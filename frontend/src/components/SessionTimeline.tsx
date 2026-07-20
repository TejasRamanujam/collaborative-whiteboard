import React, { useState, useRef, useEffect, useCallback } from 'react'

export interface ReplayEvent {
  id: number
  event_type: string
  stroke_data: Record<string, unknown>
  timestamp: string
  user_id: string
}

interface SessionTimelineProps {
  events: ReplayEvent[]
  onReplayEvent: (event: Record<string, unknown>) => void
  onEventSeek: (index: number) => void
  onResetToLive: () => void
  /** Start one replay pass automatically (first visit to a seeded board). */
  autoplay?: boolean
}

function pad4(n: number): string {
  return String(Math.max(0, n)).padStart(4, '0')
}

/**
 * The timeline: play/scrub the plate's entire stroke log like a strip of
 * proofs. Scrubbing pauses live sync upstream (via the replaying flag).
 */
const SessionTimeline: React.FC<SessionTimelineProps> = ({
  events,
  onReplayEvent,
  onEventSeek,
  onResetToLive,
  autoplay,
}) => {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentIndex, setCurrentIndex] = useState(-1)
  // Mirrors currentIndex so the play interval can advance + fire replay
  // callbacks outside React's render phase (no setState-in-render).
  const indexRef = useRef(-1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    setPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  const togglePlay = () => {
    if (playing) {
      stop()
      return
    }
    if (events.length === 0) return

    // Starting from live (or the end of the log): rewind to a blank plate
    // first, otherwise replayed events land on the already-final drawing
    // and nothing visibly changes.
    if (indexRef.current < 0 || indexRef.current >= events.length - 1) {
      indexRef.current = -1
      setCurrentIndex(-1)
      onEventSeek(-1)
    }

    setPlaying(true)
    intervalRef.current = setInterval(() => {
      const next = indexRef.current + 1
      if (next >= events.length) {
        stop()
        indexRef.current = -1
        setCurrentIndex(-1)
        onResetToLive()
        return
      }
      indexRef.current = next
      onReplayEvent(events[next] as unknown as Record<string, unknown>)
      setCurrentIndex(next)
    }, 200 / speed)
  }

  // One automatic replay pass when a seeded board is first opened.
  useEffect(() => {
    if (!autoplay || playing || events.length === 0) return
    togglePlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay])

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    indexRef.current = val
    setCurrentIndex(val)
    onEventSeek(val)
  }

  const reset = () => {
    stop()
    indexRef.current = -1
    setCurrentIndex(-1)
    onResetToLive()
  }

  const atLive = currentIndex < 0 || currentIndex >= events.length - 1

  return (
    <footer className="transport" aria-label="Timeline replay">
      <span className="transport-label" title="Replay every stroke ever drawn on this plate">
        timeline
      </span>

      <button
        className={`transport-key ${playing ? 'active' : ''}`}
        onClick={togglePlay}
        title={playing ? 'Pause replay' : 'Play replay'}
        aria-label={playing ? 'Pause replay' : 'Play replay'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
            <path d="M7 4.5v15l13-7.5L7 4.5Z" />
          </svg>
        )}
      </button>

      <button className="transport-key" onClick={reset} title="Back to live" aria-label="Reset replay to live">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" />
        </svg>
      </button>

      <div className="speed-block" role="group" aria-label="Replay speed">
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            className={`speed-key ${speed === s ? 'active' : ''}`}
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            aria-label={`Replay speed ${s}x`}
          >
            {s}×
          </button>
        ))}
      </div>

      <input
        type="range"
        className="tape-scrubber"
        min={-1}
        max={events.length - 1}
        value={currentIndex}
        onChange={handleScrub}
        aria-label="Scrub through drawing history"
        aria-valuetext={`Frame ${currentIndex + 1} of ${events.length}`}
      />

      <span className="tape-counter" aria-hidden="true">
        fr {pad4(currentIndex >= 0 ? currentIndex + 1 : 0)}
        <em>/</em>
        {pad4(events.length)}
      </span>

      <span className={`tape-mode ${atLive && !playing ? 'live' : 'replay'}`} aria-hidden="true">
        {atLive && !playing ? 'live' : 'replay'}
      </span>
    </footer>
  )
}

export default SessionTimeline
