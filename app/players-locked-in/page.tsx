"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

interface Player {
  id: string
  player_name: string
  avatar_id: string
  song_name: string
  artist_name: string
  locked_in_time: number
}

interface ChatMessage {
  id: string
  player_id: string
  player_name: string
  player_avatar: string
  message: string
  created_at: string
}

interface EmojiParticle {
  id: string
  emoji: string
  x: number
  y: number
}

const PLAYER_COLOR_SETS = [
  { border: "#C084FC", bg: "#A855F7", shadow: "#7C3AED" },
  { border: "#B9F3FF", bg: "#0891B2", shadow: "#0E7490" },
  { border: "#D2FFFF", bg: "#06B6D4", shadow: "#0891B2" },
  { border: "#FFE5B4", bg: "#FB923C", shadow: "#EA580C" },
  { border: "#FFD0F5", bg: "#EC4899", shadow: "#DB2777" },
  { border: "#C7D2FF", bg: "#4338CA", shadow: "#3730A3" },
  { border: "#FFF8C4", bg: "#FBBF24", shadow: "#F59E0B" },
  { border: "#F5D8FF", bg: "#D946EF", shadow: "#C026D3" },
  { border: "#D0F5E5", bg: "#14B8A6", shadow: "#0D9488" },
  { border: "#E5E7EB", bg: "#6B7280", shadow: "#4B5563" },
]

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

export default function PlayersLockedIn() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get("category") || "Songs about cars or driving"
  const gameCode = searchParams.get("code")
  const remainingTimeParam = searchParams.get("remainingTime")

  const [timeRemaining, setTimeRemaining] = useState(() => {
    if (remainingTimeParam) {
      const time = Number.parseInt(remainingTimeParam)
      console.log("[v0] Using remaining time from pick-your-song:", time)
      return Math.max(0, time)
    }
    console.log("[v0] No remaining time parameter, using default 10 seconds")
    return 10
  })

  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [activeTab, setActiveTab] = useState<"players" | "chat">("players")
  const [players, setPlayers] = useState<Player[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [emojiParticles, setEmojiParticles] = useState<EmojiParticle[]>([])
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number>(0)
  const touchEndX = useRef<number>(0)
  const [gameId, setGameId] = useState<string | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("")
  const [currentPlayerName, setCurrentPlayerName] = useState<string>("")
  const [currentPlayerAvatar, setCurrentPlayerAvatar] = useState<string>("")
  const supabase = createClient()

  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(true)

  const addDebugLog = (message: string) => {
    console.log("[v0]", message)
    setDebugInfo((prev) => [...prev.slice(-8), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    if (!gameCode) return

    const loadGameData = async () => {
      const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()

      if (game) {
        setGameId(game.id)
        addDebugLog(`✅ Game ID: ${game.id}`)
      }

      const storageKey = `player_id_${gameCode}`
      const playerId = localStorage.getItem(storageKey)
      const playerName = localStorage.getItem("player_name")
      const playerAvatar = localStorage.getItem("player_avatar")

      addDebugLog(`🔍 Looking for player ID with key: ${storageKey}`)
      addDebugLog(`👤 Found player ID: ${playerId || "NOT FOUND"}`)
      addDebugLog(`📝 Player name: ${playerName || "NOT FOUND"}`)
      addDebugLog(`🎨 Player avatar: ${playerAvatar || "NOT FOUND"}`)

      if (playerId && playerName && playerAvatar) {
        setCurrentPlayerId(playerId)
        setCurrentPlayerName(playerName)
        setCurrentPlayerAvatar(playerAvatar)
        addDebugLog(`✅ Current player set: ${playerName} (${playerId})`)
      } else {
        addDebugLog(`❌ Missing player data in localStorage`)
        if (game) {
          const { data: players } = await supabase
            .from("game_players")
            .select("id, player_name, avatar_id")
            .eq("game_id", game.id)
            .order("joined_at", { ascending: true })
            .limit(1)

          if (players && players.length > 0) {
            const player = players[0]
            setCurrentPlayerId(player.id)
            setCurrentPlayerName(player.player_name)
            setCurrentPlayerAvatar(player.avatar_id)
            addDebugLog(`✅ Loaded player from database: ${player.player_name} (${player.id})`)
          }
        }
      }
    }

    loadGameData()
  }, [gameCode, supabase])

  useEffect(() => {
    if (!supabase || !gameId) return

    addDebugLog(`🔧 Setting up chat for game: ${gameId}`)

    const loadMessages = async () => {
      addDebugLog("📥 Loading chat messages...")
      const { data, error } = await supabase
        .from("game_chat")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at", { ascending: true })

      if (error) {
        addDebugLog(`❌ Chat load error: ${error.message}`)
        return
      }

      if (data) {
        addDebugLog(`✅ Loaded ${data.length} messages`)

        const { data: players } = await supabase
          .from("game_players")
          .select("id, player_name, avatar_id")
          .eq("game_id", gameId)

        addDebugLog(`👥 Fetched ${players?.length || 0} player records for avatar mapping`)

        const avatarByIdMap = new Map<string, string>()
        const avatarByNameMap = new Map<string, string>()
        players?.forEach((p: any) => {
          avatarByIdMap.set(p.id, p.avatar_id)
          avatarByNameMap.set(p.player_name, p.avatar_id)
          addDebugLog(`📝 Mapped player: ${p.player_name} (${p.id}) -> ${p.avatar_id}`)
        })

        const formattedMessages: ChatMessage[] = data.map((msg: any) => {
          let avatar = msg.player_id ? avatarByIdMap.get(msg.player_id) : null
          if (!avatar) {
            avatar = avatarByNameMap.get(msg.player_name) || ""
          }

          if (!avatar) {
            addDebugLog(`⚠️ No avatar found for message from ${msg.player_name} (ID: ${msg.player_id || "null"})`)
          } else {
            addDebugLog(`✅ Avatar for ${msg.player_name}: ${avatar}`)
          }

          return {
            id: msg.id,
            player_id: msg.player_id || "",
            player_name: msg.player_name,
            player_avatar: avatar,
            message: msg.message,
            created_at: msg.created_at,
          }
        })
        setChatMessages(formattedMessages)
      }
    }

    loadMessages()

    addDebugLog("🔔 Subscribing to chat...")
    const channel = supabase
      .channel(`game_${gameId}_chat`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_chat",
          filter: `game_id=eq.${gameId}`,
        },
        async (payload) => {
          addDebugLog(`📨 New message from ${payload.new.player_name}`)
          const newMessage = payload.new as any

          const { data: playerData } = await supabase
            .from("game_players")
            .select("avatar_id, id")
            .eq("player_name", newMessage.player_name)
            .eq("game_id", gameId)
            .maybeSingle()

          if (!playerData?.avatar_id) {
            addDebugLog(`⚠️ No avatar found for ${newMessage.player_name}`)
          } else {
            addDebugLog(`✅ Avatar retrieved: ${playerData.avatar_id}`)
          }

          const formattedMessage: ChatMessage = {
            id: newMessage.id,
            player_id: newMessage.player_id || playerData?.id || "",
            player_name: newMessage.player_name,
            player_avatar: playerData?.avatar_id || "",
            message: newMessage.message,
            created_at: newMessage.created_at,
          }
          setChatMessages((prev) => {
            if (prev.find((m) => m.id === formattedMessage.id)) {
              addDebugLog("⚠️ Duplicate message skipped")
              return prev
            }
            addDebugLog("✅ Message added to chat")
            return [...prev, formattedMessage]
          })
        },
      )
      .subscribe((status) => {
        addDebugLog(`📡 Chat status: ${status}`)
      })

    return () => {
      addDebugLog("🧹 Cleaning up chat")
      supabase.removeChannel(channel)
    }
  }, [supabase, gameId])

  useEffect(() => {
    if (!gameCode) return

    const fetchPlayers = async () => {
      console.log("[v0] Fetching players for game:", gameCode)

      const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()

      if (!game) {
        console.error("[v0] Game not found")
        return
      }

      const { data: playersData, error } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", game.id)
        .order("joined_at", { ascending: true })

      if (error) {
        console.error("[v0] Error fetching players:", error)
        return
      }

      if (playersData) {
        console.log("[v0] Fetched all players:", playersData)
        const formattedPlayers: Player[] = playersData.map((p, index) => ({
          id: p.id,
          player_name: p.player_name,
          avatar_id: p.avatar_id,
          song_name: p.song_title || "Choosing song...",
          artist_name: p.song_artist || "",
          locked_in_time: index + 1,
        }))
        setPlayers(formattedPlayers)
      }
    }

    fetchPlayers()

    const channel = supabase
      .channel(`game-${gameCode}-players`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_players",
        },
        () => {
          console.log("[v0] Player update detected, refetching...")
          fetchPlayers()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameCode])

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
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      const navigateToPlayback = async () => {
        if (!gameCode || !supabase) {
          router.push(`/playtime-playback?category=${encodeURIComponent(category)}&code=${gameCode}`)
          return
        }

        try {
          const { data: game } = await supabase
            .from("games")
            .select("id, current_category")
            .eq("game_code", gameCode)
            .single()

          if (game) {
            const actualCategory = game.current_category || category
            router.push(`/playtime-playback?category=${encodeURIComponent(actualCategory)}&code=${gameCode}`)
          } else {
            router.push(`/playtime-playback?category=${encodeURIComponent(category)}&code=${gameCode}`)
          }
        } catch (error) {
          console.error("[v0] Error fetching game category:", error)
          router.push(`/playtime-playback?category=${encodeURIComponent(category)}&code=${gameCode}`)
        }
      }

      navigateToPlayback()
    }
  }, [timeRemaining, router, category, gameCode])

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatMessages])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setActiveTab("players")
      } else if (e.key === "ArrowRight") {
        setActiveTab("chat")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current
    const minSwipeDistance = 50

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        setActiveTab("chat")
      } else {
        setActiveTab("players")
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const initialTime = remainingTimeParam ? Number.parseInt(remainingTimeParam) : 10
  const progressPercentage = (timeRemaining / initialTime) * 100

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !gameId || !currentPlayerId) {
      addDebugLog(`⚠️ Cannot send: ${!messageInput.trim() ? "empty" : !gameId ? "no game" : "no player"}`)
      return
    }

    addDebugLog(`📤 Sending: "${messageInput.substring(0, 20)}..."`)

    const { error } = await supabase.from("game_chat").insert({
      game_id: gameId,
      player_name: currentPlayerName,
      message: messageInput,
    })

    if (error) {
      addDebugLog(`❌ Send error: ${error.message}`)
      return
    }

    addDebugLog("✅ Message sent")
    setMessageInput("")
  }

  const handleEmojiClick = async (emoji: string) => {
    if (!gameId || !currentPlayerId) {
      addDebugLog(`⚠️ Cannot send emoji: ${!gameId ? "no game" : "no player"}`)
      return
    }

    addDebugLog(`📤 Sending emoji: ${emoji}`)

    const { error } = await supabase.from("game_chat").insert({
      game_id: gameId,
      player_name: currentPlayerName,
      message: emoji,
    })

    if (error) {
      addDebugLog(`❌ Emoji error: ${error.message}`)
      return
    }

    addDebugLog("✅ Emoji sent")

    const particleCount = 12
    for (let i = 0; i < particleCount; i++) {
      const particle: EmojiParticle = {
        id: `${Date.now()}-${i}`,
        emoji: emoji,
        x: (Math.random() - 0.5) * 400,
        y: 0,
      }

      setEmojiParticles((prev) => [...prev, particle])

      const duration = 1500 + Math.random() * 1000
      setTimeout(() => {
        setEmojiParticles((prev) => prev.filter((p) => p.id !== particle.id))
      }, duration)
    }
  }

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col relative overflow-hidden">
      {showDebug && debugInfo.length > 0 && (
        <div
          className="fixed top-2 left-2 right-2 z-[200] bg-red-600 text-white text-xs p-3 rounded-lg max-h-40 overflow-y-auto"
          onClick={() => setShowDebug(false)}
        >
          <div className="font-bold mb-1">DEBUG (tap to hide):</div>
          {debugInfo.map((log, i) => (
            <div key={i} className="font-mono">
              {log}
            </div>
          ))}
        </div>
      )}

      <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000022] pb-4">
        <Link href="/pick-your-song">
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
          PLAYERS LOCKED IN
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

      <div className="fixed top-[124px] left-0 right-0 z-40 bg-[#000022] px-9">
        <div
          className="rounded-2xl"
          style={{
            background: "#262C87",
            border: "2px solid #C7D2FF",
            padding: "12px 8px",
          }}
        >
          <div className="px-2">
            <h3 className="text-[18px] font-semibold text-white leading-tight mb-2">{category}</h3>
            <span
              className="text-[32px] font-extrabold italic text-white leading-none block"
              style={{
                textShadow: "2px 2px 0px #0D113B",
              }}
            >
              {formatTime(timeRemaining)}
            </span>
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
          </div>
        </div>
      </div>

      <div
        className="fixed left-0 right-0 flex flex-col"
        style={{
          top: "256px",
          bottom: 0,
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          borderTop: "3px solid rgb(185, 243, 255)",
          background: "#0D113B",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ padding: "24px 36px 0" }}>
          <div
            ref={tabsRef}
            className="flex rounded-[12px] overflow-hidden"
            style={{
              border: "1px solid #C7D2FF",
              height: "48px",
            }}
            role="tablist"
            aria-label="Player and chat tabs"
          >
            <button
              onClick={() => setActiveTab("players")}
              role="tab"
              aria-selected={activeTab === "players"}
              aria-controls="players-panel"
              tabIndex={activeTab === "players" ? 0 : -1}
              className={`flex-1 transition-all ${
                activeTab === "players"
                  ? "text-[18px] font-semibold text-white"
                  : "text-[16px] font-semibold text-white"
              }`}
              style={{
                background: activeTab === "players" ? "#262C87" : "transparent",
                border: activeTab === "players" ? "1px solid #C7D2FF" : "none",
                borderRadius: "12px",
              }}
            >
              Players
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              role="tab"
              aria-selected={activeTab === "chat"}
              aria-controls="chat-panel"
              tabIndex={activeTab === "chat" ? 0 : -1}
              className={`flex-1 transition-all ${
                activeTab === "chat" ? "text-[18px] font-semibold text-white" : "text-[16px] font-semibold text-white"
              }`}
              style={{
                background: activeTab === "chat" ? "#262C87" : "transparent",
                border: activeTab === "chat" ? "1px solid #C7D2FF" : "none",
                borderRadius: "12px",
              }}
            >
              Game chat
            </button>
          </div>
        </div>

        {activeTab === "players" && (
          <div id="players-panel" role="tabpanel" className="flex-1 overflow-y-auto px-9 mt-6 pb-4">
            <div className="space-y-3">
              {players.map((player, index) => {
                const avatarImage = getAvatarImage(player.avatar_id)
                const colorSet = PLAYER_COLOR_SETS[index % PLAYER_COLOR_SETS.length]
                const hasLockedIn = player.song_name !== "Choosing song..."

                return (
                  <div
                    key={player.id}
                    className="rounded-2xl flex items-center"
                    style={{
                      maxHeight: "48px",
                      height: "48px",
                      background: colorSet.bg,
                      border: `2px solid ${colorSet.border}`,
                      padding: "0 12px 0 0",
                      opacity: hasLockedIn ? 1 : 0.5,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 flex items-center justify-center">
                        <img
                          src={avatarImage || "/placeholder.svg"}
                          alt={player.player_name}
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <span
                        className="text-[18px] font-semibold text-white"
                        style={{
                          textShadow: `2px 2px 0px ${colorSet.shadow}`,
                        }}
                      >
                        {player.player_name}
                        {!hasLockedIn && <span className="text-sm ml-2">⏳</span>}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          <div id="chat-panel" role="tabpanel" className="flex-1 flex flex-col relative">
            <div
              ref={chatMessagesRef}
              className="overflow-y-auto px-9 pt-6"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: "140px",
              }}
            >
              <div className="space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/50">
                    <p className="text-lg">No messages yet</p>
                    <p className="text-sm mt-2">Be the first to say something!</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isEmojiOnly = /^[\p{Emoji}\s]+$/u.test(msg.message.trim())
                    const msgAvatarImage = getAvatarImage(msg.player_avatar)

                    return (
                      <div key={msg.id} className="flex justify-end items-start gap-3">
                        <div className="flex items-start gap-3 flex-row-reverse ml-auto w-full">
                          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                            <img
                              src={msgAvatarImage || "/placeholder.svg"}
                              alt={msg.player_name}
                              className="w-10 h-10 object-contain"
                            />
                          </div>

                          {isEmojiOnly ? (
                            <div className="flex-1 min-w-0 flex justify-end">
                              <div className="inline-block bg-transparent px-4 py-2 rounded-2xl">
                                <span className="text-[14px] font-medium" style={{ color: "#C7D2FF" }}>
                                  {msg.player_name} sent an emoji {msg.message}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0 flex justify-end">
                              <div
                                className="inline-block rounded-2xl rounded-tr-none px-4 py-3 w-full"
                                style={{ background: "#000022" }}
                              >
                                <div className="text-[14px] font-medium mb-1" style={{ color: "#C7D2FF" }}>
                                  {msg.player_name}
                                </div>
                                <div className="text-[14px]" style={{ color: "#FFF8C4" }}>
                                  {msg.message}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                bottom: "140px",
                height: "60px",
                background: "linear-gradient(to top, #0D113B 0%, transparent 100%)",
              }}
            />

            <div className="absolute bottom-[36px] left-0 right-0 bg-[#0D113B] px-9 pointer-events-auto">
              <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                {["❤️", "🔥", "😂", "✨", "😍", "🎉", "👍", "🤣", "😎", "💯", "🙏"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-3xl hover:scale-110 transition-transform flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Send a message"
                  className="flex-1 min-w-0 text-white text-[16px] rounded-2xl px-4 py-3 outline-none min-h-[52px]"
                  style={{
                    background: "#000022",
                    border: "2px solid #D2FFFF",
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "16px",
                    border: "2px solid #D0F5E5",
                    background: "#14B8A6",
                    boxShadow: "0px 4px 0px 0px #0D9488",
                  }}
                >
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed inset-0 pointer-events-none z-40">
        {emojiParticles.map((particle) => {
          const size = 0.8 + Math.random() * 0.7
          const duration = 1.5 + Math.random() * 1
          const rotation = (Math.random() - 0.5) * 360

          return (
            <div
              key={particle.id}
              className="absolute text-4xl"
              style={{
                left: `calc(50% + ${particle.x}px)`,
                bottom: "110px",
                transform: `scale(${size}) rotate(${rotation}deg)`,
                animation: `emojiFloat ${duration}s ease-out forwards`,
              }}
            >
              {particle.emoji}
            </div>
          )
        })}
      </div>

      <style jsx>{`
        @keyframes emojiFloat {
          0% {
            transform: translateY(0) scale(${0.8 + Math.random() * 0.7}) rotate(0deg);
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-400px) scale(${1.2 + Math.random() * 0.5})
              rotate(${(Math.random() - 0.5) * 720}deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
