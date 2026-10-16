"""Flatten one record of the reference users API into a table row."""

from __future__ import annotations

import json


def flatten_user(user: dict) -> dict:
    address = user.get("address") or {}
    return {
        "user_id": user["id"],
        "first_name": user.get("firstName"),
        "last_name": user.get("lastName"),
        "email": user.get("email"),
        "username": user.get("username"),
        "phone": user.get("phone"),
        "city": address.get("city"),
        "country": address.get("country"),
        "company": (user.get("company") or {}).get("name"),
        "birth_date": user.get("birthDate"),
        "raw_json": json.dumps(user, sort_keys=True),
    }
