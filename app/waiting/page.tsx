"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"

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

export default function Waiting() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameCode = searchParams.get("code")
  const choosingPlayerId = searchParams.get("choosingPlayer")

  const [choosingPlayer, setChoosingPlayer] = useState("Player")
  const [choosingPlayerAvatar, setChoosingPlayerAvatar] = useState("jukebox")
  const [avatarImage, setAvatarImage] = useState("/jukebox-sq.png")
  const supabase = createClient()
  const [debugInfo, setDebugInfo] = useState<string[]>([`⏳ Waiting for category...`])

  const [timeRemaining, setTimeRemaining] = useState(60)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [emojiParticles, setEmojiParticles] = useState<EmojiParticle[]>([])
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("")
  const [currentPlayerName, setCurrentPlayerName] = useState<string>("")
  const [currentPlayerAvatar, setCurrentPlayerAvatar] = useState<string>("")

  useEffect(() => {
    const loadPlayerData = async () => {
      if (!supabase || !gameCode || !choosingPlayerId) return

      const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()

      if (game) {
        setGameId(game.id)

        const { data: player } = await supabase
          .from("game_players")
          .select("*")
          .eq("game_id", game.id)
          .eq("id", choosingPlayerId)
          .single()

        if (player) {
          setChoosingPlayer(player.player_name)
          setChoosingPlayerAvatar(player.avatar_id)
          setAvatarImage(getAvatarImage(player.avatar_id))
        }

        const storageKey = `player_id_${gameCode}`
        const playerId = localStorage.getItem(storageKey)
        const playerName = localStorage.getItem("player_name")
        const playerAvatar = localStorage.getItem("player_avatar")

        if (playerId && playerName && playerAvatar) {
          setCurrentPlayerId(playerId)
          setCurrentPlayerName(playerName)
          setCurrentPlayerAvatar(playerAvatar)
        }
      }
    }

    loadPlayerData()
  }, [gameCode, choosingPlayerId, supabase])

  useEffect(() => {
    if (!supabase || !gameId) return

    console.log("[v0] Setting up chat for game:", gameId)

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
        console.log("[v0] Loaded", data.length, "chat messages")
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
          console.log("[v0] New chat message received:", payload.new)
          const newMessage = payload.new as ChatMessage
          setChatMessages((prev) => {
            if (prev.find((m) => m.id === newMessage.id)) {
              return prev
            }
            return [...prev, newMessage]
          })
        },
      )
      .subscribe((status) => {
        console.log("[v0] Chat subscription status:", status)
      })

    return () => {
      console.log("[v0] Cleaning up chat subscription")
      supabase.removeChannel(channel)
    }
  }, [supabase, gameId])

  useEffect(() => {
    if (!gameCode) return

    console.log("[v0] Waiting page - polling for category in localStorage")

    const pollInterval = setInterval(() => {
      const storedCategory = localStorage.getItem(`category_${gameCode}`)
      console.log("[v0] Polling check - category:", storedCategory)

      if (storedCategory) {
        const targetUrl = `/category-selected?code=${gameCode}&category=${encodeURIComponent(storedCategory)}`
        setDebugInfo([
          `✓ Category found in localStorage!`,
          `📝 Game Code: ${gameCode}`,
          `🎵 Category: ${storedCategory}`,
          `🔗 Navigating to: ${targetUrl}`,
        ])
        console.log("[v0] Category found! Navigating to:", targetUrl)
        clearInterval(pollInterval)
        router.push(targetUrl)
      }
    }, 500)

    return () => clearInterval(pollInterval)
  }, [gameCode, router])

  useEffect(() => {
    if (!supabase || !gameCode) {
      setDebugInfo((prev) => [...prev, `ℹ️ Using localStorage fallback`])
      return
    }

    console.log("[v0] Setting up Supabase realtime subscription for game:", gameCode)

    const channel = supabase
      .channel(`game_${gameCode}_category`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `game_code=eq.${gameCode}`,
        },
        (payload) => {
          console.log("[v0] Supabase update received:", payload.new)

          if (payload.new.current_category) {
            const targetUrl = `/category-selected?code=${gameCode}&category=${encodeURIComponent(payload.new.current_category)}`
            setDebugInfo([
              `✓ Category selected via Supabase!`,
              `📝 Game Code: ${gameCode}`,
              `🎵 Category: ${payload.new.current_category}`,
              `🔗 Navigating to: ${targetUrl}`,
            ])
            console.log("[v0] Navigating via Supabase update to:", targetUrl)
            router.push(targetUrl)
          }
        },
      )
      .subscribe((status) => {
        console.log("[v0] Supabase subscription status:", status)
        setDebugInfo((prev) => [...prev, `📡 Supabase status: ${status}`])
      })

    return () => {
      console.log("[v0] Cleaning up Supabase subscription")
      supabase.removeChannel(channel)
    }
  }, [gameCode, supabase, router])

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      router.push("/category-selected?category=Songs%20about%20cars%20or%20driving")
    }
  }, [timeRemaining, router])

  const progressPercentage = ((60 - timeRemaining) / 60) * 100
  const radius = 117 // (242px diameter / 2) - 4px inset
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !gameId || !currentPlayerId) return

    const { error } = await supabase.from("chat_messages").insert({
      game_id: gameId,
      player_id: currentPlayerId,
      player_name: currentPlayerName,
      player_avatar: currentPlayerAvatar,
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
      player_avatar: currentPlayerAvatar,
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatMessages])

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col relative overflow-hidden">
      {debugInfo.length > 0 && (
        <div className="fixed top-2 left-2 right-2 z-[100] bg-black/90 text-green-400 text-xs p-3 rounded-lg border border-green-500 font-mono max-h-32 overflow-y-auto">
          <div className="font-bold mb-1">🐛 Debug Info:</div>
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
              src={avatarImage || "/placeholder.svg"}
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
              <div className="text-[24px] font-semibold text-white mt-2">{choosingPlayer}</div>
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
                  <span className="text-[18px] font-semibold text-white leading-tight">{choosingPlayer}</span>
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
                    src={avatarImage || "/placeholder.svg"}
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
