# Collaborative Whiteboard

A real-time multi-user drawing whiteboard with WebSocket sync, CRDT state management, session recording/replay, and export to SVG/PNG/PDF.

## Tech Stack

| Layer     | Technology                              |
| --------- | --------------------------------------- |
| Frontend  | React 18, TypeScript, Vite, HTML5 Canvas |
| Backend   | FastAPI, SQLAlchemy, SQLite             |
| Real-time | WebSocket (via FastAPI)                 |
| Sync      | CRDT (Last-Writer-Wins Register)        |
| Export    | PIL/Pillow (SVG/PNG/PDF)                |

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Docker

```bash
docker-compose up --build
```

## WebSocket Protocol

Connect: `ws://localhost:8000/ws/{board_id}?user_id={name}`

### Client → Server

| Message Type     | Payload                                     |
| ---------------- | ------------------------------------------- |
| `stroke_add`     | `{type, data: {id, points, color, width, tool}}` |
| `stroke_update`  | `{type, data: {id, ...}}`                   |
| `stroke_delete`  | `{type, data: {id}}`                        |
| `board_clear`    | `{type, data: {}}`                          |
| `cursor_move`    | `{type, x, y}`                              |

### Server → Client

| Message Type    | Payload                              |
| --------------- | ------------------------------------ |
| `stroke_event`  | `{type, event_type, data}`           |
| `cursor_move`   | `{type, user_id, x, y}`              |
| `user_joined`   | `{type, user_id}`                    |
| `user_left`     | `{type, user_id}`                    |

## REST API

| Method | Endpoint                     | Description        |
| ------ | ---------------------------- | ------------------ |
| GET    | `/api/boards`                | List all boards    |
| POST   | `/api/boards`                | Create board       |
| GET    | `/api/boards/{id}`           | Get board + strokes |
| GET    | `/api/boards/{id}/events`    | Event log (replay) |
| POST   | `/api/boards/{id}/export`    | Export SVG/PNG/PDF |
| POST   | `/api/boards/{id}/image`     | Upload image       |

## Export Formats

SVG — Vector format, scalable, renders strokes as `<path>` elements.
PNG — Raster format, renders strokes with Pillow ImageDraw.
PDF — Same as PNG but wrapped in PDF container.
