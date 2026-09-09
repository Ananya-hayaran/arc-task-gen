"""
token_server.py

Mints short-lived LiveKit room-join tokens for the frontend. This is the
ONLY place LIVEKIT_API_KEY / LIVEKIT_API_SECRET are read; the frontend never
sees them, and RIME_API_KEY is never referenced here at all — Rime is only
ever called from agent.py, server-side.

Run: uvicorn token_server:app --port 8000 --reload
"""

from __future__ import annotations

import os
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from livekit import api
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="FlowVoice token server")

# Dev-friendly CORS; tighten allow_origins before a public deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TokenRequest(BaseModel):
    room: str | None = None
    identity: str | None = None


@app.post("/token")
def create_token(req: TokenRequest) -> dict:
    api_key = os.environ.get("LIVEKIT_API_KEY")
    api_secret = os.environ.get("LIVEKIT_API_SECRET")
    livekit_url = os.environ.get("LIVEKIT_URL")
    if not (api_key and api_secret and livekit_url):
        raise HTTPException(500, "Server is missing LIVEKIT_API_KEY/SECRET/URL")

    room = req.room or f"flowvoice-{uuid.uuid4().hex[:8]}"
    identity = req.identity or f"user-{uuid.uuid4().hex[:6]}"

    token = (
        api.AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_name(identity)
        .with_grants(api.VideoGrants(room_join=True, room=room))
        .to_jwt()
    )
    return {"token": token, "url": livekit_url, "room": room, "identity": identity}


@app.get("/health")
def health() -> dict:
    return {"ok": True}
