import os
import sys
import json
import subprocess
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "output"
LEADS_FILE = OUTPUT_DIR / "leads.json"
OUTPUT_DIR.mkdir(exist_ok=True)

sys.path.insert(0, str(Path(__file__).resolve().parent))

app = FastAPI(title="Lead Scraper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScrapeRequest(BaseModel):
    query: str
    limit: int = 50
    headless: bool = True


def run_scraper(query: str, limit: int, headless: bool):
    """Run the scraper in-process and save outputs."""
    try:
        import asyncio
        from scrape_custom import run

        results = asyncio.run(
            run(
                query=query,
                limit=limit,
                output_dir=str(OUTPUT_DIR),
                headless=headless,
                slow_mo=0,
            )
        )
        leads = results.get("custom", [])

        # Also persist a stable copy the dashboard reads first
        with open(LEADS_FILE, "w", encoding="utf-8") as f:
            json.dump(leads, f, indent=2, ensure_ascii=False)

        return {"success": True, "count": len(leads)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/scrape")
async def scrape(request: ScrapeRequest, background_tasks: BackgroundTasks):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    if request.limit < 1 or request.limit > 500:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 500")

    # Run synchronously so we can return the count
    result = run_scraper(request.query, request.limit, request.headless)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/leads")
async def get_leads():
    # Read the latest scrape output (custom.json or karachi_*.json)
    latest_file = OUTPUT_DIR / "custom.json"
    if not latest_file.exists():
        # fallback to any karachi_* or karachi file
        candidates = sorted(
            OUTPUT_DIR.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if not candidates:
            return {"leads": [], "count": 0}
        latest_file = candidates[0]
    try:
        with open(latest_file, "r", encoding="utf-8") as f:
            leads = json.load(f)
        return {"leads": leads, "count": len(leads)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/leads")
async def clear_leads():
    if LEADS_FILE.exists():
        LEADS_FILE.unlink()
    return {"message": "Leads cleared"}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
