import json
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models import Board, StrokeEvent
from handlers import board_manager
from export import export_svg, export_png, export_pdf

app = FastAPI(title="Collaborative Whiteboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/api/boards/{board_id}")
def get_board(board_id: int, db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        return Response(content='{"error":"not found"}', status_code=404, media_type="application/json")

    active_strokes = board_manager.get_strokes(board_id)
    if active_strokes:
        board.strokes = active_strokes
        db.commit()

    return {
        "id": board.id,
        "name": board.name,
        "created_at": board.created_at.isoformat() if board.created_at else None,
        "strokes": board.strokes or [],
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
    board.strokes = body.strokes
    board_manager.set_strokes(board_id, body.strokes)
    # Keep the session timeline in sync with the saved strokes: one "add" event
    # per stroke, so the timeline replay/scrub works without a live WS server.
    db.query(StrokeEvent).filter(StrokeEvent.board_id == board_id).delete()
    for s in body.strokes:
        db.add(StrokeEvent(board_id=board_id, user_id="rest", event_type="add", stroke_data=s))
    db.commit()
    return {"ok": True, "count": len(body.strokes)}


@app.get("/api/boards/{board_id}/events")
def get_events(board_id: int, db: Session = Depends(get_db)):
    events = (
        db.query(StrokeEvent)
        .filter(StrokeEvent.board_id == board_id)
        .order_by(StrokeEvent.timestamp.asc())
        .all()
    )
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
    contents = await file.read()
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
                    event = StrokeEvent(
                        board_id=board_id,
                        user_id=user_id,
                        event_type=msg_type.replace("stroke_", ""),
                        stroke_data=data,
                    )
                    db.add(event)
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


@app.get("/health")
def health():
    return {"status": "ok"}
