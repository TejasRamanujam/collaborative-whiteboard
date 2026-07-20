import json
import time
from fastapi import WebSocket

from crdt import merge_stroke_states, lww_merge


class BoardManager:
    def __init__(self):
        self.boards: dict[int, dict] = {}

    def _ensure_board(self, board_id: int):
        if board_id not in self.boards:
            self.boards[board_id] = {"users": {}, "strokes": [], "cursors": {}}

    async def connect(self, ws: WebSocket, board_id: int, user_id: str):
        await ws.accept()
        self._ensure_board(board_id)
        self.boards[board_id]["users"][ws] = user_id
        self.boards[board_id]["cursors"][user_id] = {"x": 0, "y": 0}

        await self.broadcast(
            board_id,
            {"type": "user_joined", "user_id": user_id, "timestamp": time.time()},
        )

    async def disconnect(self, ws: WebSocket, board_id: int):
        if board_id not in self.boards:
            return
        board = self.boards[board_id]
        user_id = board["users"].pop(ws, None)
        if user_id:
            board["cursors"].pop(user_id, None)

        if not board["users"]:
            del self.boards[board_id]
        else:
            await self.broadcast(
                board_id,
                {"type": "user_left", "user_id": user_id, "timestamp": time.time()},
            )

    async def handle_stroke(self, board_id: int, data: dict):
        self._ensure_board(board_id)
        board = self.boards[board_id]
        stroke_data = data.get("data", {})
        event_type = data.get("event_type", "add")

        if event_type in ("add", "update"):
            existing = next(
                (s for s in board["strokes"] if s["id"] == stroke_data.get("id")),
                None,
            )
            if existing:
                result = {**existing, **stroke_data, "timestamp": time.time()}
                idx = board["strokes"].index(existing)
                board["strokes"][idx] = result
            else:
                board["strokes"].append(stroke_data)
        elif event_type == "delete":
            board["strokes"] = [
                s for s in board["strokes"] if s["id"] != stroke_data.get("id")
            ]
        elif event_type == "clear":
            board["strokes"] = []

        await self.broadcast(
            board_id, {"type": "stroke_event", "data": stroke_data, "event_type": event_type}, ws=None
        )

    async def handle_cursor(self, board_id: int, user_id: str, x: float, y: float):
        if board_id not in self.boards:
            return
        self.boards[board_id]["cursors"][user_id] = {"x": x, "y": y}
        await self.broadcast(
            board_id,
            {"type": "cursor_move", "user_id": user_id, "x": x, "y": y},
            exclude=None,
        )

    async def broadcast(self, board_id: int, message: dict, exclude: WebSocket | None = None):
        if board_id not in self.boards:
            return
        tasks = []
        for ws in list(self.boards[board_id]["users"].keys()):
            if ws is exclude:
                continue
            tasks.append(self._safe_send(ws, message))
        if tasks:
            import asyncio
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _safe_send(self, ws: WebSocket, message: dict):
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            pass

    def get_strokes(self, board_id: int) -> list:
        self._ensure_board(board_id)
        return self.boards[board_id]["strokes"]

    def set_strokes(self, board_id: int, strokes: list):
        self._ensure_board(board_id)
        self.boards[board_id]["strokes"] = strokes

    def handle_stroke_sync(self, board_id: int, data: dict, event_type: str):
        self._ensure_board(board_id)
        board = self.boards[board_id]
        import asyncio

        if event_type in ("add", "update"):
            existing = next(
                (s for s in board["strokes"] if s.get("id") == data.get("id")),
                None,
            )
            if existing:
                idx = board["strokes"].index(existing)
                board["strokes"][idx] = data
            else:
                board["strokes"].append(data)
        elif event_type == "delete":
            board["strokes"] = [
                s for s in board["strokes"] if s.get("id") != data.get("id")
            ]
        elif event_type == "clear":
            board["strokes"] = []

        asyncio.create_task(
            self.broadcast(
                board_id,
                {"type": "stroke_event", "data": data, "event_type": event_type},
            )
        )


board_manager = BoardManager()
