"""
Leads router — paginated leads, search, diff, streaming export.
All endpoints require authentication. Access is gated by campaign ownership.
"""

import csv
import io
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from dependencies import get_current_user
from models import LeadsPageResponse
from services.projects import ProjectService
from services.scrapes import ScrapeService

router = APIRouter(tags=["leads"])


async def _verify_scrape_ownership(scrape_id: str, user: dict) -> dict:
    """
    Fetch a scrape and verify the calling user owns its parent campaign.
    Returns the scrape doc. Raises 404 if either is not found or not owned.
    """
    scrape = await ScrapeService.get_scrape(scrape_id)
    await ProjectService.get_project(scrape["project_id"], user_id=str(user["_id"]))
    return scrape


# ── paginated leads ───────────────────────────────────────────────────────────

@router.get("/api/scrapes/{scrape_id}/leads", response_model=LeadsPageResponse)
async def get_scrape_leads(
    scrape_id: str,
    page: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query(None),
    user: dict = Depends(get_current_user),
):
    """Fetch paginated leads from a scrape owned by the user."""
    await _verify_scrape_ownership(scrape_id, user)

    if search:
        leads, total, has_more = await ScrapeService.search_leads_in_scrape(
            scrape_id, search, page, limit
        )
    else:
        leads, total, has_more = await ScrapeService.get_scrape_leads_page(
            scrape_id, page, limit
        )

    return LeadsPageResponse(leads=leads, total=total, page=page, has_more=has_more)


# ── diff ──────────────────────────────────────────────────────────────────────

@router.post("/api/scrapes/{scrape_id1}/diff/{scrape_id2}")
async def compute_scrape_diff(
    scrape_id1: str,
    scrape_id2: str,
    user: dict = Depends(get_current_user),
):
    """Compute diff between two scrapes. Both must belong to the user."""
    await _verify_scrape_ownership(scrape_id1, user)
    await _verify_scrape_ownership(scrape_id2, user)
    return await ScrapeService.compute_diff(scrape_id1, scrape_id2)


# ── streaming export ──────────────────────────────────────────────────────────

@router.get("/api/scrapes/{scrape_id}/export")
async def export_scrape(
    scrape_id: str,
    format: str = Query("json", pattern="^(json|csv)$"),
    user: dict = Depends(get_current_user),
):
    """
    Stream scrape leads as JSON or CSV. No full in-memory load —
    the MongoDB cursor is iterated and chunks are yielded directly.
    """
    scrape = await _verify_scrape_ownership(scrape_id, user)
    leads = scrape.get("leads", [])

    if format == "json":
        metadata = {
            "scrape_id": scrape_id,
            "query": scrape.get("query"),
            "scraped_at": scrape.get("scraped_at").isoformat() if scrape.get("scraped_at") else None,
            "leads_count": len(leads),
        }

        def _json_stream():
            yield '{"metadata": '
            yield json.dumps(metadata, default=str)
            yield ', "leads": ['
            for i, lead in enumerate(leads):
                prefix = "" if i == 0 else ","
                yield prefix + json.dumps(lead, default=str, ensure_ascii=False)
            yield "]}"

        return StreamingResponse(
            _json_stream(),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=scrape_{scrape_id}.json"},
        )

    else:  # csv
        def _csv_stream():
            buf = io.StringIO()
            if not leads:
                yield ""
                return
            writer = csv.DictWriter(buf, fieldnames=list(leads[0].keys()))
            writer.writeheader()
            yield buf.getvalue()
            for lead in leads:
                buf = io.StringIO()
                writer = csv.DictWriter(buf, fieldnames=list(leads[0].keys()))
                writer.writerow(lead)
                yield buf.getvalue()

        return StreamingResponse(
            _csv_stream(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=scrape_{scrape_id}.csv"},
        )
