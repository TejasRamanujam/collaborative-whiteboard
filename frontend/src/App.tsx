import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import SessionTimeline from './components/SessionTimeline'
import ExportDialog from './components/ExportDialog'
import { usePollingSync } from './hooks/usePollingSync'
import { fetchBoards, createBoard, deleteBoard, fetchBoard } from './api'
import { Stroke, Tool, Board } from './types'
import { ReplayEvent } from './components/SessionTimeline'
import './App.css'

const USER_ID_KEY = 'whiteboard_user_id'

function generateUserId(): string {
  const adjectives = ['Swift', 'Bright', 'Calm', 'Bold', 'Keen']
  const nouns = ['Fox', 'Owl', 'Bear', 'Wolf', 'Hawk']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj}${noun}${Math.floor(Math.random() * 100)}`
}

function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = generateUserId()
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

function Squiggle() {
  return (
    <svg className="squiggle" viewBox="0 0 220 14" aria-hidden="true">
      <path
        d="M3 10 C 25 2, 45 2, 65 9 S 105 14, 125 7 S 165 1, 185 8 S 210 12, 217 6"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function BoardList() {
  const navigate = useNavigate()
  const [boards, setBoards] = useState<Board[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchBoards()
      .then(setBoards)
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      const board = await createBoard(name.trim())
      setBoards((prev) => [board, ...prev])
      setName('')
      navigate(`/board/${board.id}`)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (b: Board) => {
    if (!window.confirm(`Delete "${b.name}" and all its strokes? This cannot be undone.`)) return
    try {
      await deleteBoard(b.id)
      setBoards((prev) => prev.filter((x) => x.id !== b.id))
    } catch {
      window.alert('Could not delete the board — try again.')
    }
  }

  return (
    <div className="board-list-page">
      <div className="board-list">
        <a className="back-pill" href="https://tejas-live-demos.vercel.app">
          <span aria-hidden="true">←</span> Back to demos
        </a>

        <header className="hero">
          <div className="hero-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="44" height="44">
              <rect x="4" y="4" width="56" height="56" rx="14" fill="var(--accent)" />
              <path
                d="M16 42c6-14 10-20 14-20s2 12 6 12 6-8 12-10"
                fill="none"
                stroke="#fff"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="46" cy="45" r="4" fill="var(--cyan)" />
            </svg>
          </div>
          <h1>
            Scribbly
            <Squiggle />
          </h1>
          <p className="subtitle">
            A whiteboard that remembers. Every stroke is saved — scrub the timeline to
            watch your doodles come back to life.
          </p>
        </header>

        <div className="create-row">
          <input
            className="create-input"
            placeholder="Name a new board — “rocket ideas”, “lunch doodles”…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            aria-label="New board name"
          />
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={creating || !name.trim()}
          >
            {creating ? 'Creating…' : '+ Create'}
          </button>
        </div>

        {loading && (
          <div className="board-skeletons" aria-hidden="true">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        )}

        {!loading &&
          boards.map((b) => (
            <div key={b.id} className="board-card-wrap">
              <button
                className="board-card"
                onClick={() => navigate(`/board/${b.id}`)}
              >
                <span className="board-doodle" aria-hidden="true">
                  <svg viewBox="0 0 40 40" width="22" height="22">
                    <path
                      d="M8 28c4-10 7-16 10-16s2 9 5 9 4-6 9-8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="board-meta">
                  <span className="board-name">{b.name}</span>
                  <span className="board-date">
                    {b.created_at ? new Date(b.created_at).toLocaleString() : ''}
                  </span>
                </span>
                <span className="board-arrow" aria-hidden="true">
                  →
                </span>
              </button>
              <button
                className="board-delete"
                aria-label={`Delete board ${b.name}`}
                title="Delete board"
                onClick={() => handleDelete(b)}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                  <path
                    d="M4 7h16M10 4h4M7 7l1 13h8l1-13M10 11v6M14 11v6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ))}

        {!loading && boards.length === 0 && (
          <div className="empty-state">
            <svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
              <rect
                x="8"
                y="8"
                width="104"
                height="64"
                rx="12"
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth="3"
                strokeDasharray="7 8"
                strokeLinecap="round"
              />
              <path
                d="M32 52c8-18 14-26 20-24s0 16 8 16 8-10 16-12"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.7"
              />
              <circle cx="86" cy="54" r="4" fill="var(--cyan)" opacity="0.8" />
            </svg>
            <p className="empty-title">A blank page, full of possibility</p>
            <p className="empty-hint">Name your first board above and start scribbling.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Apply a batch of stroke events to a strokes array (idempotent). */
function applyEventsToStrokes(base: Stroke[], evs: ReplayEvent[]): Stroke[] {
  let next = base
  for (const ev of evs) {
    const data = ev.stroke_data as unknown as Stroke | undefined
    const et = ev.event_type
    if ((et === 'add' || et === 'update') && data && data.id) {
      next = [...next.filter((s) => s.id !== data.id), data]
    } else if (et === 'delete' && data && data.id) {
      next = next.filter((s) => s.id !== data.id)
    } else if (et === 'clear') {
      next = []
    }
  }
  return next
}

const SYNC_META = {
  live: {
    cls: 'live',
    label: 'Live · syncing',
    title: 'Synced with everyone on this board every few seconds',
  },
  connecting: {
    cls: 'connecting',
    label: 'Connecting…',
    title: 'Reaching the board server',
  },
  offline: {
    cls: 'offline',
    label: 'Offline · retrying',
    title: 'Can’t reach the server right now — new strokes stay local until it’s back',
  },
} as const

function Whiteboard() {
  const { boardId: boardIdStr } = useParams<{ boardId: string }>()
  const boardId = boardIdStr ? parseInt(boardIdStr, 10) : null
  const [userId] = useState(getUserId)
  const navigate = useNavigate()

  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#ffffff')
  const [width, setWidth] = useState(3)
  const [showExport, setShowExport] = useState(false)
  const [events, setEvents] = useState<ReplayEvent[]>([])
  const [boardLoading, setBoardLoading] = useState(true)

  // Per-user undo/redo: the stacks hold this client's own strokes only, so
  // undoing never deletes another participant's work on the shared board.
  const undoStackRef = useRef<Stroke[]>([])
  const redoStackRef = useRef<Stroke[]>([])
  // True while the timeline is replaying/scrubbing — polling is paused so the
  // replay view isn't stomped by live updates.
  const replayingRef = useRef(false)

  const [boardName, setBoardName] = useState('Whiteboard')

  // Remote events arriving from the polling loop. The first batch (and any
  // post-replay resync, reset === true) rebuilds state from the full log;
  // later batches are applied incrementally.
  const handleRemoteEvents = useCallback((evs: ReplayEvent[], reset: boolean) => {
    if (reset) {
      setEvents(evs)
      setStrokes(applyEventsToStrokes([], evs))
    } else {
      setEvents((prev) => [...prev, ...evs])
      setStrokes((prev) => applyEventsToStrokes(prev, evs))
    }
  }, [])

  const { status: syncStatus, sendEvent } = usePollingSync(
    boardId,
    userId,
    handleRemoteEvents,
    replayingRef
  )

  useEffect(() => {
    if (boardId === null) return
    setBoardLoading(true)
    setEvents([])
    setStrokes([])
    undoStackRef.current = []
    redoStackRef.current = []
    fetchBoard(boardId).then((b) => {
      if (b) setBoardName(b.name || 'Whiteboard')
    })
  }, [boardId])

  // The board is "loaded" once the first poll answers (the full event log
  // rebuilds the drawing) — or fails, in which case we show the offline pill.
  useEffect(() => {
    if (syncStatus !== 'connecting') setBoardLoading(false)
  }, [syncStatus])

  const handleStrokeAdd = useCallback((stroke: Stroke) => {
    replayingRef.current = false
    // Track the stroke as undoable immediately (id is fixed at draw start);
    // the finished version replaces it in handleStrokeEnd.
    undoStackRef.current.push(stroke)
    if (undoStackRef.current.length > 50) undoStackRef.current.shift()
    redoStackRef.current = []
    setStrokes((prev) => [...prev, stroke])
  }, [])

  const handleStrokeUpdate = useCallback((stroke: Stroke) => {
    replayingRef.current = false
    setStrokes((prev) => prev.map((s) => (s.id === stroke.id ? stroke : s)))
  }, [])

  // The finished stroke is pushed to the server once, when drawing ends.
  const handleStrokeEnd = useCallback(
    (stroke: Stroke) => {
      const stack = undoStackRef.current
      if (stack.length > 0 && stack[stack.length - 1].id === stroke.id) {
        stack[stack.length - 1] = stroke
      }
      sendEvent('add', stroke as unknown as Record<string, unknown>)
    },
    [sendEvent]
  )

  const handleUndo = useCallback(() => {
    const stroke = undoStackRef.current.pop()
    if (stroke) {
      replayingRef.current = false
      redoStackRef.current.push(stroke)
      setStrokes((prev) => prev.filter((s) => s.id !== stroke.id))
      sendEvent('delete', { id: stroke.id })
    }
  }, [sendEvent])

  const handleRedo = useCallback(() => {
    const stroke = redoStackRef.current.pop()
    if (stroke) {
      replayingRef.current = false
      undoStackRef.current.push(stroke)
      setStrokes((prev) => [...prev.filter((s) => s.id !== stroke.id), stroke])
      sendEvent('add', stroke as unknown as Record<string, unknown>)
    }
  }, [sendEvent])

  // Clearing wipes the shared board for everyone and is not undoable.
  const handleClear = useCallback(() => {
    replayingRef.current = false
    undoStackRef.current = []
    redoStackRef.current = []
    setStrokes([])
    sendEvent('clear', {})
  }, [sendEvent])

  const handleReplayEvent = useCallback((event: Record<string, unknown>) => {
    replayingRef.current = true
    setStrokes((prev) => applyEventsToStrokes(prev, [event as unknown as ReplayEvent]))
  }, [])

  const handleEventSeek = useCallback(
    (index: number) => {
      replayingRef.current = true
      setStrokes(applyEventsToStrokes([], events.slice(0, index + 1)))
    },
    [events]
  )

  const sync = SYNC_META[syncStatus]

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-left">
          <button className="btn back-btn" onClick={() => navigate('/')}>
            <span aria-hidden="true">←</span> Boards
          </button>
          <h1 className="board-title">{boardName}</h1>
        </div>
        <div className="header-actions">
          <span className={`sync-pill ${sync.cls}`} title={sync.title}>
            <span className="sync-dot" aria-hidden="true" />
            {sync.label}
          </span>
          <span className="user-badge" title="Your doodle identity on this board">
            {userId}
          </span>
        </div>
      </div>

      <div className="board-area">
        <Canvas
          strokes={strokes}
          tool={tool}
          color={color}
          width={width}
          onStrokeAdd={handleStrokeAdd}
          onStrokeUpdate={handleStrokeUpdate}
          onStrokeEnd={handleStrokeEnd}
        />
        <Toolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          width={width}
          setWidth={setWidth}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          onExport={() => setShowExport(true)}
          canUndo={undoStackRef.current.length > 0}
          canRedo={redoStackRef.current.length > 0}
        />
        {boardLoading && (
          <div className="board-loading" role="status">
            <span className="board-loading-dot" />
            <span className="board-loading-dot" />
            <span className="board-loading-dot" />
            <span className="board-loading-text">Fetching your strokes…</span>
          </div>
        )}
        {!boardLoading && strokes.length === 0 && (
          <div className="canvas-hint" aria-hidden="true">
            <svg viewBox="0 0 90 60" width="72" height="48">
              <path
                d="M12 44c8-20 14-30 22-28s0 18 10 18 10-12 22-14"
                fill="none"
                stroke="var(--text-faint)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Grab a pen and make a mark</span>
          </div>
        )}
      </div>

      <SessionTimeline
        events={events}
        onReplayEvent={handleReplayEvent}
        onEventSeek={handleEventSeek}
      />

      {showExport && boardId !== null && (
        <ExportDialog boardId={boardId} onClose={() => setShowExport(false)} />
      )}
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<BoardList />} />
      <Route path="/board/:boardId" element={<Whiteboard />} />
    </Routes>
  )
}

export default App
