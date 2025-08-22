"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { MessageSquare, Map, Settings, Volume2, VolumeX, Music2, Pause, WifiOff } from 'lucide-react'
import IsoRoom, { type RoomPreset } from "@/components/iso-room"
import ChatPanel from "@/components/chat-panel"
import WindowFrame from "@/components/window-frame"
import styles from "@/styles/habbo.module.css"
import { useMultiplayer } from "@/hooks/use-multiplayer"
import { ChipTune } from "@/lib/chiptune-fallback"

function getOrCreateId(key: string) {
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(key, id)
    return id
  } catch {
    return "guest-" + Math.random().toString(36).slice(2, 10)
  }
}
function getOrCreateName() {
  try {
    const existing = localStorage.getItem("pp_name")
    if (existing) return existing
    const name = "Guest-" + Math.floor(Math.random() * 9000 + 1000)
    localStorage.setItem("pp_name", name)
    return name
  } catch {
    return "Guest-" + Math.floor(Math.random() * 9000 + 1000)
  }
}

// Multi-source candidates (Wikimedia/Archive). We try each in order via our proxy, else synth fallback.
type TrackId = "sunny" | "night"
type TrackCandidate = { src: string; type?: "audio/ogg" | "audio/mpeg"; note?: string }
const TRACK_CANDIDATES: Record<TrackId, { label: string; sources: TrackCandidate[] }> = {
  sunny: {
    label: "Sunny (Wikimedia/Archive)",
    sources: [
      { src: "https://upload.wikimedia.org/wikipedia/commons/4/45/Example.ogg", type: "audio/ogg" },
      { src: "https://archive.org/download/SampleAudio_201303/sample_64kbps.mp3", type: "audio/mpeg" },
      { src: "https://ia800304.us.archive.org/27/items/testmp3testfile/mpthreetest.mp3", type: "audio/mpeg" },
    ],
  },
  night: {
    label: "Night (Wikimedia/Archive)",
    sources: [
      { src: "https://upload.wikimedia.org/wikipedia/commons/3/3f/OOjs_UI_icon_notice-progressive.ogg", type: "audio/ogg" },
      { src: "https://archive.org/download/SampleAudio_201303/sample_128kbps.mp3", type: "audio/mpeg" },
      { src: "https://ia802707.us.archive.org/30/items/Example-mp3-file/Example.mp3", type: "audio/mpeg" },
    ],
  },
}

export default function Page() {
  const [room, setRoom] = useState<RoomPreset>("Lobby")
  const [chatOpen, setChatOpen] = useState(true)
  const [navOpen, setNavOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [uid, setUid] = useState("")
  const [displayName, setDisplayName] = useState("Guest")

  // Offline mode: no Supabase env available on client
  const offlineMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Audio state (local only)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [volume, setVolume] = useState(0.6)
  const [currentTrackId, setCurrentTrackId] = useState<TrackId | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Engines: HTMLAudio (remote) + WebAudio synth fallback
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const chipRef = useRef<ChipTune | null>(null)
  const usingFallbackRef = useRef(false)

  useEffect(() => {
    setUid(getOrCreateId("pp_uid"))
    setDisplayName(getOrCreateName())
  }, [])

  useEffect(() => {
    const a = new Audio()
    a.loop = true
    a.preload = "auto"
    a.crossOrigin = "anonymous"
    a.volume = volume
    audioRef.current = a
    return () => {
      a.pause()
      audioRef.current = null
    }
  }, [])

  // Enable/disable engines
  useEffect(() => {
    if (!audioEnabled) {
      audioRef.current?.pause()
      chipRef.current?.pause()
      setIsPlaying(false)
    }
    if (!chipRef.current) chipRef.current = new ChipTune()
    chipRef.current.setEnabled(audioEnabled)
  }, [audioEnabled])

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    if (!chipRef.current) chipRef.current = new ChipTune()
    chipRef.current.setVolume(volume)
  }, [volume])

  const startFallback = useCallback(async (id: TrackId) => {
    if (!chipRef.current) chipRef.current = new ChipTune()
    usingFallbackRef.current = true
    await chipRef.current.play(id)
    setCurrentTrackId(id)
    setIsPlaying(true)
  }, [])

  const stopFallback = useCallback(() => {
    if (chipRef.current) chipRef.current.pause()
    usingFallbackRef.current = false
  }, [])

  // Try a list of candidate sources for a track. If all fail, use synth fallback.
  const playTrack = useCallback(async (id: TrackId) => {
    if (!audioEnabled) {
      setCurrentTrackId(id)
      setIsPlaying(false)
      return
    }

    const a = audioRef.current
    const t = TRACK_CANDIDATES[id]
    if (!a || !t) return
    if (usingFallbackRef.current) stopFallback()

    const canPlayOgg = !!a.canPlayType && a.canPlayType("audio/ogg; codecs=vorbis") !== ""
    const canPlayMp3 = !!a.canPlayType && a.canPlayType("audio/mpeg") !== ""
    const candidates = t.sources.filter(s => {
      if (s.type === "audio/ogg") return canPlayOgg
      if (s.type === "audio/mpeg") return canPlayMp3
      return true
    })

    for (const c of candidates) {
      try {
        const proxied = `/api/proxy-audio?url=${encodeURIComponent(c.src)}`
        a.pause()
        a.src = proxied
        try { a.load?.() } catch {}
        a.currentTime = 0
        await a.play()
        setCurrentTrackId(id)
        setIsPlaying(true)
        return
      } catch {
        continue
      }
    }
    await startFallback(id)
  }, [audioEnabled, startFallback, stopFallback])

  const pauseAudio = useCallback(() => {
    if (usingFallbackRef.current) {
      stopFallback()
    }
    const a = audioRef.current
    if (a) a.pause()
    setIsPlaying(false)
  }, [stopFallback])

  const toggleMusicBox = useCallback((id: string) => {
    const trackId: TrackId = id === "night" ? "night" : "sunny"
    if (currentTrackId === trackId && isPlaying) {
      pauseAudio()
    } else {
      void playTrack(trackId)
    }
  }, [currentTrackId, isPlaying, pauseAudio, playTrack])

  const {
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
  } = useMultiplayer({
    room,
    userId: uid || "boot",
    name: displayName,
    offline: offlineMode,
  })

  const [sitSeq, setSitSeq] = useState(0)

  const handleSend = useCallback(
    async (text: string) => {
      const t = text.trim().toLowerCase()
      if (t.startsWith("/dance")) {
        const arg = t.split(" ")[1]
        const next = arg === "on" ? true : arg === "off" ? false : !selfDance
        setDance(next)
        return
      }
      if (t.startsWith("/party")) {
        const arg = t.split(" ")[1]
        const next = arg === "on" ? true : arg === "off" ? false : !party
        setPartySync(next)
        return
      }
      if (t.startsWith("/sit")) {
        if (selfSit) setSit(false)
        else setSitSeq((n) => n + 1)
        return
      }
      if (t.startsWith("/wave")) {
        triggerWave()
        return
      }
      if (t.startsWith("/laugh")) {
        triggerLaugh()
        return
      }
      await sendMessage(text)
    },
    [sendMessage, selfDance, setDance, party, setPartySync, selfSit, setSit, triggerWave, triggerLaugh]
  )

  const handleRoomChange = useCallback((next: RoomPreset) => setRoom(next), [])

  const onlineCount = useMemo(() => (others ? others.length + 1 : 1), [others])
  const roomTitle = useMemo(() => `${room} — Online: ${onlineCount}`, [room, onlineCount])

  // Use the last 10 messages for in-room bubbles (per author)
  const recentForBubbles = useMemo(() => messages.slice(-10), [messages])

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#9bbad3]">
      <header className="border-b border-black/40 bg-[#2f2f2f]">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center gap-3">
          <div className={styles.logoBlock} aria-label="Pixel Plaza logo">
            <span className={styles.logoWord}>PIXEL PLAZA</span>
          </div>
          <Separator orientation="vertical" className="h-6 bg-black/50" />
          <div className="text-sm text-white/80 hidden sm:block">{roomTitle}</div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" className={styles.pixelButton} onClick={() => setNavOpen((v) => !v)}>
              <Map className="w-4 h-4" /> Navigator
            </Button>
            <Button variant="outline" className={styles.pixelButton} onClick={() => setChatOpen((v) => !v)}>
              <MessageSquare className="w-4 h-4" /> Chat
            </Button>
            <Button variant="outline" className={styles.pixelButton} onClick={() => setSettingsOpen((v) => !v)}>
              <Settings className="w-4 h-4" /> Settings
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto p-4">
          <div className={styles.playFrame}>
            <div className="relative w-full h-[70vh] min-h-[520px]">
              <IsoRoom
                room={room}
                selfName={displayName}
                onBubble={(t) => handleSend(t)}
                recentMessages={recentForBubbles}
                peers={others}
                onStep={(s) => postPosition(s)}
                dancing={selfDance}
                party={party}
                waving={selfWave}
                laughing={selfLaugh}
                sitToggleSeq={sitSeq}
                onSitChange={(value) => setSit(value)}
                // Music boxes
                audioEnabled={audioEnabled}
                currentTrackId={currentTrackId || undefined}
                isPlaying={isPlaying}
                onMusicBoxToggle={toggleMusicBox}
              />
              {offlineMode && (
                <div
                  className="absolute bottom-2 left-2 text-[11px] text-black/80 rounded-md border border-black/30 bg-white/90 px-2 py-1 shadow-sm flex items-center gap-1"
                  aria-live="polite"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline mode (no Supabase env)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {chatOpen && (
        <WindowFrame
          id="chat"
          title="Chat"
          variant="habbo"
          initial={{ x: 16, y: 88, w: 360, h: 360 }}
          onClose={() => setChatOpen(false)}
          ariaTitle="Chat window"
        >
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            placeholder="Try /dance, /sit, /party, /wave, /laugh"
            maxLength={240}
          />
        </WindowFrame>
      )}

      {navOpen && (
        <WindowFrame
          id="navigator"
          title="Plaza Navigator"
          variant="habbo"
          initial={{ x: 400, y: 88, w: 360, h: 420 }}
          onClose={() => setNavOpen(false)}
          ariaTitle="Navigator window"
        >
          <div className="p-0 h-full flex flex-col">
            <div className={styles.tabBar}>
              <div className={styles.tabActive}>Public Spaces</div>
              <div className={styles.tab}>Guest Rooms</div>
            </div>
            <div className="px-3 py-2 text-[12px] text-black/80">Public Rooms</div>
            <div className="px-3 pb-3 space-y-2">
              {[
                { label: "GPT-5 Launch Party 🥳", value: "Lobby" as RoomPreset },
                { label: "Cafés", value: "Café" as RoomPreset },
                { label: "Rooftop", value: "Rooftop" as RoomPreset },
              ].map((r) => (
                <div key={r.label} className={styles.navRow}>
                  <div className={styles.navDot} />
                  <div className="truncate">{r.label}</div>
                  <div className="ml-auto flex items-center gap-2">
                    <div className={styles.statusPill}>Open</div>
                    <Button size="sm" className={styles.goButton} onClick={() => handleRoomChange(r.value)}>
                      Go
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto border-t border-black/20 text-[11px] text-black/70 px-3 py-2">
              Tip: Click tiles or hold WASD/Arrows to walk. Emotes: /dance, /sit, /party, /wave, /laugh. Click a music box to play tunes locally.
            </div>
          </div>
        </WindowFrame>
      )}

      {settingsOpen && (
        <WindowFrame
          id="settings"
          title="Settings"
          variant="habbo"
          initial={{ x: 780, y: 88, w: 360, h: 260 }}
          onClose={() => setSettingsOpen(false)}
          ariaTitle="Settings window"
        >
          <div className="p-3 flex flex-col gap-3">
            <div className="text-[13px] font-semibold">Audio</div>
            <div className="flex items-center justify-between border border-black/20 rounded-md px-3 py-2 bg-white">
              <div className="flex items-center gap-2">
                {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <div className="text-[12px]">Sound</div>
              </div>
              <Switch checked={audioEnabled} onCheckedChange={(v) => setAudioEnabled(!!v)} />
            </div>

            <div className="grid grid-cols-6 items-center gap-3 border border-black/20 rounded-md px-3 py-2 bg-white">
              <div className="col-span-2 text-[12px]">Volume</div>
              <div className="col-span-4">
                <Slider
                  value={[Math.round(volume * 100)]}
                  onValueChange={(vals) => setVolume((vals?.[0] ?? 60) / 100)}
                  max={100}
                  step={1}
                />
              </div>
            </div>

            <div className="border border-black/20 rounded-md px-3 py-2 bg-white">
              <div className="text-[12px]">Now playing</div>
              <div className="mt-1 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px]">
                  <Music2 className="w-4 h-4" />
                  <span>{currentTrackId ? `${TRACK_CANDIDATES[currentTrackId].label}${usingFallbackRef.current ? " (Synth)" : ""}` : "None"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className={styles.goButton}
                    onClick={() => {
                      if (!currentTrackId) return void playTrack("sunny")
                      if (isPlaying) pauseAudio()
                      else void playTrack(currentTrackId)
                    }}
                  >
                    {isPlaying ? <><Pause className="w-4 h-4" /> Pause</> : <><Music2 className="w-4 h-4" /> Play</>}
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-black/60">
                Sources: Wikimedia/Archive via local proxy; auto-switch to synth if loading fails.
              </div>
            </div>
          </div>
        </WindowFrame>
      )}
    </div>
  )
}
