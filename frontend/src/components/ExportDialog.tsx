import React, { useEffect, useRef, useState } from 'react'
import { exportBoard } from '../api'

interface ExportDialogProps {
  boardId: number
  onClose: () => void
}

/** Pull a proof: export the plate as SVG / PNG / PDF. */
const ExportDialog: React.FC<ExportDialogProps> = ({ boardId, onClose }) => {
  const [format, setFormat] = useState('svg')
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(600)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.querySelector('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleExport = async () => {
    setLoading(true)
    try {
      const result = await exportBoard(boardId, format, width, height)
      if (!result) {
        alert('The proof would not pull — try again.')
        return
      }
      const a = document.createElement('a')
      if (format === 'svg') {
        const blob = new Blob([result as unknown as string], { type: 'image/svg+xml' })
        a.href = URL.createObjectURL(blob)
      } else {
        a.href = result as unknown as string
      }
      a.download = `scribbly_plate_${boardId}.${format}`
      a.click()
    } catch {
      alert('The proof would not pull — try again.')
    } finally {
      setLoading(false)
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Export board"
      >
        <div className="modal-head">
          <span className="modal-eyebrow">output № {boardId}</span>
          <h2 className="modal-title">Pull a proof</h2>
          <p className="modal-sub">Print this plate to a file.</p>
        </div>

        <div className="modal-field">
          <span className="field-label" id="format-label">
            stock
          </span>
          <div className="format-keys" role="group" aria-labelledby="format-label">
            {(['svg', 'png', 'pdf'] as const).map((f) => (
              <button
                key={f}
                className={`format-key ${format === f ? 'active' : ''}`}
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-dims">
          <label className="modal-field">
            <span className="field-label">width</span>
            <input
              type="number"
              min={1}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="modal-input"
            />
          </label>
          <span className="dims-x" aria-hidden="true">
            ×
          </span>
          <label className="modal-field">
            <span className="field-label">height</span>
            <input
              type="number"
              min={1}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="modal-input"
            />
          </label>
        </div>

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>
            cancel
          </button>
          <button className="modal-go" onClick={handleExport} disabled={loading}>
            {loading ? 'pulling…' : 'pull proof →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportDialog
