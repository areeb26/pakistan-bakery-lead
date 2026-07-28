import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db import connect_db, disconnect_db
from routers.auth import router as auth_router
from routers.campaigns import router as campaigns_router
from routers.scrapes import router as scrapes_router
from routers.leads import router as leads_router


# ── lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    from scheduler import init_scheduler
    await init_scheduler()
    yield
    from scheduler import shutdown_scheduler
    await shutdown_scheduler()
    await disconnect_db()


# ── app ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Lead Scraper API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(campaigns_router)
app.include_router(scrapes_router)
app.include_router(leads_router)


# ── health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
