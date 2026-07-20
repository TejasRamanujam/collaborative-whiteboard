import { useEffect, useRef } from 'react'
import { drawStroke, drawingBounds } from '../drawing'
import type { Stroke } from '../types'

export default function BoardThumbnail({ strokes }: { strokes: Stroke[] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const visible = strokes.filter((stroke) => !stroke.deleted).slice(0, 200)
    if (!visible.length) return
    const bounds = drawingBounds(visible)
    const padding = 10
    const width = Math.max(1, bounds.maxX - bounds.minX)
    const height = Math.max(1, bounds.maxY - bounds.minY)
    const scale = Math.min(
      1.5,
      (canvas.width - padding * 2) / width,
      (canvas.height - padding * 2) / height
    )
    ctx.save()
    ctx.translate(
      (canvas.width - width * scale) / 2 - bounds.minX * scale,
      (canvas.height - height * scale) / 2 - bounds.minY * scale
    )
    ctx.scale(scale, scale)
    visible.forEach((stroke) => drawStroke(ctx, stroke))
    ctx.restore()
  }, [strokes])

  return <canvas ref={ref} className="board-thumbnail" width={200} height={120} aria-hidden="true" />
}
