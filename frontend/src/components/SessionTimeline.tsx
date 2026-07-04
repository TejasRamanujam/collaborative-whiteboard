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
}

const SessionTimeline: React.FC<SessionTimelineProps> = ({
  events,
  onReplayEvent,
  onEventSeek,
}) => {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentIndex, setCurrentIndex] = useState(-1)
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

    setPlaying(true)
    const startFrom = currentIndex < 0 ? 0 : currentIndex

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1
        if (next >= events.length) {
          stop()
          return prev
        }
        onReplayEvent(events[next] as unknown as Record<string, unknown>)
        return next
      })
    }, 200 / speed)
  }

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setCurrentIndex(val)
    onEventSeek(val)
  }

  const reset = () => {
    stop()
    setCurrentIndex(-1)
    onEventSeek(-1)
  }

  return (
    <div className="session-timeline">
      <span className="timeline-label" title="Replay every stroke ever drawn on this board">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
        Replay
      </span>
      <button
        className="timeline-btn play"
        onClick={togglePlay}
        title={playing ? 'Pause' : 'Play'}
        aria-label={playing ? 'Pause replay' : 'Play replay'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.9l11-6.5a1 1 0 0 0 0-1.8l-11-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
        )}
      </button>
      <button className="timeline-btn" onClick={reset} title="Reset" aria-label="Reset replay">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>
      <div className="speed-btns">
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            className={`speed-btn ${speed === s ? 'active' : ''}`}
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
          >
            {s}x
          </button>
        ))}
      </div>
      <input
        type="range"
        className="timeline-scrubber"
        min={-1}
        max={events.length - 1}
        value={currentIndex}
        onChange={handleScrub}
        aria-label="Scrub through drawing history"
      />
      <span className="timeline-time">
        {currentIndex >= 0 ? currentIndex + 1 : 0} / {events.length}
      </span>
    </div>
  )
}

export default SessionTimeline
