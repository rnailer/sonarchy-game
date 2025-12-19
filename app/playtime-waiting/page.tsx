"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { createBrowserClient } from "@supabase/ssr"
import { useServerTimer } from "@/lib/hooks/use-server-timer"

interface EmojiParticle {
  id: string
  emoji: string
  x: number
  y: number
}

interface ChatMessage {
  id: string
  player_id: string
  player_name: string
  player_avatar: string
  message: string
  created_at: string
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
  return avatarMap[avatarId] || "/jukebox-sq.png"
}

export default function PlaytimeWaitingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [gameCode, setGameCode] = useState<string>("")
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [isHost, setIsHost] = useState(false)
  const [gameId, setGameId] = useState<string>("")
  const [gameStatus, setGameStatus] = useState<string>("")
  const [choosingPlayerId, setChoosingPlayerId] = useState<string>("")
  const [choosingPlayerName, setChoosingPlayerName] = useState<string>("")
  const [choosingPlayerAvatar, setChoosingPlayerAvatar] = useState<string>("")
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [waitingDuration, setWaitingDuration] = useState(0)
  const timerStartedRef = useRef(false)

  // Server-synchronized timer
  const { timeRemaining, isExpired, startTimer } = useServerTimer({
    gameId,
    timerType: "waiting",
    enabled: !!gameId,
  })

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [emojiParticles, setEmojiParticles] = useState<EmojiParticle[]>([])
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("")
  const [currentPlayerName, setCurrentPlayerName] = useState<string>("")
  const [currentPlayerAvatarId, setCurrentPlayerAvatarId] = useState<string>("")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Track waiting duration and show timeout after 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setWaitingDuration((prev) => {
        const newDuration = prev + 1
        if (newDuration >= 30 && !loadingTimeout) {
          setLoadingTimeout(true)
          console.log("[v0] ⚠️ Loading timeout after 30 seconds")
        }
        return newDuration
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [loadingTimeout])

  useEffect(() => {
    const loadPlayerData = async () => {
      if (!gameCode) return

      const storageKey = `player_id_${gameCode}`
      const playerId = localStorage.getItem(storageKey)
      const playerName = localStorage.getItem("player_name")
      const playerAvatar = localStorage.getItem("player_avatar")

      if (playerId && playerName && playerAvatar) {
        setCurrentPlayerId(playerId)
        setCurrentPlayerName(playerName)
        setCurrentPlayerAvatarId(playerAvatar)
      }
    }

    loadPlayerData()
  }, [gameCode])

  useEffect(() => {
    if (!supabase || !gameId) return

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("[v0] Error loading chat messages:", error)
        return
      }

      if (data) {
        setChatMessages(data)
      }
    }

    loadMessages()

    const channel = supabase
      .channel(`game_${gameId}_chat`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage
          setChatMessages((prev) => {
            if (prev.find((m) => m.id === newMessage.id)) {
              return prev
            }
            return [...prev, newMessage]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, gameId])

  useEffect(() => {
    console.log("[v0] 🔄 Waiting page mounted")
    const code = searchParams.get("code")
    const choosingPlayer = searchParams.get("choosingPlayer")

    console.log("[v0] 📋 Parameters:", { code, choosingPlayer })

    if (code) {
      setGameCode(code)
      if (choosingPlayer) {
        // Store the player ID - we'll fetch name/avatar separately yes we will
        setChoosingPlayerId(choosingPlayer)
        fetchChoosingPlayerDetails(code, choosingPlayer)
      }
      checkGameStatus(code)
    } else {
      console.log("[v0] ❌ Missing game code, redirecting to home")
      router.push("/")
    }
  }, [searchParams, router])

  useEffect(() => {
    if (!gameId || !gameCode) return

    console.log("[v0] 📡 Setting up real-time subscription for game:", gameId)

    const channel = supabase
      .channel(`game_updates:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          console.log("[v0] 🔔 Game updated:", payload.new)
          const newData = payload.new as any
          const currentCategory = newData.current_category

          if (currentCategory) {
            console.log("[v0] ✅ Category selected! Navigating to category-selected...")
            router.push(`/category-selected?category=${encodeURIComponent(currentCategory)}&code=${gameCode}`)
          }
        },
      )
      .subscribe()

    const checkForUpdates = async () => {
      const { data: game } = await supabase.from("games").select("current_category").eq("id", gameId).single()

      if (game?.current_category) {
        console.log("[v0] 🔄 Polling detected category selection, navigating...")
        router.push(`/category-selected?category=${encodeURIComponent(game.current_category)}&code=${gameCode}`)
      }
    }

    const pollInterval = setInterval(checkForUpdates, 2000)
    checkForUpdates()

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [gameId, gameCode, router, supabase])

  async function checkGameStatus(code: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const authUserId = user?.id || null

      if (authUserId) {
        setCurrentUserId(authUserId)
      }

      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("id, host_user_id, status")
        .eq("game_code", code)
        .single()

      if (gameError || !game) {
        console.log("[v0] ❌ Error loading game:", gameError?.message)
        router.push("/")
        return
      }

      setGameId(game.id)
      setGameStatus(game.status)
      setIsHost(game.host_user_id === authUserId)

      console.log("[v0] 🎮 Game status:", game.status, "IsHost:", game.host_user_id === authUserId)

      if (game.status === "playing") {
        console.log("[v0] ⏭️ Game already playing, redirecting...")
        const category = searchParams.get("category") || ""
        router.push(`/playtime-playback?category=${encodeURIComponent(category)}&code=${code}`)
      }
    } catch (err: any) {
      console.log("[v0] ❌ Error:", err.message)
      router.push("/")
    }
  }

  async function startGame() {
    if (!gameId) return

    console.log("[v0] 🚀 Host starting game...")
    try {
      await supabase.from("games").update({ status: "playing" }).eq("id", gameId)

      const category = searchParams.get("category") || ""
      router.push(`/playtime-playback?category=${encodeURIComponent(category)}&code=${gameCode}`)
    } catch (err: any) {
      console.log("[v0] ❌ Error starting game:", err.message)
    }
  }

  // FIXED: Now fetches player by ID instead of name
  const fetchChoosingPlayerDetails = async (code: string, playerId: string) => {
    console.log("[v0] 🔍 Fetching player details for ID:", playerId)
    
    const { data: game } = await supabase.from("games").select("id").eq("game_code", code).single()

    if (game) {
      // Query by player ID, not player name
      const { data: player, error } = await supabase
        .from("game_players")
        .select("player_name, avatar_id")
        .eq("game_id", game.id)
        .eq("id", playerId)
        .single()

      if (error) {
        console.log("[v0] ❌ Error fetching player:", error.message)
        return
      }

      if (player) {
        console.log("[v0] ✅ Found player:", player.player_name)
        setChoosingPlayerName(player.player_name)
        if (player.avatar_id) {
          setChoosingPlayerAvatar(getAvatarImage(player.avatar_id))
        }
      }
    }
  }

  // Start the server timer once gameId is available
  useEffect(() => {
    if (gameId && !timerStartedRef.current) {
      timerStartedRef.current = true
      startTimer(60).then(() => {
        console.log("[v0] ⏱️ Started 60s waiting timer")
      })
    }
  }, [gameId, startTimer])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !gameId || !currentPlayerId) return

    const { error } = await supabase.from("chat_messages").insert({
      game_id: gameId,
      player_id: currentPlayerId,
      player_name: currentPlayerName,
      player_avatar: currentPlayerAvatarId,
      message: messageInput,
    })

    if (error) {
      console.error("[v0] Error sending message:", error)
      return
    }

    setMessageInput("")
  }

  const handleEmojiClick = async (emoji: string) => {
    if (!gameId || !currentPlayerId) return

    const { error } = await supabase.from("chat_messages").insert({
      game_id: gameId,
      player_id: currentPlayerId,
      player_name: currentPlayerName,
      player_avatar: currentPlayerAvatarId,
      message: emoji,
    })

    if (error) {
      console.error("[v0] Error sending emoji:", error)
      return
    }

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

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatMessages])

  const progressPercentage = ((60 - timeRemaining) / 60) * 100
  const radius = 117
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference

  if (isHost && gameStatus === "starting" && !choosingPlayerName) {
    return (
      <div className="min-h-screen bg-[#000022] text-white flex flex-col items-center justify-center p-4">
        <h1
          className="text-[2.5rem] font-black text-center mb-12 leading-tight bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D91EA)",
          }}
        >
          Ready to Start?
        </h1>

        <p className="text-center text-white/80 mb-8 max-w-md">
          Make sure Spotify is open on your device, then click the button below to begin the game!
        </p>

        <button
          onClick={startGame}
          className="px-8 py-4 bg-[#0D91EA] hover:bg-[#8BE1FF] text-white font-bold rounded-xl text-xl transition-all"
        >
          ▶ Start Game
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col relative overflow-hidden">
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
          FIRST CATEGORY...
        </h1>
        <div className="w-[24px]" />
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
        <p className="text-[20px] font-light text-[#B9F3FF] text-center mb-12 leading-relaxed w-full">
          The first music category is being hand crafted by...
        </p>

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ top: "133px" }}>
          <div className="relative z-20 mb-[-80px]">
            <img
              src={choosingPlayerAvatar || "/placeholder.svg"}
              alt="Player avatar"
              className="w-[160px] h-[160px] object-contain"
            />
          </div>

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
              className="flex flex-col items-center justify-center"
              style={{
                width: "242px",
                height: "242px",
                background: "transparent",
                border: "1px solid #D8D8E0",
                borderRadius: "50%",
              }}
            >
              <div
                className="text-[64px] font-extrabold text-white leading-none"
                style={{
                  textShadow: "4px 4px 0px #0D113B",
                }}
              >
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
              </div>
              <div className="text-[24px] font-semibold text-white mt-2">{choosingPlayerName || "Player"}</div>
            </div>

            <svg
              className="absolute"
              style={{
                width: "234px",
                height: "234px",
                transform: "rotate(-90deg)",
              }}
            >
              <circle
                cx="117"
                cy="117"
                r={radius}
                fill="none"
                stroke="#FFD03B"
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: "stroke-dashoffset 1s linear",
                }}
              />
            </svg>
          </div>
        </div>

        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed left-[36px] right-[36px] h-[48px] text-[16px] font-semibold rounded-[12px] flex items-center justify-center gap-2 bg-transparent text-white hover:bg-white/5 transition-colors"
          style={{
            bottom: "36px",
            border: "1px solid #C7D2FF",
          }}
        >
          Tired of waiting? Lets chat 💬
        </button>
      </div>

      <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent
          side="bottom"
          className="bg-[#0D113B] border-t-2 border-[#6CD9FF] rounded-t-3xl h-[85vh] p-0"
          hideClose
          overflow="visible"
        >
          <button
            onClick={() => setIsChatOpen(false)}
            className="absolute top-6 right-3 z-50 text-[#D2FFFF] hover:text-[#8DE2FF] transition-colors"
          >
            <X className="w-[24px] h-[24px]" />
          </button>

          <div className="absolute top-[36px] left-0 right-0 z-40 px-9">
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
                  <span className="text-[18px] font-semibold text-white leading-tight">{choosingPlayerName}</span>
                  <span
                    className="text-[32px] font-extrabold text-white leading-none"
                    style={{
                      textShadow: "2px 2px 0px #0D113B",
                    }}
                  >
                    {formatTime(timeRemaining)}
                  </span>
                </div>

                <div className="w-[60px] h-[60px] flex items-center justify-center bg-transparent">
                  <img
                    src={choosingPlayerAvatar || "/placeholder.svg"}
                    alt="Player avatar"
                    className="w-10 h-10 object-contain"
                  />
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

          <div className="h-full flex flex-col pt-[180px] pb-[160px]">
            <div ref={chatMessagesRef} className="flex-1 overflow-y-auto px-6 space-y-3">
              {chatMessages.map((msg) => {
                const isEmojiOnly = /^[\p{Emoji}\s]+$/u.test(msg.message.trim())
                const msgAvatarImage = getAvatarImage(msg.player_avatar)
                const isCurrentUser = msg.player_id === currentPlayerId

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isCurrentUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isCurrentUser && (
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                        <img
                          src={msgAvatarImage || "/placeholder.svg"}
                          alt={msg.player_name}
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                    )}

                    {isEmojiOnly ? (
                      <div className="flex-1 text-right">
                        <div className="inline-block bg-transparent px-4 py-2 rounded-2xl">
                          <span className="text-[14px] font-medium" style={{ color: "#C7D2FF" }}>
                            {msg.player_name} sent an emoji {msg.message}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex-1 ${isCurrentUser ? "text-right" : "text-left"}`}>
                        <div
                          className={`inline-block rounded-2xl px-4 py-3 ${isCurrentUser ? "rounded-tr-none" : "rounded-tl-none"}`}
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

                    {isCurrentUser && (
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                        <img
                          src={msgAvatarImage || "/placeholder.svg"}
                          alt={msg.player_name}
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="fixed left-0 right-0 bg-[#0D113B] px-6" style={{ bottom: "36px" }}>
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              {["❤️", "🔥", "😂", "✨", "😍", "🎉", "👍", "🤣", "😎", "💯", "🙏"].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-2xl hover:scale-110 transition-transform flex-shrink-0"
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
                className="flex-1 text-white rounded-2xl px-4 py-3 outline-none"
                style={{
                  background: "#000022",
                  border: "2px solid #D2FFFF",
                }}
              />
              <button
                onClick={handleSendMessage}
                className="flex items-center justify-center"
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "16px",
                  border: "2px solid #D0F5E5",
                  background: "#14B8A6",
                  boxShadow: "0px 4px 0px 0px #0D9488",
                }}
              >
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="fixed inset-0 pointer-events-none z-[150]">
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
                transform: `translateY(0) scale(${size}) rotate(${rotation}deg)`,
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
            transform: translateY(-400px) scale(${1.2 + Math.random() * 0.5}) rotate(${(Math.random() - 0.5) * 720}deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
