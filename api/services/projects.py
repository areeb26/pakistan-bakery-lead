"""
Project service for CRUD operations.
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from bson import ObjectId
from fastapi import HTTPException

from db import get_db, PROJECTS_COLLECTION, SCRAPES_COLLECTION
from models import ProjectCreateRequest, ProjectUpdateRequest, ProjectResponse, ProjectSummary, DateRange, ScheduleConfig


class ProjectService:
    """Service for project operations."""

    @staticmethod
    async def create_project(request: ProjectCreateRequest, user_id: str = None) -> ProjectResponse:
        """Create a new project."""
        db = get_db()
        projects_col = db[PROJECTS_COLLECTION]

        now = datetime.now(timezone.utc)
        project_doc = {
            "name": request.name,
            "description": request.description or "",
            "created_at": now,
            "updated_at": now,
            "created_by": user_id or "user",
            "summary": {
                "total_leads": 0,
                "scrape_count": 0,
                "avg_rating": None,
                "leads_with_phone": 0,
                "leads_with_website": 0,
                "date_range": {
                    "first_scrape": None,
                    "last_scrape": None,
                },
            },
            "last_scrape_id": None,
            "is_scheduled": False,
            "schedule": None,
        }

        result = await projects_col.insert_one(project_doc)
        project_doc["_id"] = result.inserted_id

        return ProjectResponse(**ProjectService._doc_to_response(project_doc))

    @staticmethod
    async def get_all_projects(user_id: str = None) -> List[ProjectResponse]:
        """Get all projects with summaries, optionally scoped to a user."""
        db = get_db()
        projects_col = db[PROJECTS_COLLECTION]

        query = {"created_by": user_id} if user_id else {}
        projects = await projects_col.find(query).sort("created_at", -1).to_list(None)

        return [
            ProjectResponse(**ProjectService._doc_to_response(p))
            for p in projects
        ]

    @staticmethod
    async def get_project(project_id: str, user_id: str = None) -> ProjectResponse:
        """Get a single project by ID, optionally enforcing user ownership."""
        db = get_db()
        projects_col = db[PROJECTS_COLLECTION]

        try:
            query = {"_id": ObjectId(project_id)}
            if user_id:
                query["created_by"] = user_id
            project = await projects_col.find_one(query)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid project ID")

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        return ProjectResponse(**ProjectService._doc_to_response(project))

    @staticmethod
    async def update_project(project_id: str, request: ProjectUpdateRequest, user_id: str = None) -> ProjectResponse:
        """Update a project, optionally enforcing user ownership."""
        db = get_db()
        projects_col = db[PROJECTS_COLLECTION]

        try:
            oid = ObjectId(project_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid project ID")

        update_data = {"updated_at": datetime.now(timezone.utc)}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.schedule is not None:
            update_data["is_scheduled"] = request.schedule.enabled
            update_data["schedule"] = request.schedule.model_dump()

        filter_q = {"_id": oid}
        if user_id:
            filter_q["created_by"] = user_id

        result = await projects_col.find_one_and_update(
            filter_q,
            {"$set": update_data},
            return_document=True,
        )

        if not result:
            raise HTTPException(status_code=404, detail="Project not found")

        return ProjectResponse(**ProjectService._doc_to_response(result))

    @staticmethod
    async def delete_project(project_id: str, user_id: str = None) -> Dict[str, str]:
        """Delete a project and all its scrapes, optionally enforcing user ownership."""
        db = get_db()
        projects_col = db[PROJECTS_COLLECTION]
        scrapes_col = db[SCRAPES_COLLECTION]

        try:
            oid = ObjectId(project_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid project ID")

        filter_q = {"_id": oid}
        if user_id:
            filter_q["created_by"] = user_id

        result = await projects_col.delete_one(filter_q)
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Project not found")

        # Delete all scrapes for this project
        await scrapes_col.delete_many({"project_id": project_id})

        return {"message": "Project deleted successfully"}

    @staticmethod
    async def refresh_project_summary(project_id: str) -> None:
        """Recalculate and update project summary from scrapes."""
        db = get_db()
        projects_col = db[PROJECTS_COLLECTION]
        scrapes_col = db[SCRAPES_COLLECTION]

        scrapes = await scrapes_col.find(
            {"project_id": project_id, "status": "completed"}
        ).to_list(None)

        if not scrapes:
            summary = {
                "total_leads": 0,
                "scrape_count": 0,
                "avg_rating": None,
                "leads_with_phone": 0,
                "leads_with_website": 0,
                "date_range": {"first_scrape": None, "last_scrape": None},
            }
        else:
            # Aggregate stats
            total_leads = 0
            total_rating = 0
            count_rating = 0
            leads_with_phone = 0
            leads_with_website = 0
            dates = []

            for scrape in scrapes:
                leads = scrape.get("leads", [])
                total_leads += len(leads)
                dates.append(scrape.get("scraped_at"))

                for lead in leads:
                    if lead.get("rating"):
                        total_rating += lead["rating"]
                        count_rating += 1
                    if lead.get("phone"):
                        leads_with_phone += 1
                    if lead.get("website"):
                        leads_with_website += 1

            summary = {
                "total_leads": total_leads,
                "scrape_count": len(scrapes),
                "avg_rating": round(total_rating / count_rating, 2) if count_rating > 0 else None,
                "leads_with_phone": leads_with_phone,
                "leads_with_website": leads_with_website,
                "date_range": {
                    "first_scrape": min(dates) if dates else None,
                    "last_scrape": max(dates) if dates else None,
                },
            }

        await projects_col.update_one(
            {"_id": ObjectId(project_id)},
            {"$set": {"summary": summary}},
        )

    @staticmethod
    def _doc_to_response(doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convert MongoDB document to response format."""
        return {
            "_id": str(doc["_id"]),
            "name": doc.get("name"),
            "description": doc.get("description"),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
            "summary": doc.get("summary", {}),
            "last_scrape_id": doc.get("last_scrape_id"),
            "is_scheduled": doc.get("is_scheduled", False),
            "schedule": doc.get("schedule"),
        }
