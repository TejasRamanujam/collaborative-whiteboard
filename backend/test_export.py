import unittest

from export import export_png, export_svg


STROKES = [
    {
        "tool": "text",
        "text": "hello & proof",
        "points": [{"x": 24, "y": 30}],
        "color": "#fefefe",
        "font_size": 20,
    },
    {
        "tool": "rectangle",
        "points": [{"x": 10, "y": 10}, {"x": 80, "y": 60}],
        "color": "#ff0000",
        "width": 4,
    },
    {
        "tool": "circle",
        "points": [{"x": 100, "y": 20}, {"x": 180, "y": 100}],
        "color": "#00ff00",
        "width": 3,
    },
]


class ExportTests(unittest.TestCase):
    def test_svg_preserves_text_and_shape_semantics(self):
        svg = export_svg(STROKES, 240, 140)

        self.assertIn("hello &amp; proof", svg)
        self.assertIn('font-size="20"', svg)
        self.assertIn('stroke-width="4"', svg)
        self.assertIn("<rect", svg)
        self.assertIn("<ellipse", svg)

    def test_png_contains_rendered_content(self):
        png = export_png(STROKES, 240, 140)

        self.assertTrue(png.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertGreater(len(png), 100)


if __name__ == "__main__":
    unittest.main()
