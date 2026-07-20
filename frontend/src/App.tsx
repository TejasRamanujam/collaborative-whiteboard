import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import SessionTimeline from './components/SessionTimeline'
import ExportDialog from './components/ExportDialog'
import PresenceCursors from './components/PresenceCursors'
import PresenceRoster from './components/PresenceRoster'
import BoardThumbnail from './components/BoardThumbnail'
import { usePollingSync } from './hooks/usePollingSync'
import { useLiveblocksRoom, BoardRoomEvent } from './hooks/useLiveblocksRoom'
import { fetchBoards, createBoard, deleteBoard, fetchBoard } from './api'
import { Stroke, Tool, Board, ViewTransform } from './types'
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

function pad(n: number, w = 2): string {
  return String(Math.max(0, n)).padStart(w, '0')
}

/* ============================ THE LEDGER ============================ */

function BoardIndex() {
  const navigate = useNavigate()
  const [boards, setBoards] = useState<Board[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    document.title = 'Scribbly — The Proof Room'
    fetchBoards()
      .then((bs) => Array.isArray(bs) && setBoards(bs))
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
    if (
      !window.confirm(
        `Strike plate "${b.name}" from the ledger, with its entire stroke log? This cannot be undone.`
      )
    )
      return
    try {
      await deleteBoard(b.id)
      setBoards((prev) => prev.filter((x) => x.id !== b.id))
    } catch {
      window.alert('Could not strike the plate — try again.')
    }
  }

  return (
    <div className="index-page">
      <div className="index-frame">
        <header className="index-topbar">
          <a className="demos-link" href="https://tejas-live-demos.vercel.app">
            ← Back to demos
          </a>
          <span className="topbar-tag" aria-hidden="true">
            the proof room · est. every stroke on file
          </span>
        </header>

        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title" className="wordmark">
            Scribbly<span className="wordmark-tick" aria-hidden="true">*</span>
          </h1>
          <p className="hero-sub">
            A shared drawing plate. Every stroke is broadcast live to everyone at the
            bench, filed in a permanent log, and replayable on a timeline.
          </p>
          <p className="hero-annot" aria-label="Capabilities">
            realtime sync <span aria-hidden="true">·</span> live cursors{' '}
            <span aria-hidden="true">·</span> timeline replay
          </p>
        </section>

        <div className="create-row">
          <input
            className="create-input"
            placeholder="Title a new plate…"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            aria-label="New board name"
          />
          <button className="create-btn" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? 'cutting…' : 'cut plate'}
          </button>
        </div>

        <div className="board-list-head" aria-hidden="true">
          <span>proof</span>
          <span>№</span>
          <span>plate</span>
          <span className="head-date">cut</span>
        </div>

        {loading && (
          <div className="board-skeletons" aria-hidden="true">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        )}

        {!loading && (
          <ul className="board-list">
            {boards.map((b, i) => (
              <li
                key={b.id}
                className="board-row"
                style={{ '--i': i } as React.CSSProperties}
              >
                <button className="board-open" onClick={() => navigate(`/board/${b.id}`)}>
                  <BoardThumbnail strokes={b.strokes || []} />
                  <span className="board-no" aria-hidden="true">
                    № {pad(b.id)}
                  </span>
                  <span className="board-name">{b.name}</span>
                  <span className="board-date">
                    {b.created_at
                      ? new Date(b.created_at).toLocaleDateString(undefined, {
                          year: '2-digit',
                          month: 'short',
                          day: '2-digit',
                        })
                      : '—'}
                  </span>
                  <span className="board-go" aria-hidden="true">
                    open →
                  </span>
                </button>
                {b.protected ? (
                  <span className="board-protected" title="Curated showcase plate — shared drawing remains enabled">
                    proof
                  </span>
                ) : (
                  <button
                    className="board-delete"
                    aria-label={`Delete board ${b.name}`}
                    title="Strike this plate from the ledger"
                    onClick={() => handleDelete(b)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!loading && boards.length === 0 && (
          <div className="empty-state">
            <div className="empty-plate" aria-hidden="true">
              <svg viewBox="0 0 120 64" width="120" height="64">
                <path
                  d="M14 46c9-22 15-32 22-30s1 18 10 18 10-12 22-14"
                  fill="none"
                  stroke="var(--plate-soft)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="88" cy="44" r="3.5" fill="var(--verm)" />
              </svg>
            </div>
            <p className="empty-title">Nothing in the ledger</p>
            <p className="empty-hint">Title a plate above and pull the first proof.</p>
          </div>
        )}

        <footer className="index-footer">
          <span>scribbly</span>
          <span aria-hidden="true">·</span>
          <span>the proof room</span>
          <span aria-hidden="true">·</span>
          <span>every stroke on file</span>
        </footer>
      </div>
    </div>
  )
}

/* ============================ THE PRESS ============================ */

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
  realtime: {
    cls: 'realtime',
    label: 'realtime',
    title: 'Connected in realtime — strokes and cursors appear instantly',
  },
  live: {
    cls: 'live',
    label: 'syncing',
    title: 'Synced with everyone at this bench every few seconds',
  },
  connecting: {
    cls: 'connecting',
    label: 'linking…',
    title: 'Reaching the press',
  },
  offline: {
    cls: 'offline',
    label: 'offline',
    title: 'Can’t reach the press right now — new strokes stay local until it’s back',
  },
} as const

function Whiteboard() {
  const { boardId: boardIdStr } = useParams<{ boardId: string }>()
  const boardId = boardIdStr ? parseInt(boardIdStr, 10) : null
  const [userId] = useState(getUserId)
  const navigate = useNavigate()

  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#f2ede0')
  const [width, setWidth] = useState(3)
  const [showExport, setShowExport] = useState(false)
  const [events, setEvents] = useState<ReplayEvent[]>([])
  const [boardLoading, setBoardLoading] = useState(true)
  const [protectedBoard, setProtectedBoard] = useState(false)
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 })

  // Per-user undo/redo: the stacks hold this client's own strokes only, so
  // undoing never deletes another participant's work on the shared board.
  const undoStackRef = useRef<Stroke[]>([])
  const redoStackRef = useRef<Stroke[]>([])
  // True while the timeline is replaying/scrubbing — polling is paused so the
  // replay view isn't stomped by live updates.
  const replayingRef = useRef(false)

  const [boardName, setBoardName] = useState('Plate')
  const [autoReplay, setAutoReplay] = useState(false)

  // Replay a well-stocked board once per session on first open, so the
  // timeline feature shows itself.
  useEffect(() => {
    if (boardLoading || boardId === null || events.length < 20) return
    const key = `scribbly-autoplayed-${boardId}`
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      setAutoReplay(true)
    }
  }, [boardLoading, boardId, events.length])

  useEffect(() => {
    document.title = `${boardName} — Scribbly`
  }, [boardName])

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

  // Realtime transport (Liveblocks). Broadcast events from other clients are
  // applied immediately; the polling loop below reconciles against the
  // durable Neon event log (idempotent by stroke id, so no double-apply).
  const handleRealtimeEvent = useCallback((ev: BoardRoomEvent) => {
    if (replayingRef.current) return
    if (protectedBoard && ev.event_type !== 'add') return
    setStrokes((prev) =>
      applyEventsToStrokes(prev, [
        { event_type: ev.event_type, stroke_data: ev.stroke_data } as ReplayEvent,
      ])
    )
  }, [protectedBoard])

  const {
    connected: rtConnected,
    others: remoteCursors,
    participants,
    broadcast,
    updateCursor,
  } = useLiveblocksRoom(boardId, userId, handleRealtimeEvent)

  // Polling is primary transport at 2.5s; once realtime is connected it only
  // reconciles (and feeds the timeline), so stretch it to 12s.
  const pollIntervalRef = useRef(2500)
  useEffect(() => {
    pollIntervalRef.current = rtConnected ? 12000 : 2500
  }, [rtConnected])

  const { status: syncStatus, sendEvent } = usePollingSync(
    boardId,
    userId,
    handleRemoteEvents,
    replayingRef,
    pollIntervalRef
  )

  // Every local mutation goes to the durable event log AND out over realtime.
  const emitEvent = useCallback(
    (event_type: string, stroke_data: Record<string, unknown>) => {
      sendEvent(event_type, stroke_data)
      broadcast({ event_type, stroke_data, user_id: userId })
    },
    [sendEvent, broadcast, userId]
  )

  // Live cursor presence, throttled to ~40ms, in world coordinates.
  const lastCursorSentRef = useRef(0)
  const handleCursorMove = useCallback(
    (x: number, y: number) => {
      const now = performance.now()
      if (now - lastCursorSentRef.current < 40) return
      lastCursorSentRef.current = now
      updateCursor({ x, y })
    },
    [updateCursor]
  )
  const handlePointerLeave = useCallback(() => {
    updateCursor(null)
  }, [updateCursor])

  useEffect(() => {
    if (boardId === null) return
    setBoardLoading(true)
    setProtectedBoard(false)
    setEvents([])
    setStrokes([])
    setView({ x: 0, y: 0, scale: 1 })
    undoStackRef.current = []
    redoStackRef.current = []
    fetchBoard(boardId).then((b) => {
      if (b) {
        setBoardName(b.name || 'Plate')
        setProtectedBoard(Boolean(b.protected))
      }
    })
  }, [boardId])

  // The board is "loaded" once the first poll answers (the full event log
  // rebuilds the drawing) — or fails, in which case we show the offline note.
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
      emitEvent('add', stroke as unknown as Record<string, unknown>)
    },
    [emitEvent]
  )

  const handleStrokeCommit = useCallback(
    (stroke: Stroke) => {
      replayingRef.current = false
      emitEvent('update', stroke as unknown as Record<string, unknown>)
    },
    [emitEvent]
  )

  const handleUndo = useCallback(() => {
    if (protectedBoard) return
    const stroke = undoStackRef.current.pop()
    if (stroke) {
      replayingRef.current = false
      redoStackRef.current.push(stroke)
      setStrokes((prev) => prev.filter((s) => s.id !== stroke.id))
      emitEvent('delete', { id: stroke.id })
    }
  }, [emitEvent, protectedBoard])

  const handleRedo = useCallback(() => {
    if (protectedBoard) return
    const stroke = redoStackRef.current.pop()
    if (stroke) {
      replayingRef.current = false
      undoStackRef.current.push(stroke)
      setStrokes((prev) => [...prev.filter((s) => s.id !== stroke.id), stroke])
      emitEvent('add', stroke as unknown as Record<string, unknown>)
    }
  }, [emitEvent, protectedBoard])

  // Clearing wipes the shared board for everyone and is not undoable.
  const handleClear = useCallback(() => {
    if (protectedBoard) return
    if (!window.confirm('Wipe the plate for everyone? The timeline keeps the history.')) return
    replayingRef.current = false
    undoStackRef.current = []
    redoStackRef.current = []
    setStrokes([])
    emitEvent('clear', {})
  }, [emitEvent, protectedBoard])

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

  const handleReplayReset = useCallback(() => {
    replayingRef.current = false
    setStrokes(applyEventsToStrokes([], events))
  }, [events])

  // Tool hotkeys — documented in the apparatus rail. Skipped while typing.
  useEffect(() => {
    const keys: Record<string, Tool> = {
      p: 'pen',
      v: 'select',
      m: 'highlighter',
      e: 'eraser',
      r: 'rectangle',
      o: 'circle',
      l: 'line',
      t: 'text',
    }
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (ev.metaKey || ev.ctrlKey) {
        if (ev.key.toLowerCase() === 'z') {
          ev.preventDefault()
          if (ev.shiftKey) handleRedo()
          else handleUndo()
        }
        return
      }
      const tool = keys[ev.key.toLowerCase()]
      if (tool && !(protectedBoard && (tool === 'eraser' || tool === 'select'))) setTool(tool)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleUndo, handleRedo, protectedBoard])

  useEffect(() => {
    if (protectedBoard && (tool === 'eraser' || tool === 'select')) setTool('pen')
  }, [protectedBoard, tool])

  const sync = SYNC_META[rtConnected ? 'realtime' : syncStatus]
  return (
    <div className="deck">
      <header className="deck-top">
        <div className="deck-top-left">
          <button className="back-key" onClick={() => navigate('/')} aria-label="Back to the ledger">
            ← index
          </button>
          <div className="board-id-block">
            <span className="board-no-chip" aria-hidden="true">
              plate № {boardId !== null ? pad(boardId) : '--'}
            </span>
            <h1 className="deck-title">{boardName}</h1>
          </div>
        </div>
        <div className="deck-top-right">
          <PresenceRoster self={userId} participants={participants} />
          <span className={`sync-module ${sync.cls}`} title={sync.title} role="status">
            <span className="sync-dot" aria-hidden="true" />
            {sync.label}
          </span>
          <span className="user-chip" title="Your mark in the log">
            you · {userId}
          </span>
        </div>
      </header>

      <div className="deck-mid">
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
          protectedBoard={protectedBoard}
        />

        <div className="press-bed">
          <div
            className="board-area"
            onPointerLeave={handlePointerLeave}
          >
            <Canvas
              strokes={strokes}
              tool={tool}
              color={color}
              width={width}
              view={view}
              onViewChange={setView}
              onStrokeAdd={handleStrokeAdd}
              onStrokeUpdate={handleStrokeUpdate}
              onStrokeEnd={handleStrokeEnd}
              onStrokeCommit={handleStrokeCommit}
              onCursorMove={handleCursorMove}
            />
            <PresenceCursors cursors={remoteCursors} view={view} />
            {boardLoading && (
              <div className="board-loading" role="status">
                reading the log
                <span className="loading-dots" aria-hidden="true">
                  <i>.</i>
                  <i>.</i>
                  <i>.</i>
                </span>
              </div>
            )}
            {!boardLoading && strokes.length === 0 && (
              <div className="canvas-hint" aria-hidden="true">
                blank plate — make a mark
              </div>
            )}
          </div>
          <div className="plate-caption" aria-hidden="true">
            <span>plate № {boardId !== null ? pad(boardId) : '--'} · dark litho stone</span>
            <span>{protectedBoard ? 'curated proof · additive marks only' : 'every stroke filed to the log'}</span>
          </div>
        </div>
      </div>

      <SessionTimeline
        events={events}
        onReplayEvent={handleReplayEvent}
        onEventSeek={handleEventSeek}
        onResetToLive={handleReplayReset}
        autoplay={autoReplay}
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
      <Route path="/" element={<BoardIndex />} />
      <Route path="/board/:boardId" element={<Whiteboard />} />
    </Routes>
  )
}

export default App
