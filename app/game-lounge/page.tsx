"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import QRCode from "qrcode"
import { resetGameState } from "@/lib/game-state"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Copy, Menu } from "lucide-react"

interface Player {
  id: string
  player_name: string
  avatar_id: string
  is_host: boolean
}

interface ChatMessage {
  id: string
  player_id: string
  player_name: string
  player_avatar: string
  message: string
  created_at: string
}

interface BluetoothDeviceInfo {
  id: string
  name: string
}

interface EmojiParticle {
  id: string
  emoji: string
  x: number
  y: number
}

const AVATAR_COLORS = [
  "bg-[#FF6FD8]", // pink
  "bg-[#00B8D4]", // blue
  "bg-[#FF8A3D]", // orange
  "bg-[#00E5CC]", // cyan
  "bg-[#A855F7]", // purple
  "bg-[#FACC15]", // yellow
  "bg-[#10B981]", // green
  "bg-[#F43F5E]", // red
]

const PLAYER_COLOR_SETS = [
  { border: "#C084FC", bg: "#A855F7", shadow: "#7C3AED" }, // Neon Violet
  { border: "#B9F3FF", bg: "#0891B2", shadow: "#0E7490" }, // Electric Blue
  { border: "#D2FFFF", bg: "#06B6D4", shadow: "#0891B2" }, // Aqua Cyan
  { border: "#FFE5B4", bg: "#FB923C", shadow: "#EA580C" }, // Sunset Orange
  { border: "#FFD0F5", bg: "#EC4899", shadow: "#DB2777" }, // Hot Pink
  { border: "#C7D2FF", bg: "#4338CA", shadow: "#3730A3" }, // Deep Indigo
  { border: "#FFF8C4", bg: "#FBBF24", shadow: "#F59E0B" }, // Amber Yellow
  { border: "#F5D8FF", bg: "#D946EF", shadow: "#C026D3" }, // Magenta Purple
  { border: "#D0F5E5", bg: "#14B8A6", shadow: "#0D9488" }, // Teal Green
  { border: "#E5E7EB", bg: "#6B7280", shadow: "#4B5563" }, // Charcoal Grey
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

function GameLoungeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [supabase] = useState(() => {
    console.log("[v0] Creating Supabase client...")
    console.log("[v0] NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT SET")
    console.log("[v0] NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "NOT SET")
    const client = createClient()
    console.log("[v0] Supabase client created:", client ? "SUCCESS" : "FAILED (null)")
    return client
  })

  const [debugInfo, setDebugInfo] = useState({
    gameCode: "",
    gameId: "",
    playerCount: 0,
    supabaseStatus: "unknown",
    lastError: "",
    isJoining: false,
  })
  const [showDebug, setShowDebug] = useState(true)

  const [isSupabaseAvailable, setIsSupabaseAvailable] = useState(false)
  const [activeTab, setActiveTab] = useState<"players" | "chat">("players")
  const [gameCode, setGameCode] = useState("")
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [players, setPlayers] = useState<Player[]>([])
  const [gameId, setGameId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [playbackDevice, setPlaybackDevice] = useState<string | null>(null)
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<string>("this-device")
  const [isTestMode, setIsTestMode] = useState(false)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const [slideOffset, setSlideOffset] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDeviceInfo[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [emojiParticles, setEmojiParticles] = useState<EmojiParticle[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [isHost, setIsHost] = useState(false)
  const [gameStatus, setGameStatus] = useState<string>("waiting")

  const getGameUrl = useCallback(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/game-lounge?code=${gameCode || "789437"}`
    }
    return ""
  }, [gameCode])

  const generateQRCode = useCallback(async (code: string) => {
    try {
      const url = `${window.location.origin}/game-lounge?code=${code}`
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000033",
          light: "#FFFFFF",
        },
      })
      setQrCodeUrl(qrDataUrl)
    } catch (error) {
      console.error("Error generating QR code:", error)
    }
  }, [])

  useEffect(() => {
    console.log("[v0] Checking Supabase availability...")
    if (supabase) {
      setIsSupabaseAvailable(true)
      console.log("[v0] ✅ Supabase is available, using database sync")
    } else {
      setIsSupabaseAvailable(false)
      console.log("[v0] ❌ Supabase not available, using localStorage fallback")
      toast({
        title: "Limited multiplayer mode",
        description: "Players on the same device can see each other. For full multiplayer, configure Supabase.",
        duration: 5000,
      })
    }
  }, [supabase, toast])

  useEffect(() => {
    if (!supabase || !gameId) return

    console.log("[v0] 📨 Setting up chat for game:", gameId)

    const loadMessages = async () => {
      const { data: messages, error } = await supabase
        .from("game_chat")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("[v0] ❌ Error loading chat messages:", error)
        console.error("[v0] ❌ Error code:", error.code)
        console.error("[v0] ❌ Error message:", error.message)
        return
      }

      if (messages && messages.length > 0) {
        console.log("[v0] ✅ Loaded", messages.length, "chat messages")

        // Fetch all player avatars for this game
        const { data: players } = await supabase
          .from("game_players")
          .select("player_name, avatar_id")
          .eq("game_id", gameId)

        console.log("[v0] 👥 Fetched player avatars:", players)

        // Create a map of player names to avatars
        const avatarMap = new Map<string, string>()
        players?.forEach((p: any) => {
          if (p.player_name && p.avatar_id) {
            avatarMap.set(p.player_name, p.avatar_id)
          }
        })

        const formattedMessages: ChatMessage[] = messages.map((msg: any) => ({
          id: msg.id,
          player_id: msg.player_id || "",
          player_name: msg.player_name,
          player_avatar: avatarMap.get(msg.player_name) || "",
          message: msg.message, // Fixed: was newMsg.created_at, now correctly using newMsg.message
          created_at: msg.created_at,
        }))

        console.log("[v0] ✅ Formatted messages with avatars:", formattedMessages)
        setChatMessages(formattedMessages)
      } else {
        console.log("[v0] ℹ️ No chat messages found")
        setChatMessages([])
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
          table: "game_chat",
          filter: `game_id=eq.${gameId}`,
        },
        async (payload) => {
          console.log("[v0] 📨 New chat message received:", payload.new)
          const newMsg = payload.new as any

          const { data: playerData } = await supabase
            .from("game_players")
            .select("avatar_id")
            .eq("player_name", newMsg.player_name)
            .eq("game_id", gameId)
            .maybeSingle()

          console.log("[v0] 👤 Fetched avatar for new message:", playerData)

          const newMessage: ChatMessage = {
            id: newMsg.id,
            player_id: newMsg.player_id || "",
            player_name: newMsg.player_name,
            player_avatar: playerData?.avatar_id || "",
            message: newMsg.message, // Fixed: was newMsg.created_at, now correctly using newMsg.message
            created_at: newMsg.created_at,
          }
          // </CHANGE>

          setChatMessages((prev) => {
            if (prev.find((m) => m.id === newMessage.id)) {
              console.log("[v0] ℹ️ Message already exists, skipping")
              return prev
            }
            console.log("[v0] ✅ Adding new message to chat")
            return [...prev, newMessage]
          })
        },
      )
      .subscribe((status) => {
        console.log("[v0] 📡 Chat subscription status:", status)
      })

    return () => {
      console.log("[v0] 🧹 Cleaning up chat subscription")
      supabase.removeChannel(channel)
    }
  }, [supabase, gameId])

  useEffect(() => {
    const initializeGame = async () => {
      try {
        console.log("[v0] ========================================")
        console.log("[v0] GAME LOUNGE INITIALIZATION STARTED")
        console.log("[v0] ========================================")

        console.log("[v0] Full URL:", window.location.href)
        console.log("[v0] Search params:", window.location.search)

        const code = searchParams.get("code")
        const playerName = searchParams.get("playerName")
        const avatar = searchParams.get("avatar")
        const testMode = searchParams.get("test_mode")
        const isJoining = searchParams.get("join")

        console.log("[v0] Raw URL Parameters:")
        console.log("[v0]   - code:", code)
        console.log("[v0]   - playerName:", playerName)
        console.log("[v0]   - avatar:", avatar)
        console.log("[v0]   - testMode:", testMode)
        console.log("[v0]   - join (raw):", isJoining)

        let finalPlayerName = playerName
        let finalAvatar = avatar

        if (!finalPlayerName || !finalAvatar) {
          console.log("[v0] Player info not in URL, checking localStorage...")
          const savedName = localStorage.getItem("player_name")
          const savedAvatar = localStorage.getItem("player_avatar")

          if (savedName && savedAvatar) {
            finalPlayerName = savedName
            finalAvatar = savedAvatar
            console.log("[v0] Retrieved from profile:", { name: finalPlayerName, avatar: finalAvatar })
          } else {
            console.log("[v0] ❌ No player profile found, redirecting to profile-setup")
            router.push("/profile-setup")
            return
          }
        }

        setDebugInfo((prev) => ({
          ...prev,
          gameCode: code || "",
          isJoining: isJoining === "true",
          supabaseStatus: isSupabaseAvailable ? "available" : "not available",
        }))

        if (testMode === "true") {
          setIsTestMode(true)
          console.log("[v0] Test mode enabled")
        }

        if (!code) {
          console.log("[v0] ❌ ERROR: No game code provided in URL")
          setDebugInfo((prev) => ({ ...prev, lastError: "No game code in URL" }))
          return
        }

        console.log("[v0] ✅ Game code found:", code)
        setGameCode(code)
        generateQRCode(code)

        if (isSupabaseAvailable && supabase) {
          console.log("[v0] ========================================")
          console.log("[v0] USING SUPABASE DATABASE SYNC")
          console.log("[v0] ========================================")

          const {
            data: { user },
          } = await supabase.auth.getUser()
          console.log("[v0] Authenticated user:", user?.id || "NOT AUTHENTICATED")

          try {
            console.log("[v0] Step 1: Checking if game exists...")
            const { data: existingGame, error: gameError } = await supabase
              .from("games")
              .select("*")
              .eq("game_code", code)
              .single()

            if (gameError && gameError.code !== "PGRST116") {
              console.error("[v0] ❌ ERROR checking game:", gameError)
              setDebugInfo((prev) => ({ ...prev, lastError: `Game lookup error: ${gameError.message}` }))
              throw gameError
            }

            console.log("[v0] Game lookup result:", existingGame ? "FOUND" : "NOT FOUND")
            if (existingGame) {
              console.log("[v0]   - Game ID:", existingGame.id)
              setDebugInfo((prev) => ({ ...prev, gameId: existingGame.id }))
              setGameStatus(existingGame.status)
            }

            let currentGameId = existingGame?.id

            if (!existingGame && isJoining !== "true") {
              console.log("[v0] Step 2: Creating new game (user is host)...")

              const hostUserId = user?.id || null

              if (!hostUserId) {
                console.error("[v0] ❌ Cannot create game: User not authenticated")
                toast({
                  title: "Authentication required",
                  description: "You must be logged in to host a game. Please connect your Spotify account first.",
                  variant: "destructive",
                  duration: 10000,
                })
                router.push("/with-friends")
                return
              }

              const storageKey = `player_id_${code}`
              let hostPlayerId = localStorage.getItem(storageKey)

              if (!hostPlayerId) {
                hostPlayerId = crypto.randomUUID()
                localStorage.setItem(storageKey, hostPlayerId)
                console.log("[v0] Generated new host player UUID:", hostPlayerId)
              } else {
                console.log("[v0] Using existing host player UUID:", hostPlayerId)
              }

              const { data: newGame, error: createError } = await supabase
                .from("games")
                .insert({
                  game_code: code,
                  status: "waiting",
                  max_players: 10,
                  host_user_id: hostUserId,
                  // starting_player_index will be null initially and randomized in game-starting page
                })
                .select()
                .single()

              if (createError) {
                console.error("[v0] ❌ ERROR creating game:", createError)
                setDebugInfo((prev) => ({ ...prev, lastError: `Game creation error: ${createError.message}` }))
                throw createError
              }

              currentGameId = newGame.id
              console.log("[v0] ✅ Game created successfully! ID:", newGame.id)
              console.log("[v0] ✅ Host user ID set to:", hostUserId)
              setDebugInfo((prev) => ({ ...prev, gameId: newGame.id, lastError: "" }))
              setGameStatus("waiting")
            } else if (!existingGame && isJoining === "true") {
              console.log("[v0] ❌ ERROR: Player trying to join non-existent game")
              setDebugInfo((prev) => ({ ...prev, lastError: "Game not found in database" }))
              toast({
                title: "Game not found",
                description: `Game code ${code} doesn't exist. Please check the code.`,
                variant: "destructive",
                duration: 10000,
              })
              return
            }

            if (currentGameId) {
              setGameId(currentGameId)
              console.log("[v0] ✅ Game ID set:", currentGameId)

              if (finalPlayerName && finalAvatar) {
                const storageKey = `player_id_${code}`
                let playerId = localStorage.getItem(storageKey)

                if (!playerId) {
                  playerId = crypto.randomUUID()
                  localStorage.setItem(storageKey, playerId)
                  console.log("[v0] Generated new player UUID:", playerId)
                } else {
                  console.log("[v0] Using existing player UUID:", playerId)
                }

                const isHostPlayer = isJoining !== "true"

                console.log("[v0] Step 3: Adding player to database...")
                console.log("[v0]   - Player ID:", playerId)
                console.log("[v0]   - Player name:", finalPlayerName)
                console.log("[v0]   - Avatar:", finalAvatar)
                console.log("[v0]   - Is host:", isHostPlayer)
                console.log("[v0]   - User ID:", user?.id || "NULL")

                const { data: existingPlayer } = await supabase
                  .from("game_players")
                  .select("*")
                  .eq("game_id", currentGameId)
                  .eq("id", playerId)
                  .maybeSingle()

                if (!existingPlayer) {
                  console.log("[v0] Inserting new player...")
                  const { error: playerError } = await supabase.from("game_players").insert({
                    id: playerId,
                    game_id: currentGameId,
                    user_id: user?.id || null,
                    player_name: finalPlayerName,
                    avatar_id: finalAvatar,
                    is_host: isHostPlayer,
                  })

                  if (playerError) {
                    console.error("[v0] ❌ ERROR adding player:", playerError)
                    setDebugInfo((prev) => ({ ...prev, lastError: `Player insert error: ${playerError.message}` }))
                    throw playerError
                  }
                  console.log("[v0] ✅ Player added successfully!")
                } else {
                  console.log("[v0] Player already exists, skipping insert")
                }

                setCurrentUserId(playerId)
                setIsHost(isHostPlayer)
                console.log("[v0] ✅ User role:", isHostPlayer ? "HOST" : "PLAYER")
              }

              console.log("[v0] Step 4: Loading players from database...")
              const { data: gamePlayers, error: playersError } = await supabase
                .from("game_players")
                .select("*")
                .eq("game_id", currentGameId)
                .order("joined_at", { ascending: true })

              if (playersError) {
                console.error("[v0] ❌ ERROR loading players:", playersError)
                setDebugInfo((prev) => ({ ...prev, lastError: `Players load error: ${playersError.message}` }))
                throw playersError
              }

              console.log("[v0] ✅ Players loaded:", gamePlayers?.length || 0)
              gamePlayers?.forEach((p, i) => {
                console.log(`[v0]     ${i + 1}. ${p.player_name} - ${p.is_host ? "HOST" : "PLAYER"}`)
              })

              setPlayers(gamePlayers || [])
              setDebugInfo((prev) => ({ ...prev, playerCount: gamePlayers?.length || 0, lastError: "" }))
            }
          } catch (error: any) {
            console.error("[v0] ❌ FATAL ERROR:", error)
            setDebugInfo((prev) => ({ ...prev, lastError: `Fatal error: ${error.message}` }))
          }
        } else {
          console.log("[v0] Using localStorage fallback")
          const storageKey = `game_${code}_players`
          const storedPlayers = localStorage.getItem(storageKey)
          const existingPlayers: Player[] = storedPlayers ? JSON.parse(storedPlayers) : []

          if (finalPlayerName && finalAvatar) {
            const playerId = isJoining === "true" ? `player_${Date.now()}` : "host"
            const isHostPlayer = isJoining !== "true"

            const newPlayer: Player = {
              id: playerId,
              player_name: finalPlayerName,
              avatar_id: finalAvatar,
              is_host: isHostPlayer,
            }

            if (!existingPlayers.find((p) => p.id === playerId)) {
              existingPlayers.push(newPlayer)
              localStorage.setItem(storageKey, JSON.stringify(existingPlayers))
            }

            setCurrentUserId(playerId)
            setIsHost(isHostPlayer)
          }

          setPlayers(existingPlayers)
        }

        console.log("[v0] ========================================")
        console.log("[v0] INITIALIZATION COMPLETE")
        console.log("[v0] ========================================")
      } catch (error: any) {
        console.error("[v0] ❌ FATAL ERROR:", error)
        setDebugInfo((prev) => ({ ...prev, lastError: `Fatal error: ${error.message}` }))
      }
    }

    initializeGame()
  }, [searchParams, generateQRCode, supabase, isSupabaseAvailable, toast, router])

  useEffect(() => {
    if (!gameId || !isSupabaseAvailable || !supabase) {
      console.log("[v0] Realtime subscription skipped:")
      console.log("[v0]   - gameId:", gameId || "NOT SET")
      console.log("[v0]   - isSupabaseAvailable:", isSupabaseAvailable)
      console.log("[v0]   - supabase client:", supabase ? "EXISTS" : "NULL")
      return
    }

    console.log("[v0] ========================================")
    console.log("[v0] SETTING UP REALTIME SUBSCRIPTION")
    console.log("[v0] ========================================")
    console.log("[v0] Game ID:", gameId)
    console.log("[v0] Channel name:", `game_${gameId}_players`)
    console.log("[v0] Is Host:", isHost)
    console.log("[v0] Current User ID:", currentUserId)

    let pollingInterval: NodeJS.Timeout | null = null
    let realtimeWorking = false

    const channel = supabase
      .channel(`game_${gameId}_players`, {
        config: {
          broadcast: { self: true },
          presence: { key: currentUserId },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_players",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          console.log("[v0] ========================================")
          console.log("[v0] 🔴 REALTIME EVENT RECEIVED")
          console.log("[v0] ========================================")
          console.log("[v0] Event type:", payload.eventType)
          console.log("[v0] Payload:", payload)

          realtimeWorking = true

          if (payload.eventType === "INSERT") {
            const newPlayer = payload.new as Player
            console.log("[v0] New player joined:")
            console.log("[v0]   - ID:", newPlayer.id)
            console.log("[v0]   - Name:", newPlayer.player_name)
            console.log("[v0]   - Avatar:", newPlayer.avatar_id)
            console.log("[v0]   - Is host:", newPlayer.is_host)

            setPlayers((prev) => {
              const exists = prev.find((p) => p.id === newPlayer.id)
              if (exists) {
                console.log("[v0] Player already in list, skipping")
                return prev
              }
              console.log("[v0] ✅ Adding player to list")
              const updated = [...prev, newPlayer]
              console.log("[v0] New player count:", updated.length)
              setDebugInfo((prev) => ({ ...prev, playerCount: updated.length }))
              return updated
            })
          } else if (payload.eventType === "DELETE") {
            console.log("[v0] Player left:", payload.old)
            setPlayers((prev) => {
              const updated = prev.filter((p) => p.id !== payload.old.id)
              setDebugInfo((prev) => ({ ...prev, playerCount: updated.length }))
              return updated
            })
          } else if (payload.eventType === "UPDATE") {
            console.log("[v0] Player updated:", payload.new)
            setPlayers((prev) => prev.map((p) => (p.id === payload.new.id ? (payload.new as Player) : p)))
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          console.log("[v0] 🎮 GAME STATUS UPDATE:", payload.new)
          const newStatus = (payload.new as any).status
          setGameStatus(newStatus)

          realtimeWorking = true

          console.log("[v0] Current game status:", newStatus)
          console.log("[v0] Is host:", isHost)
          console.log("[v0] Should navigate:", newStatus === "starting" && !isHost)

          if (newStatus === "starting" && !isHost) {
            console.log("[v0] ✅ Game started by host, navigating to game-starting page...")
            console.log("[v0] Navigation URL:", `/game-starting?code=${gameCode}`)
            router.push(`/game-starting?code=${gameCode}`)
          } else if (newStatus === "starting" && isHost) {
            console.log("[v0] ℹ️ I am the host, not navigating (host navigates manually)")
          }
        },
      )
      .subscribe((status) => {
        console.log("[v0] Realtime subscription status:", status)
        if (status === "SUBSCRIBED") {
          console.log("[v0] ✅ Successfully subscribed to realtime updates")
          setDebugInfo((prev) => ({ ...prev, supabaseStatus: "connected", lastError: "" }))
          realtimeWorking = true
        } else if (status === "CHANNEL_ERROR") {
          console.error("[v0] ❌ Realtime subscription error")
          setDebugInfo((prev) => ({
            ...prev,
            supabaseStatus: "error",
            lastError: "Realtime channel error - using polling",
          }))
          startPolling()
        } else if (status === "TIMED_OUT") {
          console.error("[v0] ❌ Realtime subscription timed out")
          setDebugInfo((prev) => ({
            ...prev,
            supabaseStatus: "error",
            lastError: "Realtime timed out - using polling",
          }))
          startPolling()
        }
      })

    const startPolling = () => {
      if (pollingInterval) return

      console.log("[v0] Starting fallback polling (every 2 seconds)")
      pollingInterval = setInterval(async () => {
        if (realtimeWorking) {
          console.log("[v0] Realtime is working, stopping polling")
          if (pollingInterval) {
            clearInterval(pollingInterval)
            pollingInterval = null
          }
          return
        }

        try {
          // Poll for player updates
          const { data: gamePlayers } = await supabase
            .from("game_players")
            .select("*")
            .eq("game_id", gameId)
            .order("joined_at", { ascending: true })

          if (gamePlayers) {
            setPlayers(gamePlayers)
            setDebugInfo((prev) => ({ ...prev, playerCount: gamePlayers.length }))
          }

          // Poll for game status updates
          const { data: gameData } = await supabase.from("games").select("status").eq("id", gameId).single()

          if (gameData && gameData.status !== gameStatus) {
            console.log("[v0] 📊 Polling detected status change:", gameData.status)
            setGameStatus(gameData.status)
            if (gameData.status === "starting" && !isHost) {
              console.log("[v0] ✅ Polling: Navigating to game-starting")
              router.push(`/game-starting?code=${gameCode}`)
            }
          }
        } catch (error) {
          console.error("[v0] Polling error:", error)
        }
      }, 2000)
    }

    // Start polling after 5 seconds if realtime hasn't connected
    const pollingTimeout = setTimeout(() => {
      if (!realtimeWorking) {
        console.log("[v0] Realtime not working after 5s, starting polling")
        startPolling()
      }
    }, 5000)

    return () => {
      console.log("[v0] Cleaning up realtime subscription")
      clearTimeout(pollingTimeout)
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
      supabase.removeChannel(channel)
    }
  }, [gameId, supabase, isSupabaseAvailable, isHost, router, currentUserId, gameStatus, gameCode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && activeTab === "chat") {
        setIsTransitioning(true)
        setActiveTab("players")
        setTimeout(() => setIsTransitioning(false), 300)
      } else if (e.key === "ArrowRight" && activeTab === "players") {
        setIsTransitioning(true)
        setActiveTab("chat")
        setTimeout(() => setIsTransitioning(false), 300)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeTab])

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatMessages])

  const scanForBluetoothDevices = async () => {
    console.log("[v0] Starting Bluetooth scan...")

    if (!navigator.bluetooth) {
      console.log("[v0] Bluetooth API not available")
      toast({
        title: "Bluetooth not supported",
        description: "Your browser doesn't support Web Bluetooth API. Try Chrome or Edge on desktop.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsScanning(true)
      console.log("[v0] Requesting Bluetooth device...")

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ["battery_service"] },
          { services: ["device_information"] },
          { namePrefix: "JBL" },
          { namePrefix: "Sony" },
          { namePrefix: "Bose" },
          { namePrefix: "Beats" },
        ],
        optionalServices: ["battery_service", "device_information"],
      })

      console.log("[v0] Device found:", device)

      if (device.name) {
        const newDevice: BluetoothDeviceInfo = {
          id: device.id,
          name: device.name,
        }

        if (!bluetoothDevices.find((d) => d.id === device.id)) {
          setBluetoothDevices([...bluetoothDevices, newDevice])
          console.log("[v0] Device added to list:", newDevice)
        }

        toast({
          title: "Device found",
          description: `Found ${device.name}`,
        })
      }
    } catch (error: any) {
      console.log("[v0] Bluetooth error:", error)

      if (error.name === "NotFoundError") {
        toast({
          title: "No devices found",
          description: "Make sure your Bluetooth device is on and in pairing mode",
        })
      } else if (error.name === "NotSupportedError") {
        toast({
          title: "Bluetooth not available",
          description: "Bluetooth requires HTTPS. This feature works on the published site.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Bluetooth error",
          description: error.message || "Failed to scan for devices",
          variant: "destructive",
        })
      }
    } finally {
      setIsScanning(false)
      console.log("[v0] Bluetooth scan complete")
    }
  }

  const handleCopyCode = () => {
    console.log("[v0] Copy button clicked")
    const gameUrl = getGameUrl()
    console.log("[v0] Game URL:", gameUrl)

    navigator.clipboard
      .writeText(gameUrl)
      .then(() => {
        console.log("[v0] URL copied successfully")
        toast({
          title: "Game link copied",
          description: "Share this link with your friends",
          className: "bg-[#00E5CC] text-[#000033] border-none",
        })
      })
      .catch((err) => {
        console.error("[v0] Copy failed:", err)
        toast({
          title: "Copy failed",
          description: "Please try again",
          variant: "destructive",
        })
      })
  }

  const handleShowQR = () => {
    console.log("[v0] QR button clicked")
    if (!qrCodeUrl) {
      console.log("[v0] Generating QR code...")
      generateQRCode(gameCode || "789437")
    }
    setIsQRModalOpen(true)
    console.log("[v0] QR modal opened")
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !gameId || !currentUserId) {
      console.log("[v0] ❌ Cannot send message:")
      console.log("[v0]   - Message empty:", !messageInput.trim())
      console.log("[v0]   - Game ID missing:", !gameId)
      console.log("[v0]   - User ID missing:", !currentUserId)
      return
    }

    const currentPlayer = players.find((p) => p.id === currentUserId)
    if (!currentPlayer) {
      console.log("[v0] ❌ Current player not found in players list")
      console.log("[v0]   - Current user ID:", currentUserId)
      console.log(
        "[v0]   - Players:",
        players.map((p) => p.id),
      )
      return
    }

    console.log("[v0] 📤 ========================================")
    console.log("[v0] 📤 SENDING MESSAGE")
    console.log("[v0] 📤 ========================================")
    console.log("[v0] 📤 Message:", messageInput)
    console.log("[v0] 📤 Game ID:", gameId)
    console.log("[v0] 📤 Player name:", currentPlayer.player_name)

    const { data, error } = await supabase
      .from("game_chat")
      .insert({
        game_id: gameId,
        player_name: currentPlayer.player_name,
        message: messageInput,
      })
      .select()

    console.log("[v0] 📤 ========================================")
    console.log("[v0] 📤 MESSAGE SEND RESULT")
    console.log("[v0] 📤 ========================================")
    console.log("[v0] 📤 Data:", data)
    console.log("[v0] 📤 Error:", error)

    if (error) {
      console.error("[v0] ❌ Error sending message:", error)
      console.error("[v0] ❌ Error code:", error.code)
      console.error("[v0] ❌ Error message:", error.message)
      console.error("[v0] ❌ Error details:", error.details)
      console.error("[v0] ❌ Error hint:", error.hint)
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    console.log("[v0] ✅ Message sent successfully")
    setMessageInput("")
  }

  const handleEmojiClick = async (emoji: string) => {
    if (!gameId || !currentUserId) {
      console.log("[v0] ❌ Cannot send emoji:")
      console.log("[v0]   - Game ID missing:", !gameId)
      console.log("[v0]   - User ID missing:", !currentUserId)
      return
    }

    const currentPlayer = players.find((p) => p.id === currentUserId)
    if (!currentPlayer) {
      console.log("[v0] ❌ Current player not found for emoji")
      return
    }

    console.log("[v0] 📤 Sending emoji:", emoji)

    const { data, error } = await supabase
      .from("game_chat")
      .insert({
        game_id: gameId,
        player_name: currentPlayer.player_name,
        message: emoji,
      })
      .select()

    console.log("[v0] 📤 Emoji send result - Data:", data, "Error:", error)

    if (error) {
      console.error("[v0] ❌ Emoji error:", error)
      console.error("[v0] ❌ Error details:", error.code, error.message)
      toast({
        title: "Failed to send emoji",
        description: error.message,
        variant: "destructive",
      })
      return
    }

    console.log("[v0] ✅ Emoji sent successfully")

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

  const handleSelectDevice = (device: string) => {
    setSelectedDevice(device)
  }

  const handleConnectDevice = () => {
    if (selectedDevice === "this-device") {
      setPlaybackDevice("This device")
    } else {
      setPlaybackDevice(selectedDevice)
    }
    setIsDeviceModalOpen(false)
    toast({
      title: "Device connected",
      description: `Playing on ${selectedDevice === "this-device" ? "this device" : selectedDevice}`,
    })
  }

  const handleStartGame = async () => {
    if (isSupabaseAvailable && supabase && gameId) {
      console.log("[v0] Updating game status to 'starting'...")
      const { error } = await supabase.from("games").update({ status: "starting" }).eq("id", gameId)

      if (error) {
        console.error("[v0] Failed to update game status:", error)
      } else {
        console.log("[v0] Game status updated successfully")
      }
    }

    resetGameState()
    router.push(`/game-starting?code=${gameCode}`)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
    setTouchEnd(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.touches[0].clientX)
    const diff = e.touches[0].clientX - touchStart

    if (activeTab === "players" && diff < 0) {
      setSlideOffset(Math.max(diff, -window.innerWidth))
    } else if (activeTab === "chat" && diff > 0) {
      setSlideOffset(Math.min(diff, window.innerWidth))
    }
  }

  const handleTouchEnd = () => {
    const swipeThreshold = 50
    const diff = touchEnd - touchStart

    if (Math.abs(diff) > swipeThreshold) {
      setIsTransitioning(true)
      if (diff < 0 && activeTab === "players") {
        setActiveTab("chat")
      } else if (diff > 0 && activeTab === "chat") {
        setActiveTab("players")
      }
      setTimeout(() => {
        setIsTransitioning(false)
        setSlideOffset(0)
      }, 300)
    } else {
      setSlideOffset(0)
    }
  }

  return (
    <div className="min-h-screen bg-[#000033] text-white flex flex-col">
      {showDebug && (
        <div
          className="fixed top-2 left-2 right-2 z-[200] bg-red-600 text-white text-xs p-3 rounded-lg max-h-40 overflow-y-auto"
          onClick={() => setShowDebug(false)}
        >
          <div className="font-bold mb-1">DEBUG (tap to hide):</div>
          <div className="space-y-1 font-mono">
            <div>
              Game Code: <span className="text-yellow-300">{debugInfo.gameCode || "NOT SET"}</span>
            </div>
            <div>
              Game ID: <span className="text-yellow-300">{debugInfo.gameId || "NOT SET"}</span>
            </div>
            <div>
              Players: <span className="text-yellow-300">{debugInfo.playerCount}</span>
            </div>
            <div>
              Supabase:{" "}
              <span
                className={
                  debugInfo.supabaseStatus === "available" || debugInfo.supabaseStatus === "connected"
                    ? "text-green-300"
                    : "text-red-300"
                }
              >
                {debugInfo.supabaseStatus}
              </span>
            </div>
            <div>
              Is Joining: <span className="text-yellow-300">{debugInfo.isJoining ? "YES" : "NO"}</span>
            </div>
            {debugInfo.lastError && (
              <div>
                Error: <span className="text-red-300">{debugInfo.lastError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000033] pb-4">
        <Link href="/with-friends">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 w-[24px] h-[24px] p-0">
            <ArrowLeft className="h-[24px] w-[24px]" />
          </Button>
        </Link>
        <h1
          className="text-[22px] font-black text-center bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D9EA)",
          }}
        >
          THE LOUNGE
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 w-[24px] h-[24px] p-0"
          onClick={() => {}}
        >
          <Menu className="h-[24px] w-[24px]" />
        </Button>
      </header>

      <div
        className="fixed top-[122px] left-0 right-0 z-40 px-6 pb-3"
        style={{
          background: "#000022",
        }}
      >
        <div
          className="rounded-2xl p-4"
          style={{
            border: "2px solid #D2FFFF",
            background: "linear-gradient(to right, #0D113B, #8B94C0)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-[18px] font-semibold text-white">Join the game</h3>
              <p className="text-[14px] text-white mt-3 truncate">Game code: {gameCode || "789437"}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleCopyCode}
                className="flex items-center justify-center"
                style={{
                  width: "56px",
                  height: "56px",
                  background: "#C86BFF",
                  border: "2px solid #F5D8FF",
                  borderRadius: "12px",
                  boxShadow: "0px 4px 0px 0px #511574",
                }}
              >
                <Copy className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleShowQR}
                className="flex items-center justify-center"
                style={{
                  width: "56px",
                  height: "56px",
                  background: "#FF58C9",
                  border: "2px solid #FFD0F5",
                  borderRadius: "12px",
                  boxShadow: "0px 4px 0px 0px #7A0066",
                }}
              >
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm-2 8h8v8H3v-8zm2 2v4h4v-4H5zm8-12v8h8V3h-8zm6 6h-4V5h4v4zm-6 4h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2zm2-2h2v2h-2v-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {isHost && playbackDevice && (
          <div className="mt-3">
            <div
              className="rounded-2xl p-4 flex items-center justify-between"
              style={{
                border: "2px solid #C7D2FF",
                background: "linear-gradient(to right, #0D113B, #8B94C0)",
              }}
            >
              <div className="flex-1">
                <div className="text-[16px] font-semibold text-white mb-1">Playback device</div>
                <div className="text-[14px] text-white/80">{playbackDevice}</div>
              </div>
              <button
                onClick={() => setIsDeviceModalOpen(true)}
                className="flex items-center gap-2 px-4"
                style={{
                  height: "56px",
                  borderRadius: "16px",
                  border: "2px solid #D2FFFF",
                  background: "#90F7F9",
                  boxShadow: "0px 4px 0px 0px #056E74",
                }}
              >
                <span className="text-[16px] font-semibold text-[#000033]">Edit</span>
                <img src="/bluetooth-speaker01.png" alt="Speaker" className="w-8 h-8 object-contain" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        className="fixed left-0 right-0 z-30 px-6 pb-4 bg-[#0D113B]"
        style={{
          top: playbackDevice ? "338px" : "244px",
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          borderTop: "3px solid #B9F3FF",
        }}
      >
        <div
          className="flex rounded-[12px] overflow-hidden"
          style={{
            border: "1px solid #C7D2FF",
            height: "48px",
          }}
        >
          <button
            onClick={() => {
              setIsTransitioning(true)
              setActiveTab("players")
              setTimeout(() => setIsTransitioning(false), 300)
            }}
            className={`flex-1 transition-all ${
              activeTab === "players" ? "text-[18px] font-semibold text-white" : "text-[16px] font-semibold text-white"
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
            onClick={() => {
              setIsTransitioning(true)
              setActiveTab("chat")
              setTimeout(() => setIsTransitioning(false), 300)
            }}
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
        <div
          className="fixed left-0 right-0 overflow-y-auto px-6"
          style={{
            top: playbackDevice ? "426px" : "332px",
            bottom: "83px",
            background: "#0D113B",
          }}
        >
          <div className="space-y-3 pt-4 pb-4">
            {players.map((player, index) => {
              const avatarImage = getAvatarImage(player.avatar_id)
              const colorSet = PLAYER_COLOR_SETS[index % PLAYER_COLOR_SETS.length]

              return (
                <div
                  key={player.id}
                  className="rounded-2xl flex items-center justify-between"
                  style={{
                    height: "48px",
                    background: colorSet.bg,
                    border: `2px solid ${colorSet.border}`,
                    padding: "0 12px 0 0",
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
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[18px] font-semibold text-white"
                        style={{
                          textShadow: `2px 2px 0px ${colorSet.shadow}`,
                        }}
                      >
                        {player.player_name}
                      </span>
                      {player.is_host && <span className="text-[20px]">👑</span>}
                    </div>
                  </div>
                  {player.is_host && (
                    <span
                      className="px-3 py-1 text-white text-[14px] font-semibold rounded-lg"
                      style={{
                        background: colorSet.border,
                      }}
                    >
                      HOST
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === "chat" && (
        <div
          className="fixed left-0 right-0 px-6"
          style={{
            top: playbackDevice ? "426px" : "332px",
            bottom: "83px",
            background: "#0D113B",
          }}
        >
          <div
            ref={chatMessagesRef}
            className="overflow-y-auto space-y-3 pt-4 pb-4"
            style={{
              height: "calc(100% - 160px)",
            }}
          >
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/50">
                <p className="text-lg">No messages yet</p>
                <p className="text-sm mt-2">Be the first to say something!</p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const msgAvatarImage = getAvatarImage(msg.player_avatar)
                const isEmojiOnly = /^[\p{Emoji}\s]+$/u.test(msg.message.trim())

                console.log(
                  `[v0] 🎨 Rendering message from ${msg.player_name}, avatar: ${msg.player_avatar}, image: ${msgAvatarImage}`,
                )

                return (
                  <div key={msg.id} className="flex items-start gap-3 flex-row-reverse w-full">
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                      <img
                        src={msgAvatarImage || "/placeholder.svg"}
                        alt={msg.player_name}
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                    {/* </CHANGE> */}

                    {isEmojiOnly ? (
                      <div className="flex-1 min-w-0 w-full">
                        <div className="inline-block bg-transparent px-4 py-2 rounded-2xl w-full">
                          <span className="text-[14px] font-medium" style={{ color: "#C7D2FF" }}>
                            {msg.player_name} sent an emoji {msg.message}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0 w-full">
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
                )
              })
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-[#0D113B] px-6 py-4">
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              {["❤️", "🔥", "😂", "✨", "😍", "🎉", "👍", "🤣", "💯", "🙏"].map((emoji) => (
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
                className="flex-1 min-w-0 text-white rounded-2xl px-4 py-3 outline-none"
                style={{
                  background: "#000022",
                  border: "2px solid #D2FFFF",
                }}
              />
              <button
                onClick={handleSendMessage}
                className="flex items-center justify-center flex-shrink-0"
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
        </div>
      )}

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
            transform: translateY(-400px) scale(${1.2 + Math.random() * 0.5}) rotate(${(Math.random() - 0.5) * 720}deg);
            opacity: 0;
          }
        }

        @keyframes startButtonPop {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes startButtonPulse {
          0%, 100% {
            box-shadow: 0px 4px 0px 0px #7C5100, 0 0 20px rgba(255, 208, 59, 0.5);
          }
          50% {
            box-shadow: 0px 4px 0px 0px #7C5100, 0 0 30px rgba(255, 208, 59, 0.8);
          }
        }

        :global(.animate-start-button-pop) {
          animation: startButtonPop 0.5s ease-out, startButtonPulse 2s ease-in-out infinite;
        }

        @keyframes speakerBounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-30px);
          }
          60% {
            transform: translateY(-15px);
          }
        }

        .animate-speaker-bounce {
          animation: speakerBounce 2s infinite ease-in-out;
        }
      `}</style>

      {isHost && (
        <div className="fixed left-0 right-0 px-6 z-50" style={{ bottom: "36px" }}>
          {!playbackDevice ? (
            <button
              onClick={() => setIsDeviceModalOpen(true)}
              className="w-full h-[56px] bg-[#FFD03B] hover:bg-[#FFD03B]/90 text-[#000033] text-[18px] font-bold rounded-[16px] border-2 border-[#FFF8C4]"
              style={{
                boxShadow: "0px 4px 0px 0px #7C5100",
              }}
            >
              Select playback device
            </button>
          ) : (
            <button
              onClick={handleStartGame}
              className="w-full h-[56px] bg-[#FFD03B] hover:bg-[#FFD03B]/90 text-[#000033] text-[18px] font-bold rounded-[16px] border-2 border-[#FFF8C4] animate-start-button-pop"
              style={{
                boxShadow: "0px 4px 0px 0px #7C5100, 0 0 20px rgba(255, 208, 59, 0.5)",
              }}
            >
              Start the game
            </button>
          )}
        </div>
      )}

      {isQRModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-6"
          onClick={() => setIsQRModalOpen(false)}
        >
          <div
            className="bg-[#000033] rounded-3xl p-8 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
            style={{
              border: "2px solid #D2FFFF",
            }}
          >
            <h2 className="text-2xl font-bold text-white text-center mb-6">Scan to Join</h2>

            {qrCodeUrl ? (
              <div className="bg-white rounded-2xl p-4 mb-6">
                <img src={qrCodeUrl || "/placeholder.svg"} alt="QR Code" className="w-full h-auto" />
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 mb-6 flex items-center justify-center h-64">
                <p className="text-[#000033]">Generating QR code...</p>
              </div>
            )}

            <p className="text-center text-white/70 text-sm mb-6">
              Game code: <span className="font-bold text-white">{gameCode || "789437"}</span>
            </p>

            <button
              onClick={() => setIsQRModalOpen(false)}
              className="w-full h-[56px] bg-[#FFD03B] hover:bg-[#FFD03B]/90 text-[#000033] text-[16px] font-bold rounded-[16px] border-2 border-[#FFF8C4]"
              style={{
                boxShadow: "0px 4px 0px 0px #7C5100",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isDeviceModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-6"
          onClick={() => setIsDeviceModalOpen(false)}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-[180px]">
            <img
              src="/bluetooth-speaker01.png"
              alt="Bluetooth Speaker"
              className="animate-speaker-bounce"
              style={{
                width: "134px",
                height: "136px",
              }}
            />
          </div>

          <div
            className="bg-[#000033] rounded-3xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
            style={{
              border: "2px solid #B9F3FF",
              paddingTop: "80px",
              paddingLeft: "24px",
              paddingRight: "24px",
              paddingBottom: "24px",
            }}
          >
            <h2 className="text-[20px] font-semibold text-white text-center mb-6">Select Playback Device</h2>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleSelectDevice("this-device")}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  selectedDevice === "this-device"
                    ? "bg-[#262C87] border-2 border-[#00E5CC]"
                    : "bg-[#0D113B] border-2 border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">This Device</div>
                    <div className="text-sm text-white/60">Play music on this device</div>
                  </div>
                  {selectedDevice === "this-device" && (
                    <img src="/check-square.png" alt="Selected" className="w-8 h-8" />
                  )}
                </div>
              </button>

              {bluetoothDevices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => handleSelectDevice(device.name)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    selectedDevice === device.name
                      ? "bg-[#262C87] border-2 border-[#00E5CC]"
                      : "bg-[#0D113B] border-2 border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{device.name}</div>
                      <div className="text-sm text-white/60">Bluetooth device</div>
                    </div>
                    {selectedDevice === device.name && (
                      <img src="/check-square.png" alt="Selected" className="w-8 h-8" />
                    )}
                  </div>
                </button>
              ))}

              <button
                onClick={scanForBluetoothDevices}
                disabled={isScanning}
                className="w-full p-4 rounded-xl border-2 border-dashed border-[#00E5CC]/50 text-[#00E5CC] hover:border-[#00E5CC] transition-all disabled:opacity-50"
              >
                {isScanning ? "Scanning..." : "+ Add Bluetooth Device"}
              </button>
            </div>

            <button
              onClick={handleConnectDevice}
              className="w-full h-[56px] bg-[#FFD03B] hover:bg-[#FFD03B]/90 text-[#000033] text-[16px] font-bold rounded-[16px] border-2 border-[#FFF8C4]"
              style={{
                boxShadow: "0px 4px 0px 0px #7C5100",
              }}
            >
              Back to the lounge
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameLoungeContent
