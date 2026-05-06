from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone


class Base(DeclarativeBase):
    pass


class Board(Base):
    __tablename__ = "boards"
    id = Column(Integer, primary_key=True)
    name = Column(String, default="Untitled")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    strokes = Column(JSON, default=[])


class StrokeEvent(Base):
    __tablename__ = "stroke_events"
    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, nullable=False)
    user_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    stroke_data = Column(JSON, default={})
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
