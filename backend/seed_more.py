"""Append more boards with strokes (run once)."""
import math
from datetime import datetime, timezone, timedelta

from database import SessionLocal
from models import Board

db = SessionLocal()
now = datetime.now(timezone.utc)


def circle(cx, cy, r, n=40):
    return [{"x": round(cx + r * math.cos(2 * math.pi * i / n), 1), "y": round(cy + r * math.sin(2 * math.pi * i / n), 1)} for i in range(n + 1)]


def poly(points):
    return [{"x": x, "y": y} for x, y in points]


# House sketch
house = [
    {"id": "h1", "tool": "pen", "color": "#5b9dff", "width": 4, "points": poly([(180, 320), (180, 200), (320, 200), (320, 320), (180, 320)])},
    {"id": "h2", "tool": "pen", "color": "#ef476f", "width": 4, "points": poly([(180, 200), (250, 140), (320, 200)])},
    {"id": "h3", "tool": "pen", "color": "#ffd166", "width": 3, "points": poly([(230, 320), (230, 260), (270, 260), (270, 320)])},
    {"id": "h4", "tool": "pen", "color": "#06d6a0", "width": 6, "points": circle(420, 160, 40)},
]
# Star
star_pts = []
for i in range(11):
    ang = -math.pi / 2 + i * math.pi / 5
    r = 80 if i % 2 == 0 else 32
    star_pts.append((round(250 + r * math.cos(ang), 1), round(220 + r * math.sin(ang), 1)))
star = [{"id": "st1", "tool": "pen", "color": "#a78bfa", "width": 4, "points": poly(star_pts)}]
# Flowchart-ish
flow = [
    {"id": "f1", "tool": "pen", "color": "#5b9dff", "width": 3, "points": poly([(120, 120), (280, 120), (280, 180), (120, 180), (120, 120)])},
    {"id": "f2", "tool": "pen", "color": "#5b9dff", "width": 3, "points": poly([(120, 260), (280, 260), (280, 320), (120, 320), (120, 260)])},
    {"id": "f3", "tool": "pen", "color": "#8aa0b8", "width": 3, "points": poly([(200, 180), (200, 260)])},
]

boards = [
    Board(name="House Sketch", created_at=now - timedelta(hours=20), strokes=house),
    Board(name="Star", created_at=now - timedelta(hours=14), strokes=star),
    Board(name="Flow Diagram", created_at=now - timedelta(hours=8), strokes=flow),
    Board(name="Retro Notes", created_at=now - timedelta(hours=2),
          strokes=[{"id": "r1", "tool": "pen", "color": "#06d6a0", "width": 5, "points": circle(300, 220, 90)}]),
]
db.add_all(boards)
db.commit()
print(f"Total boards now {db.query(Board).count()}.")
db.close()
