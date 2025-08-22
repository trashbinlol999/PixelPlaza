"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-client"
import leo from "leo-profanity"

export type ChatMessage = { id: string; author: string; text: string; timestamp: number }
export type Facing = "N" | "S" | "E" | "W"
export type Peer = {
  id: string
  name: string
  color: string
  x: number
  y: number
  facing: Facing
  dance?: boolean
  sit?: boolean
  wave?: boolean
  laugh?: boolean
}

type Options = { room: string; userId: string; name: string; offline?: boolean }

function randomColor() {
  const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#22c55e", "#eab308"]
  return colors[Math.floor(Math.random() * colors.length)]
}

class SpamGuard {
  private capacity = 5
  private tokens = 5
  private refillRate = 0.5 // tokens/sec
  private last = Date.now()
  private minInterval = 900 // ms
  private lastMessage = 0
  canSend() {
    const now = Date.now()
    const delta = (now - this.last) / 1000
    this.last = now
    this.tokens = Math.min(this.capacity, this.tokens + delta * this.refillRate)
    if (now - this.lastMessage < this.minInterval) return false
    if (this.tokens < 1) return false
    this.tokens -= 1
    this.lastMessage = now
    return true
  }
}

const MAX_LEN = 240

export function useMultiplayer({ room, userId, name, offline }: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [others, setOthers] = useState<Peer[]>([])
  const [selfDance, setSelfDance] = useState(false)
  const [selfSit, setSelfSit] = useState(false)
  const [selfWave, setSelfWave] = useState(false)
  const [selfLaugh, setSelfLaugh] = useState(false)
  const [party, setParty] = useState(false)

  const guardRef = useRef(new SpamGuard())
  const colorRef = useRef<string>(randomColor())

  // Final offline flag: explicit offline OR missing env config
  const offlineResolved = !!offline || !isSupabaseConfigured()

  // Only create supabase client when we are ONLINE
  const supabase = useMemo(() => (offlineResolved ? null : getSupabaseBrowser()), [offlineResolved])

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null)

  useEffect(() => {
    if (!leo.getDictionary()?.length) {
      try { leo.loadDictionary() } catch {}
    }
  }, [])

  useEffect(() => {
    // In offline mode, ensure no channel is active
    if (offlineResolved) {
      if (channelRef.current) {
        try { channelRef.current.unsubscribe() } catch {}
        channelRef.current = null
      }
      setOthers([])
      return
    }

    if (!supabase || !userId) return
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }

    const channel = supabase.channel(`room:${room}`, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    })

    channel
      .on("broadcast", { event: "chat" }, (payload) => {
        const m = payload.payload as ChatMessage
        setMessages((prev) => [...prev, m])
      })
      .on("broadcast", { event: "pos" }, (payload) => {
        const p = payload.payload as Peer
        if (!p || p.id === userId) return
        setOthers((prev) => {
          const map = new Map(prev.map((o) => [o.id, o]))
          map.set(p.id, { ...map.get(p.id), ...p } as Peer)
          return Array.from(map.values())
        })
      })
      .on("broadcast", { event: "action" }, (payload) => {
        const data = payload.payload as { id: string; type: "dance" | "sit" | "party" | "wave" | "laugh"; value: boolean }
        if (!data) return
        if (data.type === "party") { setParty(data.value); return }
        if (data.type === "wave") {
          if (data.id === userId) return
          setOthers((prev) => prev.map((o) => (o.id === data.id ? { ...o, wave: data.value } : o)))
          return
        }
        if (data.type === "laugh") {
          if (data.id === userId) return
          setOthers((prev) => prev.map((o) => (o.id === data.id ? { ...o, laugh: data.value } : o)))
          return
        }
        if (data.id === userId) return
        if (data.type === "dance") setOthers((prev) => prev.map((o) => (o.id === data.id ? { ...o, dance: data.value } : o)))
        if (data.type === "sit") setOthers((prev) => prev.map((o) => (o.id === data.id ? { ...o, sit: data.value } : o)))
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        setOthers((prev) => {
          const map = new Map(prev.map((o) => [o.id, o]))
          Object.entries(state).forEach(([id, metas]) => {
            if (id === userId) return
            const meta = (metas as any[])[0] || {}
            const existing = map.get(id)
            map.set(id, {
              id,
              name: meta.name || existing?.name || "Guest",
              color: meta.color || existing?.color || randomColor(),
              x: existing?.x ?? 6,
              y: existing?.y ?? 6,
              facing: existing?.facing ?? "S",
              dance: meta.dance ?? existing?.dance ?? false,
              sit: meta.sit ?? existing?.sit ?? false,
              wave: meta.wave ?? existing?.wave ?? false,
              laugh: meta.laugh ?? existing?.laugh ?? false,
            })
          })
          for (const id of Array.from(map.keys())) {
            if (!state[id]) map.delete(id)
          }
          return Array.from(map.values())
        })
      })

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name, color: colorRef.current, dance: false, sit: false, wave: false, laugh: false })
      }
    })

    channelRef.current = channel
    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [room, supabase, userId, name, offlineResolved])

  const sendMessage = useCallback(
    async (text: string) => {
      const guard = guardRef.current
      const cleaned = leo.clean(text ?? "")
      const trimmed = cleaned.trim()

      if (!trimmed) {
        setMessages((prev) => [...prev, { id: "sys-" + crypto.randomUUID(), author: "System", text: "Message cannot be empty.", timestamp: Date.now() }])
        return
      }
      if (trimmed.length > MAX_LEN) {
        setMessages((prev) => [...prev, { id: "sys-" + crypto.randomUUID(), author: "System", text: `Message is too long. Max ${MAX_LEN} characters.`, timestamp: Date.now() }])
        return
      }
      if (!guard.canSend()) {
        setMessages((prev) => [...prev, { id: "sys-" + crypto.randomUUID(), author: "System", text: "You are sending messages too fast.", timestamp: Date.now() }])
        return
      }

      const msg: ChatMessage = { id: crypto.randomUUID(), author: name, text: trimmed, timestamp: Date.now() }
      setMessages((prev) => [...prev, msg]) // optimistic

      if (!offlineResolved) {
        await channelRef.current?.send({ type: "broadcast", event: "chat", payload: msg })
      }
    },
    [name, offlineResolved]
  )

  const postPosition = useCallback(
    (s: { x: number; y: number; facing: Facing }) => {
      if (offlineResolved) return
      const payload: Peer = {
        id: userId,
        name,
        color: colorRef.current,
        ...s,
        dance: selfDance,
        sit: selfSit,
        wave: selfWave,
        laugh: selfLaugh,
      }
      channelRef.current?.send({ type: "broadcast", event: "pos", payload }).catch(() => {})
    },
    [name, userId, selfDance, selfSit, selfWave, selfLaugh, offlineResolved]
  )

  const setDance = useCallback(
    async (value: boolean) => {
      setSelfDance(value)
      if (offlineResolved) return
      await channelRef.current?.track({ name, color: colorRef.current, dance: value, sit: selfSit, wave: selfWave, laugh: selfLaugh })
      await channelRef.current?.send({ type: "broadcast", event: "action", payload: { id: userId, type: "dance", value } })
    },
    [name, userId, selfSit, selfWave, selfLaugh, offlineResolved]
  )

  const setSit = useCallback(
    async (value: boolean) => {
      setSelfSit(value)
      if (offlineResolved) return
      await channelRef.current?.track({ name, color: colorRef.current, dance: selfDance, sit: value, wave: selfWave, laugh: selfLaugh })
      await channelRef.current?.send({ type: "broadcast", event: "action", payload: { id: userId, type: "sit", value } })
    },
    [name, userId, selfDance, selfWave, selfLaugh, offlineResolved]
  )

  const setPartySync = useCallback(
    async (value: boolean) => {
      setParty(value)
      if (offlineResolved) return
      await channelRef.current?.send({ type: "broadcast", event: "action", payload: { id: userId, type: "party", value } })
    },
    [userId, offlineResolved]
  )

  const triggerWave = useCallback(async () => {
    setSelfWave(true)
    setTimeout(() => setSelfWave(false), 2000)
    if (offlineResolved) return
    await channelRef.current?.track({ name, color: colorRef.current, dance: selfDance, sit: selfSit, wave: true, laugh: selfLaugh })
    await channelRef.current?.send({ type: "broadcast", event: "action", payload: { id: userId, type: "wave", value: true } })
    setTimeout(async () => {
      await channelRef.current?.track({ name, color: colorRef.current, dance: selfDance, sit: selfSit, wave: false, laugh: selfLaugh })
      await channelRef.current?.send({ type: "broadcast", event: "action", payload: { id: userId, type: "wave", value: false } })
    }, 2000)
  }, [name, userId, selfDance, selfSit, selfLaugh, offlineResolved])

  const triggerLaugh = useCallback(async () => {
    setSelfLaugh(true)
    setTimeout(() => setSelfLaugh(false), 1800)
    if (offlineResolved) return
    await channelRef.current?.track({ name, color: colorRef.current, dance: selfDance, sit: selfSit, wave: selfWave, laugh: true })
    await channelRef.current?.send({ type: "broadcast", event: "action", payload: { id: userId, type: "laugh", value: true } })
    setTimeout(async () => {
      await channelRef.current?.track({ name, color: colorRef.current, dance: selfDance, sit: selfSit, wave: selfWave, laugh: false })
      await channelRef.current?.send({ type: "broadcast", event: "action", payload: { id: userId, type: "laugh", value: false } })
    }, 1800)
  }, [name, userId, selfDance, selfSit, selfWave, offlineResolved])

  return {
    messages,
    sendMessage,
    others,
    postPosition,
    setDance,
    selfDance,
    setSit,
    selfSit,
    party,
    setPartySync,
    triggerWave,
    selfWave,
    triggerLaugh,
    selfLaugh,
  }
}
