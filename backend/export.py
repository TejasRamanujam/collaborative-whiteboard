from io import BytesIO
from xml.dom import minidom
from xml.etree import ElementTree as ET

from PIL import Image, ImageDraw, ImageFont


def _point(stroke: dict):
    points = stroke.get("points", [])
    if points:
        return points[0]
    return {"x": stroke.get("x", 0), "y": stroke.get("y", 0)}


def export_svg(board_strokes: list, width: int = 800, height: int = 600) -> str:
    svg = ET.Element(
        "svg",
        xmlns="http://www.w3.org/2000/svg",
        viewBox=f"0 0 {width} {height}",
        width=str(width),
        height=str(height),
    )
    ET.SubElement(svg, "rect", width=str(width), height=str(height), fill="#0f1117")

    for stroke in board_strokes:
        if stroke.get("deleted"):
            continue
        color = stroke.get("color", "#ffffff")
        size = int(stroke.get("font_size", 18))
        if stroke.get("tool") == "text" and stroke.get("text"):
            point = _point(stroke)
            element = ET.SubElement(
                svg,
                "text",
                {
                    "x": str(point["x"]),
                    "y": str(point["y"]),
                    "fill": color,
                    "font-size": str(size),
                    "font-family": "Georgia, serif",
                    "dominant-baseline": "hanging",
                },
            )
            for index, line in enumerate(str(stroke["text"]).splitlines() or [""]):
                span = ET.SubElement(
                    element,
                    "tspan",
                    x=str(point["x"]),
                    dy="0" if index == 0 else str(size * 1.2),
                )
                span.text = line
            continue

        points = stroke.get("points", [])
        if len(points) < 2:
            if points:
                ET.SubElement(
                    svg,
                    "circle",
                    cx=str(points[0]["x"]),
                    cy=str(points[0]["y"]),
                    r=str(stroke.get("width", 2) / 2),
                    fill=color,
                )
            continue

        start, end = points[0], points[-1]
        common = {
            "fill": "none",
            "stroke": color,
            "stroke-width": str(stroke.get("width", 2)),
        }
        if stroke.get("tool") == "rectangle":
            ET.SubElement(
                svg,
                "rect",
                {
                    **common,
                    "x": str(min(start["x"], end["x"])),
                    "y": str(min(start["y"], end["y"])),
                    "width": str(abs(end["x"] - start["x"])),
                    "height": str(abs(end["y"] - start["y"])),
                },
            )
            continue
        if stroke.get("tool") == "circle":
            ET.SubElement(
                svg,
                "ellipse",
                {
                    **common,
                    "cx": str((start["x"] + end["x"]) / 2),
                    "cy": str((start["y"] + end["y"]) / 2),
                    "rx": str(abs(end["x"] - start["x"]) / 2),
                    "ry": str(abs(end["y"] - start["y"]) / 2),
                },
            )
            continue

        path = " ".join(
            f"{'M' if index == 0 else 'L'} {point['x']} {point['y']}"
            for index, point in enumerate(points)
        )
        ET.SubElement(
            svg,
            "path",
            {
                "d": path,
                **common,
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
            },
        )

    return minidom.parseString(ET.tostring(svg, encoding="unicode")).toprettyxml(indent="  ")


def export_png(board_strokes: list, width: int = 800, height: int = 600) -> bytes:
    image = Image.new("RGBA", (width, height), (15, 17, 23, 255))
    draw = ImageDraw.Draw(image)

    for stroke in board_strokes:
        if stroke.get("deleted"):
            continue
        color = stroke.get("color", "#ffffff")
        stroke_width = int(stroke.get("width", 2))
        if stroke.get("tool") == "text" and stroke.get("text"):
            point = _point(stroke)
            size = int(stroke.get("font_size", 18))
            try:
                font = ImageFont.truetype("DejaVuSans.ttf", size)
            except OSError:
                font = ImageFont.load_default()
            draw.multiline_text(
                (point["x"], point["y"]),
                str(stroke["text"]),
                fill=color,
                font=font,
                spacing=max(2, int(size * 0.2)),
            )
            continue

        points = stroke.get("points", [])
        if not points:
            continue
        if len(points) == 1:
            x, y = points[0]["x"], points[0]["y"]
            radius = max(stroke_width, 2)
            draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=color)
            continue

        start, end = points[0], points[-1]
        if stroke.get("tool") == "rectangle":
            draw.rectangle(
                [
                    min(start["x"], end["x"]),
                    min(start["y"], end["y"]),
                    max(start["x"], end["x"]),
                    max(start["y"], end["y"]),
                ],
                outline=color,
                width=stroke_width,
            )
            continue
        if stroke.get("tool") == "circle":
            draw.ellipse(
                [
                    min(start["x"], end["x"]),
                    min(start["y"], end["y"]),
                    max(start["x"], end["x"]),
                    max(start["y"], end["y"]),
                ],
                outline=color,
                width=stroke_width,
            )
            continue

        flat = [coordinate for point in points for coordinate in (point["x"], point["y"])]
        draw.line(flat, fill=color, width=stroke_width, joint="curve")

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()


def export_pdf(board_strokes: list, width: int = 800, height: int = 600) -> bytes:
    png_data = export_png(board_strokes, width, height)
    buffer = BytesIO()
    image = Image.open(BytesIO(png_data))
    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, (15, 17, 23))
        background.paste(image, mask=image.split()[3])
        image = background
    image.save(buffer, format="PDF")
    buffer.seek(0)
    return buffer.getvalue()
