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
  text?: string
  font_size?: number
}

export interface ViewTransform {
  x: number
  y: number
  scale: number
}

export interface Board {
  id: number
  name: string
  created_at: string
  strokes: Stroke[]
  protected?: boolean
}

export type Tool = 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text' | 'select'

