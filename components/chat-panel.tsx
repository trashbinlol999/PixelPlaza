"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual"
import styles from "@/styles/habbo.module.css"

export type ChatMessage = { id: string; author: string; text: string; timestamp: number }

type Props = {
  messages?: ChatMessage[]
  onSend?: (text: string) => void
  placeholder?: string
  maxLength?: number
}

const DEFAULT_MAX_LEN = 240

export default function ChatPanel({
  messages = [],
  onSend,
  placeholder = "Type a message...",
  maxLength = DEFAULT_MAX_LEN,
}: Props) {
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const atBottomRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  const sorted = useMemo(() => [...messages].sort((a, b) => a.timestamp - b.timestamp), [messages])

  // Virtualizer (variable height)
  const estimate = useCallback(() => 36, [])
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: estimate,
    overscan: 12,
    measureElement: (el) => el?.getBoundingClientRect().height || 36,
  })

  // Track whether user is scrolled to bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4
      atBottomRef.current = nearBottom
      setAtBottom(nearBottom)
    }
    onScroll()
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  // Auto-scroll on new messages if already at bottom
  useEffect(() => {
    if (!sorted.length) return
    if (atBottomRef.current) {
      virtualizer.scrollToIndex(sorted.length - 1, { align: "end" })
    }
  }, [sorted.length, virtualizer])

  function submit() {
    const trimmed = text.trim()
    setError(null)
    if (!trimmed) {
      setError("Message cannot be empty.")
      return
    }
    if (trimmed.length > maxLength) {
      setError(`Message is too long. Max ${maxLength} characters.`)
      return
    }
    onSend?.(trimmed)
    setText("")
  }

  return (
    <div className={styles.windowBody}>
      <div className="px-3 py-2 text-[12px] text-black/70">Welcome to the chat. Be kind.</div>
      <div className="px-3">
        <div className="h-px bg-black/20" />
      </div>

      {/* Virtualized scroll viewport */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-0">
        <div style={{ height: virtualizer.getTotalSize() }} className="relative">
          {virtualizer.getVirtualItems().map((vi: VirtualItem) => {
            const m = sorted[vi.index]
            return (
              <div
                key={m.id}
                ref={(el) => {
                  if (el) virtualizer.measureElement(el)
                }}
                className="absolute left-0 right-0 px-3"
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                <div className="py-1.5 leading-snug">
                  <div className="inline-block max-w-[92%] bg-white/90 border border-black/15 rounded px-2 py-1">
                    <span className="font-semibold text-[12px]">{m.author}:</span>{" "}
                    <span className="text-[13px] whitespace-pre-wrap break-words">{m.text}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {!atBottom && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <Button
              size="sm"
              className={styles.goButton}
              onClick={() => virtualizer.scrollToIndex(sorted.length - 1, { align: "end" })}
            >
              Jump to latest
            </Button>
          </div>
        )}
      </div>

      <form
        className="p-3 flex flex-col gap-2 border-t border-black/15"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (error) setError(null)
            }}
            placeholder={placeholder}
            aria-label="Chat input"
            className={styles.pixelInput}
            onKeyDown={(e) => {
              // Keep movement handlers from seeing these keystrokes
              e.stopPropagation()
              if (e.key === "Enter" && (e.shiftKey || e.altKey)) {
                // allow newline with Shift+Enter
                setText((t) => t + "\n")
                e.preventDefault()
              }
            }}
            maxLength={maxLength + 10}
          />
          <Button type="submit" className={styles.goButton}>Send</Button>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-black/50">Max {maxLength} characters • Shift+Enter for newline</span>
          {error ? <span className="text-red-600 font-medium">{error}</span> : null}
        </div>
      </form>
    </div>
  )
}
