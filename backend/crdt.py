"""CRDT stroke data type using Last-Writer-Wins register semantics."""

from typing import Any


def lww_merge(stroke_a: dict[str, Any] | None, stroke_b: dict[str, Any] | None) -> dict[str, Any] | None:
    """Merge two stroke states. The write with the higher timestamp wins."""
    if stroke_a is None and stroke_b is None:
        return None
    if stroke_a is None:
        return stroke_b
    if stroke_b is None:
        return stroke_a

    ts_a = stroke_a.get("timestamp", 0)
    ts_b = stroke_b.get("timestamp", 0)

    if ts_b > ts_a:
        return stroke_b
    elif ts_a > ts_b:
        return stroke_a
    else:
        return stroke_a if stroke_a.get("id", "") > stroke_b.get("id", "") else stroke_b


def merge_stroke_states(local: list[dict], remote: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for s in local:
        sid = s["id"]
        merged[sid] = lww_merge(merged.get(sid), s) or s
    for s in remote:
        sid = s["id"]
        merged[sid] = lww_merge(merged.get(sid), s) or s
    return list(merged.values())
