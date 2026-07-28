"""
User service — database operations for the users collection.
"""

from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import HTTPException

from db import get_db, USERS_COLLECTION


class UserService:
    """CRUD operations for the users collection."""

    @staticmethod
    async def create_user(email: str, password_hash: str) -> dict:
        """
        Insert a new user. Returns the created user doc.
        Raises 409 if the email already exists.
        """
        db = get_db()
        col = db[USERS_COLLECTION]

        existing = await col.find_one({"email": email.lower()})
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        now = datetime.now(timezone.utc)
        doc = {
            "email": email.lower(),
            "password_hash": password_hash,
            "plan": "free",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        result = await col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    @staticmethod
    async def get_by_email(email: str) -> Optional[dict]:
        """Return the user doc for the given email, or None."""
        db = get_db()
        col = db[USERS_COLLECTION]
        return await col.find_one({"email": email.lower()})

    @staticmethod
    async def get_by_id(user_id: str) -> Optional[dict]:
        """Return the user doc for the given ID, or None."""
        db = get_db()
        col = db[USERS_COLLECTION]
        try:
            return await col.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None
