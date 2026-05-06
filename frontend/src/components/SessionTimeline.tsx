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
      <button className="timeline-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button className="timeline-btn" onClick={reset} title="Reset">
        ⏹
      </button>
      <div className="speed-btns">
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            className={`speed-btn ${speed === s ? 'active' : ''}`}
            onClick={() => setSpeed(s)}
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
      />
      <span className="timeline-time">
        {currentIndex >= 0 ? currentIndex + 1 : 0} / {events.length}
      </span>
    </div>
  )
}

export default SessionTimeline
