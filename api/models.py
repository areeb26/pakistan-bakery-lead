"""
MongoDB models and schemas for the lead scraper API.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class ScrapeStatus(str, Enum):
    """Scrape status values."""
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


# ==================== REQUEST/RESPONSE MODELS ====================


class Lead(BaseModel):
    """Individual lead data."""
    lead_id: str
    type: str
    business_name: str
    category: str
    address: str
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    plus_code: Optional[str] = None
    hours: Optional[str] = None
    gmaps_url: str
    search_query: str
    scraped_at: str


class DateRange(BaseModel):
    """Date range for project summary."""
    first_scrape: Optional[datetime] = None
    last_scrape: Optional[datetime] = None


class ProjectSummary(BaseModel):
    """Project summary statistics."""
    total_leads: int = 0
    scrape_count: int = 0
    avg_rating: Optional[float] = None
    leads_with_phone: int = 0
    leads_with_website: int = 0
    date_range: DateRange = Field(default_factory=DateRange)


class ScheduleConfig(BaseModel):
    """Scrape schedule configuration."""
    cron_expression: str
    enabled: bool = False
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None


class ProjectCreateRequest(BaseModel):
    """Request to create a project."""
    name: str
    description: Optional[str] = None


class ProjectUpdateRequest(BaseModel):
    """Request to update a project."""
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[ScheduleConfig] = None


class ProjectResponse(BaseModel):
    """Project response."""
    id: str = Field(alias="_id")
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    summary: ProjectSummary
    last_scrape_id: Optional[str] = None
    is_scheduled: bool = False
    schedule: Optional[ScheduleConfig] = None

    class Config:
        populate_by_name = True


class ScrapeRequest(BaseModel):
    """Request to start a scrape."""
    campaign_id: str
    query: str
    limit: int = 50
    headless: bool = True


class ScrapeResponse(BaseModel):
    """Response after starting a scrape."""
    scrape_id: str
    campaign_id: str
    status: str
    created_at: datetime


class ScrapeProgressResponse(BaseModel):
    """Real-time scrape progress."""
    scrape_id: str
    status: str
    progress_percent: int
    leads_collected: int
    current_query: str
    started_at: datetime
    estimated_completion: Optional[datetime] = None


class ScrapeHistoryItem(BaseModel):
    """Scrape history item (brief)."""
    id: str = Field(alias="_id")
    query: str
    leads_count: int
    scraped_at: datetime
    status: str

    class Config:
        populate_by_name = True


class ScrapeDetailResponse(BaseModel):
    """Full scrape details with first page of leads."""
    id: str = Field(alias="_id")
    project_id: str
    query: str
    status: str
    leads_count: int
    leads: List[Lead]
    scraped_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        populate_by_name = True


class LeadsPageResponse(BaseModel):
    """Paginated leads response."""
    leads: List[Lead]
    total: int
    page: int
    has_more: bool


class DiffLead(BaseModel):
    """Lead with change indicator in diff."""
    lead_id: str
    business_name: str
    address: str
    change_type: str  # "new", "deleted", "updated"
    changes: Optional[Dict[str, Dict[str, Any]]] = None  # {field: {old, new}}


class DiffResponse(BaseModel):
    """Diff between two scrapes."""
    new_leads: List[DiffLead]
    deleted_leads: List[DiffLead]
    updated_leads: List[DiffLead]
    stats: Dict[str, int]  # {added, deleted, updated, total_change}


class ExportFormat(str, Enum):
    """Export format."""
    JSON = "json"
    CSV = "csv"


class ScheduleUpdateRequest(BaseModel):
    """Request to update schedule."""
    enabled: bool
    cron_expression: str


# ==================== AUTH MODELS ====================

class RegisterRequest(BaseModel):
    """User registration payload."""
    email: str
    password: str


class LoginRequest(BaseModel):
    """User login payload."""
    email: str
    password: str


class TokenResponse(BaseModel):
    """Access token returned after login or refresh."""
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public user representation (no password fields)."""
    id: str
    email: str
    plan: str
    created_at: datetime
