import React, { useCallback, useEffect, useRef, useState } from 'react'
import { drawStroke, findStrokeAt, strokeBounds, translateStroke } from '../drawing'
import type { Point, Stroke, Tool, ViewTransform } from '../types'

interface CanvasProps {
  strokes: Stroke[]
  tool: Tool
  color: string
  width: number
  view: ViewTransform
  onViewChange: (view: ViewTransform) => void
  onStrokeAdd: (stroke: Stroke) => void
  onStrokeUpdate: (stroke: Stroke) => void
  onStrokeEnd?: (stroke: Stroke) => void
  onStrokeCommit?: (stroke: Stroke) => void
  onCursorMove?: (x: number, y: number) => void
  readOnly?: boolean
}

interface TextDraft {
  point: Point
  value: string
}

const Canvas: React.FC<CanvasProps> = ({
  strokes,
  tool,
  color,
  width,
  view,
  onViewChange,
  onStrokeAdd,
  onStrokeUpdate,
  onStrokeEnd,
  onStrokeCommit,
  onCursorMove,
  readOnly,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentStrokeRef = useRef<Stroke | null>(null)
  const drawingRef = useRef(false)
  const spaceRef = useRef(false)
  const panRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null)
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>())
  const textCommittingRef = useRef(false)
  const selectionDragRef = useRef<{ origin: Point; original: Stroke; current: Stroke; moved: boolean } | null>(null)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const renderAll = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(view.x, view.y)
    ctx.scale(view.scale, view.scale)
    for (const stroke of strokes) {
      if (stroke.deleted) continue
      if (stroke.image_data) {
        let image = imageCacheRef.current.get(stroke.image_data)
        if (!image) {
          image = new Image()
          image.src = stroke.image_data
          image.onload = renderAll
          imageCacheRef.current.set(stroke.image_data, image)
        }
        if (image.complete) ctx.drawImage(image, stroke.x ?? 50, stroke.y ?? 50)
      } else {
        drawStroke(ctx, stroke)
      }
    }
    const selected = strokes.find((stroke) => stroke.id === selectedId)
    const bounds = selected ? strokeBounds(selected) : null
    if (bounds) {
      const padding = 5 / view.scale
      ctx.save()
      ctx.strokeStyle = '#ff6a3d'
      ctx.lineWidth = 1.5 / view.scale
      ctx.setLineDash([6 / view.scale, 4 / view.scale])
      ctx.strokeRect(
        bounds.minX - padding,
        bounds.minY - padding,
        bounds.maxX - bounds.minX + padding * 2,
        bounds.maxY - bounds.minY + padding * 2
      )
      ctx.restore()
    }
    ctx.restore()
  }, [selectedId, strokes, view])

  useEffect(() => renderAll(), [renderAll])

  useEffect(() => {
    if (tool !== 'select') setSelectedId(null)
  }, [tool])

  useEffect(() => {
    if (selectedId && !strokes.some((stroke) => stroke.id === selectedId && !stroke.deleted)) {
      setSelectedId(null)
    }
  }, [selectedId, strokes])

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    const resize = () => {
      const rect = parent.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width))
      canvas.height = Math.max(1, Math.round(rect.height))
      renderAll()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(parent)
    resize()
    return () => observer.disconnect()
  }, [renderAll])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !(event.target instanceof HTMLInputElement)) {
        spaceRef.current = true
      }
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceRef.current = false
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
    }
  }, [])

  const eventPosition = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const source = 'touches' in event
      ? (event.touches[0] || event.changedTouches[0])
      : event
    return { clientX: source.clientX, clientY: source.clientY, x: source.clientX - rect.left, y: source.clientY - rect.top }
  }, [])

  const getCanvasPoint = useCallback((event: React.MouseEvent | React.TouchEvent): Point => {
    const position = eventPosition(event)
    return {
      x: (position.x - view.x) / view.scale,
      y: (position.y - view.y) / view.scale,
      pressure: 0.5,
    }
  }, [eventPosition, view])

  const startDraw = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const position = eventPosition(event)
    const panGesture = 'button' in event && (event.button === 1 || spaceRef.current)
    if (panGesture) {
      event.preventDefault()
      panRef.current = { clientX: position.clientX, clientY: position.clientY, x: view.x, y: view.y }
      return
    }
    if (readOnly) return
    event.preventDefault()
    const point = getCanvasPoint(event)
    onCursorMove?.(point.x, point.y)
    if (tool === 'select') {
      const selected = findStrokeAt(strokes, point, 8 / view.scale)
      setSelectedId(selected?.id ?? null)
      selectionDragRef.current = selected
        ? { origin: point, original: selected, current: selected, moved: false }
        : null
      return
    }
    if (tool === 'text') {
      textCommittingRef.current = false
      setTextDraft({ point, value: '' })
      return
    }

    const userId = localStorage.getItem('whiteboard_user_id') || 'user'
    const stroke: Stroke = {
      id: `${userId}_${Date.now()}`,
      user_id: userId,
      points: [point],
      color: tool === 'eraser' ? '#0f1117' : color,
      width: tool === 'highlighter' || tool === 'eraser' ? width * 2 : width,
      tool,
      deleted: false,
      timestamp: Date.now(),
    }
    drawingRef.current = true
    currentStrokeRef.current = stroke
    onStrokeAdd(stroke)
  }, [color, eventPosition, getCanvasPoint, onCursorMove, onStrokeAdd, readOnly, strokes, tool, view, width])

  const move = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    const position = eventPosition(event)
    if (panRef.current) {
      event.preventDefault()
      onViewChange({
        ...view,
        x: panRef.current.x + position.clientX - panRef.current.clientX,
        y: panRef.current.y + position.clientY - panRef.current.clientY,
      })
      return
    }
    const point = getCanvasPoint(event)
    onCursorMove?.(point.x, point.y)
    if (selectionDragRef.current && !readOnly) {
      event.preventDefault()
      const translated = translateStroke(
        selectionDragRef.current.original,
        point.x - selectionDragRef.current.origin.x,
        point.y - selectionDragRef.current.origin.y
      )
      selectionDragRef.current.current = translated
      selectionDragRef.current.moved = true
      onStrokeUpdate(translated)
      return
    }
    if (!drawingRef.current || !currentStrokeRef.current || readOnly) return
    event.preventDefault()
    const shape = ['rectangle', 'circle', 'line'].includes(currentStrokeRef.current.tool)
    const points = shape
      ? [currentStrokeRef.current.points[0], point]
      : [...currentStrokeRef.current.points, point]
    const updated = { ...currentStrokeRef.current, points, timestamp: Date.now() }
    currentStrokeRef.current = updated
    onStrokeUpdate(updated)
  }, [eventPosition, getCanvasPoint, onCursorMove, onStrokeUpdate, onViewChange, readOnly, view])

  const endDraw = useCallback(() => {
    if (panRef.current) {
      panRef.current = null
      return
    }
    if (selectionDragRef.current) {
      const { current: moved, moved: didMove } = selectionDragRef.current
      selectionDragRef.current = null
      if (didMove) onStrokeCommit?.(moved)
      return
    }
    if (!drawingRef.current) return
    const finished = currentStrokeRef.current
    drawingRef.current = false
    currentStrokeRef.current = null
    if (finished) onStrokeEnd?.(finished)
  }, [onStrokeCommit, onStrokeEnd])

  const commitText = useCallback((value: string) => {
    if (textCommittingRef.current) return
    textCommittingRef.current = true
    const draft = textDraft
    setTextDraft(null)
    if (!draft || !value.trim()) return
    const userId = localStorage.getItem('whiteboard_user_id') || 'user'
    const stroke: Stroke = {
      id: `${userId}_${Date.now()}`,
      user_id: userId,
      points: [draft.point],
      color,
      width,
      tool: 'text',
      text: value.trim(),
      font_size: Math.max(16, 12 + width * 2),
      deleted: false,
      timestamp: Date.now(),
    }
    onStrokeAdd(stroke)
    onStrokeEnd?.(stroke)
  }, [color, onStrokeAdd, onStrokeEnd, textDraft, width])

  // React registers wheel listeners as passive, so preventDefault inside
  // onWheel is ignored — attach a non-passive native listener instead.
  const zoom = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const scale = Math.min(4, Math.max(0.25, view.scale * Math.exp(-event.deltaY * 0.0015)))
    const worldX = (x - view.x) / view.scale
    const worldY = (y - view.y) / view.scale
    onViewChange({ scale, x: x - worldX * scale, y: y - worldY * scale })
  }, [onViewChange, view])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', zoom, { passive: false })
    return () => canvas.removeEventListener('wheel', zoom)
  }, [zoom])

  return (
    <div className="canvas-stage">
      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
        data-tool={tool}
        onMouseDown={startDraw}
        onMouseMove={move}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={move}
        onTouchEnd={endDraw}
        onDoubleClick={() => onViewChange({ x: 0, y: 0, scale: 1 })}
        style={{ touchAction: 'none', width: '100%', height: '100%' }}
      />
      {textDraft && (
        <input
          className="canvas-text-input"
          style={{
            left: textDraft.point.x * view.scale + view.x,
            top: textDraft.point.y * view.scale + view.y,
            color,
            fontSize: Math.max(16, 12 + width * 2) * view.scale,
          }}
          value={textDraft.value}
          onChange={(event) => setTextDraft({ ...textDraft, value: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitText(textDraft.value)
            } else if (event.key === 'Escape') {
              setTextDraft(null)
            }
          }}
          onBlur={() => commitText(textDraft.value)}
          aria-label="Text on plate"
          autoFocus
        />
      )}
      <div className="view-controls" aria-label="Canvas view controls">
        <span>{Math.round(view.scale * 100)}%</span>
        <button type="button" onClick={() => onViewChange({ x: 0, y: 0, scale: 1 })}>fit</button>
      </div>
    </div>
  )
}

export default Canvas
