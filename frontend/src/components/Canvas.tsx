import React, { useRef, useEffect, useCallback, useState } from 'react'
import { Stroke, Point, Tool } from '../types'

interface CanvasProps {
  strokes: Stroke[]
  tool: Tool
  color: string
  width: number
  onStrokeAdd: (stroke: Stroke) => void
  onStrokeUpdate: (stroke: Stroke) => void
  onCursorMove: (x: number, y: number) => void
  readOnly?: boolean
}

interface ShapeDraft {
  type: 'rectangle' | 'circle' | 'line'
  startX: number
  startY: number
  endX: number
  endY: number
}

const USER_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
  '#ff8c32', '#845ec2', '#00c9a7', '#c34a36',
]

function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

function smoothPoints(points: Point[]): Point[] {
  if (points.length < 3) return points
  const smoothed: Point[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    smoothed.push({
      x: (points[i - 1].x + points[i].x + points[i + 1].x) / 3,
      y: (points[i - 1].y + points[i].y + points[i + 1].y) / 3,
      pressure: points[i].pressure,
    })
  }
  smoothed.push(points[points.length - 1])
  return smoothed
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = smoothPoints(stroke.points || [])
  if (pts.length === 0) return

  ctx.save()
  ctx.strokeStyle = stroke.tool === 'eraser' ? '#0f1117' : stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = 0.3
    ctx.lineWidth = stroke.width * 3
  } else if (stroke.tool === 'rectangle') {
    if (pts.length >= 2) {
      const start = pts[0]
      const end = pts[pts.length - 1]
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
      ctx.restore()
      return
    }
  } else if (stroke.tool === 'circle') {
    if (pts.length >= 2) {
      const start = pts[0]
      const end = pts[pts.length - 1]
      const cx = (start.x + end.x) / 2
      const cy = (start.y + end.y) / 2
      const rx = Math.abs(end.x - start.x) / 2
      const ry = Math.abs(end.y - start.y) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      return
    }
  }

  ctx.beginPath()
  if (pts.length === 1) {
    ctx.arc(pts[0].x, pts[0].y, stroke.width / 4, 0, Math.PI * 2)
    ctx.fillStyle = stroke.tool === 'eraser' ? '#0f1117' : stroke.color
    ctx.fill()
  } else {
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      const midX = (pts[i - 1].x + pts[i].x) / 2
      const midY = (pts[i - 1].y + pts[i].y) / 2
      if (i === 1) {
        ctx.lineTo(midX, midY)
      }
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, midX, midY)
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.stroke()
  }
  ctx.restore()
}

const Canvas: React.FC<CanvasProps> = ({
  strokes,
  tool,
  color,
  width,
  onStrokeAdd,
  onStrokeUpdate,
  onCursorMove,
  readOnly,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<Stroke | null>(null)
  const animFrameRef = useRef<number>(0)
  const shapeDraftRef = useRef<ShapeDraft | null>(null)
  const [, setRenderTick] = useState(0)

  const renderAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let offscreen = offscreenRef.current
    if (!offscreen) {
      offscreen = document.createElement('canvas')
      offscreenRef.current = offscreen
    }
    // Keep the offscreen buffer the same size as the visible canvas; otherwise
    // strokes outside the buffer's initial (default 300x150) size get clipped,
    // leaving the board blank after a resize/reload.
    if (offscreen.width !== canvas.width || offscreen.height !== canvas.height) {
      offscreen.width = canvas.width
      offscreen.height = canvas.height
    }

    const ctx = offscreen.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, offscreen.width, offscreen.height)
    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, offscreen.width, offscreen.height)

    for (const stroke of strokes) {
      if (stroke.deleted) continue
      if (stroke.image_data) {
        const img = new Image()
        img.src = stroke.image_data
        if (img.complete) {
          ctx.drawImage(img, stroke.x || 50, stroke.y || 50)
        } else {
          img.onload = () => {
            ctx.drawImage(img, stroke.x || 50, stroke.y || 50)
          }
        }
        continue
      }
      drawStroke(ctx, stroke)
    }

    const mainCtx = canvas.getContext('2d')
    if (mainCtx) {
      mainCtx.clearRect(0, 0, canvas.width, canvas.height)
      mainCtx.drawImage(offscreen, 0, 0)
    }
  }, [strokes])

  useEffect(() => {
    renderAll()
  }, [renderAll])

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (rect) {
        canvas.width = rect.width
        canvas.height = rect.height
        renderAll()
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [renderAll])

  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      pressure: 0.5,
    }
  }, [])

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (readOnly) return
      e.preventDefault()
      const pt = getCanvasPoint(e)
      isDrawingRef.current = true

      const userId = localStorage.getItem('userId') || 'user'

      if (tool === 'rectangle' || tool === 'circle' || tool === 'line') {
        shapeDraftRef.current = {
          type: tool as 'rectangle' | 'circle' | 'line',
          startX: pt.x,
          startY: pt.y,
          endX: pt.x,
          endY: pt.y,
        }
        currentStrokeRef.current = {
          id: `${userId}_${Date.now()}`,
          user_id: userId,
          points: [pt],
          color,
          width,
          tool,
          deleted: false,
          timestamp: Date.now(),
        }
        onStrokeAdd(currentStrokeRef.current)
        return
      }

      currentStrokeRef.current = {
        id: `${userId}_${Date.now()}`,
        user_id: userId,
        points: [pt],
        color: tool === 'eraser' ? '#0f1117' : color,
        width: tool === 'highlighter' ? width * 2 : tool === 'eraser' ? width * 2 : width,
        tool,
        deleted: false,
        timestamp: Date.now(),
      }
      onStrokeAdd(currentStrokeRef.current)
    },
    [color, width, tool, readOnly, getCanvasPoint, onStrokeAdd]
  )

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawingRef.current || readOnly) return
      e.preventDefault()
      const pt = getCanvasPoint(e)
      onCursorMove(pt.x, pt.y)

      if (shapeDraftRef.current) {
        shapeDraftRef.current.endX = pt.x
        shapeDraftRef.current.endY = pt.y
        if (currentStrokeRef.current) {
          const updated = {
            ...currentStrokeRef.current,
            points: [
              { x: shapeDraftRef.current.startX, y: shapeDraftRef.current.startY, pressure: 0.5 },
              pt,
            ],
          }
          currentStrokeRef.current = updated
          onStrokeUpdate(updated)
        }
        renderAll()
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = width
        const sd = shapeDraftRef.current
        if (sd.type === 'rectangle') {
          ctx.strokeRect(sd.startX, sd.startY, sd.endX - sd.startX, sd.endY - sd.startY)
        } else if (sd.type === 'circle') {
          const cx = (sd.startX + sd.endX) / 2
          const cy = (sd.startY + sd.endY) / 2
          const rx = Math.abs(sd.endX - sd.startX) / 2
          const ry = Math.abs(sd.endY - sd.startY) / 2
          ctx.beginPath()
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
          ctx.stroke()
        } else if (sd.type === 'line') {
          ctx.beginPath()
          ctx.moveTo(sd.startX, sd.startY)
          ctx.lineTo(sd.endX, sd.endY)
          ctx.stroke()
        }
        ctx.restore()
        return
      }

      if (!currentStrokeRef.current) return
      const updated = {
        ...currentStrokeRef.current,
        points: [...currentStrokeRef.current.points, pt],
        timestamp: Date.now(),
      }
      currentStrokeRef.current = updated
      onStrokeUpdate(updated)

      renderAll()
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      drawStroke(ctx, currentStrokeRef.current)
    },
    [color, width, readOnly, getCanvasPoint, onCursorMove, onStrokeUpdate, renderAll]
  )

  const endDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawingRef.current || readOnly) return
      isDrawingRef.current = false
      shapeDraftRef.current = null
      currentStrokeRef.current = null
      renderAll()
    },
    [readOnly, renderAll]
  )

  return (
    <canvas
      ref={canvasRef}
      className="whiteboard-canvas"
      onMouseDown={startDraw}
      onMouseMove={draw}
      onMouseUp={endDraw}
      onMouseLeave={endDraw}
      onTouchStart={startDraw}
      onTouchMove={draw}
      onTouchEnd={endDraw}
      style={{ touchAction: 'none', width: '100%', height: '100%' }}
    />
  )
}

export default Canvas
