"""
MongoDB connection and database setup.

In mock mode (no MongoDB available) we use a pure-Python async in-memory
store that implements the same Motor interface the service layer calls:
  - collection.insert_one(doc)       → InsertOneResult
  - collection.find_one(filter)      → dict | None
  - collection.find(filter)          → AsyncCursor  (.sort/.skip/.limit/.to_list)
  - collection.update_one(f, update) → UpdateResult
  - collection.find_one_and_update() → dict | None
  - collection.delete_one(filter)    → DeleteResult
  - collection.delete_many(filter)   → DeleteResult
  - collection.count_documents(f)    → int
  - collection.create_index(...)     → (no-op)
"""

import os
import copy
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from datetime import datetime, timezone
from bson import ObjectId

# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

MONGO_URL = os.getenv(
    "MONGO_URL",
    "mongodb+srv://mamoareeb_db_user:4!8-7Lp!V4bRhus@cluster0.juzmgmz.mongodb.net/?appName=Cluster0"
)

DB_NAME = "bakery_leads"
USERS_COLLECTION = "users"
PROJECTS_COLLECTION = "projects"
SCRAPES_COLLECTION = "scrapes"
PROGRESS_COLLECTION = "scrape_progress"

db = None
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"


# ──────────────────────────────────────────────────────────────────────────────
# Async in-memory mock
# ──────────────────────────────────────────────────────────────────────────────

def _matches(doc: dict, filter: dict) -> bool:
    """Return True if doc satisfies the filter (equality only, supports ObjectId _id)."""
    for key, value in filter.items():
        doc_val = doc.get(key)
        # ObjectId comparison: allow comparing ObjectId to ObjectId or str
        if key == "_id":
            if isinstance(value, ObjectId):
                if str(doc_val) != str(value):
                    return False
            else:
                if str(doc_val) != str(value):
                    return False
        else:
            if doc_val != value:
                return False
    return True


def _apply_update(doc: dict, update: dict) -> dict:
    """Apply a MongoDB update operator dict ($set, $push, $inc …) to a doc copy."""
    doc = copy.deepcopy(doc)
    for operator, fields in update.items():
        if operator == "$set":
            for k, v in fields.items():
                doc[k] = v
        elif operator == "$push":
            for k, v in fields.items():
                doc.setdefault(k, []).append(v)
        elif operator == "$inc":
            for k, v in fields.items():
                doc[k] = doc.get(k, 0) + v
        # Other operators ignored for now
    return doc


class _InsertOneResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _UpdateResult:
    def __init__(self, matched, modified):
        self.matched_count = matched
        self.modified_count = modified


class _DeleteResult:
    def __init__(self, deleted):
        self.deleted_count = deleted


class _AsyncCursor:
    """Chainable cursor that yields docs from an in-memory list."""

    def __init__(self, docs: List[dict]):
        self._docs = list(docs)  # copy so chaining doesn't mutate source

    def sort(self, key_or_list, direction=None):
        if isinstance(key_or_list, str):
            pairs = [(key_or_list, direction if direction is not None else ASCENDING)]
        else:
            pairs = key_or_list  # list of (key, direction) tuples

        for key, direction in reversed(pairs):
            reverse = (direction == DESCENDING or direction == -1)
            self._docs.sort(
                key=lambda d: (d.get(key) is None, d.get(key)),
                reverse=reverse,
            )
        return self

    def skip(self, n: int):
        self._docs = self._docs[n:]
        return self

    def limit(self, n: int):
        if n and n > 0:
            self._docs = self._docs[:n]
        return self

    async def to_list(self, length=None):
        if length is None:
            return list(self._docs)
        return list(self._docs[:length])

    def __aiter__(self):
        self._iter_index = 0
        return self

    async def __anext__(self):
        if self._iter_index >= len(self._docs):
            raise StopAsyncIteration
        doc = self._docs[self._iter_index]
        self._iter_index += 1
        return doc


class _MockCollection:
    """Async-compatible in-memory collection."""

    def __init__(self):
        self._docs: List[Dict[str, Any]] = []

    # ── write operations ──────────────────────────────────────────────────────

    async def insert_one(self, doc: dict) -> _InsertOneResult:
        doc = copy.deepcopy(doc)
        if "_id" not in doc:
            doc["_id"] = ObjectId()
        self._docs.append(doc)
        return _InsertOneResult(doc["_id"])

    async def update_one(self, filter: dict, update: dict, upsert=False) -> _UpdateResult:
        for i, doc in enumerate(self._docs):
            if _matches(doc, filter):
                self._docs[i] = _apply_update(doc, update)
                return _UpdateResult(1, 1)
        if upsert:
            new_doc = copy.deepcopy(filter)
            new_doc = _apply_update(new_doc, update)
            if "_id" not in new_doc:
                new_doc["_id"] = ObjectId()
            self._docs.append(new_doc)
            return _UpdateResult(0, 1)
        return _UpdateResult(0, 0)

    async def update_many(self, filter: dict, update: dict) -> _UpdateResult:
        modified = 0
        for i, doc in enumerate(self._docs):
            if _matches(doc, filter):
                self._docs[i] = _apply_update(doc, update)
                modified += 1
        return _UpdateResult(modified, modified)

    async def find_one_and_update(
        self,
        filter: dict,
        update: dict,
        return_document=None,
        upsert=False,
    ) -> Optional[dict]:
        for i, doc in enumerate(self._docs):
            if _matches(doc, filter):
                updated = _apply_update(doc, update)
                self._docs[i] = updated
                return copy.deepcopy(updated)
        return None

    async def delete_one(self, filter: dict) -> _DeleteResult:
        for i, doc in enumerate(self._docs):
            if _matches(doc, filter):
                self._docs.pop(i)
                return _DeleteResult(1)
        return _DeleteResult(0)

    async def delete_many(self, filter: dict) -> _DeleteResult:
        before = len(self._docs)
        self._docs = [d for d in self._docs if not _matches(d, filter)]
        return _DeleteResult(before - len(self._docs))

    # ── read operations ───────────────────────────────────────────────────────

    async def find_one(self, filter: dict = None) -> Optional[dict]:
        for doc in self._docs:
            if not filter or _matches(doc, filter):
                return copy.deepcopy(doc)
        return None

    def find(self, filter: dict = None) -> _AsyncCursor:
        if filter:
            matched = [copy.deepcopy(d) for d in self._docs if _matches(d, filter)]
        else:
            matched = [copy.deepcopy(d) for d in self._docs]
        return _AsyncCursor(matched)

    async def count_documents(self, filter: dict = None) -> int:
        if not filter:
            return len(self._docs)
        return sum(1 for d in self._docs if _matches(d, filter))

    # ── index (no-op) ─────────────────────────────────────────────────────────

    async def create_index(self, keys, **kwargs):
        pass  # indexes have no effect in mock mode


class _MockDatabase:
    """Dict-backed database that hands out _MockCollection instances."""

    def __init__(self):
        self._collections: Dict[str, _MockCollection] = {}

    def __getitem__(self, name: str) -> _MockCollection:
        if name not in self._collections:
            self._collections[name] = _MockCollection()
        return self._collections[name]

    def get_collection(self, name: str) -> _MockCollection:
        return self[name]


# ──────────────────────────────────────────────────────────────────────────────
# Public connection API
# ──────────────────────────────────────────────────────────────────────────────

async def connect_db():
    """Connect to MongoDB, or fall back to the async in-memory mock."""
    global db, USE_MOCK

    if USE_MOCK:
        print("⚠️  Using in-memory mock database (set MONGO_URL for real MongoDB)", flush=True)
        db = _MockDatabase()
        return

    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        await client.admin.command("ping")
        db = client[DB_NAME]
        print("✓ Connected to MongoDB", flush=True)
        await setup_indexes()
    except Exception as e:
        print(f"⚠️  MongoDB unavailable ({str(e)[:50]}...), switching to mock mode", flush=True)
        USE_MOCK = True
        db = _MockDatabase()


async def disconnect_db():
    """Disconnect from MongoDB (no-op in mock mode)."""
    global db
    if db and not isinstance(db, _MockDatabase):
        db.client.close()
        print("✓ Disconnected from MongoDB", flush=True)


async def setup_indexes():
    """Create necessary MongoDB indexes (Motor / real DB only)."""
    try:
        users_col = db[USERS_COLLECTION]
        await users_col.create_index([("email", ASCENDING)], unique=True)

        projects_col = db[PROJECTS_COLLECTION]
        await projects_col.create_index([("created_at", DESCENDING)])
        await projects_col.create_index([("name", ASCENDING)])

        scrapes_col = db[SCRAPES_COLLECTION]
        await scrapes_col.create_index([("project_id", ASCENDING)])
        await scrapes_col.create_index([("project_id", ASCENDING), ("scraped_at", DESCENDING)])
        await scrapes_col.create_index([("status", ASCENDING)])

        progress_col = db[PROGRESS_COLLECTION]
        await progress_col.create_index([("scrape_id", ASCENDING)])
        await progress_col.create_index(
            [("last_updated", ASCENDING)],
            expireAfterSeconds=3600,
        )
        print("✓ MongoDB indexes created", flush=True)
    except Exception as e:
        print(f"✗ Failed to create indexes: {e}", flush=True)
        raise


def get_db():
    """Return the active database (Motor or mock)."""
    if db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return db
