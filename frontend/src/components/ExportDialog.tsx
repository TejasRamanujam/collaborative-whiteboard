import React, { useState } from 'react'
import { exportBoard } from '../api'

interface ExportDialogProps {
  boardId: number
  onClose: () => void
}

const ExportDialog: React.FC<ExportDialogProps> = ({ boardId, onClose }) => {
  const [format, setFormat] = useState('svg')
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(600)
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const result = await exportBoard(boardId, format, width, height)
      if (!result) {
        alert('Export failed')
        return
      }
      const a = document.createElement('a')
      if (format === 'svg') {
        const blob = new Blob([result as unknown as string], { type: 'image/svg+xml' })
        a.href = URL.createObjectURL(blob)
      } else {
        a.href = result as unknown as string
      }
      a.download = `whiteboard_${boardId}.${format}`
      a.click()
    } catch {
      alert('Export failed')
    } finally {
      setLoading(false)
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Export Board</h2>

        <div className="modal-field">
          <label>Format</label>
          <div className="format-btns">
            {(['svg', 'png', 'pdf'] as const).map((f) => (
              <button
                key={f}
                className={`format-btn ${format === f ? 'active' : ''}`}
                onClick={() => setFormat(f)}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-field">
          <label>Width</label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="modal-input"
          />
        </div>

        <div className="modal-field">
          <label>Height</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="modal-input"
          />
        </div>

        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" onClick={handleExport} disabled={loading}>
            {loading ? 'Exporting...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportDialog
