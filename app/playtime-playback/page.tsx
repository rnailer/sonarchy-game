"use client"

// Playback page - plays on host's Spotify device (not in browser)

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import Image from "next/image"
import { getGameState } from "@/lib/game-state"
import { createClient } from "@/lib/supabase/client"
import { useServerTimer } from "@/lib/hooks/use-server-timer"
import { usePhaseSync } from '@/lib/hooks/use-phase-sync'
import { setGamePhase } from '@/lib/game-phases'

const SHOW_DEBUG = false

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: any
  }
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

export default function PlaytimePlayback() {
  console.log("[v0] 🚀 PlaytimePlayback component rendering - CODE VERSION: 2025-01-11-VOTE-DISPLAY-FIX-V3")

  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedCategory = searchParams.get("category") || "Songs about cars or driving"
  const gameCode = searchParams.get("code")

  console.log("[v0] 🎮 Game code from URL:", gameCode)

  const gameState = getGameState()
  const showNames = gameState.showNames
  const currentSongNumber = gameState.currentSongNumber || 1
  const currentRound = gameState.currentRound || 1

  const [playerData, setPlayerData] = useState<any>(null)
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false)
  const hasStartedPlaybackRef = useRef(false)
  const timerStartedRef = useRef(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Phase sync for playback
  const { currentPhase, isLoading, isCorrectPhase } = usePhaseSync({
    gameCode: gameCode || "",
    gameId: gameId || "",
    expectedPhase: 'playback',
    expectedRound: currentRound,
    disabled: !gameCode || !gameId
  })

  // Detect when phase changes away from playback and show transition state
  useEffect(() => {
    if (currentPhase && currentPhase !== 'playback') {
      console.log("[v0] Phase changed away from playback, showing transition state")
      setIsTransitioning(true)
    }
  }, [currentPhase])

  // REMOVED: Phase should be set BEFORE navigation, not on page load
  // Pages should not set their own phase - it conflicts with phase sync
  // Phase is set by: pick-your-song (when all songs picked) or leaderboard (when next song starts)

  // Use server-synchronized timer for voting periods
  // NOTE: onExpire should NOT transition to ranking - vote processing handles that
  // The local timer effect processes votes and decides whether to extend or skip
  const { timeRemaining: serverTimeRemaining, startTimer: startServerTimer } = useServerTimer({
    gameId: gameId || undefined,
    timerType: "song",
    enabled: !!gameId && hasStartedPlayback,
    onExpire: async () => {
      addDebugLog("⏱️ Server timer expired - vote processing will handle phase transition")
      // DO NOT transition to ranking here!
      // The local timer useEffect handles vote processing and phase transitions
      // This prevents race conditions where onExpire fires before extend vote is processed
    },
  })

  // Use server timer value, fallback to 30 if not started yet
  const [timeRemaining, setTimeRemaining] = useState(30)

  // Sync local timer with server timer when available
  useEffect(() => {
    if (serverTimeRemaining !== undefined && serverTimeRemaining !== timeRemaining) {
      setTimeRemaining(serverTimeRemaining)
    }
  }, [serverTimeRemaining])

  const [isMuted, setIsMuted] = useState(false)
  const [skipVotes, setSkipVotes] = useState(0)
  const [extendVotes, setExtendVotes] = useState(0)

  useEffect(() => {
    console.log("[v0] 🔢 Vote counts updated in state - Skip:", skipVotes, "Extend:", extendVotes)
    addDebugLog(`🔢 Current vote counts - Skip: ${skipVotes}, Extend: ${extendVotes}`)
  }, [skipVotes, extendVotes])
  // </CHANGE>

  const [userVote, setUserVote] = useState<"skip" | "extend" | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; player_name: string; message: string; player_id: string; player_avatar: string }>
  >([])
  const [messageInput, setMessageInput] = useState("")
  const [emojiParticles, setEmojiParticles] = useState<Array<{ id: string; emoji: string; x: number; y: number }>>([])
  const [showOverlay, setShowOverlay] = useState(false)
  const [voteResult, setVoteResult] = useState<"skip" | "extend" | null>(null)
  const [extensionCount, setExtensionCount] = useState(0)
  const [songEnded, setSongEnded] = useState(false)
  const [hasReachedNaturalEnd, setHasReachedNaturalEnd] = useState(false) // Distinguishes natural end (bonus) from skip
  const [isProcessingExpiration, setIsProcessingExpiration] = useState(false)
  const [songPlaybackStartTime, setSongPlaybackStartTime] = useState<number | null>(null) // Track actual playback start for natural end detection
  const [isAnimatingIn, setIsAnimatingIn] = useState(true)
  const [totalElapsedTime, setTotalElapsedTime] = useState(0)
  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [playbackStarted, setPlaybackStarted] = useState(false)
  const [authUserId, setAuthUserId] = useState<string | null>(null)

  // Spotify Web Playback SDK states
  const [spotifyPlayer, setSpotifyPlayer] = useState<any>(null)
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null)
  const [spotifyDeviceName, setSpotifyDeviceName] = useState<string | null>(null)
  const [availableDevices, setAvailableDevices] = useState<any[]>([])
  const [isMobile, setIsMobile] = useState(false)

  // Store current user's ID to display their messages on the right
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(SHOW_DEBUG)

  const voteSubscription = useRef<any>(null) // Changed from state to ref

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [needsUserInteraction, setNeedsUserInteraction] = useState(true)

  const chatMessagesRef = useRef<HTMLDivElement>(null)

  const addDebugLog = (message: string) => {
    console.log("[v0]", message)
    setDebugInfo((prev) => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    console.log("[v0] ✅ Component mounted! Game code:", gameCode)
    addDebugLog(`✅ COMPONENT MOUNTED - Game code: ${gameCode || "MISSING"}`)
    addDebugLog(`✅ CODE VERSION: 2025-01-11-VOTE-DISPLAY-FIX-V3`)

    // Detect mobile device
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    setIsMobile(mobile)
    addDebugLog(`📱 Device type: ${mobile ? "MOBILE" : "DESKTOP"}`)
    if (mobile) {
      addDebugLog(`📱 Mobile detected - will use Spotify Connect instead of Web Playback SDK`)
    }

    const getAuthUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setAuthUserId(user.id)
        addDebugLog(`🔐 Authenticated user ID: ${user.id}`)
      } else {
        addDebugLog(`⚠️ No authenticated user - cannot be host`)
      }
    }
    getAuthUser()
  }, [])

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!gameCode) {
        addDebugLog("❌ No game code")
        setLoadError("No game code provided. Please start a new game.")
        setIsLoadingPlayer(false)
        return
      }

      const supabase = createClient()
      if (!supabase) {
        addDebugLog("❌ Supabase not available")
        setLoadError("Database connection failed. Please refresh the page.")
        setIsLoadingPlayer(false)
        return
      }

      addDebugLog(`🔍 Fetching game: ${gameCode}`)

      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("id, host_user_id, current_song_player_id")
        .eq("game_code", gameCode)
        .single()

      if (gameError || !game) {
        addDebugLog(`❌ Game not found: ${gameError?.message}`)
        setLoadError(`Game not found: ${gameCode}`)
        setIsLoadingPlayer(false)
        return
      }

      addDebugLog(`✅ Game ID: ${game.id}`)
      setGameId(game.id) // Set gameId for server timer
      addDebugLog(`👑 Host user ID: ${game.host_user_id}`)
      addDebugLog(`🎵 Current song player ID: ${game.current_song_player_id || "NONE - need to select next song"}`)

      // CRITICAL: Clear any stale timer on mount to prevent timer from previous song
      addDebugLog("🧹 Clearing any stale timer from previous song...")
      await supabase.from("games").update({
        song_start_time: null,
        song_duration: null
      }).eq("id", game.id)
      addDebugLog("✅ Timer cleared - fresh start for this song")

      if (game.current_song_player_id) {
        addDebugLog(`🎯 Using current synchronized song for ALL players: ${game.current_song_player_id}`)

        const { data: currentPlayer, error: currentPlayerError } = await supabase
          .from("game_players")
          .select("*")
          .eq("id", game.current_song_player_id)
          .single()

        if (currentPlayerError || !currentPlayer) {
          addDebugLog(`❌ Current song player not found, will select new song`)
        } else {
          addDebugLog(`✅ ALL PLAYERS SYNCHRONIZED on: "${currentPlayer.song_title}" by ${currentPlayer.song_artist}`)

          setPlayerData({
            id: currentPlayer.id,
            player_name: currentPlayer.player_name,
            avatar_id: currentPlayer.avatar_id,
            song_title: currentPlayer.song_title,
            song_artist: currentPlayer.song_artist,
            song_uri: currentPlayer.song_uri,
            song_preview_url: currentPlayer.song_preview_url,
            album_cover_url: currentPlayer.album_cover_url || "/placeholder.svg",
            song_duration_ms: currentPlayer.song_duration_ms || 180000,
          })

          const storedPlayerId = localStorage.getItem(`player_id_${gameCode}`)
          if (storedPlayerId) {
            setCurrentUserId(storedPlayerId)
          }

          setIsLoadingPlayer(false)
          return
        }
      }
      // </CHANGE>

      // Players without songs will be skipped during playback

      const { data: allPlayers, error: allPlayersError } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", game.id)
        .not("song_uri", "is", null)
        .eq("song_played", false)
        .order("joined_at", { ascending: true })

      if (allPlayersError) {
        addDebugLog(`❌ Error fetching players: ${allPlayersError.message}`)
        setLoadError(`Database error: ${allPlayersError.message}`)
        setIsLoadingPlayer(false)
        return
      }

      addDebugLog(`📊 Total unplayed songs: ${allPlayers?.length || 0}`)

      if (!allPlayers || allPlayers.length === 0) {
        addDebugLog("✅ All songs have been played! Navigating to round completion...")

        // Pause Spotify if host
        if (isHost && spotifyAccessToken) {
          await pauseSpotifyPlayback(spotifyAccessToken)
        }

        // Use the last song's player ID (current_song_player_id) for navigation
        const lastSongPlayerId = game.current_song_player_id || ""
        router.push(
          `/leaderboard?category=${encodeURIComponent(selectedCategory)}&code=${gameCode}&playerId=${lastSongPlayerId}&roundComplete=true&t=${Date.now()}`,
        )
        return
      }

      // Select the first unplayed song (in order of joining)
      const selectedPlayer = allPlayers[0]

      addDebugLog(
        `🎯 Selected NEXT song for ALL players: "${selectedPlayer.song_title}" by ${selectedPlayer.song_artist}`,
      )
      addDebugLog(`✅ Player: ${selectedPlayer.player_name}`)
      addDebugLog(`✅ Song URI: ${selectedPlayer.song_uri}`)
      addDebugLog(`🎵 Preview URL from DB: ${selectedPlayer.song_preview_url || "NULL/MISSING"}`)

      // SET this as the current song so all players are synchronized
      // CRITICAL: Only the host should update current_song_player_id to prevent race conditions
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const userIsHost = currentUser && game.host_user_id === currentUser.id

      if (userIsHost) {
        await supabase.from("games").update({ current_song_player_id: selectedPlayer.id }).eq("id", game.id)
        addDebugLog(`✅ HOST: Set current_song_player_id to ${selectedPlayer.id} - ALL PLAYERS SYNCHRONIZED!`)
      } else {
        addDebugLog(`⏳ NON-HOST: Waiting for host to set current_song_player_id`)
      }
      // </CHANGE>

      if (!selectedPlayer.song_preview_url) {
        addDebugLog(`⚠️ WARNING: No preview URL for this song - audio won't play`)
      }

      console.log("[v0] Full player data from DB:", selectedPlayer)

      setPlayerData({
        id: selectedPlayer.id,
        player_name: selectedPlayer.player_name,
        avatar_id: selectedPlayer.avatar_id,
        song_title: selectedPlayer.song_title,
        song_artist: selectedPlayer.song_artist,
        song_uri: selectedPlayer.song_uri,
        song_preview_url: selectedPlayer.song_preview_url,
        album_cover_url: selectedPlayer.album_cover_url || "/placeholder.svg",
        song_duration_ms: selectedPlayer.song_duration_ms || 180000,
      })

      const storedPlayerId = localStorage.getItem(`player_id_${gameCode}`)
      if (storedPlayerId) {
        setCurrentUserId(storedPlayerId)
      }

      setIsLoadingPlayer(false)
      addDebugLog("🎉 Player data loaded successfully - ALL PLAYERS SEEING SAME SONG!")
    }

    fetchPlayerData()
  }, [gameCode, selectedCategory, router])

  useEffect(() => {
    if (!playerData?.song_preview_url) {
      console.log("[v0] ⚠️ No preview URL available for this song")
      addDebugLog("⚠️ No preview URL - song will play silently")
      return
    }

    console.log("[v0] 🎵 Setting up audio with preview URL:", playerData.song_preview_url)
    addDebugLog(`🎵 Loading audio from: ${playerData.song_preview_url}`)

    audioRef.current = new Audio(playerData.song_preview_url)
    audioRef.current.volume = isMuted ? 0 : 1
    audioRef.current.loop = false

    audioRef.current.addEventListener("canplaythrough", () => {
      console.log("[v0] ✅ Audio ready to play")
      addDebugLog("✅ Audio loaded and ready")
      setAudioReady(true)
    })

    audioRef.current.addEventListener("ended", () => {
      console.log("[v0] 🎵 Audio ended naturally")
      addDebugLog("🎵 Audio playback ended")
      setSongEnded(true)
      setHasReachedNaturalEnd(true) // Natural end - show bonus overlay
    })

    audioRef.current.addEventListener("error", (e) => {
      console.error("[v0] ❌ Audio error:", e)
      addDebugLog(`❌ Audio error: ${e.type}`)
    })

    audioRef.current.load()

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [playerData, isMuted]) // Added isMuted to dependency array to ensure volume is set initially

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : 1
    }
  }, [isMuted])

  useEffect(() => {
    console.log("[v0] 🔍🔍🔍 CHECK IF HOST USEEFFECT TRIGGERED 🔍🔍🔍")
    console.log("[v0] 🔍 gameCode:", gameCode)
    addDebugLog("🔍 === CHECK IF HOST USEEFFECT TRIGGERED ===")
    addDebugLog(`🔍 gameCode from URL: ${gameCode || "MISSING"}`)

    const checkIfHost = async () => {
      if (!gameCode) {
        console.log("[v0] ❌ No game code in checkIfHost")
        addDebugLog("❌ No game code in checkIfHost")
        setIsHost(false) // Ensure isHost is false if no gameCode
        return
      }

      if (!authUserId) {
        addDebugLog("⚠️ No auth user ID - cannot be host (waiting for auth...)")
        setIsHost(false)
        return
      }

      const supabase = createClient()
      if (!supabase) {
        addDebugLog("❌ No Supabase client in checkIfHost")
        return
      }

      addDebugLog(`🔍 Checking if auth user ${authUserId} is host...`)

      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("id, host_user_id")
        .eq("game_code", gameCode)
        .single()

      if (!game) {
        addDebugLog(`❌ Game not found: ${gameError?.message}`)
        setLoadError(`Game not found: ${gameCode}`) // Added error message here too
        return
      }

      addDebugLog(`✅ Game found: ${game.id}`)
      addDebugLog(`👑 Host user ID from game: ${game.host_user_id}`)
      addDebugLog(`🔐 Current auth user ID: ${authUserId}`)

      const userIsHost = game.host_user_id === authUserId
      setIsHost(userIsHost)
      addDebugLog(`✅ Is current user the host: ${userIsHost}`)

      if (userIsHost) {
        addDebugLog("🎵 User is host! Fetching Spotify token...")
        try {
          const response = await fetch(`/api/spotify/host-token?code=${gameCode}`)
          addDebugLog(`📡 Token API response status: ${response.status}`)

          if (response.ok) {
            const data = await response.json()
            addDebugLog(`✅ Got Spotify access token (Premium: ${data.is_premium})`)
            addDebugLog(`🔑 Token length: ${data.access_token?.length || 0} chars`)
            setSpotifyAccessToken(data.access_token)
            addDebugLog("🎵 Token state updated! Should trigger player init...")
            addDebugLog(`🔍 window.Spotify available now: ${!!window.Spotify}`)
          } else {
            const errorText = await response.text()
            addDebugLog(`❌ Failed to get Spotify token: ${response.status} - ${errorText}`)
          }
        } catch (error) {
          addDebugLog(`❌ Error fetching Spotify token: ${error}`)
        }
      } else {
        addDebugLog("ℹ️ User is not the host, no Spotify playback needed")
      }
    }

    checkIfHost()
  }, [gameCode, authUserId]) // Added authUserId as dependency

  // Fetch available Spotify devices (for mobile or when SDK not available)
  const getSpotifyDevices = async (token: string) => {
    addDebugLog("📱 Fetching available Spotify devices...")
    try {
      const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        addDebugLog(`❌ Failed to fetch devices: ${response.status}`)
        return []
      }

      const data = await response.json()
      addDebugLog(`📱 Found ${data.devices?.length || 0} Spotify devices`)

      if (data.devices && data.devices.length > 0) {
        data.devices.forEach((device: any) => {
          addDebugLog(`📱 Device: ${device.name} (${device.type}) - Active: ${device.is_active}`)
        })
      }

      return data.devices || []
    } catch (error) {
      addDebugLog(`❌ Error fetching devices: ${error}`)
      return []
    }
  }

  // Load Spotify Web Playback SDK when user is host (DESKTOP ONLY)
  useEffect(() => {
    if (!isHost) {
      addDebugLog("ℹ️ Not host, skipping Spotify SDK load")
      return
    }

    if (isMobile) {
      addDebugLog("📱 Mobile device - skipping Web Playback SDK, will use Spotify Connect")
      return
    }

    addDebugLog("🎵 Loading Spotify Web Playback SDK (Desktop)...")
    const script = document.createElement("script")
    script.src = "https://sdk.scdn.co/spotify-player.js"
    script.async = true

    script.onload = () => {
      addDebugLog("✅ Spotify SDK script loaded")
    }

    script.onerror = () => {
      addDebugLog("❌ Failed to load Spotify SDK script")
    }

    document.body.appendChild(script)

    window.onSpotifyWebPlaybackSDKReady = () => {
      addDebugLog("✅ Spotify Web Playback SDK is ready!")
    }

    return () => {
      addDebugLog("🧹 Cleaning up Spotify SDK script")
      if (script.parentNode) {
        document.body.removeChild(script)
      }
      if (spotifyPlayer) {
        addDebugLog("🔌 Disconnecting Spotify player")
        spotifyPlayer.disconnect()
      }
    }
  }, [isHost, isMobile])

  // For mobile: fetch available devices and auto-poll
  useEffect(() => {
    if (!isMobile || !isHost || !spotifyAccessToken) return

    addDebugLog("📱 === MOBILE DEVICE DETECTION ===")
    addDebugLog("📱 Starting auto-polling for Spotify devices...")

    const fetchDevices = async () => {
      const devices = await getSpotifyDevices(spotifyAccessToken)
      setAvailableDevices(devices)

      // Auto-select active device or first available device
      if (devices.length > 0) {
        const activeDevice = devices.find((d: any) => d.is_active)
        const selectedDevice = activeDevice || devices[0]

        setSpotifyDeviceId(selectedDevice.id)
        setSpotifyDeviceName(selectedDevice.name)
        addDebugLog(`✅ Auto-selected device: ${selectedDevice.name} (${selectedDevice.type})`)
      } else {
        addDebugLog("⚠️ No Spotify devices found - will retry...")
      }
    }

    // Initial fetch
    fetchDevices()

    // Auto-poll every 3 seconds until device is found
    const pollInterval = setInterval(() => {
      if (!spotifyDeviceId) {
        addDebugLog("🔄 Polling for Spotify devices...")
        fetchDevices()
      }
    }, 3000)

    return () => {
      clearInterval(pollInterval)
      addDebugLog("🧹 Stopped polling for devices")
    }
  }, [isMobile, isHost, spotifyAccessToken, spotifyDeviceId])

  // Initialize Spotify Player when token is available (DESKTOP ONLY)
  useEffect(() => {
    addDebugLog("🔍 === PLAYER INIT CHECK ===")
    addDebugLog(`🔍 Has spotifyAccessToken: ${!!spotifyAccessToken}`)
    addDebugLog(`🔍 Has window.Spotify: ${!!window.Spotify}`)
    addDebugLog(`🔍 Has spotifyPlayer already: ${!!spotifyPlayer}`)
    addDebugLog(`🔍 Is host: ${isHost}`)
    addDebugLog(`🔍 Is mobile: ${isMobile}`)

    if (isMobile) {
      addDebugLog("📱 BLOCKED: Mobile device - using Spotify Connect instead of SDK")
      return
    }

    if (!spotifyAccessToken) {
      addDebugLog("⏳ BLOCKED: Waiting for Spotify access token...")
      return
    }

    if (!window.Spotify) {
      addDebugLog("⏳ BLOCKED: Waiting for Spotify SDK to load...")
      addDebugLog("⏳ Hint: Check if SDK script loaded and onSpotifyWebPlaybackSDKReady fired")
      return
    }

    if (spotifyPlayer) {
      addDebugLog("⏭️ BLOCKED: Player already initialized, skipping")
      return
    }

    addDebugLog("🎵 === INITIALIZING SPOTIFY WEB PLAYER ===")
    addDebugLog(`🔑 Token available: ${spotifyAccessToken.substring(0, 20)}...`)

    const player = new window.Spotify.Player({
      name: "Sonarchy Game Player",
      getOAuthToken: (cb: (token: string) => void) => {
        addDebugLog("🔑 Spotify SDK requesting token...")
        cb(spotifyAccessToken)
      },
      volume: 0.5,
    })

    // Ready event - device is online
    player.addListener("ready", ({ device_id }: { device_id: string }) => {
      addDebugLog("✅ ✅ ✅ SPOTIFY DEVICE READY! ✅ ✅ ✅")
      addDebugLog(`📱 Device ID: ${device_id}`)
      setSpotifyDeviceId(device_id)
    })

    // Not ready event - device went offline
    player.addListener("not_ready", ({ device_id }: { device_id: string }) => {
      addDebugLog(`❌ Spotify device went offline: ${device_id}`)
    })

    // Player state changed
    player.addListener("player_state_changed", (state: any) => {
      if (!state) {
        addDebugLog("⚠️ Player state changed but state is null")
        return
      }
      addDebugLog(`🎵 Playback state: ${state.paused ? "PAUSED" : "PLAYING"}`)
      addDebugLog(`🎵 Track: ${state.track_window?.current_track?.name || "Unknown"}`)
      addDebugLog(`🎵 Position: ${Math.floor(state.position / 1000)}s / ${Math.floor(state.duration / 1000)}s`)
    })

    // Error handling
    player.addListener("initialization_error", ({ message }: { message: string }) => {
      addDebugLog(`❌ Initialization error: ${message}`)
    })

    player.addListener("authentication_error", ({ message }: { message: string }) => {
      addDebugLog(`❌ Authentication error: ${message}`)
    })

    player.addListener("account_error", ({ message }: { message: string }) => {
      addDebugLog(`❌ Account error: ${message} (Premium required)`)
    })

    player.addListener("playback_error", ({ message }: { message: string }) => {
      addDebugLog(`❌ Playback error: ${message}`)
    })

    addDebugLog("🔌 Connecting Spotify player...")
    player.connect().then((success: boolean) => {
      if (success) {
        addDebugLog("✅ Spotify player connected successfully!")
      } else {
        addDebugLog("❌ Failed to connect Spotify player")
      }
    })

    setSpotifyPlayer(player)
  }, [spotifyAccessToken, spotifyPlayer, isHost, isMobile])

  // Monitor readiness but DON'T auto-start (browser autoplay policy blocks it)
  useEffect(() => {
    if (spotifyAccessToken && spotifyDeviceId && playerData && isHost) {
      addDebugLog("✅ === SPOTIFY READY FOR USER-INITIATED PLAYBACK ===")
      addDebugLog(`✅ Token: ${spotifyAccessToken.substring(0, 20)}...`)
      addDebugLog(`✅ Device ID: ${spotifyDeviceId}`)
      addDebugLog(`✅ Song data: ${playerData.song_title}`)
      addDebugLog("👆 Waiting for user to click 'Start Music' button...")
    }
  }, [spotifyAccessToken, spotifyDeviceId, playerData, isHost])

  const handleStartPlayback = async () => {
    addDebugLog("🎮 === USER CLICKED START MUSIC ===")
    setNeedsUserInteraction(false)
    setHasStartedPlayback(true)
    hasStartedPlaybackRef.current = true
    setSongPlaybackStartTime(Date.now()) // Track when playback actually started
    setIsAnimatingIn(false)

    // If user is host and Spotify is ready, start Spotify playback
    if (isHost && spotifyAccessToken && spotifyDeviceId && playerData) {
      addDebugLog("🎵 Host with Spotify ready - starting Spotify playback!")
      addDebugLog(`🎵 Device ID: ${spotifyDeviceId}`)
      addDebugLog(`🎵 Song: ${playerData.song_title}`)

      // Call Spotify playback directly from user interaction
      await startSpotifyPlayback(spotifyAccessToken, spotifyDeviceId)
      return
    }

    // If host but Spotify not ready yet
    if (isHost && spotifyAccessToken && !spotifyDeviceId) {
      addDebugLog("⏳ Host but Spotify device not ready yet - waiting...")
      addDebugLog("⏳ This usually takes 2-3 seconds after page load")
      // Timer will still start, and when device becomes ready, playback will work
      return
    }

    // Non-host players: play preview audio
    if (!audioRef.current || !audioReady) {
      console.log("[v0] ⏳ Audio not ready, but starting timer for testing")
      addDebugLog("⏳ Starting game timer (audio may not be available)")
      return
    }

    try {
      await audioRef.current.play()
      console.log("[v0] ✅ Audio playback started!")
      addDebugLog("✅ Audio playback started successfully")
    } catch (error) {
      console.error("[v0] ❌ Failed to start playback:", error)
      addDebugLog(`⚠️ Audio playback failed, but game continues`)
    }
  }

  const pauseSpotifyPlayback = async (token: string) => {
    addDebugLog("⏸️ === PAUSING SPOTIFY PLAYBACK ===")

    try {
      // First attempt with provided token
      let accessToken = token

      // If no token provided, try to get a fresh one
      if (!accessToken) {
        addDebugLog("⚠️ No token provided, fetching fresh token...")
        const tokenResponse = await fetch('/api/spotify/token')
        if (!tokenResponse.ok) {
          addDebugLog("❌ Failed to get Spotify token for pause")
          return
        }
        const tokenData = await tokenResponse.json()
        accessToken = tokenData.access_token
      }

      const response = await fetch("https://api.spotify.com/v1/me/player/pause", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok || response.status === 204) {
        addDebugLog("✅ Spotify playback paused successfully")
      } else if (response.status === 401) {
        // Token expired, retry with fresh token
        addDebugLog("⚠️ Token expired (401), retrying with fresh token...")
        const tokenResponse = await fetch('/api/spotify/token')
        if (!tokenResponse.ok) {
          addDebugLog("❌ Failed to refresh Spotify token")
          return
        }
        const tokenData = await tokenResponse.json()

        const retryResponse = await fetch("https://api.spotify.com/v1/me/player/pause", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        })

        if (retryResponse.ok || retryResponse.status === 204) {
          addDebugLog("✅ Spotify paused successfully after token refresh")
        } else {
          const errorText = await retryResponse.text()
          addDebugLog(`❌ Pause failed even after refresh: ${retryResponse.status} - ${errorText}`)
        }
      } else {
        const errorText = await response.text()
        addDebugLog(`⚠️ Pause response: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      addDebugLog(`❌ Failed to pause Spotify: ${error}`)
    }
  }

  const startSpotifyPlayback = async (token: string, deviceId: string) => {
    if (!playerData) {
      addDebugLog("⏳ Waiting for player data...")
      return
    }

    if (playbackStarted) {
      addDebugLog("✅ Playback already started")
      return
    }

    addDebugLog("🎵 === STARTING SPOTIFY PLAYBACK ===")
    setPlaybackStarted(true)

    try {
      addDebugLog(`🎵 Song URI: ${playerData.song_uri}`)
      addDebugLog(`🎵 Song Title: ${playerData.song_title}`)
      addDebugLog(`🎵 Artist: ${playerData.song_artist}`)
      addDebugLog(`📱 Using Device ID: ${deviceId}`)

      const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: [playerData.song_uri],
          position_ms: 0,
        }),
      })

      addDebugLog(`🎵 Playback API status: ${playResponse.status}`)

      if (playResponse.ok || playResponse.status === 204) {
        addDebugLog("✅ ✅ ✅ SPOTIFY PLAYBACK STARTED ON DEVICE! ✅ ✅ ✅")
        addDebugLog("🎵 Music should now be playing on your Spotify device!")
      } else {
        const errorText = await playResponse.text()
        addDebugLog(`❌ Playback API error: ${playResponse.status}`)
        addDebugLog(`❌ Error details: ${errorText}`)
        setPlaybackStarted(false)
      }
    } catch (error) {
      addDebugLog(`❌ FATAL ERROR: ${error}`)
      console.error("[v0] Spotify playback error:", error)
      setPlaybackStarted(false)
    }
  }

  const handleStartSimulatedPlayback = () => {
    addDebugLog("🎮 === STARTING SIMULATED PLAYBACK MODE ===")
    addDebugLog("🎮 This mode simulates playback for testing game mechanics")
    addDebugLog("🎮 In a native app, real Spotify playback will work here")
    setPlaybackStarted(true)
  }

  useEffect(() => {
    if (!playerData) return

    console.log("[v0] ⏱️ Starting playback timer...")
    addDebugLog("⏱️ Starting playback timer...")
    setHasStartedPlayback(true)
    hasStartedPlaybackRef.current = true
    setSongPlaybackStartTime(Date.now()) // Track when playback actually started
    setIsAnimatingIn(false)

    console.log("[v0] Player data:", playerData)
    console.log("[v0] Song URI:", playerData.song_uri)
    console.log("[v0] Preview URL:", playerData.song_preview_url)
    addDebugLog(`🎵 Song URI: ${playerData.song_uri}`)
    addDebugLog(`🎵 Preview URL: ${playerData.song_preview_url || "MISSING"}`)
  }, [playerData]) // Removed simulatedPlaybackActive from dependencies

  // Start server timer when playback begins
  useEffect(() => {
    if (gameId && hasStartedPlayback && !timerStartedRef.current) {
      timerStartedRef.current = true
      console.log("[v0] 🎬 Starting fresh server timer for voting (30s)")
      addDebugLog("🎬 Starting fresh server timer for voting (30s)")

      // Clear any existing timer from previous song before starting fresh
      const supabase = createClient()
      supabase.from('games').update({
        song_start_time: null,
        song_duration: null
      }).eq('id', gameId).then(() => {
        console.log("[v0] 🧹 Cleared old timer, starting fresh 30s timer")
        startServerTimer(30)
      })
    }
  }, [gameId, hasStartedPlayback, startServerTimer])

  useEffect(() => {
    if (!hasStartedPlayback) return

    if (timeRemaining > 0 && !songEnded) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1)
        setTotalElapsedTime((prev) => prev + 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (timeRemaining === 0 && !songEnded && !isProcessingExpiration) {
      setIsProcessingExpiration(true)

      addDebugLog("⏰ Timer expired. Processing votes...")

      // CRITICAL: Use actual playback time for song end detection (not timer-based elapsed time)
      const songDurationMs = playerData?.song_duration_ms || 0
      const actualElapsedMs = songPlaybackStartTime ? Date.now() - songPlaybackStartTime : 0
      const hasReachedEnd = actualElapsedMs >= songDurationMs && songDurationMs > 0

      // Enhanced logging for song end detection debugging
      console.log("[v0] 🎵 === SONG DURATION CHECK (REAL TIME) ===")
      console.log("[v0] 🎵 songPlaybackStartTime:", songPlaybackStartTime)
      console.log("[v0] 🎵 songDurationMs:", songDurationMs)
      console.log("[v0] 🎵 actualElapsedMs:", actualElapsedMs)
      console.log("[v0] 🎵 hasReachedEnd:", hasReachedEnd)
      console.log("[v0] 🎵 remainingMs:", songDurationMs - actualElapsedMs)
      addDebugLog(`🎵 Song: ${Math.floor(songDurationMs/1000)}s total, ${Math.floor(actualElapsedMs/1000)}s elapsed, ${Math.floor((songDurationMs - actualElapsedMs)/1000)}s remaining`)

      // Calculate remaining time for extend duration (in seconds)
      const remainingTime = Math.floor((songDurationMs - actualElapsedMs) / 1000)

      // If song has reached its natural end, show overlay and transition to ranking
      if (hasReachedEnd) {
        addDebugLog(`🎉 Song has reached its natural end!`)
        if (audioRef.current) {
          audioRef.current.pause()
        }

        // Pause Spotify if host
        if (isHost && spotifyAccessToken) {
          pauseSpotifyPlayback(spotifyAccessToken)
        }

        // Award bonus points to song owner for song completion
        if (playerData && gameId) {
          console.log("[v0] 🎁 Awarding +10 bonus points for song completion")
          addDebugLog(`🎁 Awarding +10 bonus points to ${playerData.player_name}`)

          const supabase = createClient()
          supabase
            .from("game_players")
            .select("bonus_points")
            .eq("id", playerData.id)
            .single()
            .then(({ data: playerInfo }) => {
              const currentBonus = playerInfo?.bonus_points || 0
              const newBonus = currentBonus + 10

              supabase
                .from("game_players")
                .update({ bonus_points: newBonus })
                .eq("id", playerData.id)
                .then(({ error }) => {
                  if (error) {
                    console.error("[v0] ❌ Error awarding bonus points:", error)
                  } else {
                    console.log("[v0] ✅ Bonus points awarded successfully:", newBonus)
                  }
                })
            })
        }

        setSongEnded(true)
        setHasReachedNaturalEnd(true) // Natural end - show bonus overlay
        setShowOverlay(true)
        setVoteResult("extend")

        // CRITICAL: Host must transition to ranking phase when song ends naturally
        if (isHost && gameId) {
          ;(async () => {
            const supabase = createClient()
            const { data: game } = await supabase
              .from("games")
              .select("current_phase")
              .eq("id", gameId)
              .single()

            if (game?.current_phase === 'ranking') {
              addDebugLog("⚠️ Phase already ranking, skipping duplicate transition")
              return
            }

            addDebugLog("🎯 Host setting phase to ranking (song ended naturally)")
            await setGamePhase(gameId, 'ranking')
            addDebugLog("✅ Phase set to ranking - all players will be redirected")
          })()
        } else {
          addDebugLog("⏳ Non-host waiting for phase change to ranking")
        }

        return
      }

      // Song hasn't ended, fetch FRESH votes from database and check result
      // This ensures all devices see the same vote counts
      ;(async () => {
        const supabase = createClient()

        // Get current round
        const { data: gameData } = await supabase
          .from("games")
          .select("current_round")
          .eq("id", gameId)
          .single()

        if (!gameData) {
          console.error("[v0] ❌ Failed to get game data for votes")
          setIsProcessingExpiration(false)
          return
        }

        // Fetch FRESH votes from database
        const { data: freshVotes, error: votesError } = await supabase
          .from("player_votes")
          .select("vote_type")
          .eq("game_id", gameId)
          .eq("round_number", gameData.current_round)

        if (votesError) {
          console.error("[v0] ❌ Failed to fetch votes:", votesError)
        }

        const freshSkipVotes = freshVotes?.filter(v => v.vote_type === "skip").length || 0
        const freshExtendVotes = freshVotes?.filter(v => v.vote_type === "extend").length || 0

        console.log("[v0] 🗳️ === VOTE RESULT (FRESH FROM DB) ===")
        console.log("[v0] 🗳️ freshVotes from DB:", freshVotes)
        console.log("[v0] 🗳️ freshSkipVotes:", freshSkipVotes)
        console.log("[v0] 🗳️ freshExtendVotes:", freshExtendVotes)
        console.log("[v0] 🗳️ Local state - skipVotes:", skipVotes, "extendVotes:", extendVotes)

        const result = freshExtendVotes > freshSkipVotes ? "extend" : "skip"
        console.log("[v0] 🗳️ result:", result)
        console.log("[v0] 🗳️ Setting voteResult to:", result)
        console.log("[v0] 🗳️ Setting showOverlay to: true")
        addDebugLog(`🎯 Vote result: ${result} (Skip: ${freshSkipVotes}, Extend: ${freshExtendVotes})`)
        setVoteResult(result)
        setShowOverlay(true)

        if (result === "extend") {
        // Extend for the next voting period (up to 30 seconds or remaining time)
        const nextRoundDuration = Math.min(30, remainingTime)
        addDebugLog(`⏱️ Extending song for ${nextRoundDuration} more seconds (Extension #${extensionCount + 1})`)

        // Restart server timer with new duration
        startServerTimer(nextRoundDuration)

        // CRITICAL: Clear ALL votes from database after extend
        if (gameId) {
          const supabase = createClient()
          supabase
            .from("games")
            .select("current_round")
            .eq("id", gameId)
            .single()
            .then(({ data: game }) => {
              if (game) {
                supabase
                  .from("player_votes")
                  .delete()
                  .eq("game_id", gameId)
                  .eq("round_number", game.current_round)
                  .then(({ error }) => {
                    if (error) {
                      console.error("[v0] ❌ Error clearing votes after extend:", error)
                    } else {
                      console.log("[v0] ✅ Votes cleared from database after extend")
                      addDebugLog("✅ Votes cleared from database after extend")
                    }
                  })
              }
            })
        }

        setTimeout(() => {
          setShowOverlay(false)
          setVoteResult(null)
          setTimeRemaining(nextRoundDuration)
          setSkipVotes(0)
          setExtendVotes(0)
          setUserVote(null)
          setExtensionCount(extensionCount + 1)
          setIsProcessingExpiration(false)
        }, 1500)
        return
      } else {
        // Skip - end song early, set phase to ranking
        addDebugLog("⏭️ Song skipped by vote")
        if (audioRef.current) {
          audioRef.current.pause()
        }

        // Pause Spotify if host
        if (isHost && spotifyAccessToken) {
          pauseSpotifyPlayback(spotifyAccessToken)
        }

        // CRITICAL: Mark song as ended to stop local timer
        setSongEnded(true)

        // Show skip overlay for 2 seconds before transitioning
        addDebugLog("📺 Showing skip overlay for 2 seconds...")

        // Delay ranking transition to show overlay
        setTimeout(() => {
          // Only host sets phase to ranking when skip wins
          if (isHost && gameId) {
            ;(async () => {
              const supabase = createClient()
              const { data: game } = await supabase
                .from("games")
                .select("current_phase")
                .eq("id", gameId)
                .single()

              if (game?.current_phase === 'ranking') {
                addDebugLog("⚠️ Phase already ranking, skipping duplicate transition")
                return
              }

              addDebugLog("🎯 Host setting phase to ranking (skipped)")
              await setGamePhase(gameId, 'ranking')
              addDebugLog("✅ Phase set to ranking - all players will be redirected")
            })()
          } else {
            addDebugLog("⏳ Non-host waiting for phase change to ranking (skipped)")
          }
        }, 2000) // 2 second delay for overlay visibility

        // Phase sync will redirect all players to leaderboard
        return
      }
      })() // End of async IIFE for vote processing
      // </CHANGE>
    }
  }, [
    timeRemaining,
    skipVotes,
    extendVotes,
    router,
    selectedCategory,
    playerData,
    totalElapsedTime,
    extensionCount,
    songEnded,
    isProcessingExpiration,
    hasStartedPlayback,
    isAnimatingIn,
    gameCode,
    gameId,
    songPlaybackStartTime,
  ])


  useEffect(() => {
    if (!gameCode || !playerData) return

    const supabase = createClient()
    if (!supabase) return

    let isSubscribed = true
    let fetchInterval: NodeJS.Timeout | null = null // Add polling as backup

    const setupVoteSubscription = async () => {
      const { data: game } = await supabase.from("games").select("id, current_round").eq("game_code", gameCode).single()
      if (!game || !isSubscribed) return

      addDebugLog(`📊 Setting up vote subscription for game: ${game.id}, round: ${game.current_round}`)

      const myPlayerId = localStorage.getItem(`player_id_${gameCode}`)
      if (myPlayerId) {
        await supabase
          .from("player_votes")
          .delete()
          .eq("game_id", game.id)
          .eq("round_number", game.current_round)
          .eq("player_id", myPlayerId)

        setUserVote(null)
        setVoteResult(null)
        setShowOverlay(false)
        addDebugLog("🔄 Cleared previous votes for new song")
      }
      // </CHANGE>

      const fetchVotes = async () => {
        const { data: votes, error } = await supabase
          .from("player_votes")
          .select("vote_type")
          .eq("game_id", game.id)
          .eq("round_number", game.current_round)

        if (error) {
          console.error("[v0] ❌ Error fetching votes:", error)
          addDebugLog(`❌ Error fetching votes: ${error.message}`)
          return
        }

        console.log("[v0] 📊 Raw votes from database:", votes)

        if (votes && isSubscribed) {
          const skipCount = votes.filter((v) => v.vote_type === "skip").length
          const extendCount = votes.filter((v) => v.vote_type === "extend").length

          console.log("[v0] 🔥🔥🔥 CALCULATED COUNTS - Skip:", skipCount, "Extend:", extendCount)
          addDebugLog(`📊 Calculated vote counts - Skip: ${skipCount}, Extend: ${extendCount}`)

          setSkipVotes(() => {
            console.log("[v0] ⚡ Setting skipVotes to:", skipCount)
            return skipCount
          })
          setExtendVotes(() => {
            console.log("[v0] ⚡ Setting extendVotes to:", extendCount)
            return extendCount
          })
        }
      }

      await fetchVotes()

      fetchInterval = setInterval(() => {
        console.log("[v0] 🔄 Polling votes (backup to subscription)")
        fetchVotes()
      }, 2000)
      // </CHANGE>

      // Clean up any existing subscription
      if (voteSubscription.current) {
        supabase.removeChannel(voteSubscription.current)
      }

      voteSubscription.current = supabase
        .channel(`player_votes:${game.id}:${game.current_round}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "player_votes",
            filter: `game_id=eq.${game.id}`,
          },
          async (payload) => {
            if (!isSubscribed) return
            console.log("[v0] 🎯🎯🎯 VOTE DATABASE EVENT:", payload.eventType, payload)
            addDebugLog(`📊 Vote ${payload.eventType} event received`)
            await fetchVotes()
          },
        )
        .subscribe((status) => {
          console.log("[v0] 📡 Vote subscription status:", status)
          addDebugLog(`📊 Subscription status: ${status}`)
        })
    }

    setupVoteSubscription()

    return () => {
      isSubscribed = false
      if (fetchInterval) {
        clearInterval(fetchInterval) // Clean up polling
      }
      if (voteSubscription.current) {
        supabase.removeChannel(voteSubscription.current)
      }
    }
  }, [gameCode, playerData])

  // Pause Spotify when game ends
  useEffect(() => {
    if (!gameId) return

    const supabase = createClient()

    // Check current phase on mount
    const checkGameComplete = async () => {
      const { data: game } = await supabase
        .from("games")
        .select("current_phase")
        .eq("id", gameId)
        .single()

      if (game?.current_phase === "game_complete" || game?.current_phase === "final_placements") {
        console.log("[v0] 🛑 Game ended - pausing Spotify")
        const token = localStorage.getItem("spotify_access_token")
        if (token) {
          try {
            await fetch("https://api.spotify.com/v1/me/player/pause", {
              method: "PUT",
              headers: { Authorization: `Bearer ${token}` }
            })
          } catch (e) {
            console.log("[v0] Could not pause Spotify:", e)
          }
        }
      }
    }

    checkGameComplete()

    // Subscribe to phase changes
    const channel = supabase
      .channel(`game-complete-${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, (payload) => {
        if (payload.new.current_phase === "game_complete" || payload.new.current_phase === "final_placements") {
          console.log("[v0] 🛑 Game complete detected - pausing Spotify")
          const token = localStorage.getItem("spotify_access_token")
          if (token) {
            fetch("https://api.spotify.com/v1/me/player/pause", {
              method: "PUT",
              headers: { Authorization: `Bearer ${token}` }
            }).catch(() => {})
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatMessages])

  // Cleanup: pause Spotify when component unmounts or user navigates away
  useEffect(() => {
    return () => {
      // Always try to pause on unmount, even if token/host checks fail
      // The pauseSpotifyPlayback function will handle token refresh
      if (isHost && playbackStarted) {
        console.log("🧹 Component unmounting - pausing Spotify playback")
        pauseSpotifyPlayback(spotifyAccessToken || '')
      }
    }
  }, [isHost, playbackStarted, spotifyAccessToken])

  useEffect(() => {
    if (!gameCode) return

    const supabase = createClient()
    if (!supabase) return

    let channel: any

    const setupChat = async () => {
      const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()
      if (!game) return

      const playerId = localStorage.getItem(`player_id_${gameCode}`)
      if (playerId) {
        setCurrentUserId(playerId)
        addDebugLog(`✅ Current user ID set: ${playerId}`)
      }

      // Fetch all player avatars for this game
      const { data: players } = await supabase
        .from("game_players")
        .select("player_name, avatar_id, id")
        .eq("game_id", game.id)

      // Create a map of player names to avatars and IDs
      const playerMap = new Map<string, { avatar_id: string; id: string }>()
      players?.forEach((p: any) => {
        if (p.player_name) {
          playerMap.set(p.player_name, { avatar_id: p.avatar_id, id: p.id })
        }
      })

      const { data: messages, error: chatError } = await supabase
        .from("game_chat")
        .select("id, player_name, message, created_at")
        .eq("game_id", game.id)
        .order("created_at", { ascending: true })

      if (chatError) {
        addDebugLog(`❌ Error fetching chat messages: ${chatError.message}`)
        return
      }

      if (messages) {
        const formattedMessages = messages.map((msg: any) => {
          const playerInfo = playerMap.get(msg.player_name)
          return {
            id: msg.id,
            player_name: msg.player_name,
            message: msg.message,
            player_id: playerInfo?.id || "",
            player_avatar: playerInfo?.avatar_id || "",
          }
        })
        addDebugLog(`Loaded chat messages: ${formattedMessages.length}`)
        setChatMessages(formattedMessages)
      }

      // Subscribe to new messages
      channel = supabase
        .channel(`game_chat:${game.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "game_chat",
            filter: `game_id=eq.${game.id}`,
          },
          async (payload) => {
            addDebugLog(`New chat message received: ${JSON.stringify(payload.new)}`)
            const newMsg = payload.new as any

            // Fetch player info for the new message
            const { data: playerData } = await supabase
              .from("game_players")
              .select("avatar_id, id")
              .eq("player_name", newMsg.player_name)
              .eq("game_id", game.id)
              .maybeSingle()

            setChatMessages((prev) => {
              // Prevent duplicates
              if (prev.find((m) => m.id === newMsg.id)) return prev
              return [
                ...prev,
                {
                  id: newMsg.id,
                  player_name: newMsg.player_name,
                  message: newMsg.message,
                  player_id: playerData?.id || "",
                  player_avatar: playerData?.avatar_id || "",
                },
              ]
            })
          },
        )
        .subscribe((status) => {
          addDebugLog(`Chat subscription status: ${status}`)
        })
    }

    setupChat()

    return () => {
      if (channel) {
        // Use the same supabase client instance for removing the channel
        supabase.removeChannel(channel)
      }
    }
  }, [gameCode]) // Removed chatMessages from dependencies to prevent loop

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleVote = async (voteType: "skip" | "extend") => {
    if (songEnded || !gameCode) return

    const supabase = createClient()
    if (!supabase) return

    const { data: game } = await supabase.from("games").select("id, current_round").eq("game_code", gameCode).single()
    if (!game) return

    const playerId = localStorage.getItem(`player_id_${gameCode}`)
    if (!playerId) return

    console.log("[v0] 🗳️ USER VOTING:", voteType)
    addDebugLog(`🗳️ Player voting: ${voteType}`)

    const { data: existingVote } = await supabase
      .from("player_votes")
      .select("*")
      .eq("game_id", game.id)
      .eq("player_id", playerId)
      .eq("round_number", game.current_round)
      .maybeSingle()

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Remove vote (toggle off)
        console.log("[v0] 🗑️ Removing vote (toggled off)")
        addDebugLog(`🗑️ Removing vote: ${voteType}`)

        await supabase.from("player_votes").delete().eq("id", existingVote.id)

        setUserVote(null)
      } else {
        // Switch vote
        console.log("[v0] 🔄 Switching vote from", existingVote.vote_type, "to", voteType)
        addDebugLog(`🔄 Changing: ${existingVote.vote_type} -> ${voteType}`)

        await supabase.from("player_votes").update({ vote_type: voteType }).eq("id", existingVote.id)

        setUserVote(voteType)
      }
    } else {
      // New vote
      console.log("[v0] ➕ Adding new vote:", voteType)
      addDebugLog(`➕ New vote: ${voteType}`)

      await supabase.from("player_votes").insert({
        game_id: game.id,
        player_id: playerId,
        round_number: game.current_round,
        vote_type: voteType,
      })

      setUserVote(voteType)
    }

    // Force immediate refetch after 100ms to ensure DB commit
    await new Promise((resolve) => setTimeout(resolve, 100))

    const { data: votes } = await supabase
      .from("player_votes")
      .select("vote_type")
      .eq("game_id", game.id)
      .eq("round_number", game.current_round)

    if (votes) {
      const skipCount = votes.filter((v) => v.vote_type === "skip").length
      const extendCount = votes.filter((v) => v.vote_type === "extend").length

      console.log("[v0] 🔥 IMMEDIATE REFETCH - Skip:", skipCount, "Extend:", extendCount)
      addDebugLog(`🔥 Immediate counts - Skip: ${skipCount}, Extend: ${extendCount}`)

      setSkipVotes(skipCount)
      setExtendVotes(extendCount)
    }
    // </CHANGE>

    console.log("[v0] ✅ Vote complete")
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !gameCode) return

    const supabase = createClient()
    if (!supabase) return

    const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()
    if (!game) return

    const playerId = localStorage.getItem(`player_id_${gameCode}`)
    if (!playerId) return

    const { data: player } = await supabase
      .from("game_players")
      .select("player_name, avatar_id")
      .eq("id", playerId)
      .single()

    addDebugLog(`Sending message: ${messageInput}`)
    const { error } = await supabase.from("game_chat").insert({
      game_id: game.id,
      player_name: player?.player_name || "Anonymous",
      message: messageInput,
    })

    if (error) {
      addDebugLog(`❌ Error sending message: ${error.message}`)
      return
    }

    addDebugLog("✅ Message sent successfully")
    setMessageInput("")
  }

  const handleEmojiClick = async (emoji: string) => {
    if (!gameCode) return

    const supabase = createClient()
    if (!supabase) return

    const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()
    if (!game) return

    const playerId = localStorage.getItem(`player_id_${gameCode}`)
    if (!playerId) return

    const { data: player } = await supabase
      .from("game_players")
      .select("player_name, avatar_id")
      .eq("id", playerId)
      .single()

    addDebugLog(`Sending emoji: ${emoji}`)
    await supabase.from("game_chat").insert({
      game_id: game.id,
      player_name: player?.player_name || "Anonymous",
      message: emoji,
    })

    const particleCount = 12
    for (let i = 0; i < particleCount; i++) {
      const particle = {
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

  // CRITICAL: Only animate yellow timer when song has actually started playing
  const progress = hasStartedPlayback ? ((30 - timeRemaining) / 30) * 100 : 0
  // </CHANGE>

  const svgSize = 330
  const strokeWidth = 4
  const radius = 24
  const halfStroke = strokeWidth / 2

  const createRoundedRectPath = () => {
    const x = halfStroke
    const y = halfStroke
    const width = svgSize - strokeWidth
    const height = svgSize - strokeWidth
    const r = radius

    return `
      M ${x + r} ${y}
      L ${x + width - r} ${y}
      Q ${x + width} ${y} ${x + width} ${y + r}
      L ${x + width} ${y + height - r}
      Q ${x + width} ${y + height} ${x + width - r} ${y + height}
      L ${x + r} ${y + height}
      Q ${x} ${y + height} ${x} ${y + height - r}
      L ${x} ${y + r}
      Q ${x} ${y} ${x + r} ${y}
      Z
    `
  }

  const path = createRoundedRectPath()
  const straightLength = (svgSize - strokeWidth - 2 * radius) * 4
  const arcLength = 2 * Math.PI * radius
  const pathLength = straightLength + arcLength

  const handleSkipToVoting = () => {
    router.push(`/playtime-name-vote?category=${encodeURIComponent(selectedCategory)}&code=${gameCode}`)
  }

  if (isLoadingPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black flex items-center justify-center">
        {/* Added debug panel to loading screen */}
        {SHOW_DEBUG && showDebug && debugInfo.length > 0 && (
          <div
            className="fixed top-2 left-2 right-2 z-[200] bg-red-600 text-white text-xs p-3 rounded-lg max-h-48 overflow-y-auto"
            onClick={() => setShowDebug(false)}
          >
            <div className="font-bold mb-1">🔴 DEBUG (tap to hide):</div>
            {debugInfo.map((log, i) => (
              <div key={i} className="font-mono">
                {log}
              </div>
            ))}
          </div>
        )}
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500 mx-auto mb-4" />
          <p className="text-white text-xl">Loading next song...</p>
          {retryCount > 0 && (
            <p className="text-white/60 text-sm mt-2">Attempt {retryCount + 1} of 10</p>
          )}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#000022] text-white flex items-center justify-center p-6">
        {SHOW_DEBUG && showDebug && debugInfo.length > 0 && (
          <div
            className="fixed top-2 left-2 right-2 z-[200] bg-red-600 text-white text-xs p-3 rounded-lg max-h-48 overflow-y-auto"
            onClick={() => setShowDebug(false)}
          >
            <div className="font-bold mb-1">🔴 DEBUG (tap to hide):</div>
            {debugInfo.map((log, i) => (
              <div key={i} className="font-mono">
                {log}
              </div>
            ))}
          </div>
        )}

        <div className="text-center max-w-md">
          <div className="text-2xl font-bold mb-2 text-red-400">Unable to load player data</div>
          <div className="text-lg text-white/70 mb-4">{loadError}</div>
          {loadError.includes("No Spotify devices") && (
            <div className="bg-[#0D113B] border-2 border-[#8BE1FF] rounded-xl p-4 mb-6 text-left">
              <div className="font-bold text-[#8BE1FF] mb-2">How to fix this:</div>
              <ol className="text-sm text-white/80 space-y-2 list-decimal list-inside">
                <li>Open the Spotify app on your phone or computer</li>
                <li>Play any song (you can pause it immediately)</li>
                <li>Wait a few seconds for the device to appear</li>
                <li>Click the Retry button below</li>
              </ol>
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={() => {
                setLoadError(null)
                setIsLoadingPlayer(true)
                setRetryCount(0)
                // setDeviceSearchAttempt(0) // This was removed as device searching is no longer a focus
              }}
              className="w-full px-6 py-3 bg-[#8BE1FF] text-[#000022] font-bold rounded-xl hover:bg-[#6CD9FF] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show transition state immediately when navigating away
  if (isTransitioning) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500 mx-auto mb-4" />
          <p className="text-white text-xl">Moving to rankings...</p>
        </div>
      </div>
    )
  }

  // CRITICAL: Don't render if wrong phase (prevents flicker during phase transitions)
  if (!isCorrectPhase && currentPhase) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500 mx-auto mb-4" />
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    )
  }

  // CRITICAL: Don't render if player has no song (prevents flicker during navigation)
  if (!playerData || !playerData.song_uri) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black flex items-center justify-center p-6">
        {/* Added debug panel to no player data screen */}
        {SHOW_DEBUG && showDebug && debugInfo.length > 0 && (
          <div
            className="fixed top-2 left-2 right-2 z-[200] bg-red-600 text-white text-xs p-3 rounded-lg max-h-48 overflow-y-auto"
            onClick={() => setShowDebug(false)}
          >
            <div className="font-bold mb-1">🔴 DEBUG (tap to hide):</div>
            {debugInfo.map((log, i) => (
              <div key={i} className="font-mono">
                {log}
              </div>
            ))}
          </div>
        )}
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500 mx-auto mb-4" />
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col">
      {SHOW_DEBUG && showDebug && debugInfo.length > 0 && (
        <div
          className="fixed top-2 left-2 right-2 z-[200] bg-red-600 text-white text-xs p-3 rounded-lg max-h-48 overflow-y-auto"
          onClick={() => setShowDebug(false)}
        >
          <div className="font-bold mb-1">🔴 DEBUG (tap to hide):</div>
          {debugInfo.map((log, i) => (
            <div key={i} className="font-mono">
              {log}
            </div>
          ))}
        </div>
      )}
      <header className="fixed top-[4.5rem] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000022] pb-4">
        <Link href="/playtime-name-vote">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 w-6 h-6 p-0">
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </Link>
        <h1
          className="text-[1.375rem] font-black text-center leading-tight bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D9EA)",
            animation: isAnimatingIn ? "fadeInUp 0.6s ease-out" : "none",
          }}
        >
          IT'S PLAYTIME, ROUND {currentRound}
        </h1>
        <div className="w-6 h-6" />
      </header>

      {needsUserInteraction && isHost && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-6">
          <div className="bg-[#0D113B] rounded-2xl p-8 max-w-md w-full border-2 border-[#8BE1FF] text-center">
            <div className="text-6xl mb-6">🎵</div>
            <h3 className="text-3xl font-bold text-white mb-4">Host Controls</h3>
            {isMobile && !spotifyDeviceId ? (
              <>
                <p className="text-lg text-white/80 mb-4">Opening Spotify on your phone...</p>
                <a
                  href="spotify://"
                  className="block w-full px-8 py-5 text-2xl font-bold text-white rounded-2xl mb-3 text-center"
                  style={{
                    background: "linear-gradient(135deg, #1DB954 0%, #1ED760 100%)",
                    border: "3px solid #1ED760",
                    boxShadow: "0 8px 0 0 #117A37",
                    textDecoration: "none",
                  }}
                  onClick={() => addDebugLog("📱 Opening Spotify app via deep link")}
                >
                  📱 Open Spotify
                </a>
                <p className="text-sm text-white/60">Detecting your device automatically...</p>
              </>
            ) : (
              <p className="text-lg text-white/80 mb-6">
                {spotifyDeviceId && spotifyDeviceName
                  ? `✓ Connected! Playing on: ${spotifyDeviceName}`
                  : spotifyDeviceId
                    ? "✓ Connected! Tap to start."
                    : "Connecting to Spotify..."}
              </p>
            )}
            <button
              onClick={handleStartPlayback}
              disabled={!spotifyDeviceId}
              className="w-full px-8 py-5 text-2xl font-bold text-white rounded-2xl transition-opacity"
              style={{
                background: spotifyDeviceId
                  ? "linear-gradient(135deg, #43D4AF 0%, #14B8A6 100%)"
                  : "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)",
                border: spotifyDeviceId ? "3px solid #D0FFF3" : "3px solid #9CA3AF",
                boxShadow: spotifyDeviceId ? "0 8px 0 0 #066B5C" : "0 8px 0 0 #374151",
                opacity: spotifyDeviceId ? 1 : 0.6,
                cursor: spotifyDeviceId ? "pointer" : "wait",
              }}
            >
              {spotifyDeviceId ? (
                <>
                  <svg className="w-8 h-8 inline mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Start Music
                </>
              ) : (
                <>
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin inline-block mr-2" />
                  {isMobile ? "Waiting for Spotify..." : "Connecting..."}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showOverlay && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            style={{
              background: "rgba(20, 24, 38, 0.5)",
            }}
          />
          <div
            className="fixed inset-0 z-[101] flex items-center justify-center overflow-hidden"
            style={{
              animation: "stampIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
            }}
          >
            {hasReachedNaturalEnd ? (
              <div className="text-center">
                <div
                  className="text-[4rem] font-black mb-4"
                  style={{
                    background: "linear-gradient(to right, #FFD700, #FFA500)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    textShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  🎉 CONGRATULATIONS! 🎉
                </div>
                <div className="text-[2rem] font-bold text-white">Song completed!</div>
                <div className="text-[1.5rem] text-[#FFD700] mt-2">+10 Bonus Points</div>
              </div>
            ) : (
              <Image
                src={voteResult === "extend" ? "/extend.svg" : "/skip.svg"}
                alt={voteResult === "extend" ? "EXTEND" : "SKIP"}
                width={488}
                height={339}
                style={{
                  width: "488px",
                  height: "auto",
                }}
              />
            )}
          </div>
        </>
      )}
      <div
        className="fixed left-0 right-0 bottom-0 overflow-y-auto"
        style={{
          top: "8.75rem",
          borderTopLeftRadius: "1.5rem",
          borderTopRightRadius: "1.5rem",
          borderTop: "0.1875rem solid rgb(185, 243, 255)",
          background: "#0D113B",
        }}
      >
        <div style={{ padding: "1.5rem 1.5rem 1.5rem" }}>
          <h2
            className="text-[1.75rem] font-extrabold text-center leading-tight bg-clip-text text-transparent mb-4"
            style={{
              backgroundImage: "linear-gradient(to right, #FFF1AB, #DC9C00)",
              animation: isAnimatingIn ? "fadeInUp 0.6s ease-out 0.1s both" : "none",
            }}
          >
            Song {currentSongNumber}
            {showNames ? ` - ${playerData?.player_name}` : ""}
          </h2>

          <div
            className="bg-[#000022] flex items-center gap-0 mb-6"
            style={{
              height: "4rem",
              borderRadius: "1rem",
              paddingRight: "1rem",
              animation: isAnimatingIn ? "fadeInUp 0.6s ease-out 0.2s both" : "none",
            }}
          >
            <Image
              src={playerData?.album_cover_url || "/placeholder.svg"}
              alt="Album cover"
              width={64}
              height={64}
              style={{
                borderRadius: "1rem",
                flexShrink: 0,
                width: "4rem",
                height: "4rem",
              }}
            />
            <div className="flex-1 ml-4">
              <h3 className="text-[1.25rem] font-medium text-white mb-0 leading-tight">{playerData?.song_title}</h3>
              <p className="text-[1rem] font-light text-[#D2FFFF] leading-tight">{playerData?.song_artist}</p>
            </div>
          </div>

          <div
            className="flex items-center justify-center mb-6"
            style={{
              animation: isAnimatingIn ? "scaleIn 0.8s ease-out 0.3s both" : "none",
            }}
          >
            <div className="relative" style={{ maxWidth: "20.625rem", width: "100%" }}>
              <svg
                className="absolute inset-0 w-full h-full"
                style={{ transform: "rotate(0deg)", zIndex: 2, pointerEvents: "none" }}
                viewBox={`0 0 ${svgSize} ${svgSize}`}
                preserveAspectRatio="none"
              >
                <path d={path} fill="none" stroke="#4A5FD9" strokeWidth={strokeWidth} />
                <path
                  d={path}
                  fill="none"
                  stroke="#FFC700"
                  strokeWidth={strokeWidth}
                  strokeDasharray={pathLength}
                  strokeDashoffset={pathLength - (progress / 100) * pathLength}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>

              <div
                className="relative overflow-hidden"
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  maxWidth: "20.625rem",
                  maxHeight: "20.625rem",
                  borderRadius: "1.5rem",
                }}
              >
                <Image
                  src={playerData?.album_cover_url || "/placeholder.svg"}
                  alt="Album artwork"
                  fill
                  className="object-cover"
                />

                <div
                  className="absolute bottom-0 left-0 right-0"
                  style={{
                    height: "4.625rem",
                    background: "linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%)",
                    zIndex: 1,
                  }}
                />

                <div
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10"
                  style={{
                    textShadow: "0 0.125rem 0.25rem rgba(0, 0, 0, 0.8)",
                  }}
                >
                  <div className="text-[2rem] font-extrabold text-white leading-none">{formatTime(timeRemaining)}</div>
                </div>

                <div
                  className="absolute bottom-2 right-2 z-10 flex items-end justify-start"
                  style={{
                    width: "6.5625rem",
                    height: "6.5625rem",
                  }}
                >
                  <Image
                    src={getAvatarImage(playerData?.avatar_id) || "/placeholder.svg"}
                    alt={`${playerData?.player_name}'s avatar`}
                    width={80}
                    height={80}
                    className="object-contain"
                    style={{
                      width: "5rem",
                      height: "5rem",
                      filter: "drop-shadow(0 0.125rem 0.25rem rgba(0, 0, 0, 0.8))",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className="flex gap-4 mb-3"
            style={{
              marginTop: "-5rem",
              position: "relative",
              zIndex: 50,
              animation: isAnimatingIn ? "fadeInUp 0.6s ease-out 0.5s both" : "none",
            }}
          >
            <div className="flex-1 flex flex-col items-start gap-0">
              <div
                className="flex items-center justify-center mb-0"
                style={{
                  width: "70px",
                  height: "70px",
                  borderRadius: "50%",
                  background: "#FFD0F5",
                  position: "relative",
                }}
              >
                <svg
                  className="absolute inset-0"
                  style={{ width: "70px", height: "70px", transform: "rotate(-90deg)" }}
                  viewBox="0 0 70 70"
                >
                  <defs>
                    <path id="skipCircle" d="M 35 10 A 25 25 0 1 1 35 60 A 25 25 0 1 1 35 10" fill="none" />
                  </defs>
                  <text fontSize="7" fill="#7A0066" fontWeight="700" letterSpacing="1.5">
                    <textPath href="#skipCircle" startOffset="50%" textAnchor="middle">
                      TOTAL PLAYER VOTES
                    </textPath>
                  </text>
                </svg>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: "#FFD0F5",
                  }}
                >
                  <span
                    className="text-[48px] font-bold"
                    style={{
                      color: "#FF58C9",
                      textShadow: "2px 2px 0px #7A0066",
                    }}
                  >
                    {skipVotes}
                  </span>
                </div>
              </div>
              {/* </CHANGE> */}
              <button
                onClick={() => handleVote("skip")}
                disabled={songEnded}
                className={`text-[16px] font-bold text-white transition-transform ${
                  userVote === "skip" ? "scale-95" : "active:scale-95"
                } ${songEnded ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{
                  height: "48px",
                  borderRadius: "24px",
                  maxWidth: "156px",
                  width: "156px",
                  border: "2px solid #FFD0F5",
                  background: "#FF58C9",
                  boxShadow: "0px 4px 0px 0px #7A0066",
                  opacity: songEnded ? 0.5 : userVote === "skip" ? 1 : userVote === null ? 1 : 0.5,
                }}
              >
                Skip
              </button>
            </div>

            <div className="flex-1 flex flex-col items-end gap-0">
              <div
                className="flex items-center justify-center mb-0"
                style={{
                  width: "70px",
                  height: "70px",
                  borderRadius: "50%",
                  background: "#D0FFF3",
                  position: "relative",
                }}
              >
                <svg
                  className="absolute inset-0"
                  style={{ width: "70px", height: "70px", transform: "rotate(-90deg)" }}
                  viewBox="0 0 70 70"
                >
                  <defs>
                    <path id="extendCircle" d="M 35 10 A 25 25 0 1 1 35 60 A 25 25 0 1 1 35 10" fill="none" />
                  </defs>
                  <text fontSize="7" fill="#066B5C" fontWeight="700" letterSpacing="1.5">
                    <textPath href="#extendCircle" startOffset="50%" textAnchor="middle">
                      TOTAL PLAYER VOTES
                    </textPath>
                  </text>
                </svg>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: "#D0FFF3",
                  }}
                >
                  <span
                    className="text-[48px] font-bold"
                    style={{
                      color: "#43D4AF",
                      textShadow: "2px 2px 0px #066B5C",
                    }}
                  >
                    {extendVotes}
                  </span>
                </div>
              </div>
              {/* </CHANGE> */}
              <button
                onClick={() => handleVote("extend")}
                disabled={songEnded}
                className={`text-[16px] font-bold text-white transition-transform ${
                  userVote === "extend" ? "scale-95" : "active:scale-95"
                } ${songEnded ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{
                  height: "48px",
                  borderRadius: "24px",
                  maxWidth: "156px",
                  width: "156px",
                  border: "2px solid #D0FFF3",
                  background: "#43D4AF",
                  boxShadow: "0px 4px 0px 0px #066B5C",
                  opacity: songEnded ? 0.5 : userVote === "extend" ? 1 : userVote === null ? 1 : 0.5,
                }}
              >
                Extend
              </button>
            </div>
          </div>

          <div
            className="grid grid-cols-2 gap-4 text-[0.6875rem] text-white/70 mb-6"
            style={{
              animation: isAnimatingIn ? "fadeInUp 0.6s ease-out 0.6s both" : "none",
            }}
          >
            <p className="text-center">Song is skipped if a majority of players select.</p>
            <p className="text-center">Song is extended if a majority of players select.</p>
          </div>

          <div
            className="flex gap-2 mb-3 overflow-x-auto py-1 justify-center"
            style={{
              animation: isAnimatingIn ? "fadeInUp 0.6s ease-out 0.7s both" : "none",
            }}
          >
            {["❤️", "🔥", "😭", "✨", "😂", "🎉", "👍", "🤣", "😎", "👀", "🙌"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="text-2xl hover:scale-110 transition-transform flex-shrink-0"
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsChatOpen(true)}
            className="w-full h-[3rem] text-[1rem] font-semibold rounded-[0.75rem] flex items-center justify-center gap-2 bg-transparent text-white hover:bg-white/5 transition-colors"
            style={{
              border: "1px solid #C7D2FF",
              animation: isAnimatingIn ? "fadeInUp 0.6s ease-out 0.8s both" : "none",
            }}
          >
            Yay or Nay? Lets discuss 💬
          </button>
        </div>
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

          <div className="absolute top-[36px] left-0 right-0 z-40 px-6">
            <h2
              className="text-[1.75rem] font-extrabold text-center leading-tight bg-clip-text text-transparent mb-4"
              style={{
                backgroundImage: "linear-gradient(to right, #FFF1AB, #DC9C00)",
              }}
            >
              Song {currentSongNumber}
              {showNames ? ` - ${playerData?.player_name}` : ""}
            </h2>

            <div
              className="bg-[#000022] flex items-center gap-0"
              style={{
                height: "4rem",
                borderRadius: "1rem",
                paddingRight: "1rem",
              }}
            >
              <Image
                src={playerData?.album_cover_url || "/placeholder.svg"}
                alt="Album cover"
                width={64}
                height={64}
                style={{
                  borderRadius: "1rem",
                  flexShrink: 0,
                  width: "4rem",
                  height: "4rem",
                }}
              />
              <div className="flex-1 ml-4">
                <h3 className="text-[1.25rem] font-medium text-white mb-0 leading-tight">{playerData?.song_title}</h3>
                <p className="text-[1rem] font-light text-[#D2FFFF] leading-tight">{playerData?.song_artist}</p>
              </div>
            </div>
          </div>

          <div className="h-full flex flex-col pt-[200px] pb-[280px]">
            <div ref={chatMessagesRef} className="flex-1 overflow-y-auto px-6 space-y-3">
              {chatMessages.map((msg) => {
                const isEmojiOnly = /^[\p{Emoji}\s]+$/u.test(msg.message.trim())

                return (
                  <div key={msg.id} className="flex items-start gap-3 flex-row-reverse w-full">
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                      <img
                        src={getAvatarImage(msg.player_avatar) || "/placeholder.svg"}
                        alt={msg.player_name}
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                    {/* </CHANGE> */}

                    {isEmojiOnly ? (
                      <div className="flex-1 min-w-0">
                        <div className="inline-block bg-transparent px-4 py-2 rounded-2xl ml-auto">
                          <span className="text-[14px] font-medium" style={{ color: "#C7D2FF" }}>
                            {msg.player_name} sent an emoji {msg.message}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
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
              })}
            </div>
          </div>

          <div className="fixed left-0 right-0 bg-[#0D113B] px-6" style={{ bottom: "36px" }}>
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              {["❤️", "🔥", "😭", "✨", "😂", "🎉", "👍", "🤣", "😎", "👀", "🙌"].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-2xl hover:scale-110 transition-transform flex-shrink-0"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
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

            <div className="flex gap-3">
              <button
                onClick={() => handleVote("skip")}
                disabled={songEnded}
                className={`flex-1 flex items-center justify-between text-[1.125rem] font-bold text-white transition-all ${
                  userVote === "skip" ? "scale-95" : "active:scale-95"
                } ${songEnded ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{
                  height: "3.5rem",
                  borderRadius: "1.75rem",
                  border: "0.125rem solid #FFD0F5",
                  background: userVote === "skip" ? "#D94AA8" : "#FF58C9",
                  boxShadow: "0 0.25rem 0 0 #7A0066",
                  paddingLeft: "1.5rem",
                  paddingRight: "1rem",
                }}
              >
                <span>Skip</span>
                <div
                  className="flex items-center justify-center text-[1.25rem] font-extrabold"
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    borderRadius: "50%",
                    border: "0.125rem solid #FFD0F5",
                    background: "#FFD0F5",
                    color: "#7A0066",
                  }}
                >
                  {skipVotes}
                </div>
              </button>

              <button
                onClick={() => handleVote("extend")}
                disabled={songEnded}
                className={`flex-1 flex items-center justify-between text-[1.125rem] font-bold text-white transition-all ${
                  userVote === "extend" ? "scale-95" : "active:scale-95"
                } ${songEnded ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{
                  height: "3.5rem",
                  borderRadius: "1.75rem",
                  border: "0.125rem solid #D0FFF3",
                  background: userVote === "extend" ? "#3AB89A" : "#43D4AF",
                  boxShadow: "0 0.25rem 0 0 #066B5C",
                  paddingLeft: "1.5rem",
                  paddingRight: "1rem",
                }}
              >
                <span>Extend</span>
                <div
                  className="flex items-center justify-center text-[1.25rem] font-extrabold"
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    borderRadius: "50%",
                    border: "0.125rem solid #D0FFF3",
                    background: "#D0FFF3",
                    color: "#066B5C",
                  }}
                >
                  {extendVotes}
                </div>
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
                ["--scale" as any]: size,
                ["--rotation" as any]: `${rotation}deg`,
                animation: `emojiFloat ${duration}s ease-out forwards`,
              }}
            >
              {particle.emoji}
            </div>
          )
        })}
      </div>
    </div>
  )
}
