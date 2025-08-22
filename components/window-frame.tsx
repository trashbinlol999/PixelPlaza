"use client"

import { type PropsWithChildren, useEffect, useId, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import useDraggable from "@/hooks/use-draggable"
import { cn } from "@/lib/utils"
import styles from "@/styles/habbo.module.css"

type Props = PropsWithChildren<{
  id?: string
  title?: string
  initial?: { x: number; y: number; w: number; h?: number }
  onClose?: () => void
  ariaTitle?: string
  className?: string
  variant?: "habbo" | "default"
}>

export default function WindowFrame({
  id,
  title = "Window",
  initial = { x: 24, y: 24, w: 360, h: 300 },
  onClose,
  ariaTitle = "Window",
  className,
  children,
  variant = "habbo",
}: Props) {
  const reactId = useId()
  const domId = id || reactId
  const [rect, setRect] = useState(initial)
  const { onPointerDown } = useDraggable({
    onMove: (dx, dy) => setRect((r) => ({ ...r, x: r.x + dx, y: r.y + dy })),
  })

  useEffect(() => { setRect(initial) }, [initial.x, initial.y, initial.w, initial.h])

  const style = useMemo(
    () => ({ left: rect.x, top: rect.y, width: rect.w, height: rect.h ?? undefined }),
    [rect.h, rect.w, rect.x, rect.y]
  )

  const habbo = variant === "habbo"

  function handleBarPointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest("[data-no-drag='true']")) return
    onPointerDown(e)
  }

  return (
    <div
      id={domId}
      role="dialog"
      aria-label={ariaTitle}
      className={cn(
        "fixed z-40",
        habbo ? styles.window : "rounded-md border shadow-lg bg-background overflow-hidden",
        className
      )}
      style={style}
    >
      <div
        onPointerDown={handleBarPointerDown}
        className={habbo ? styles.titlebar : "h-10 flex items-center justify-between px-2 border-b"}
      >
        <div className={cn("truncate pr-2", habbo ? styles.title : "text-sm font-semibold")}>{title}</div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", styles.closeBtn)}
            onClick={onClose}
            aria-label="Close window"
            title="Close"
            data-no-drag="true"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span aria-hidden="true" className={styles.closeIcon} />
          </Button>
        </div>
      </div>
      <div className={habbo ? styles.windowInner : "h-[calc(100%-2.5rem)]"}>{children}</div>
    </div>
  )
}
