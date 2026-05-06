import json
import time
from io import BytesIO
from xml.etree import ElementTree as ET
from xml.dom import minidom
from PIL import Image, ImageDraw


def export_svg(board_strokes: list, width: int = 800, height: int = 600) -> str:
    svg = ET.Element(
        "svg",
        xmlns="http://www.w3.org/2000/svg",
        viewBox=f"0 0 {width} {height}",
        width=str(width),
        height=str(height),
    )

    bg = ET.SubElement(svg, "rect", width=str(width), height=str(height), fill="#0f1117")

    for stroke in board_strokes:
        if stroke.get("deleted"):
            continue
        pts = stroke.get("points", [])
        if len(pts) < 2:
            if len(pts) == 1:
                cx, cy = pts[0]["x"], pts[0]["y"]
                ET.SubElement(
                    svg,
                    "circle",
                    cx=str(cx),
                    cy=str(cy),
                    r=str(stroke.get("width", 2) / 2),
                    fill=stroke.get("color", "#ffffff"),
                )
            continue

        d_parts = []
        for i, pt in enumerate(pts):
            cmd = "M" if i == 0 else "L"
            d_parts.append(f"{cmd} {pt['x']} {pt['y']}")
        d = " ".join(d_parts)

        ET.SubElement(
            svg,
            "path",
            d=d,
            fill="none",
            stroke=stroke.get("color", "#ffffff"),
            stroke_width=str(stroke.get("width", 2)),
            stroke_linecap="round",
            stroke_linejoin="round",
        )

    xml_str = ET.tostring(svg, encoding="unicode")
    return minidom.parseString(xml_str).toprettyxml(indent="  ")


def export_png(board_strokes: list, width: int = 800, height: int = 600) -> bytes:
    img = Image.new("RGBA", (width, height), (15, 17, 23, 255))
    draw = ImageDraw.Draw(img)

    for stroke in board_strokes:
        if stroke.get("deleted"):
            continue
        pts = stroke.get("points", [])
        if not pts:
            continue
        color = stroke.get("color", "#ffffff")
        w = int(stroke.get("width", 2))

        if len(pts) == 1:
            x, y = pts[0]["x"], pts[0]["y"]
            r = max(w, 2)
            draw.ellipse([x - r, y - r, x + r, y + r], fill=color)
            continue

        flat = []
        for pt in pts:
            flat.extend([pt["x"], pt["y"]])
        draw.line(flat, fill=color, width=w, joint="curve")

    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


def export_pdf(board_strokes: list, width: int = 800, height: int = 600) -> bytes:
    png_data = export_png(board_strokes, width, height)

    buf = BytesIO()
    pil_img = Image.open(BytesIO(png_data))
    if pil_img.mode == "RGBA":
        bg = Image.new("RGB", pil_img.size, (15, 17, 23))
        bg.paste(pil_img, mask=pil_img.split()[3])
        pil_img = bg
    pil_img.save(buf, format="PDF")
    buf.seek(0)
    return buf.getvalue()
