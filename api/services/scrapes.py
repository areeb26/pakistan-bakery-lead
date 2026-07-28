"""
Scrape service for managing scrape operations and history.
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from bson import ObjectId
from fastapi import HTTPException

from db import get_db, SCRAPES_COLLECTION, PROJECTS_COLLECTION
from models import ScrapeStatus, Lead


class ScrapeService:
    """Service for scrape operations."""

    @staticmethod
    async def create_scrape(
        project_id: str, query: str, limit: int
    ) -> str:
        """Create a new scrape document and return its ID."""
        db = get_db()
        scrapes_col = db[SCRAPES_COLLECTION]

        now = datetime.now(timezone.utc)
        scrape_doc = {
            "project_id": project_id,
            "query": query,
            "leads": [],
            "scraped_at": now,
            "completed_at": None,
            "status": ScrapeStatus.RUNNING,
            "leads_count": 0,
            "error_message": None,
            "partial_leads_count": 0,
        }

        result = await scrapes_col.insert_one(scrape_doc)
        return str(result.inserted_id)

    @staticmethod
    async def get_scrape(scrape_id: str) -> Dict[str, Any]:
        """Get a scrape by ID."""
        db = get_db()
        scrapes_col = db[SCRAPES_COLLECTION]

        try:
            oid = ObjectId(scrape_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid scrape ID")

        scrape = await scrapes_col.find_one({"_id": oid})
        if not scrape:
            raise HTTPException(status_code=404, detail="Scrape not found")

        return scrape

    @staticmethod
    async def update_scrape_with_leads(
        scrape_id: str, leads: List[Dict[str, Any]], partial: bool = False
    ) -> None:
        """Update scrape with leads and mark as completed/partial."""
        db = get_db()
        scrapes_col = db[SCRAPES_COLLECTION]

        try:
            oid = ObjectId(scrape_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid scrape ID")

        status = ScrapeStatus.PARTIAL if partial else ScrapeStatus.COMPLETED
        now = datetime.now(timezone.utc)

        await scrapes_col.update_one(
            {"_id": oid},
            {
                "$set": {
                    "leads": leads,
                    "leads_count": len(leads),
                    "completed_at": now,
                    "status": status,
                    "partial_leads_count": len(leads) if partial else 0,
                }
            },
        )

    @staticmethod
    async def mark_scrape_failed(scrape_id: str, error: str) -> None:
        """Mark scrape as failed."""
        db = get_db()
        scrapes_col = db[SCRAPES_COLLECTION]

        try:
            oid = ObjectId(scrape_id)
        except Exception:
            return

        now = datetime.now(timezone.utc)
        await scrapes_col.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": ScrapeStatus.FAILED,
                    "completed_at": now,
                    "error_message": error,
                }
            },
        )

    @staticmethod
    async def get_project_scrapes(
        project_id: str, skip: int = 0, limit: int = 10
    ) -> tuple[List[Dict[str, Any]], int]:
        """Get scrapes for a project with pagination."""
        db = get_db()
        scrapes_col = db[SCRAPES_COLLECTION]

        total = await scrapes_col.count_documents({"project_id": project_id})

        scrapes = (
            await scrapes_col.find({"project_id": project_id})
            .sort("scraped_at", -1)
            .skip(skip)
            .limit(limit)
            .to_list(limit)
        )

        return scrapes, total

    @staticmethod
    async def get_scrape_leads_page(
        scrape_id: str, page: int = 0, limit: int = 50
    ) -> tuple[List[Dict[str, Any]], int, bool]:
        """Get paginated leads from a scrape."""
        db = get_db()
        scrapes_col = db[SCRAPES_COLLECTION]

        try:
            oid = ObjectId(scrape_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid scrape ID")

        scrape = await scrapes_col.find_one({"_id": oid})
        if not scrape:
            raise HTTPException(status_code=404, detail="Scrape not found")

        leads = scrape.get("leads", [])
        total = len(leads)

        start = page * limit
        end = start + limit
        page_leads = leads[start:end]

        has_more = end < total

        return page_leads, total, has_more

    @staticmethod
    async def search_leads_in_scrape(
        scrape_id: str, search_term: str, page: int = 0, limit: int = 50
    ) -> tuple[List[Dict[str, Any]], int, bool]:
        """Search for leads within a scrape."""
        db = get_db()
        scrapes_col = db[SCRAPES_COLLECTION]

        try:
            oid = ObjectId(scrape_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid scrape ID")

        scrape = await scrapes_col.find_one({"_id": oid})
        if not scrape:
            raise HTTPException(status_code=404, detail="Scrape not found")

        leads = scrape.get("leads", [])
        search_lower = search_term.lower()

        # Filter leads by search term
        filtered = [
            lead
            for lead in leads
            if search_lower in lead.get("business_name", "").lower()
            or search_lower in lead.get("address", "").lower()
        ]

        total = len(filtered)
        start = page * limit
        end = start + limit
        page_leads = filtered[start:end]
        has_more = end < total

        return page_leads, total, has_more

    @staticmethod
    async def compute_diff(scrape_id1: str, scrape_id2: str) -> Dict[str, Any]:
        """Compute diff between two scrapes."""
        db = get_db()
        scrapes_col = db[SCRAPES_COLLECTION]

        try:
            oid1 = ObjectId(scrape_id1)
            oid2 = ObjectId(scrape_id2)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid scrape IDs")

        scrape1 = await scrapes_col.find_one({"_id": oid1})
        scrape2 = await scrapes_col.find_one({"_id": oid2})

        if not scrape1 or not scrape2:
            raise HTTPException(status_code=404, detail="One or both scrapes not found")

        leads1 = {lead["lead_id"]: lead for lead in scrape1.get("leads", [])}
        leads2 = {lead["lead_id"]: lead for lead in scrape2.get("leads", [])}

        new_leads = []
        deleted_leads = []
        updated_leads = []

        # Find new and updated leads
        for lead_id, lead in leads2.items():
            if lead_id not in leads1:
                new_leads.append({
                    "lead_id": lead_id,
                    "business_name": lead.get("business_name"),
                    "address": lead.get("address"),
                    "change_type": "new",
                })
            else:
                # Check for updates
                changes = {}
                old_lead = leads1[lead_id]
                for key in ["phone", "website", "rating", "review_count", "hours"]:
                    if old_lead.get(key) != lead.get(key):
                        changes[key] = {
                            "old": old_lead.get(key),
                            "new": lead.get(key),
                        }

                if changes:
                    updated_leads.append({
                        "lead_id": lead_id,
                        "business_name": lead.get("business_name"),
                        "address": lead.get("address"),
                        "change_type": "updated",
                        "changes": changes,
                    })

        # Find deleted leads
        for lead_id, lead in leads1.items():
            if lead_id not in leads2:
                deleted_leads.append({
                    "lead_id": lead_id,
                    "business_name": lead.get("business_name"),
                    "address": lead.get("address"),
                    "change_type": "deleted",
                })

        return {
            "new_leads": new_leads,
            "deleted_leads": deleted_leads,
            "updated_leads": updated_leads,
            "stats": {
                "added": len(new_leads),
                "deleted": len(deleted_leads),
                "updated": len(updated_leads),
                "total_change": len(new_leads) + len(deleted_leads) + len(updated_leads),
            },
        }
