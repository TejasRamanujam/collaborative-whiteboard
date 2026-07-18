import unittest

from backend.protection import (
    DEFAULT_PROTECTED_BOARD_IDS,
    is_protected_board,
    merge_additive_strokes,
    mutation_allowed,
    parse_protected_board_ids,
)


class ProtectionTests(unittest.TestCase):
    def test_defaults_match_curated_production_boards(self):
        self.assertEqual(DEFAULT_PROTECTED_BOARD_IDS, frozenset({1, 2, 3, 4, 5, 6, 7, 27}))
        self.assertTrue(is_protected_board(27))
        self.assertFalse(is_protected_board(19))

    def test_environment_override_uses_stable_ids(self):
        self.assertEqual(parse_protected_board_ids("4, 9,12"), frozenset({4, 9, 12}))
        self.assertEqual(parse_protected_board_ids(""), frozenset())

    def test_curated_boards_only_accept_additive_events(self):
        self.assertTrue(mutation_allowed(27, "add"))
        self.assertFalse(mutation_allowed(27, "update"))
        self.assertFalse(mutation_allowed(27, "delete"))
        self.assertFalse(mutation_allowed(27, "clear"))
        self.assertTrue(mutation_allowed(19, "clear"))

    def test_additive_merge_preserves_curated_strokes(self):
        original = [{"id": "seed", "points": [1]}]
        incoming = [
            {"id": "seed", "points": []},
            {"id": "visitor", "points": [2]},
        ]

        merged, added = merge_additive_strokes(original, incoming)

        self.assertEqual(merged[0], original[0])
        self.assertEqual(added, [{"id": "visitor", "points": [2]}])
        self.assertEqual(len(merged), 2)


if __name__ == "__main__":
    unittest.main()
