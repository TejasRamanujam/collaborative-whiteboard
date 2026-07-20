import React from 'react'
import { RemoteCursor } from '../hooks/useLiveblocksRoom'
import type { ViewTransform } from '../types'

/** Per-user proofing inks — light pigments that read on the dark plate. */
const USER_COLORS = [
  '#ff6a3d', '#6fc7b2', '#eab54e', '#7f9cf5',
  '#f193b4', '#a4d474', '#f2ede0', '#b9b0a2',
]

export function getUserColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

/**
 * Live cursors of other participants, driven by Liveblocks presence.
 * Each renders as a drafting pointer: a fine crosshair with a name slip
 * in that artist's ink.
 */
const PresenceCursors: React.FC<{ cursors: RemoteCursor[]; view: ViewTransform }> = ({ cursors, view }) => {
  return (
    <>
      {cursors.map((c) => {
        const color = getUserColor(c.name)
        return (
          <div
            key={c.connectionId}
            className="presence-cursor"
            style={{ left: c.cursor.x * view.scale + view.x, top: c.cursor.y * view.scale + view.y, color }}
          >
            <svg className="presence-reticle" viewBox="0 0 28 28" width="24" height="24" aria-hidden="true">
              <path
                d="M14 2v8M14 18v8M2 14h8M18 14h8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <circle cx="14" cy="14" r="2" fill="currentColor" />
            </svg>
            <span className="presence-label" style={{ backgroundColor: color }}>
              {c.name}
            </span>
          </div>
        )
      })}
    </>
  )
}

export default PresenceCursors
