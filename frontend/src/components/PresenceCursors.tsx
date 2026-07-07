import React from 'react'
import { RemoteCursor } from '../hooks/useLiveblocksRoom'

const USER_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4cc9f0',
  '#ff8c32', '#7c5cff', '#00c9a7', '#f06595',
]

function getUserColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

/** Live cursors of other participants, driven by Liveblocks presence. */
const PresenceCursors: React.FC<{ cursors: RemoteCursor[] }> = ({ cursors }) => {
  return (
    <>
      {cursors.map((c) => {
        const color = getUserColor(c.name)
        return (
          <div
            key={c.connectionId}
            className="presence-cursor"
            style={{ left: c.cursor.x, top: c.cursor.y, color }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M4 2l16 7.5-7 2-3.5 6.5L4 2z"
                fill="currentColor"
                stroke="#12101c"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
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
