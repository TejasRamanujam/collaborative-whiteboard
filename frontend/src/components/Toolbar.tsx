import React, { useState } from 'react'
import { Tool } from '../types'

/**
 * The apparatus rail: a typeset instrument column. No keycaps, no icons —
 * tools are ledger rows in the mono voice with hairline dividers; the
 * active row floods with the vermilion spot ink.
 */

const TOOLS: { id: Tool; label: string; hotkey: string }[] = [
  { id: 'pen', label: 'Pen', hotkey: 'P' },
  { id: 'highlighter', label: 'Marker', hotkey: 'M' },
  { id: 'eraser', label: 'Eraser', hotkey: 'E' },
  { id: 'rectangle', label: 'Rectangle', hotkey: 'R' },
  { id: 'circle', label: 'Ellipse', hotkey: 'O' },
  { id: 'line', label: 'Line', hotkey: 'L' },
]

/* Proofing inks — light pigments that read on the dark litho plate. */
const INKS = [
  '#f2ede0',
  '#ff6a3d',
  '#eab54e',
  '#6fc7b2',
  '#7f9cf5',
  '#f193b4',
  '#a4d474',
  '#b9b0a2',
]

const NIBS = [1, 3, 6, 10, 16]

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
  protectedBoard?: boolean
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
  protectedBoard = false,
}) => {
  const [customColor, setCustomColor] = useState(color)

  return (
    <aside className="rail" role="toolbar" aria-label="Drawing apparatus" aria-orientation="vertical">
      <div className="rail-section">
        <span className="rail-label" aria-hidden="true">
          tool
        </span>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`app-row ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.hotkey})`}
            aria-label={`${t.label}, hotkey ${t.hotkey}`}
            aria-pressed={tool === t.id}
            disabled={protectedBoard && t.id === 'eraser'}
          >
            <span className="app-row-name">{t.label}</span>
            <span className="app-row-key" aria-hidden="true">
              {t.hotkey}
            </span>
          </button>
        ))}
      </div>

      <div className="rail-section">
        <span className="rail-label" aria-hidden="true">
          ink
        </span>
        <div className="ink-grid">
          {INKS.map((c) => (
            <button
              key={c}
              className={`ink-dot ${color === c ? 'active' : ''}`}
              onClick={() => {
                setColor(c)
                setCustomColor(c)
              }}
              title={`Ink ${c}`}
              aria-label={`Ink color ${c}`}
              aria-pressed={color === c}
            >
              <span className="ink-pigment" style={{ backgroundColor: c }} aria-hidden="true" />
            </button>
          ))}
          <label className="ink-dot ink-custom" title="Mix a custom ink">
            <span
              className="ink-pigment ink-pigment-custom"
              style={{ backgroundColor: customColor }}
              aria-hidden="true"
            />
            <input
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value)
                setColor(e.target.value)
              }}
              className="ink-custom-input"
              aria-label="Custom ink color"
            />
          </label>
        </div>
      </div>

      <div className="rail-section">
        <span className="rail-label" aria-hidden="true">
          nib
        </span>
        <div className="nib-row" role="group" aria-label="Stroke size">
          {NIBS.map((n) => (
            <button
              key={n}
              className={`nib-key ${width === n ? 'active' : ''}`}
              onClick={() => setWidth(n)}
              title={`Nib size ${n}`}
              aria-label={`Nib size ${n}`}
              aria-pressed={width === n}
            >
              <span className="nib-dot" style={{ width: 3 + n, height: 3 + n }} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <div className="rail-section">
        <span className="rail-label" aria-hidden="true">
          plate
        </span>
        <button className="app-row" onClick={onUndo} disabled={!canUndo || protectedBoard} title={protectedBoard ? 'Curated marks are permanent' : 'Undo (Ctrl+Z)'} aria-label="Undo">
          <span className="app-row-name">Undo</span>
          <span className="app-row-key" aria-hidden="true">
            ^Z
          </span>
        </button>
        <button
          className="app-row"
          onClick={onRedo}
          disabled={!canRedo || protectedBoard}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <span className="app-row-name">Redo</span>
          <span className="app-row-key" aria-hidden="true">
            ^⇧Z
          </span>
        </button>
        <button className="app-row app-row-danger" onClick={onClear} disabled={protectedBoard} title={protectedBoard ? 'Curated plates cannot be wiped' : 'Wipe the plate for everyone'} aria-label="Wipe plate">
          <span className="app-row-name">Wipe</span>
        </button>
      </div>

      <div className="rail-section rail-end">
        <button className="export-key" onClick={onExport} aria-label="Export board">
          download <span aria-hidden="true">→</span>
        </button>
      </div>
    </aside>
  )
}

export default Toolbar
