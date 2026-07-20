import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, Client } from '@liveblocks/client'

/** Presence published by each participant (cursor in canvas coordinates). */
export type CursorPresence = {
  cursor: { x: number; y: number } | null
  name: string
}

/** A remote participant's cursor, ready to render. */
export interface RemoteCursor {
  connectionId: number
  name: string
  cursor: { x: number; y: number }
}

export interface RoomParticipant {
  connectionId: number
  name: string
}

/** Stroke event broadcast through the room (mirrors the REST event shape). */
export type BoardRoomEvent = {
  event_type: string
  stroke_data: Record<string, unknown>
  user_id: string
}

// One Liveblocks client per tab. The auth endpoint lives on our backend so
// the secret key never reaches the browser; the client only receives a
// short-lived token scoped to a single board room.
let sharedClient: Client | null = null
function getClient(userId: string): Client {
  if (!sharedClient) {
    sharedClient = createClient({
      authEndpoint: async (room) => {
        const res = await fetch('/api/liveblocks-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room, user_id: userId }),
        })
        if (!res.ok) {
          // Terminal result: stops retry spam; the polling loop remains the
          // sync transport when realtime auth is unavailable.
          return { error: 'forbidden' as const, reason: `auth failed (${res.status})` }
        }
        return (await res.json()) as { token: string }
      },
    })
  }
  return sharedClient
}

interface BoardRoomHandle {
  broadcastEvent: (event: BoardRoomEvent) => void
  updatePresence: (patch: Partial<CursorPresence>) => void
}

/**
 * Realtime transport via Liveblocks: joins room "board-<id>", exposes the
 * connection state, other users' live cursors, and broadcast/presence
 * publishers. Degrades silently — when the room can't connect, `connected`
 * stays false and callers rely on polling.
 */
export function useLiveblocksRoom(
  boardId: number | null,
  userId: string,
  onRemoteEvent: (event: BoardRoomEvent) => void
) {
  const [connected, setConnected] = useState(false)
  const [others, setOthers] = useState<RemoteCursor[]>([])
  const [participants, setParticipants] = useState<RoomParticipant[]>([])
  const roomRef = useRef<BoardRoomHandle | null>(null)
  const onRemoteEventRef = useRef(onRemoteEvent)
  onRemoteEventRef.current = onRemoteEvent

  useEffect(() => {
    if (boardId === null) return
    let leaveFn: (() => void) | undefined
    const unsubs: (() => void)[] = []
    try {
      const client = getClient(userId)
      const { room, leave } = client.enterRoom(`board-${boardId}`, {
        initialPresence: { cursor: null, name: userId },
      })
      leaveFn = leave
      roomRef.current = room as unknown as BoardRoomHandle
      unsubs.push(
        room.subscribe('status', (status) => {
          setConnected(status === 'connected')
        }),
        room.subscribe('event', ({ event }) => {
          const e = event as unknown as BoardRoomEvent
          if (e && typeof e.event_type === 'string') onRemoteEventRef.current(e)
        }),
        room.subscribe('others', (list) => {
          const cursors: RemoteCursor[] = []
          const roster: RoomParticipant[] = []
          for (const o of list) {
            const p = o.presence as unknown as CursorPresence | undefined
            const name = typeof p?.name === 'string' && p.name ? p.name : 'guest'
            roster.push({ connectionId: o.connectionId, name })
            if (p && p.cursor) {
              cursors.push({
                connectionId: o.connectionId,
                name,
                cursor: p.cursor,
              })
            }
          }
          setOthers(cursors)
          setParticipants(roster)
        })
      )
    } catch {
      setConnected(false)
    }
    return () => {
      unsubs.forEach((u) => u())
      roomRef.current = null
      setConnected(false)
      setOthers([])
      setParticipants([])
      leaveFn?.()
    }
  }, [boardId, userId])

  const broadcast = useCallback((event: BoardRoomEvent) => {
    try {
      roomRef.current?.broadcastEvent(event)
    } catch {
      // realtime is best-effort; the REST event log remains source of truth
    }
  }, [])

  const updateCursor = useCallback((cursor: { x: number; y: number } | null) => {
    try {
      roomRef.current?.updatePresence({ cursor })
    } catch {
      // presence is cosmetic — never let it break drawing
    }
  }, [])

  return { connected, others, participants, broadcast, updateCursor }
}
