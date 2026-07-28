"""
Campaigns router — CRUD for campaigns (formerly "projects"), user-scoped.
Every endpoint requires a valid Bearer token and only touches
campaigns that belong to the authenticated user.
"""

from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_current_user
from models import ProjectCreateRequest, ProjectUpdateRequest, ProjectResponse, ScheduleUpdateRequest
from services.projects import ProjectService
from scheduler import update_schedule as update_schedule_job

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


@router.post("", status_code=201, response_model=ProjectResponse)
async def create_campaign(
    body: ProjectCreateRequest,
    user: dict = Depends(get_current_user),
):
    """Create a new campaign for the authenticated user."""
    return await ProjectService.create_project(body, user_id=str(user["_id"]))


@router.get("")
async def list_campaigns(user: dict = Depends(get_current_user)):
    """List campaigns belonging to the authenticated user."""
    campaigns = await ProjectService.get_all_projects(user_id=str(user["_id"]))
    return {"campaigns": campaigns}


@router.get("/{campaign_id}", response_model=ProjectResponse)
async def get_campaign(
    campaign_id: str,
    user: dict = Depends(get_current_user),
):
    """Get a single campaign (must belong to the authenticated user)."""
    return await ProjectService.get_project(campaign_id, user_id=str(user["_id"]))


@router.put("/{campaign_id}", response_model=ProjectResponse)
async def update_campaign(
    campaign_id: str,
    body: ProjectUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Update a campaign."""
    return await ProjectService.update_project(campaign_id, body, user_id=str(user["_id"]))


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a campaign and all its scrapes."""
    return await ProjectService.delete_project(campaign_id, user_id=str(user["_id"]))


@router.put("/{campaign_id}/schedule")
async def update_schedule(
    campaign_id: str,
    body: ScheduleUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Update the scrape schedule for a campaign."""
    from models import ScheduleConfig
    schedule = ScheduleConfig(
        cron_expression=body.cron_expression,
        enabled=body.enabled,
    )
    result = await ProjectService.update_project(
        campaign_id,
        ProjectUpdateRequest(schedule=schedule),
        user_id=str(user["_id"]),
    )
    await update_schedule_job(campaign_id, body.enabled, body.cron_expression)
    return {
        "campaign_id": campaign_id,
        "schedule": {"enabled": body.enabled, "cron_expression": body.cron_expression},
    }


@router.get("/{campaign_id}/schedule")
async def get_schedule(
    campaign_id: str,
    user: dict = Depends(get_current_user),
):
    """Get schedule details for a campaign."""
    campaign = await ProjectService.get_project(campaign_id, user_id=str(user["_id"]))
    return {
        "enabled": campaign.is_scheduled,
        "cron_expression": campaign.schedule.cron_expression if campaign.schedule else None,
        "last_run": campaign.schedule.last_run if campaign.schedule else None,
        "next_run": campaign.schedule.next_run if campaign.schedule else None,
    }
