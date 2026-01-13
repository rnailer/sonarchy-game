
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

const getAvatarImage = (avatarId: string) => {
  const avatarMap: Record<string, string> = {
    vinyl: "/vinyl-deck-sq.png",
    jukebox: "/jukebox-sq.png",
    mp3: "/mp3-player.png",
    cassette: "/sg-casette.png",
    minidisc: "/midi-sq.png",
    boombox: "/beatbox-sq.png",
    walkman: "/walkman.png",
  }
  return avatarMap[avatarId] || "/music-cloud-sq.png"
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

  // Helper function to get ordinal for round number
  const getOrdinal = (n: number): string => {
    const ordinals = ['', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH']
    return ordinals[n] || `ROUND ${n}`
  }

  const [gameId, setGameId] = useState<string>("")
  const [currentRound, setCurrentRound] = useState<number>(1)
  const [categoryInput, setCategoryInput] = useState("")
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [presetCategories, setPresetCategories] = useState<typeof ALL_PRESET_CATEGORIES>([])
  const [isMuted, setIsMuted] = useState(false)
  const [isPicker, setIsPicker] = useState<boolean>(false)
  const [pickerName, setPickerName] = useState<string>("")
  const [pickerAvatar, setPickerAvatar] = useState<string | null>(null)
  // TODO: Add host-only sounds later
  // const audioRef = useRef<HTMLAudioElement | null>(null)
  const supabase = createClient()
  const timerStartedRef = useRef(false)
  const hasHandledExpiration = useRef(false)
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdown, setCountdown] = useState<number | "GO">(3)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  // TODO: Add host-only sounds later
  // const countdownAudioRef = useRef<HTMLAudioElement | null>(null)

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
    expectedRound: currentRound,
    disabled: !gameCode || !gameId
  })

  // Server-synchronized timer
  const { timeRemaining, isExpired, startTimer } = useServerTimer({
    gameId,
    timerType: "category_selection",
    onExpire: async () => {
      if (hasHandledExpiration.current) {
        console.log("[v0] ⏰ Timer expiration already handled, skipping")
        return
      }
      hasHandledExpiration.current = true

      console.log("[v0] Category selection timer expired")

      // Only the picker should auto-select when timer expires
      if (!isPicker) {
        console.log("[v0] Non-picker: waiting for picker to auto-select or phase change")
        return
      }

      if (presetCategories.length === 0) {
        console.error("[v0] No preset categories available!")
        return
      }
      const randomPreset = presetCategories[Math.floor(Math.random() * presetCategories.length)]

      // Auto-select category when time runs out
      if (supabase && gameCode) {
        const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()

        if (game) {
          await supabase.from("games").update({ current_category: randomPreset.text }).eq("id", game.id)

          const myPlayerId = localStorage.getItem(`player_id_${gameCode}`)
          if (myPlayerId) {
            await supabase.from("game_players").update({
              has_selected_category: true,
              has_been_category_picker: true
            }).eq("id", myPlayerId)
          }

          // Show countdown to all players (via database subscription)
          // Phase transition will happen AFTER countdown in countdown effect
          addDebug(`⏰ Time's up! Auto-selected: ${randomPreset.text}`)
          addDebug(`🎬 Countdown will trigger for all players via subscription`)

          // Also trigger countdown for the picker (who just auto-selected)
          setSelectedCategory(randomPreset.text)
          setShowCountdown(true)
          setCountdown(3)
        }
      }
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
        setCurrentRound(game.current_round || 1)
        addDebug(`📋 Round: ${game.current_round}`)

        // Check if this player is the category picker
        const isThisPlayerPicker = game.next_category_picker_id === myPlayerId
        setIsPicker(isThisPlayerPicker)

        // Fetch picker's name and avatar for display
        if (game.next_category_picker_id) {
          const { data: pickerPlayer } = await supabase
            .from("game_players")
            .select("player_name, avatar_id")
            .eq("id", game.next_category_picker_id)
            .single()

          if (pickerPlayer) {
            setPickerName(pickerPlayer.player_name)
            setPickerAvatar(pickerPlayer.avatar_id)
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

  // Subscribe to category selection for countdown (ALL players)
  useEffect(() => {
    if (!gameId || !gameCode) return

    console.log("[v0] Setting up category selection subscription for all players")

    const channel = supabase
      .channel(`category-selection-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        async (payload) => {
          const newCategory = payload.new.current_category
          const oldCategory = payload.old.current_category

          // Category was just selected
          if (newCategory && newCategory !== oldCategory) {
            console.log("[v0] 🎯 Category selected:", newCategory)
            addDebug(`🎯 Category selected: ${newCategory}`)

            // TODO: Add host-only sounds later
            // Stop the ticking clock sound
            // if (audioRef.current) {
            //   audioRef.current.pause()
            //   audioRef.current = null
            // }

            // Show countdown overlay with the selected category
            setSelectedCategory(newCategory)
            setShowCountdown(true)
            setCountdown(3)

            // TODO: Add host-only sounds later
            // Play countdown sound after a brief delay
            // setTimeout(() => {
            //   countdownAudioRef.current = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/8-bit%20Countdown%20D-q2pOCsVe8lEbv9dXtvx4WMLm1hyxOx.wav")
            //   countdownAudioRef.current.loop = false
            //   countdownAudioRef.current.volume = isMuted ? 0 : 1
            //   countdownAudioRef.current.play().catch((e) => console.log("[v0] Countdown audio play failed:", e))
            // }, 1000)
          }
        }
      )
      .subscribe()

    return () => {
      console.log("[v0] Cleaning up category selection subscription")
      supabase.removeChannel(channel)
    }
  }, [gameId, gameCode, supabase, isMuted])

  // Countdown timer effect
  useEffect(() => {
    if (!showCountdown) return

    if (countdown === 3 || countdown === 2 || countdown === 1) {
      const timer = setTimeout(() => {
        setCountdown(countdown === 3 ? 2 : countdown === 2 ? 1 : "GO")
      }, 1000)
      return () => clearTimeout(timer)
    } else if (countdown === "GO") {
      // After showing "GO", set phase and navigate to pick-your-song
      const timer = setTimeout(async () => {
        console.log("[v0] Countdown finished, setting phase and navigating to pick-your-song")

        // Set phase to song_selection AFTER countdown
        if (gameId) {
          console.log("[v0] Setting phase to song_selection after countdown")
          await setGamePhase(gameId, 'song_selection')
          console.log("[v0] Phase transition complete")
        }

        // Fetch the current category from the database
        const { data } = await supabase
          .from("games")
          .select("current_category")
          .eq("game_code", gameCode)
          .single()

        if (data?.current_category) {
          const targetUrl = `/pick-your-song?code=${gameCode}&category=${encodeURIComponent(data.current_category)}`
          router.push(targetUrl)
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [showCountdown, countdown, gameCode, gameId, router, supabase])

  // TODO: Add host-only sounds later
  // useEffect(() => {
  //   audioRef.current = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ClockTick_BW.49759-5tQ73YsHaA1iUYYs96tgX16MIN18cC.wav")
  //   audioRef.current.loop = true
  //   audioRef.current.volume = isMuted ? 0 : 0.5
  //   audioRef.current.play().catch((e) => console.log("[v0] Audio play failed:", e))

  //   return () => {
  //     if (audioRef.current) {
  //       audioRef.current.pause()
  //       audioRef.current = null
  //     }
  //   }
  // }, [])

  // TODO: Add host-only sounds later
  // useEffect(() => {
  //   if (audioRef.current) {
  //     audioRef.current.volume = isMuted ? 0 : 0.5
  //   }
  // }, [isMuted])

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
          // TODO: Add host-only sounds later
          // Stop the ticking clock sound
          // if (audioRef.current) {
          //   audioRef.current.pause()
          //   audioRef.current = null
          // }

          // Update category in database (this triggers subscription for all players)
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

          // Show countdown overlay for picker too
          setSelectedCategory(category)
          setShowCountdown(true)
          setCountdown(3)

          // TODO: Add host-only sounds later
          // Play countdown sound after a brief delay
          // setTimeout(() => {
          //   countdownAudioRef.current = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/8-bit%20Countdown%20D-q2pOCsVe8lEbv9dXtvx4WMLm1hyxOx.wav")
          //   countdownAudioRef.current.loop = false
          //   countdownAudioRef.current.volume = isMuted ? 0 : 1
          //   countdownAudioRef.current.play().catch((e) => console.log("[v0] Countdown audio play failed:", e))
          // }, 1000)

          // Phase transition moved to countdown effect - happens AFTER countdown finishes
          // This prevents PhaseSync from redirecting before the countdown completes
        }
      }
    }
  }

  // Show waiting view for non-pickers
  if (!isPicker && pickerName && gameId) {
    const ordinal = getOrdinal(currentRound || 1)
    const ordinalLower = ordinal.toLowerCase()

    return (
      <div className="min-h-screen bg-[#000022] text-white flex flex-col">
        {/* Header */}
        <header className="pt-12 pb-6 px-6 text-center">
          <h1
            className="text-2xl font-black tracking-wide"
            style={{
              background: "linear-gradient(to right, #00D4FF, #00F0FF)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {ordinal} CATEGORY...
          </h1>
        </header>

        {/* Main content card */}
        <div
          className="flex-1 mx-4 rounded-t-3xl flex flex-col items-center px-6 pt-8"
          style={{
            background: "linear-gradient(to bottom, #0D113B, #000022)",
            borderTop: "2px solid rgba(0, 212, 255, 0.3)",
          }}
        >
          <p className="text-white/80 text-center text-lg mb-8">
            The {ordinalLower} music category is being<br />hand crafted by...
          </p>

          {/* Timer circle with avatar */}
          <div className="relative flex items-center justify-center mb-4">
            {/* Outer decorative ring */}
            <div
              className="absolute w-72 h-72 rounded-full"
              style={{
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            />

            {/* Progress ring background */}
            <div
              className="relative w-64 h-64 rounded-full flex items-center justify-center"
              style={{
                background: "#262C87",
              }}
            >
              {/* SVG Progress Ring */}
              <svg className="absolute w-full h-full -rotate-90">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="4"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  fill="none"
                  stroke="#FFD700"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 120}
                  strokeDashoffset={2 * Math.PI * 120 * (1 - (timeRemaining || 0) / 60)}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>

              {/* Inner content */}
              <div className="flex flex-col items-center justify-center z-10">
                {/* Avatar */}
                {pickerAvatar && (
                  <div className="w-16 h-16 rounded-full overflow-hidden mb-2 border-2 border-white/20">
                    <img
                      src={getAvatarImage(pickerAvatar)}
                      alt={pickerName}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                )}

                {/* Timer */}
                <div
                  className="text-6xl font-black"
                  style={{
                    color: "white",
                    textShadow: "2px 2px 4px rgba(0,0,0,0.5)"
                  }}
                >
                  {Math.floor((timeRemaining || 0) / 60)}:{String((timeRemaining || 0) % 60).padStart(2, '0')}
                </div>

                {/* Picker name */}
                <p className="text-white text-xl font-semibold mt-2">
                  {pickerName}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat button */}
        <div className="px-6 pb-8 pt-4">
          <button
            onClick={() => {/* TODO: Open chat */}}
            className="w-full py-4 rounded-full text-white font-semibold"
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            Tired of waiting? Lets chat 💬
          </button>
        </div>
      </div>
    )
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
            placeholder={isPicker ? "Type category selection here..." : "Only the picker can select..."}
            disabled={!isPicker}
            className="w-full text-white rounded-2xl px-4 outline-none mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  if (!isPicker) return // Only picker can select
                  setSelectedPreset(category.text)
                  setCategoryInput("")
                }}
                disabled={!isPicker}
                className="w-full p-4 rounded-2xl text-left transition-all hover:bg-[#262C87]/30 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Countdown overlay (shown to ALL players when category is selected) */}
      {showCountdown && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{
            background: "#000022",
          }}
        >
          <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-center px-3 pb-4">
            <h1
              className="text-[22px] font-black text-center bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D91EA)",
              }}
            >
              the category is...
            </h1>
          </header>

          <div
            className="flex-1 flex flex-col items-start mt-[140px] w-full relative"
            style={{
              borderTopLeftRadius: "24px",
              borderTopRightRadius: "24px",
              borderTop: "3px solid rgb(185, 243, 255)",
              background: "#0D113B",
              paddingLeft: "36px",
              paddingRight: "36px",
              paddingTop: "36px",
            }}
          >
            <h2
              className="text-[36px] font-extrabold text-center mb-12 leading-tight w-full bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(to right, #FFF1AB, #DC9C00)",
              }}
            >
              {selectedCategory || "Loading..."}
            </h2>

            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center" style={{ top: "206px" }}>
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: "280px",
                  height: "280px",
                  background: "#262C87",
                  borderRadius: "50%",
                }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: "242px",
                    height: "242px",
                    background: "transparent",
                    border: "1px solid #D8D8E0",
                    borderRadius: "50%",
                  }}
                >
                  <div
                    className="font-extrabold text-center"
                    style={{
                      fontSize: "128px",
                      color: "white",
                      filter: "drop-shadow(4px 4px 0px #0D113B)",
                    }}
                  >
                    {countdown}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
