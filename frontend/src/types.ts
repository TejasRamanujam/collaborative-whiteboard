export interface Point {
  x: number
  y: number
  pressure: number
}

export interface Stroke {
  id: string
  user_id: string
  points: Point[]
  color: string
  width: number
  tool: string
  deleted: boolean
  timestamp?: number
  image_data?: string
  x?: number
  y?: number
}

export interface Board {
  id: number
  name: string
  created_at: string
  strokes: Stroke[]
  protected?: boolean
}

export interface CursorPosition {
  x: number
  y: number
  user_id: string
}

export type Tool = 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text' | 'select'

export interface DrawingState {
  isDrawing: boolean
  currentStroke: Stroke | null
  tool: Tool
  color: string
  width: number
  startPoint: Point | null
}
