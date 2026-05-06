import { useEffect, useRef, useCallback, useState } from 'react'

interface WsMessage {
  type: string
  [key: string]: unknown
}

export function useWebSocket(boardId: number | null, userId: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null)
  const [connected, setConnected] = useState(false)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listenersRef = useRef<((msg: WsMessage) => void)[]>([])

  const addListener = useCallback((fn: (msg: WsMessage) => void) => {
    listenersRef.current.push(fn)
    return () => {
      listenersRef.current = listenersRef.current.filter((l) => l !== fn)
    }
  }, [])

  useEffect(() => {
    if (boardId === null) return

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const wsUrl = `${protocol}://${window.location.host}/ws/${boardId}?user_id=${encodeURIComponent(userId)}`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage
          setLastMessage(msg)
          listenersRef.current.forEach((fn) => fn(msg))
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        reconnectRef.current = setTimeout(connect, 2000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [boardId, userId])

  const send = useCallback(
    (msg: WsMessage) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg))
      }
    },
    []
  )

  return { send, lastMessage, connected, addListener }
}
