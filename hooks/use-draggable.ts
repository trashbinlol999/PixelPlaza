"use client"

import { useCallback, useRef } from "react"

type Options = { onMove?: (dx: number, dy: number) => void }

export default function useDraggable({ onMove }: Options) {
  const last = useRef<{ x: number; y: number } | null>(null)

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!last.current) return
      const dx = e.clientX - last.current.x
      const dy = e.clientY - last.current.y
      last.current = { x: e.clientX, y: e.clientY }
      onMove?.(dx, dy)
    },
    [onMove]
  )

  const onPointerUp = useCallback(() => {
    last.current = null
    window.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
    window.removeEventListener("pointercancel", onPointerUp)
  }, [onPointerMove])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      last.current = { x: e.clientX, y: e.clientY }
      window.addEventListener("pointermove", onPointerMove, { passive: true })
      window.addEventListener("pointerup", onPointerUp, { passive: true })
      window.addEventListener("pointercancel", onPointerUp, { passive: true })
    },
    [onPointerMove, onPointerUp]
  )

  return { onPointerDown }
}
