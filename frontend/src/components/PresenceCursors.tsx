import React from 'react'

const USER_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
  '#ff8c32', '#845ec2', '#00c9a7', '#c34a36',
]

interface Cursor {
  user_id: string
  x: number
  y: number
}

interface PresenceCursorsProps {
  cursors: Cursor[]
}

function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

const PresenceCursors: React.FC<PresenceCursorsProps> = ({ cursors }) => {
  return (
    <>
      {cursors.map((c) => (
        <div
          key={c.user_id}
          className="presence-cursor"
          style={{
            left: c.x,
            top: c.y,
            borderColor: getUserColor(c.user_id),
          }}
        >
          <span
            className="presence-label"
            style={{
              backgroundColor: getUserColor(c.user_id),
            }}
          >
            {c.user_id}
          </span>
        </div>
      ))}
    </>
  )
}

export default PresenceCursors
