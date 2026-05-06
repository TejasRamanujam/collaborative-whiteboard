import React, { useState } from 'react'
import { Tool } from '../types'

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'pen', icon: '✏️', label: 'Pen' },
  { id: 'highlighter', icon: '🖍️', label: 'Highlighter' },
  { id: 'eraser', icon: '🧹', label: 'Eraser' },
  { id: 'rectangle', icon: '▭', label: 'Rectangle' },
  { id: 'circle', icon: '○', label: 'Circle' },
  { id: 'line', icon: '╱', label: 'Line' },
]

const PRESET_COLORS = [
  '#ffffff', '#ff6b6b', '#ffd93d', '#6bcb77',
  '#4d96ff', '#ff8c32', '#845ec2', '#00c9a7',
]

interface ToolbarProps {
  tool: Tool
  setTool: (t: Tool) => void
  color: string
  setColor: (c: string) => void
  width: number
  setWidth: (w: number) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onExport: () => void
  canUndo: boolean
  canRedo: boolean
}

const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  setTool,
  color,
  setColor,
  width,
  setWidth,
  onUndo,
  onRedo,
  onClear,
  onExport,
  canUndo,
  canRedo,
}) => {
  const [customColor, setCustomColor] = useState(color)

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            className={`color-swatch ${color === c ? 'active' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => {
              setColor(c)
              setCustomColor(c)
            }}
          />
        ))}
        <div className="custom-color-wrap">
          <input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value)
              setColor(e.target.value)
            }}
            className="custom-color-input"
          />
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <label className="width-label">
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Size</span>
          <input
            type="range"
            min={1}
            max={20}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="width-slider"
          />
          <span style={{ color: 'var(--text)', fontSize: '11px', minWidth: '20px' }}>{width}</span>
        </label>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          className="tool-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
        >
          ↩
        </button>
        <button
          className="tool-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
        >
          ↪
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button className="tool-btn" onClick={onClear} title="Clear Board">
          🗑
        </button>
        <button className="tool-btn export-btn" onClick={onExport} title="Export">
          ⬇
        </button>
      </div>
    </div>
  )
}

export default Toolbar
