import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchEvents, postEvent } from '../api'
import { ReplayEvent } from '../components/SessionTimeline'

const POLL_INTERVAL_MS = 2500

export type SyncStatus = 'connecting' | 'live' | 'offline'

/**
 * Polling-based multi-user sync. Vercel serverless can't host a websocket
 * server, so instead every client:
 *  - POSTs its local stroke events to /api/boards/{id}/events, and
 *  - polls GET /api/boards/{id}/events?since=<last event id> on an interval,
 *    applying remote events incrementally (the cursor keeps payloads small).
 *
 * The first poll (since=0) returns the full event log, which seeds both the
 * board contents and the session timeline.
 *
 * `pausedRef` (the timeline's "replaying" flag) suspends polling so a replay
 * view isn't stomped by live updates; when polling resumes the hook re-fetches
 * from 0 and asks the caller to rebuild state (`reset === true`).
 */
export function usePollingSync(
  boardId: number | null,
  userId: string,
  onEvents: (events: ReplayEvent[], reset: boolean) => void,
  pausedRef: React.MutableRefObject<boolean>,
  // Optional dynamic interval (ms) — stretched while a realtime transport is
  // connected and polling is only reconciliation, tightened when it's primary.
  intervalRef?: React.MutableRefObject<number>
) {
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const cursorRef = useRef(0)
  const onEventsRef = useRef(onEvents)
  onEventsRef.current = onEvents

  useEffect(() => {
    if (boardId === null) return
    cursorRef.current = 0
    setStatus('connecting')
    let stopped = false
    let wasPaused = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = () => {
      if (!stopped) timer = setTimeout(poll, intervalRef?.current ?? POLL_INTERVAL_MS)
    }

    const poll = async () => {
      if (stopped) return
      if (pausedRef.current) {
        wasPaused = true
        schedule()
        return
      }
      const since = wasPaused ? 0 : cursorRef.current
      try {
        const events = (await fetchEvents(boardId, since)) as ReplayEvent[]
        if (stopped) return
        setStatus('live')
        if (pausedRef.current) {
          // Replay started while the request was in flight — drop this batch
          // (cursor untouched, so nothing is lost).
          wasPaused = true
          schedule()
          return
        }
        if (Array.isArray(events)) {
          if (events.length > 0) cursorRef.current = events[events.length - 1].id
          if (wasPaused) {
            onEventsRef.current(events, true)
            wasPaused = false
          } else if (events.length > 0) {
            onEventsRef.current(events, false)
          }
        }
      } catch {
        if (!stopped) setStatus('offline')
      }
      schedule()
    }

    poll()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  const sendEvent = useCallback(
    async (event_type: string, stroke_data: Record<string, unknown>) => {
      if (boardId === null) return
      try {
        await postEvent(boardId, { user_id: userId, event_type, stroke_data })
      } catch {
        setStatus('offline')
      }
    },
    [boardId, userId]
  )

  return { status, sendEvent }
}
