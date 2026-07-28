"""
Scheduled scraping with APScheduler.
"""

from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from db import get_db, PROJECTS_COLLECTION, SCRAPES_COLLECTION
from services.scrapes import ScrapeService
from services.projects import ProjectService

scheduler: AsyncIOScheduler = None


async def init_scheduler():
    """Initialize APScheduler."""
    global scheduler
    try:
        from db import USE_MOCK
        if USE_MOCK:
            print("⚠️  Skipping scheduler in mock mode", flush=True)
            return
        
        scheduler = AsyncIOScheduler()
        scheduler.start()
        await load_scheduled_projects()
        print("✓ Scheduler initialized", flush=True)
    except Exception as e:
        print(f"✗ Failed to initialize scheduler: {e}", flush=True)
        raise


async def shutdown_scheduler():
    """Shutdown APScheduler."""
    global scheduler
    if scheduler:
        scheduler.shutdown()
        print("✓ Scheduler shutdown", flush=True)


async def load_scheduled_projects():
    """Load all scheduled projects and add them to the scheduler."""
    global scheduler
    if not scheduler:
        return

    db = get_db()
    projects_col = db[PROJECTS_COLLECTION]

    # Find all projects with scheduling enabled
    scheduled = await projects_col.find(
        {"is_scheduled": True, "schedule.enabled": True}
    ).to_list(None)

    for project in scheduled:
        schedule = project.get("schedule")
        if schedule and schedule.get("cron_expression"):
            project_id = str(project["_id"])
            cron_expr = schedule["cron_expression"]

            # Remove existing job if present
            job_id = f"scrape_{project_id}"
            if scheduler.get_job(job_id):
                scheduler.remove_job(job_id)

            # Add new job
            try:
                trigger = CronTrigger.from_crontab(cron_expr)
                scheduler.add_job(
                    scheduled_scrape,
                    trigger=trigger,
                    id=job_id,
                    args=[project_id],
                    replace_existing=True,
                )
                print(f"✓ Scheduled project {project_id} with cron: {cron_expr}", flush=True)
            except Exception as e:
                print(f"✗ Failed to schedule project {project_id}: {e}", flush=True)


async def scheduled_scrape(project_id: str):
    """Execute a scheduled scrape for a project."""
    try:
        db = get_db()
        projects_col = db[PROJECTS_COLLECTION]
        from bson import ObjectId

        project = await projects_col.find_one({"_id": ObjectId(project_id)})
        if not project:
            print(f"✗ Project {project_id} not found", flush=True)
            return

        # Create scrape with default query from last scrape or a default
        scrapes_col = db[SCRAPES_COLLECTION]
        last_scrape = await scrapes_col.find_one(
            {"project_id": project_id},
            sort=[("scraped_at", -1)],
        )

        query = last_scrape.get("query", "bakeries in Karachi") if last_scrape else "bakeries in Karachi"

        scrape_id = await ScrapeService.create_scrape(project_id, query, limit=50)

        # Run scraper via the routers module (avoids circular import with main)
        from routers.scrapes import _run_scraper_background
        await _run_scraper_background(scrape_id, query, 50, headless=True)

        # Update schedule's last_run and next_run
        next_run_time = None
        job = scheduler.get_job(f"scrape_{project_id}")
        if job and job.next_run_time:
            next_run_time = job.next_run_time

        await projects_col.update_one(
            {"_id": ObjectId(project_id)},
            {
                "$set": {
                    "schedule.last_run": datetime.now(timezone.utc),
                    "schedule.next_run": next_run_time,
                }
            },
        )

        print(f"✓ Scheduled scrape completed for project {project_id}", flush=True)
    except Exception as e:
        print(f"✗ Scheduled scrape failed for project {project_id}: {e}", flush=True)


async def update_schedule(project_id: str, enabled: bool, cron_expression: str):
    """Update or create a schedule for a project."""
    global scheduler
    if not scheduler:
        return

    db = get_db()
    projects_col = db[PROJECTS_COLLECTION]
    from bson import ObjectId

    job_id = f"scrape_{project_id}"

    if enabled and cron_expression:
        # Remove existing job if present
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)

        # Add new job
        try:
            trigger = CronTrigger.from_crontab(cron_expression)
            scheduler.add_job(
                scheduled_scrape,
                trigger=trigger,
                id=job_id,
                args=[project_id],
                replace_existing=True,
            )
            print(f"✓ Updated schedule for project {project_id}", flush=True)
        except Exception as e:
            print(f"✗ Failed to update schedule: {e}", flush=True)
            raise
    else:
        # Remove job
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
            print(f"✓ Removed schedule for project {project_id}", flush=True)
