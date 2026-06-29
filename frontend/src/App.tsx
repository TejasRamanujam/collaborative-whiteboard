import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import PresenceCursors from './components/PresenceCursors'
import SessionTimeline from './components/SessionTimeline'
import ExportDialog from './components/ExportDialog'
import { useWebSocket } from './hooks/useWebSocket'
import { fetchBoards, createBoard, fetchBoard, fetchEvents, saveStrokes } from './api'
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

function BoardList() {
  const navigate = useNavigate()
  const [boards, setBoards] = useState<Board[]>([])
  const [name, setName] = useState('')

  useEffect(() => {
    fetchBoards().then(setBoards)
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    const board = await createBoard(name.trim())
    setBoards((prev) => [board, ...prev])
    setName('')
    navigate(`/board/${board.id}`)
  }

  return (
    <div className="board-list">
      <h1>Whiteboards</h1>
      <p className="subtitle">Collaborate in real time. Pick up where you left off.</p>

      <div className="create-row">
        <input
          className="create-input"
          placeholder="New board name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button className="btn btn-primary" onClick={handleCreate}>
          + Create
        </button>
      </div>

      {boards.map((b) => (
        <div
          key={b.id}
          className="board-card"
          onClick={() => navigate(`/board/${b.id}`)}
        >
          <div>
            <div className="board-name">{b.name}</div>
            <div className="board-date">
              {b.created_at ? new Date(b.created_at).toLocaleString() : ''}
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
        </div>
      ))}

      {boards.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 32 }}>
          No boards yet. Create one to get started.
        </p>
      )}
    </div>
  )
}

function Whiteboard() {
  const { boardId: boardIdStr } = useParams<{ boardId: string }>()
  const boardId = boardIdStr ? parseInt(boardIdStr, 10) : null
  const [userId] = useState(getUserId)
  const navigate = useNavigate()

  const { send, connected, addListener } = useWebSocket(boardId, userId)

  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#ffffff')
  const [width, setWidth] = useState(3)
  const [cursors, setCursors] = useState<{ user_id: string; x: number; y: number }[]>([])
  const [showExport, setShowExport] = useState(false)
  const [events, setEvents] = useState<ReplayEvent[]>([])

  const undoStackRef = useRef<Stroke[][]>([])
  const redoStackRef = useRef<Stroke[][]>([])
  const loadedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // True while the timeline is replaying/scrubbing — saves are suppressed so a
  // temporary replay view can't overwrite the saved board.
  const replayingRef = useRef(false)

  const [boardName, setBoardName] = useState('Whiteboard')

  useEffect(() => {
    if (boardId === null) return
    loadedRef.current = false
    fetchBoard(boardId).then((b) => {
      if (b && b.strokes) {
        setStrokes(b.strokes as Stroke[])
        setBoardName(b.name || 'Whiteboard')
      }
      loadedRef.current = true
    })
    fetchEvents(boardId).then(setEvents)
  }, [boardId])

  // Persist strokes to the backend over REST (debounced) so drawings are saved
  // without a live websocket server. Guarded by loadedRef so the initial empty
  // state can't overwrite a board before it has loaded.
  useEffect(() => {
    if (boardId === null || !loadedRef.current || replayingRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveStrokes(boardId, strokes)
    }, 600)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [strokes, boardId])

  const pushUndo = useCallback((s: Stroke[]) => {
    undoStackRef.current.push([...s])
    if (undoStackRef.current.length > 50) undoStackRef.current.shift()
    redoStackRef.current = []
  }, [])

  const handleStrokeAdd = useCallback(
    (stroke: Stroke) => {
      replayingRef.current = false
      pushUndo(strokes)
      setStrokes((prev) => [...prev, stroke])
      send({ type: 'stroke_add', data: stroke })
    },
    [strokes, send, pushUndo]
  )

  const handleStrokeUpdate = useCallback(
    (stroke: Stroke) => {
      replayingRef.current = false
      setStrokes((prev) =>
        prev.map((s) => (s.id === stroke.id ? stroke : s))
      )
      send({ type: 'stroke_update', data: stroke })
    },
    [send]
  )

  const handleCursorMove = useCallback(
    (x: number, y: number) => {
      send({ type: 'cursor_move', x, y })
    },
    [send]
  )

  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop()
    if (prev) {
      replayingRef.current = false
      redoStackRef.current.push([...strokes])
      setStrokes(prev)
    }
  }, [strokes])

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop()
    if (next) {
      replayingRef.current = false
      undoStackRef.current.push([...strokes])
      setStrokes(next)
    }
  }, [strokes])

  const handleClear = useCallback(() => {
    replayingRef.current = false
    pushUndo(strokes)
    setStrokes([])
    send({ type: 'board_clear', data: {} })
  }, [strokes, send, pushUndo])

  useEffect(() => {
    const unsub = addListener((msg) => {
      if (msg.type === 'stroke_event') {
        const data = msg.data as Stroke
        const eventType = msg.event_type as string
        if (eventType === 'add') {
          setStrokes((prev) => [...prev.filter((s) => s.id !== data.id), data])
        } else if (eventType === 'update') {
          setStrokes((prev) =>
            prev.map((s) => (s.id === data.id ? data : s))
          )
        } else if (eventType === 'delete') {
          setStrokes((prev) => prev.filter((s) => s.id !== data.id))
        } else if (eventType === 'clear') {
          setStrokes([])
        }
      } else if (msg.type === 'cursor_move') {
        setCursors((prev) => {
          const filtered = prev.filter((c) => c.user_id !== (msg.user_id as string))
          return [...filtered, { user_id: msg.user_id as string, x: msg.x as number, y: msg.y as number }]
        })
      }
    })
    return unsub
  }, [addListener])

  const handleReplayEvent = useCallback(
    (event: Record<string, unknown>) => {
      replayingRef.current = true
      const data = event.stroke_data as Stroke | undefined
      if (!data) return
      const et = event.event_type as string
      if (et === 'add') {
        setStrokes((prev) => [...prev.filter((s) => s.id !== data.id), data])
      } else if (et === 'delete') {
        setStrokes((prev) => prev.filter((s) => s.id !== data.id))
      } else if (et === 'clear') {
        setStrokes([])
      }
    },
    []
  )

  const handleEventSeek = useCallback(
    async (index: number) => {
      if (boardId === null) return
      replayingRef.current = true
      const allEvents = await fetchEvents(boardId)
      setStrokes([])
      for (let i = 0; i <= index && i < allEvents.length; i++) {
        const ev = allEvents[i] as Record<string, unknown>
        const data = ev.stroke_data as Stroke | undefined
        if (!data) continue
        const et = ev.event_type as string
        if (et === 'add') {
          setStrokes((prev) => [...prev.filter((s) => s.id !== data.id), data])
        }
      }
    },
    [boardId]
  )

  const otherCursors = cursors.filter((c) => c.user_id !== userId)

  return (
    <div className="app">
      <div className="app-header">
        <h1>{boardName}</h1>
        <div className="header-actions">
          <span className="user-badge">{userId}</span>
          <span
            className={`conn-dot ${connected ? 'online' : 'offline'}`}
            title={connected ? 'Connected' : 'Disconnected'}
          />
          <button className="btn" onClick={() => navigate('/')}>
            ← Boards
          </button>
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
          onCursorMove={handleCursorMove}
        />
        <PresenceCursors cursors={otherCursors} />
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
