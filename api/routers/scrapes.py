"""
Scrapes router — start scrapes, poll progress, view history.
All endpoints require authentication. Scrapes are accessed only
through campaigns the authenticated user owns.
"""

import json
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Depends

from dependencies import get_current_user
from models import ScrapeRequest, ScrapeResponse, ScrapeProgressResponse, ScrapeStatus
from services.projects import ProjectService
from services.scrapes import ScrapeService

router = APIRouter(tags=["scrapes"])

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


# ── background scraper ────────────────────────────────────────────────────────

async def _run_scraper_background(scrape_id: str, query: str, limit: int, headless: bool):
    """Background task: run Playwright scraper and persist leads."""
    try:
        from scrape_custom import run
        from db import get_db, SCRAPES_COLLECTION
        from bson import ObjectId

        results = await run(
            query=query,
            limit=limit,
            output_dir=str(OUTPUT_DIR),
            headless=headless,
            slow_mo=0,
        )
        leads_raw = results.get("custom", [])

        db = get_db()
        scrape = await db[SCRAPES_COLLECTION].find_one({"_id": ObjectId(scrape_id)})
        if scrape:
            await ScrapeService.update_scrape_with_leads(scrape_id, leads_raw, partial=False)
            project_id = scrape.get("project_id")
            if project_id:
                await ProjectService.refresh_project_summary(project_id)

        print(f"✓ Scrape {scrape_id} completed with {len(leads_raw)} leads", flush=True)
    except Exception as exc:
        print(f"✗ Scrape {scrape_id} failed: {exc}", flush=True)
        await ScrapeService.mark_scrape_failed(scrape_id, str(exc))


# ── start scrape ──────────────────────────────────────────────────────────────

@router.post("/api/scrapes", response_model=ScrapeResponse, status_code=202)
async def start_scrape(
    body: ScrapeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Start a new async scrape on a campaign the user owns."""
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    if body.limit < 1 or body.limit > 1000:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 1000")

    # Verify the campaign belongs to the current user (raises 404 if not)
    await ProjectService.get_project(body.campaign_id, user_id=str(user["_id"]))

    scrape_id = await ScrapeService.create_scrape(body.campaign_id, body.query, body.limit)

    background_tasks.add_task(
        _run_scraper_background, scrape_id, body.query, body.limit, body.headless
    )

    import datetime
    return ScrapeResponse(
        scrape_id=scrape_id,
        campaign_id=body.campaign_id,
        status=ScrapeStatus.RUNNING,
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )


# ── scrape progress ───────────────────────────────────────────────────────────

@router.get("/api/scrapes/{scrape_id}/progress", response_model=ScrapeProgressResponse)
async def get_scrape_progress(
    scrape_id: str,
    user: dict = Depends(get_current_user),
):
    """Poll real-time scrape progress. Only accessible to the campaign owner."""
    scrape = await ScrapeService.get_scrape(scrape_id)

    # Ownership: verify the campaign belongs to the calling user
    await ProjectService.get_project(scrape["project_id"], user_id=str(user["_id"]))

    status = scrape.get("status", ScrapeStatus.RUNNING)
    leads_count = len(scrape.get("leads", []))
    leads_total = scrape.get("leads_count", 0)

    if status == ScrapeStatus.COMPLETED:
        progress_percent = 100
    elif status == ScrapeStatus.RUNNING:
        progress_percent = min(50 + int((leads_count / max(leads_total, 1)) * 50), 99)
    else:
        progress_percent = 0

    return ScrapeProgressResponse(
        scrape_id=scrape_id,
        status=status,
        progress_percent=progress_percent,
        leads_collected=leads_count,
        current_query=scrape.get("query", ""),
        started_at=scrape.get("scraped_at"),
        estimated_completion=scrape.get("completed_at"),
    )


# ── scrape history for a campaign ─────────────────────────────────────────────

@router.get("/api/campaigns/{campaign_id}/scrapes")
async def get_campaign_scrapes(
    campaign_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """Get scrape history for a campaign the user owns."""
    # Ownership check — raises 404 if campaign not owned by user
    await ProjectService.get_project(campaign_id, user_id=str(user["_id"]))

    scrapes, total = await ScrapeService.get_project_scrapes(campaign_id, skip, limit)

    return {
        "scrapes": [
            {
                "_id": str(scrape["_id"]),
                "query": scrape.get("query"),
                "leads_count": scrape.get("leads_count", 0),
                "scraped_at": scrape.get("scraped_at"),
                "status": scrape.get("status"),
            }
            for scrape in scrapes
        ],
        "total": total,
    }
