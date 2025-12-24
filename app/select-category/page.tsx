
"use client"

const SHOW_DEBUG = false

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { getGameState } from "@/lib/game-state"
import { useServerTimer } from "@/lib/hooks/use-server-timer"
import { usePhaseSync } from '@/lib/hooks/use-phase-sync'
import { setGamePhase } from '@/lib/game-phases'

const ALL_PRESET_CATEGORIES = [
  { emoji: "🐾", text: "Songs with an animal in the title" },
  { emoji: "🚗", text: "Songs about cars or driving" },
  { emoji: "🏛️", text: "Songs about a city" },
  { emoji: "🎨", text: "Songs with a color in the title" },
  { emoji: "💃", text: "Dance anthems" },
  { emoji: "💥", text: "One-hit wonders" },
  { emoji: "🎬", text: "Movie soundtracks" },
  { emoji: "🚿", text: "Songs you sing in the shower" },
  { emoji: "💒", text: "Wedding party favorites" },
  { emoji: "🧸", text: "Childhood songs" },
  { emoji: "🍕", text: "Songs with a food or drink" },
  { emoji: "🎤", text: "Best cover versions" },
  { emoji: "📅", text: "Songs released this year" },
  { emoji: "📼", text: "Songs from before 2000" },
  { emoji: "🎵", text: "Featuring a famous guest" },
  { emoji: "🔁", text: "Songs you'd play on repeat" },
  { emoji: "🌍", text: "Songs from a non-English language" },
  { emoji: "🎹", text: "Instrumental tracks" },
  { emoji: "🎙️", text: "Songs by a solo artist" },
  { emoji: "🎸", text: "Songs by a band" },
  { emoji: "😳", text: "Guilty pleasures" },
  { emoji: "🚙", text: "Road trip songs" },
  { emoji: "📺", text: "TV theme tunes" },
  { emoji: "😊", text: "Feel-good songs" },
  { emoji: "🎤", text: "Karaoke legends" },
  { emoji: "☀️", text: "Summer hits" },
  { emoji: "🌧️", text: "Rainy day songs" },
  { emoji: "🔢", text: "Songs with numbers" },
  { emoji: "💔", text: "Breakup anthems" },
  { emoji: "❤️", text: "Love songs" },
  { emoji: "🎄", text: "Holiday tunes" },
  { emoji: "🎉", text: "Party starters" },
  { emoji: "🌙", text: "Songs with 'night'" },
  { emoji: "💖", text: "Songs with 'heart'" },
  { emoji: "🔥", text: "Songs with 'fire'" },
  { emoji: "👯", text: "Friendship songs" },
  { emoji: "🌅", text: "Songs for mornings" },
  { emoji: "🕛", text: "Songs for midnight" },
  { emoji: "💪", text: "Songs to motivate" },
  { emoji: "🕺", text: "Songs you dance to" },
  { emoji: "📍", text: "Songs with a place" },
  { emoji: "💭", text: "Songs about dreams" },
  { emoji: "🗺️", text: "Adventure songs" },
  { emoji: "😂", text: "Songs that make you laugh" },
  { emoji: "✊", text: "Protest songs" },
  { emoji: "📱", text: "Viral hits" },
  { emoji: "🤳", text: "Internet memes" },
  { emoji: "👏", text: "Songs with clapping" },
  { emoji: "🔄", text: "Songs about change" },
  { emoji: "❓", text: "Songs with a question" },
  { emoji: "📖", text: "Songs that tell a story" },
  { emoji: "🔍", text: "Songs with a mystery" },
]

function getRandomCategories(count = 10) {
  const shuffled = [...ALL_PRESET_CATEGORIES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export default function SelectCategory() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameCode = searchParams.get("code")
  const currentPlayerId = searchParams.get("player")
  const playerId = searchParams.get("player") || "host"

  const gameState = getGameState()
  const playerData = gameState.players[playerId]
  const playerName = searchParams.get("playerName") || "Player"
  const playerAvatar = searchParams.get("avatar") || "vinyl"

  const [gameId, setGameId] = useState<string>("")
  const [categoryInput, setCategoryInput] = useState("")
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [presetCategories, setPresetCategories] = useState<typeof ALL_PRESET_CATEGORIES>([])
  const [isMuted, setIsMuted] = useState(false)
  const [isPicker, setIsPicker] = useState<boolean>(false)
  const [pickerName, setPickerName] = useState<string>("")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const supabase = createClient()
  const timerStartedRef = useRef(false)

  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(true)

  const addDebug = (msg: string) => {
    if (!SHOW_DEBUG) return;
    setDebugInfo((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  // Phase sync for category selection
  const { currentPhase, isLoading, isCorrectPhase } = usePhaseSync({
    gameCode: gameCode || "",
    gameId,
    expectedPhase: 'category_selection',
    disabled: !gameCode || !gameId
  })

  // Server-synchronized timer
  const { timeRemaining, isExpired, startTimer } = useServerTimer({
    gameId,
    timerType: "category_selection",
    onExpire: async () => {
      console.log("[v0] Category selection timer expired")
      if (presetCategories.length === 0) {
        console.error("[v0] No preset categories available!")
        return
      }
      const randomPreset = presetCategories[Math.floor(Math.random() * presetCategories.length)]

      // NEW: Transition to song_selection phase
      if (gameId) {
        addDebug(`Setting phase to song_selection`)
        await setGamePhase(gameId, 'song_selection')
      }

      // KEEP existing navigation as fallback
      const url = `/category-selected?category=${encodeURIComponent(randomPreset.text)}&code=${gameCode}`
      addDebug(`⏰ Time's up! Auto-selecting: ${randomPreset.text}`)
      router.push(url)
    },
    enabled: !!gameId,
  })

  useEffect(() => {
    setPresetCategories(getRandomCategories(10))
    addDebug(`✅ Page loaded: category-selected`)
    addDebug(`🎮 Game Code: ${gameCode}`)

    const checkCategoryStatus = async () => {
      if (!gameCode) return

      const myPlayerId = localStorage.getItem(`player_id_${gameCode}`)
      if (!myPlayerId) return

      const { data: game } = await supabase
        .from("games")
        .select("id, current_round, current_category, next_category_picker_id")
        .eq("game_code", gameCode)
        .single()

      if (game) {
        setGameId(game.id) // Set gameId for server timer
        addDebug(`📋 Round: ${game.current_round}`)

        // Check if this player is the category picker
        const isThisPlayerPicker = game.next_category_picker_id === myPlayerId
        setIsPicker(isThisPlayerPicker)

        // Fetch picker's name for display
        if (game.next_category_picker_id) {
          const { data: pickerPlayer } = await supabase
            .from("game_players")
            .select("player_name")
            .eq("id", game.next_category_picker_id)
            .single()

          if (pickerPlayer) {
            setPickerName(pickerPlayer.player_name)
          }
        }

        const { data: player } = await supabase
          .from("game_players")
          .select("has_selected_category")
          .eq("id", myPlayerId)
          .single()

        if (player?.has_selected_category && game.current_category) {
          addDebug("⚠️ Already selected category, redirecting...")
          router.push(`/category-selected?category=${encodeURIComponent(game.current_category)}&code=${gameCode}`)
        }
      }
    }

    checkCategoryStatus()
  }, [gameCode, supabase, router])

  useEffect(() => {
    audioRef.current = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ClockTick_BW.49759-5tQ73YsHaA1iUYYs96tgX16MIN18cC.wav")
    audioRef.current.loop = true
    audioRef.current.volume = isMuted ? 0 : 0.5
    audioRef.current.play().catch((e) => console.log("[v0] Audio play failed:", e))

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : 0.5
    }
  }, [isMuted])

  // Start the server timer once gameId is available
  useEffect(() => {
    console.log("[v0] Timer start check:", { gameId, timerStarted: timerStartedRef.current, presetsLoaded: presetCategories.length })
    if (gameId && !timerStartedRef.current && presetCategories.length > 0) {
      timerStartedRef.current = true
      console.log("[v0] Starting category selection timer...")
      startTimer(60).then(() => {
        console.log("[v0] Timer started successfully")
        addDebug("⏱️ Started 60s category selection timer")
      }).catch((err) => {
        console.error("[v0] Failed to start timer:", err)
      })
    }
  }, [gameId, startTimer, presetCategories.length])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const progressPercentage = (timeRemaining / 60) * 100

  const handleLockIn = async () => {
    // Only the picker can lock in a category
    if (!isPicker) {
      addDebug("⚠️ Only the category picker can select!")
      return
    }

    if (categoryInput || selectedPreset) {
      const category = categoryInput || selectedPreset || ""
      addDebug(`🔒 Locking in: ${category}`)

      if (supabase && gameCode) {
        const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()

        if (game) {
          await supabase.from("games").update({ current_category: category }).eq("id", game.id)
          addDebug("✅ Updated game category")

          const myPlayerId = localStorage.getItem(`player_id_${gameCode}`)
          if (myPlayerId) {
            await supabase.from("game_players").update({
              has_selected_category: true,
              has_been_category_picker: true  // Mark as having been the picker
            }).eq("id", myPlayerId)
            addDebug("✅ Marked as selected and as category picker")
          }

          // NEW: Transition to song_selection phase
          if (gameId) {
            addDebug(`Setting phase to song_selection`)
            await setGamePhase(gameId, 'song_selection')
          }
        }
      }

      // KEEP existing navigation as fallback
      router.push(`/category-selected?category=${encodeURIComponent(category)}&code=${gameCode}`)
    }
  }

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col relative overflow-hidden">
      {SHOW_DEBUG && showDebug && debugInfo.length > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] bg-green-600 text-white p-2 text-xs max-h-32 overflow-y-auto"
          onClick={() => setShowDebug(false)}
        >
          <div className="font-bold">DEBUG: select-category (tap to hide)</div>
          {debugInfo.map((info, i) => (
            <div key={i}>{info}</div>
          ))}
        </div>
      )}

      <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000022] pb-4">
        <Link href="/game-starting">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 w-[24px] h-[24px] p-0">
            <ArrowLeft className="h-[24px] w-[24px]" />
          </Button>
        </Link>
        <h1
          className="text-[22px] font-black text-center bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D91EA)",
          }}
        >
          SELECT CATEGORY
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className="text-white hover:bg-white/10 w-[24px] h-[24px] p-0"
        >
          {isMuted ? <VolumeX className="h-[20px] w-[20px]" /> : <Volume2 className="h-[20px] w-[20px]" />}
        </Button>
      </header>

      <div className="fixed top-[120px] left-0 right-0 z-40 bg-[#000022] px-9">
        <p className="text-[14px] font-normal mb-3 text-left" style={{ color: "#B9F3FF" }}>
          {isPicker
            ? `You're up first ${playerName}, one minute to pick.`
            : `Waiting for ${pickerName} to select category...`
          }
        </p>

        <div
          className="rounded-2xl"
          style={{
            background: "#262C87",
            border: "2px solid #C7D2FF",
            padding: "12px 8px",
          }}
        >
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col gap-0">
              <span className="text-[18px] font-semibold text-white leading-tight">{playerName}</span>
              <span
                className="text-[32px] font-extrabold italic text-white leading-none"
                style={{
                  textShadow: "2px 2px 0px #0D113B",
                }}
              >
                {formatTime(timeRemaining)}
              </span>
            </div>

            <div className="w-[60px] h-[60px] flex items-center justify-center bg-transparent">
              <img src={`/${playerAvatar}-sq.png`} alt="Player avatar" className="w-full h-full object-contain" />
            </div>
          </div>

          <div className="px-2 mt-2">
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{
                background: "#C7D2FF",
              }}
            >
              <div
                className="h-full transition-all duration-1000"
                style={{
                  width: `${progressPercentage}%`,
                  background: "#E2A100",
                }}
              />
            </div>
            <p className="text-[12px] font-light mt-1" style={{ color: "#B9F3FF" }}>
              Time remaining...
            </p>
          </div>
        </div>
      </div>

      <div
        className="fixed left-0 right-0 flex flex-col"
        style={{
          top: "300px",
          bottom: 0,
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          borderTop: "3px solid rgb(185, 243, 255)",
          background: "#0D113B",
        }}
      >
        <div style={{ padding: "24px 36px 0" }}>
          <h2 className="text-[20px] font-semibold text-white mb-4">Select your category</h2>

          <input
            type="text"
            value={categoryInput}
            onChange={(e) => {
              setCategoryInput(e.target.value)
              setSelectedPreset(null)
            }}
            placeholder="Type category selection here..."
            className="w-full text-white rounded-2xl px-4 outline-none mb-3"
            style={{
              background: "#000022",
              border: "2px solid #C7D2FF",
              fontSize: "16px",
              height: "56px",
            }}
          />

          <p className="text-[12px] font-light mb-6" style={{ color: "#B9F3FF" }}>
            eg. Love songs, you get more points for your own pick
          </p>

          <h3 className="text-[20px] font-semibold text-white mb-4">Stuck? Pick a preset...</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-9 pb-[120px]">
          <div className="space-y-3">
            {presetCategories.map((category, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedPreset(category.text)
                  setCategoryInput("")
                }}
                className="w-full p-4 rounded-2xl text-left transition-all hover:bg-[#262C87]/30"
                style={{
                  border: selectedPreset === category.text ? "1px solid #00E5CC" : "1px dashed #C7D2FF",
                  background: selectedPreset === category.text ? "#262C87" : "transparent",
                  fontSize: "14px",
                }}
              >
                <span>
                  {category.emoji} {category.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
        style={{
          background: "linear-gradient(to top, #000022 0%, rgba(0, 0, 34, 0.95) 50%, transparent 100%)",
          paddingTop: "40px",
          paddingBottom: "26px",
        }}
      >
        <button
          onClick={handleLockIn}
          disabled={!isPicker || (!categoryInput && !selectedPreset)}
          className="w-[calc(100%-72px)] h-[56px] text-[20px] font-bold rounded-[16px] border-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "#FFD03B",
            border: "2px solid #FFF8C4",
            boxShadow: "0px 4px 0px 0px #7C5100",
            color: "#000033",
          }}
        >
          {isPicker ? "Lock in your category" : `Waiting for ${pickerName}...`}
        </button>
      </div>
    </div>
  )
}
