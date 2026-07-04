"""Minimal demo seed for the Collaborative Whiteboard (idempotent).

Seeds a board pre-populated with strokes that draw a smiley + label, so the
canvas shows real content on load (live multi-user sync needs the websocket
server, which isn't part of the serverless demo).
"""
import math
from datetime import datetime, timezone, timedelta

from database import SessionLocal
from models import Board, StrokeEvent

db = SessionLocal()

if db.query(Board).count() > 0:
    print("Already seeded; skipping.")
    raise SystemExit


def circle(cx, cy, r, n=40):
    return [{"x": round(cx + r * math.cos(2 * math.pi * i / n), 1),
             "y": round(cy + r * math.sin(2 * math.pi * i / n), 1)} for i in range(n + 1)]


def arc(cx, cy, r, a0, a1, n=20):
    return [{"x": round(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), 1),
             "y": round(cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)), 1)} for i in range(n + 1)]


strokes = [
    {"id": "s1", "tool": "pen", "color": "#ffd166", "width": 5, "points": circle(300, 240, 120)},
    {"id": "s2", "tool": "pen", "color": "#06d6a0", "width": 8, "points": circle(255, 210, 12)},
    {"id": "s3", "tool": "pen", "color": "#06d6a0", "width": 8, "points": circle(345, 210, 12)},
    {"id": "s4", "tool": "pen", "color": "#ef476f", "width": 6, "points": arc(300, 250, 70, 30, 150)},
    {"id": "s5", "tool": "pen", "color": "#5b9dff", "width": 4,
     "points": [{"x": 470, "y": 120}, {"x": 470, "y": 180}, {"x": 470, "y": 150},
                {"x": 510, "y": 150}, {"x": 510, "y": 120}, {"x": 510, "y": 180}]},
]

now = datetime.now(timezone.utc)
b1 = Board(name="Welcome — Demo Sketch", created_at=now - timedelta(days=1), strokes=strokes)
b2 = Board(name="Team Brainstorm", created_at=now - timedelta(hours=3),
           strokes=[{"id": "r1", "tool": "pen", "color": "#a78bfa", "width": 4,
                     "points": [{"x": 120, "y": 120}, {"x": 320, "y": 120}, {"x": 320, "y": 260},
                                {"x": 120, "y": 260}, {"x": 120, "y": 120}]}])
b3 = Board(name="Blank Canvas", created_at=now, strokes=[])
db.add_all([b1, b2, b3])
db.flush()

for i, s in enumerate(strokes):
    db.add(StrokeEvent(board_id=b1.id, user_id="demo-user", event_type="stroke_add",
                       stroke_data=s, timestamp=now - timedelta(minutes=len(strokes) - i)))

db.commit()
print(f"Seeded {db.query(Board).count()} boards, {db.query(StrokeEvent).count()} stroke events.")
db.close()
