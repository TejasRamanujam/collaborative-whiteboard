import os
from typing import Iterable


DEFAULT_PROTECTED_BOARD_IDS = frozenset({1, 2, 3, 4, 5, 6, 7, 27})


def parse_protected_board_ids(raw: str | None) -> frozenset[int]:
    if raw is None:
        return DEFAULT_PROTECTED_BOARD_IDS

    ids: set[int] = set()
    for value in raw.split(","):
        value = value.strip()
        if value:
            ids.add(int(value))
    return frozenset(ids)


PROTECTED_BOARD_IDS = parse_protected_board_ids(os.environ.get("PROTECTED_BOARD_IDS"))


def is_protected_board(board_id: int | None) -> bool:
    return board_id is not None and board_id in PROTECTED_BOARD_IDS


def mutation_allowed(board_id: int | None, event_type: str) -> bool:
    return not is_protected_board(board_id) or event_type == "add"


def merge_additive_strokes(
    existing: Iterable[dict] | None,
    incoming: Iterable[dict] | None,
) -> tuple[list[dict], list[dict]]:
    merged = [stroke for stroke in (existing or []) if isinstance(stroke, dict)]
    known_ids = {stroke.get("id") for stroke in merged if stroke.get("id") is not None}
    added: list[dict] = []

    for stroke in incoming or []:
        if not isinstance(stroke, dict):
            continue
        stroke_id = stroke.get("id")
        if stroke_id is None or stroke_id in known_ids:
            continue
        known_ids.add(stroke_id)
        merged.append(stroke)
        added.append(stroke)

    return merged, added
