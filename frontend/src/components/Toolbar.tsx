import React, { useState } from 'react'
import { Tool } from '../types'

const I = {
  pen: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  ),
  highlighter: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 11-6 6v3h9l3-3" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4Z" />
    </svg>
  ),
  eraser: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  ),
  rectangle: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>
  ),
  circle: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  line: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 19 19 5" />
    </svg>
  ),
  undo: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
    </svg>
  ),
  redo: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  ),
}

const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: 'pen', icon: I.pen, label: 'Pen' },
  { id: 'highlighter', icon: I.highlighter, label: 'Highlighter' },
  { id: 'eraser', icon: I.eraser, label: 'Eraser' },
  { id: 'rectangle', icon: I.rectangle, label: 'Rectangle' },
  { id: 'circle', icon: I.circle, label: 'Circle' },
  { id: 'line', icon: I.line, label: 'Line' },
]

const PRESET_COLORS = [
  '#ffffff', '#ff6b6b', '#ffd93d', '#6bcb77',
  '#4cc9f0', '#ff8c32', '#7c5cff', '#00c9a7',
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
    <div className="toolbar" role="toolbar" aria-label="Drawing tools">
      <div className="toolbar-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={t.label}
            aria-label={t.label}
            aria-pressed={tool === t.id}
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
            title={c}
            aria-label={`Color ${c}`}
            aria-pressed={color === c}
          />
        ))}
        <div className="custom-color-wrap" title="Custom color">
          <input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value)
              setColor(e.target.value)
            }}
            className="custom-color-input"
            aria-label="Custom color"
          />
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <label className="width-label">
          <span className="width-caption">Size</span>
          <input
            type="range"
            min={1}
            max={20}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="width-slider"
            aria-label="Stroke size"
          />
          <span className="width-value">{width}</span>
        </label>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          className="tool-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          aria-label="Undo"
        >
          {I.undo}
        </button>
        <button
          className="tool-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          aria-label="Redo"
        >
          {I.redo}
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button className="tool-btn danger" onClick={onClear} title="Clear board" aria-label="Clear board">
          {I.trash}
        </button>
        <button className="tool-btn export-btn" onClick={onExport} title="Export" aria-label="Export board">
          {I.download}
        </button>
      </div>
    </div>
  )
}

export default Toolbar
