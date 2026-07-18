import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models import Board, StrokeEvent
from handlers import board_manager
from export import export_svg, export_png, export_pdf
from protection import is_protected_board, merge_additive_strokes, mutation_allowed

app = FastAPI(title="Collaborative Whiteboard")

MAX_IMAGE_BYTES = 5 * 1024 * 1024


def is_protected(board: Board) -> bool:
    return is_protected_board(board.id)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get(
            "ALLOWED_ORIGINS",
            "https://scribbly-collab.vercel.app,http://localhost:5173",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/api/boards")
def list_boards(db: Session = Depends(get_db)):
    boards = db.query(Board).order_by(Board.created_at.desc()).all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "strokes": b.strokes or [],
            "protected": is_protected(b),
        }
        for b in boards
    ]


@app.post("/api/boards")
def create_board(name: str = "Untitled", db: Session = Depends(get_db)):
    board = Board(name=name, created_at=datetime.now(timezone.utc), strokes=[])
    db.add(board)
    db.commit()
    db.refresh(board)
    board_manager.set_strokes(board.id, [])
    return {
        "id": board.id,
        "name": board.name,
        "created_at": board.created_at.isoformat(),
        "strokes": [],
    }


@app.delete("/api/boards/{board_id}")
def delete_board(board_id: int, db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.id == board_id).with_for_update().first()
    if not board:
        return Response(content='{"error":"not found"}', status_code=404, media_type="application/json")
    if is_protected(board):
        raise HTTPException(status_code=403, detail="Curated showcase plates cannot be deleted")
    db.query(StrokeEvent).filter(StrokeEvent.board_id == board_id).delete()
    db.delete(board)
    db.commit()
    return {"deleted": board_id}


@app.get("/api/boards/{board_id}")
def get_board(board_id: int, db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        return Response(content='{"error":"not found"}', status_code=404, media_type="application/json")

    # NOTE: the old code overwrote board.strokes from board_manager's in-memory
    # state here. On serverless that memory is per-instance and can be stale,
    # which clobbered the DB — the DB row is now authoritative.
    return {
        "id": board.id,
        "name": board.name,
        "created_at": board.created_at.isoformat() if board.created_at else None,
        "strokes": board.strokes or [],
        "protected": is_protected(board),
    }


class StrokesUpdate(BaseModel):
    strokes: list = []


@app.put("/api/boards/{board_id}/strokes")
def save_strokes(board_id: int, body: StrokesUpdate, db: Session = Depends(get_db)):
    """Persist the full strokes array for a board over plain REST, so drawings
    are saved without a live websocket server."""
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        return Response(content='{"error":"not found"}', status_code=404, media_type="application/json")
    if is_protected(board):
        merged, added = merge_additive_strokes(board.strokes, body.strokes)
        board.strokes = merged
        board_manager.set_strokes(board_id, merged)
        for stroke in added:
            db.add(
                StrokeEvent(
                    board_id=board_id,
                    user_id=str(stroke.get("user_id", "rest")),
                    event_type="add",
                    stroke_data=stroke,
                )
            )
        db.commit()
        return {"ok": True, "count": len(merged), "added": len(added), "protected": True}
    board.strokes = body.strokes
    board_manager.set_strokes(board_id, body.strokes)
    # Keep the session timeline in sync with the saved strokes: one "add" event
    # per stroke, so the timeline replay/scrub works without a live WS server.
    db.query(StrokeEvent).filter(StrokeEvent.board_id == board_id).delete()
    for s in body.strokes:
        db.add(StrokeEvent(board_id=board_id, user_id="rest", event_type="add", stroke_data=s))
    db.commit()
    return {"ok": True, "count": len(body.strokes)}


def _backfill_events(board_id: int, db: Session):
    """Boards created before the event log existed have strokes but no events.
    Seed one 'add' event per stroke so the timeline and polling sync work.
    Locks the board row so two concurrent first-loads don't double-backfill."""
    board = db.query(Board).filter(Board.id == board_id).with_for_update().first()
    if not board or not board.strokes:
        db.rollback()
        return
    has_events = (
        db.query(StrokeEvent.id).filter(StrokeEvent.board_id == board_id).first()
    )
    if has_events:
        db.rollback()
        return
    for s in board.strokes:
        if isinstance(s, dict):
            db.add(
                StrokeEvent(
                    board_id=board_id,
                    user_id=s.get("user_id", "seed"),
                    event_type="add",
                    stroke_data=s,
                )
            )
    db.commit()


@app.get("/api/boards/{board_id}/events")
def get_events(board_id: int, since: int = 0, db: Session = Depends(get_db)):
    """Event log for a board. `since` is an incremental cursor (last event id
    the client has seen) so polling clients receive small payloads."""
    if since <= 0:
        _backfill_events(board_id, db)
    q = db.query(StrokeEvent).filter(StrokeEvent.board_id == board_id)
    if since > 0:
        q = q.filter(StrokeEvent.id > since)
    events = q.order_by(StrokeEvent.id.asc()).all()
    return [
        {
            "id": e.id,
            "board_id": e.board_id,
            "user_id": e.user_id,
            "event_type": e.event_type,
            "stroke_data": e.stroke_data,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in events
    ]


class EventCreate(BaseModel):
    user_id: str = "anonymous"
    event_type: str  # add | update | delete | clear
    stroke_data: dict = {}


@app.post("/api/boards/{board_id}/events")
def create_event(board_id: int, body: EventCreate, db: Session = Depends(get_db)):
    """Append a stroke event to the board's log (the sync channel for polling
    clients) and apply it to the board's materialized strokes array."""
    if body.event_type not in ("add", "update", "delete", "clear"):
        return Response(
            content='{"error":"invalid event_type"}',
            status_code=422,
            media_type="application/json",
        )
    board = db.query(Board).filter(Board.id == board_id).with_for_update().first()
    if not board:
        return Response(content='{"error":"not found"}', status_code=404, media_type="application/json")

    strokes = [s for s in (board.strokes or []) if isinstance(s, dict)]
    sid = (body.stroke_data or {}).get("id")
    if is_protected(board):
        if not mutation_allowed(board.id, body.event_type):
            raise HTTPException(status_code=403, detail="Curated plates accept additive marks only")
        if sid is None:
            raise HTTPException(status_code=422, detail="A stroke id is required")
        if any(stroke.get("id") == sid for stroke in strokes):
            raise HTTPException(status_code=409, detail="Curated strokes cannot be replaced")

    event = StrokeEvent(
        board_id=board_id,
        user_id=body.user_id,
        event_type=body.event_type,
        stroke_data=body.stroke_data,
    )
    db.add(event)

    if body.event_type in ("add", "update") and sid is not None:
        strokes = [s for s in strokes if s.get("id") != sid]
        strokes.append(body.stroke_data)
    elif body.event_type == "delete" and sid is not None:
        strokes = [s for s in strokes if s.get("id") != sid]
    elif body.event_type == "clear":
        strokes = []
    board.strokes = strokes

    db.commit()
    db.refresh(event)
    return {"id": event.id, "event_type": event.event_type}


@app.get("/api/boards/{board_id}/export")
@app.post("/api/boards/{board_id}/export")
def export_board(
    board_id: int,
    format: str = "svg",
    width: int = 800,
    height: int = 600,
    db: Session = Depends(get_db),
):
    strokes = board_manager.get_strokes(board_id)
    if not strokes:
        board = db.query(Board).filter(Board.id == board_id).first()
        if board and board.strokes:
            strokes = board.strokes

    strokes = strokes or []
    strokes = [s for s in strokes if isinstance(s, dict)]

    if format == "png":
        data = export_png(strokes, width, height)
        return Response(content=data, media_type="image/png")
    elif format == "pdf":
        data = export_pdf(strokes, width, height)
        return Response(content=data, media_type="application/pdf")
    else:
        data = export_svg(strokes, width, height)
        return Response(content=data, media_type="image/svg+xml")


@app.post("/api/boards/{board_id}/image")
async def upload_image(board_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image uploads are supported")
    contents = await file.read(MAX_IMAGE_BYTES + 1)
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 5 MB demo limit")
    import base64
    import os

    static_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
    os.makedirs(static_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "image.png")[1] or ".png"
    filename = f"board_{board_id}_{int(time.time())}{ext}"
    filepath = os.path.join(static_dir, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    b64 = base64.b64encode(contents).decode("utf-8")
    mime = file.content_type or "image/png"

    stroke_data = {
        "id": f"img_{int(time.time() * 1000)}",
        "user_id": "system",
        "points": [],
        "color": "#000000",
        "width": 1,
        "tool": "image",
        "deleted": False,
        "timestamp": time.time(),
        "image_data": f"data:{mime};base64,{b64}",
        "x": 50,
        "y": 50,
    }

    board = db.query(Board).filter(Board.id == board_id).first()
    if board:
        strokes = list(board.strokes or [])
        strokes.append(stroke_data)
        board.strokes = strokes
        # Keep the event log a superset of the strokes array so polling
        # clients and the timeline see uploaded images too.
        db.add(StrokeEvent(board_id=board_id, user_id="system", event_type="add", stroke_data=stroke_data))
        db.commit()

    board_manager.strokes[board_id] = board_manager.strokes.get(board_id, []) + [stroke_data]
    return {"success": True, "stroke": stroke_data}


@app.websocket("/ws/{board_id}")
async def websocket_endpoint(ws: WebSocket, board_id: int, user_id: str = Query("anonymous")):
    await board_manager.connect(ws, board_id, user_id)

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            if msg_type in ("stroke_add", "stroke_update", "stroke_delete", "board_clear"):
                data = msg.get("data", {})
                if not isinstance(data, dict):
                    data = {}

                if "id" not in data and msg_type in ("stroke_add", "stroke_update"):
                    data["id"] = f"{user_id}_{int(time.time() * 1000)}"
                if "user_id" not in data:
                    data["user_id"] = user_id
                if "timestamp" not in data:
                    data["timestamp"] = time.time()

                db = SessionLocal()
                try:
                    board = db.query(Board).filter(Board.id == board_id).with_for_update().first()
                    if not board:
                        await ws.send_text(json.dumps({"type": "error", "error": "board_not_found"}))
                        continue
                    strokes = [s for s in (board.strokes or []) if isinstance(s, dict)]
                    event_type = msg_type.replace("stroke_", "")
                    if not mutation_allowed(board.id, event_type):
                        await ws.send_text(
                            json.dumps({"type": "error", "error": "curated_plate_additive_only"})
                        )
                        continue
                    if is_protected(board) and any(s.get("id") == data.get("id") for s in strokes):
                        await ws.send_text(
                            json.dumps({"type": "error", "error": "curated_stroke_immutable"})
                        )
                        continue
                    event = StrokeEvent(
                        board_id=board_id,
                        user_id=user_id,
                        event_type=event_type,
                        stroke_data=data,
                    )
                    db.add(event)
                    if is_protected(board):
                        board.strokes = [*strokes, data]
                    db.commit()
                finally:
                    db.close()

                board_manager.handle_stroke_sync(board_id, data, msg_type.replace("stroke_", ""))

            elif msg_type == "cursor_move":
                x = float(msg.get("x", 0))
                y = float(msg.get("y", 0))
                await board_manager.handle_cursor(board_id, user_id, x, y)

            elif msg_type == "export":
                strokes = board_manager.get_strokes(board_id)
                await ws.send_text(json.dumps({"type": "export_data", "strokes": strokes}))

    except WebSocketDisconnect:
        pass
    finally:
        await board_manager.disconnect(ws, board_id)


class LiveblocksAuthRequest(BaseModel):
    room: str
    user_id: str = "anonymous"


@app.post("/api/liveblocks-auth")
def liveblocks_auth(body: LiveblocksAuthRequest):
    """Issue a Liveblocks room token for realtime sync. The secret key stays
    server-side (env LIVEBLOCKS_SECRET_KEY); clients only ever see the
    short-lived token scoped to a single board room."""
    secret = os.environ.get("LIVEBLOCKS_SECRET_KEY", "")
    if not secret:
        return Response(
            content='{"error":"realtime not configured"}',
            status_code=503,
            media_type="application/json",
        )
    if not re.fullmatch(r"board-\d{1,10}", body.room):
        return Response(
            content='{"error":"invalid room"}',
            status_code=400,
            media_type="application/json",
        )
    user_id = (body.user_id or "anonymous")[:64]
    try:
        resp = httpx.post(
            "https://api.liveblocks.io/v2/authorize-user",
            json={"userId": user_id, "permissions": {body.room: ["room:write"]}},
            headers={"Authorization": f"Bearer {secret}"},
            timeout=10.0,
        )
    except httpx.HTTPError:
        return Response(
            content='{"error":"liveblocks unreachable"}',
            status_code=502,
            media_type="application/json",
        )
    return Response(
        content=resp.text,
        status_code=resp.status_code,
        media_type="application/json",
    )


@app.get("/health")
def health():
    return {"status": "ok"}
