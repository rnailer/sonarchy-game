"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Search, Volume2, VolumeX, Music, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { savePlayerData, getGameState } from "@/lib/game-state"
import { createClient } from "@/lib/supabase/client"
import { useServerTimer } from "@/lib/hooks/use-server-timer"
import { usePhaseSync } from '@/lib/hooks/use-phase-sync'
import { setGamePhase } from '@/lib/game-phases'

import { checkDuplicateSpotifyAccounts } from "@/app/actions/spotify"

const SHOW_DEBUG = false

interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string }[]
  }
  preview_url: string | null
  uri: string
  duration_ms?: number
  isAlreadyPicked?: boolean
  pickedByPlayer?: string
}

export default function PickYourSong() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const playerName = searchParams.get("player") || "Rich"
  const gameCode = searchParams.get("code")

  const [gameId, setGameId] = useState<string>("")
  const [currentRound, setCurrentRound] = useState<number>(1)
  const [category, setCategory] = useState<string>("Songs about cars or driving")
  const timerStartedRef = useRef(false)
  const hasHandledExpiration = useRef(false)
  const [countdown, setCountdown] = useState<number | "GO" | null>(3)

  // Phase sync for song selection
  const { currentPhase, isLoading, isCorrectPhase } = usePhaseSync({
    gameCode: gameCode || "",
    gameId,
    expectedPhase: 'song_selection',
    expectedRound: currentRound,
    disabled: !gameCode || !gameId
  })

  // Server-synchronized timer
  const { timeRemaining, isExpired, startTimer } = useServerTimer({
    gameId,
    timerType: "song_selection",
    onExpire: async () => {
      if (hasHandledExpiration.current) {
        console.log("[v0] ⏰ Timer expiration already handled on this device, skipping")
        return
      }
      hasHandledExpiration.current = true

      console.log("[v0] ⏰ Song selection timer expired")

      // Try to set phase - if it's already at players_locked_in, that's fine
      try {
        await setGamePhase(gameId, 'players_locked_in')
        console.log("[v0] ✅ Phase transitioned to players_locked_in")
      } catch (error) {
        console.error("[v0] ❌ Failed to transition phase:", error)
      }
    },
    enabled: !!gameId,
  })

  const [searchInput, setSearchInput] = useState("")
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null)
  const [pickedSongs, setPickedSongs] = useState<Set<string>>(new Set())
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const isProcessingCallback = useRef(false)
  const hasProcessedCallback = useRef(false)

  useEffect(() => {
    setDebugInfo([
      `✅ SUCCESS! pick-your-song page loaded!`,
      `📝 Game Code: ${searchParams.get("code") || "MISSING"}`,
      `🎵 Category: ${category}`,
      `👤 Player: ${playerName}`,
      `🔗 Full URL: ${window.location.href}`,
      `✓ Page is working correctly!`,
    ])
    console.log("[v0] Pick Your Song Page - Successfully loaded!")
  }, [])

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

  // Countdown animation effect (3-2-1-GO)
  useEffect(() => {
    if (countdown === null) return

    if (countdown === "GO") {
      // Show "GO" for 500ms, then enable search
      const timer = setTimeout(() => {
        console.log("[v0] ⏱️ Countdown complete! Song selection enabled")
        setCountdown(null)
      }, 500)
      return () => clearTimeout(timer)
    } else if (typeof countdown === "number" && countdown > 0) {
      // Countdown: 3, 2, 1
      const timer = setTimeout(() => {
        if (countdown === 1) {
          setCountdown("GO")
        } else {
          setCountdown(countdown - 1)
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Fetch gameId and start timer
  useEffect(() => {
    const loadGameData = async () => {
      if (!gameCode) return

      const supabase = createClient()
      const { data: game } = await supabase
        .from("games")
        .select("id, current_round")
        .eq("game_code", gameCode)
        .maybeSingle()

      if (game) {
        setGameId(game.id)
        setCurrentRound(game.current_round || 1)
      }
    }

    loadGameData()
  }, [gameCode])

  // Self-reset: Clear own song data when entering song selection for a new round
  // This fixes RLS issue where song owner can't reset other players' data
  useEffect(() => {
    const selfResetSongData = async () => {
      if (!gameCode || !gameId) return

      const supabase = createClient()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get current player and game round
      const { data: player } = await supabase
        .from("game_players")
        .select("id, song_uri, song_played")
        .eq("game_id", gameId)
        .eq("user_id", user.id)
        .single()

      if (!player) return

      // Get current round from game
      const { data: game } = await supabase
        .from("games")
        .select("current_round")
        .eq("id", gameId)
        .single()

      // If player has song data (from previous round), clear it
      // This ensures clean slate for new round song selection
      if (player.song_uri || player.song_played) {
        console.log("[v0] 🧹 Self-resetting stale song data for round", game?.current_round)
        console.log("[v0]   - Old song_uri:", player.song_uri)
        console.log("[v0]   - Old song_played:", player.song_played)

        const { error } = await supabase
          .from("game_players")
          .update({
            song_uri: null,
            song_title: null,
            song_artist: null,
            song_preview_url: null,
            album_cover_url: null,
            song_duration_ms: null,
            song_played: false,
          })
          .eq("id", player.id)

        if (error) {
          console.error("[v0] ❌ Self-reset failed:", error)
        } else {
          console.log("[v0] ✅ Self-reset complete - ready for new song selection")
        }
      }
    }

    selfResetSongData()
  }, [gameCode, gameId])

  // Start the server timer once gameId is available
  useEffect(() => {
    if (gameId && !timerStartedRef.current) {
      timerStartedRef.current = true
      startTimer(60).then(() => {
        console.log("[v0] ⏱️ Started 60s song selection timer")
      }).catch((err) => {
        console.error("[v0] Failed to start song selection timer:", err)
      })
    }
  }, [gameId, startTimer])

  useEffect(() => {
    const fetchPickedSongs = async () => {
      const gameCode = searchParams.get("code")
      if (!gameCode) return

      const supabase = createClient()
      if (!supabase) return

      const { data: game } = await supabase.from("games").select("id, current_category").eq("game_code", gameCode).single()

      if (game) {
        // Set category from database (single source of truth)
        if (game.current_category) {
          setCategory(game.current_category)
          console.log("[v0] 📂 Category from database:", game.current_category)
        }

        const fetchSongs = async () => {
          const { data: players } = await supabase
            .from("game_players")
            .select("song_uri, player_name")
            .eq("game_id", game.id)
            .not("song_uri", "is", null)

          if (players) {
            const uris = new Set(players.map((p) => p.song_uri))
            setPickedSongs(uris)
            console.log("[v0] Already picked songs:", Array.from(uris))
          }
        }

        await fetchSongs()

        // Subscribe to realtime updates for picked songs
        const channel = supabase
          .channel(`game_${game.id}_songs`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "game_players",
              filter: `game_id=eq.${game.id}`,
            },
            (payload: any) => {
              console.log("[v0] Song picked by another player:", payload.new.song_uri)
              if (payload.new.song_uri) {
                setPickedSongs((prev) => new Set([...prev, payload.new.song_uri]))

                // Update search results to mark newly picked song
                setSearchResults((prev) =>
                  prev.map((track) =>
                    track.uri === payload.new.song_uri
                      ? { ...track, isAlreadyPicked: true, pickedByPlayer: payload.new.player_name }
                      : track,
                  ),
                )
              }
            },
          )
          .subscribe((status) => {
            console.log("[v0] Song subscription status:", status)
          })

        return () => {
          supabase.removeChannel(channel)
        }
      }
    }

    fetchPickedSongs()
  }, [searchParams])

  useEffect(() => {
    async function checkTokens() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const initialDebug = [
        `✅ Page loaded successfully`,
        `📝 Game Code: ${searchParams.get("code") || "MISSING"}`,
        `🎵 Category: ${category}`,
        `👤 Player: ${playerName}`,
      ]

      if (user) {
        initialDebug.push(`✅ User authenticated: ${user.id}`)

        const localAccessToken = localStorage.getItem("spotify_access_token")
        const localRefreshToken = localStorage.getItem("spotify_refresh_token")
        const localExpiry = localStorage.getItem("spotify_token_expiry")

        const { data: profile, error } = await supabase
          .from("user_profiles")
          .select("spotify_access_token, spotify_refresh_token, spotify_token_expires_at")
          .eq("user_id", user.id)
          .maybeSingle()

        if (error) {
          initialDebug.push(`❌ Error fetching profile: ${error.message}`)
        }

        if (localAccessToken && localRefreshToken && localExpiry) {
          initialDebug.push(`✅ Spotify tokens found in localStorage`)

          if (!profile?.spotify_access_token) {
            initialDebug.push(`🔄 Syncing localStorage tokens to database...`)
            const { error: syncError } = await supabase.from("user_profiles").upsert({
              user_id: user.id,
              spotify_access_token: localAccessToken,
              spotify_refresh_token: localRefreshToken,
              spotify_token_expires_at: new Date(Number.parseInt(localExpiry)).toISOString(),
            })

            if (syncError) {
              initialDebug.push(`❌ Failed to sync tokens to database: ${syncError.message}`)
            } else {
              initialDebug.push(`✅ Tokens synced to database successfully`)
            }
          }

          const expiresAt = new Date(Number.parseInt(localExpiry))
          const now = new Date()
          const isExpired = expiresAt <= now
          initialDebug.push(`🕐 Token expires: ${expiresAt.toLocaleTimeString()}`)
          initialDebug.push(`🕐 Current time: ${now.toLocaleTimeString()}`)
          initialDebug.push(isExpired ? `❌ Token is EXPIRED` : `✅ Token is valid`)
        } else if (profile?.spotify_access_token) {
          initialDebug.push(`✅ Spotify tokens found in database`)
          initialDebug.push(`🔄 Syncing database tokens to localStorage...`)

          localStorage.setItem("spotify_access_token", profile.spotify_access_token)
          localStorage.setItem("spotify_refresh_token", profile.spotify_refresh_token)
          localStorage.setItem("spotify_token_expiry", new Date(profile.spotify_token_expires_at).getTime().toString())
          initialDebug.push(`✅ Tokens synced to localStorage`)

          const expiresAt = new Date(profile.spotify_token_expires_at)
          const now = new Date()
          const isExpired = expiresAt <= now
          initialDebug.push(`🕐 Token expires: ${expiresAt.toLocaleTimeString()}`)
          initialDebug.push(`🕐 Current time: ${now.toLocaleTimeString()}`)
          initialDebug.push(isExpired ? `❌ Token is EXPIRED` : `✅ Token is valid`)
        } else {
          initialDebug.push(`❌ No Spotify tokens found in localStorage or database`)
        }
      } else {
        initialDebug.push(`❌ User not authenticated`)
      }

      setDebugInfo(initialDebug)
      console.log("[v0] Token check complete:", initialDebug)
    }

    checkTokens()
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchInput.trim()) {
        handleSearch()
      } else {
        setSearchResults([])
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchInput])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleSearch = async () => {
    if (!searchInput.trim()) return

    setIsSearching(true)
    console.log("[v0] Starting Spotify search for:", searchInput)

    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchInput)}`)

      console.log("[v0] Spotify search response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Spotify search failed:", errorData)

        setDebugInfo((prev) => [
          ...prev,
          `❌ Search failed: ${response.status}`,
          `❌ Error: ${errorData.error || "Unknown error"}`,
          `🔄 Redirecting to profile...`,
        ])

        const gameCode = searchParams.get("code")
        if (gameCode) {
          const myPlayerId = localStorage.getItem(`player_id_${gameCode}`)
          localStorage.setItem(
            "return_to_game",
            JSON.stringify({
              gameCode,
              playerId: myPlayerId,
              page: "pick-your-song",
              category,
              playerName,
              timestamp: Date.now(),
            }),
          )
        }

        toast({
          title: "Spotify connection required",
          description: "Redirecting to Profile Settings to reconnect...",
          variant: "destructive",
        })

        setTimeout(() => {
          router.push("/profile-setup")
        }, 2000)

        setIsSearching(false)
        return
      }

      const data = await response.json()
      console.log("[v0] Spotify search results:", data.tracks?.length || 0, "tracks")

      setDebugInfo((prev) => [...prev, `✅ Search successful: ${data.tracks?.length || 0} tracks found`])

      if (!data.tracks || data.tracks.length === 0) {
        toast({
          title: "No results found",
          description: "Try a different search term",
        })
      }

      const tracksWithPickedStatus = (data.tracks || []).map((track: SpotifyTrack) => ({
        ...track,
        isAlreadyPicked: pickedSongs.has(track.uri),
      }))

      setSearchResults(tracksWithPickedStatus)
    } catch (error) {
      console.error("[v0] Search error:", error)

      setDebugInfo((prev) => [
        ...prev,
        `❌ Search exception: ${error instanceof Error ? error.message : "Unknown error"}`,
      ])

      toast({
        title: "Search failed",
        description: "Please try again or check your connection",
        variant: "destructive",
      })
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleTrackSelect = (track: SpotifyTrack) => {
    if (track.isAlreadyPicked) {
      toast({
        title: "Song already picked",
        description: `${track.pickedByPlayer || "Another player"} has already selected this song.`,
        variant: "destructive",
      })
      return
    }

    setSelectedTrack(track)

    const state = getGameState()
    const playerId = Object.keys(state.players)[0] || "player1"

    savePlayerData(playerId, {
      songTitle: track.name,
      songArtist: track.artists.map((a) => a.name).join(", "),
      albumCover: track.album.images[0]?.url || "",
      songUri: track.uri,
      songPreviewUrl: track.preview_url || undefined,
      songDurationMs: track.duration_ms,
    })

    console.log("[v0] Song auto-saved on selection:", {
      title: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      uri: track.uri,
      playerId,
    })
  }

  const handleConfirmPick = async () => {
    if (!selectedTrack) {
      console.log("[v0] ❌ No track selected")
      toast({
        title: "No song selected",
        description: "Please select a song first",
        variant: "destructive",
      })
      return
    }

    const gameCode = searchParams.get("code")
    const supabase = createClient()

    console.log("[v0] 🎯 ========================================")
    console.log("[v0] 🎯 CONFIRM PICK STARTED")
    console.log("[v0] 🎯 ========================================")
    console.log("[v0] 📝 Game Code:", gameCode)
    console.log("[v0] 🎵 Selected Track:", {
      name: selectedTrack.name,
      artist: selectedTrack.artists.map((a) => a.name).join(", "),
      uri: selectedTrack.uri,
    })

    if (!supabase) {
      console.error("[v0] ❌ Supabase client not available")
      toast({
        title: "Error",
        description: "Database connection failed",
        variant: "destructive",
      })
      return
    }

    if (!gameCode) {
      console.error("[v0] ❌ No game code")
      toast({
        title: "Error",
        description: "Game code missing",
        variant: "destructive",
      })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    console.log("[v0] 🔐 Authenticated user:", user?.id || "NOT AUTHENTICATED")

    const storageKey = `player_id_${gameCode}`
    console.log("[v0] 🔍 ========================================")
    console.log("[v0] 🔍 LOCALSTORAGE DEBUGGING")
    console.log("[v0] 🔍 ========================================")
    console.log("[v0] 🔑 Storage key:", storageKey)
    console.log("[v0] 📦 All localStorage keys:", Object.keys(localStorage))
    console.log("[v0] 📦 All localStorage values:")
    Object.keys(localStorage).forEach((key) => {
      console.log(`[v0]     ${key}: ${localStorage.getItem(key)}`)
    })

    const myPlayerId = localStorage.getItem(storageKey)
    console.log("[v0] 👤 Player ID from localStorage:", myPlayerId)

    if (!myPlayerId) {
      console.error("[v0] ❌ ========================================")
      console.error("[v0] ❌ NO PLAYER ID IN LOCALSTORAGE")
      console.error("[v0] ❌ ========================================")
      console.error("[v0] ❌ This means the player was never properly added to the game")
      console.error("[v0] ❌ User needs to rejoin the game from the lounge")
      toast({
        title: "Session Error",
        description: "Player session not found. Please rejoin the game from the lounge.",
        variant: "destructive",
        duration: 10000,
      })

      setTimeout(() => {
        router.push(`/game-lounge?code=${gameCode}&join=true`)
      }, 3000)
      return
    }

    console.log("[v0] 🔍 Verifying player exists in database...")
    console.log("[v0] 🔍 Query: SELECT * FROM game_players WHERE id =", myPlayerId)

    const { data: existingPlayer, error: checkError } = await supabase
      .from("game_players")
      .select("*")
      .eq("id", myPlayerId)
      .maybeSingle()

    console.log("[v0] 📊 ========================================")
    console.log("[v0] 📊 PLAYER VERIFICATION RESULT")
    console.log("[v0] 📊 ========================================")
    console.log("[v0] 📊 Player found:", !!existingPlayer)
    if (existingPlayer) {
      console.log("[v0] 📊 Player data:")
      console.log("[v0] 📊   - ID:", existingPlayer.id)
      console.log("[v0] 📊   - Name:", existingPlayer.player_name)
      console.log("[v0] 📊   - Game ID:", existingPlayer.game_id)
      console.log("[v0] 📊   - User ID:", existingPlayer.user_id || "NULL")
      console.log("[v0] 📊   - Current song:", existingPlayer.song_uri || "NONE")
      if (user && existingPlayer.user_id !== user.id) {
        console.error("[v0] ⚠️ WARNING: Player user_id doesn't match authenticated user!")
        console.error("[v0] ⚠️   - Player user_id:", existingPlayer.user_id)
        console.error("[v0] ⚠️   - Authenticated user:", user.id)
        console.error("[v0] ⚠️ This will cause RLS policy to block the UPDATE")
      }
    }
    console.log("[v0] 📊 Check error:", checkError)

    if (checkError) {
      console.error("[v0] ❌ Database error checking player:", checkError)
      toast({
        title: "Database Error",
        description: `Failed to verify player: ${checkError.message}`,
        variant: "destructive",
      })
      return
    }

    if (!existingPlayer) {
      console.error("[v0] ❌ ========================================")
      console.error("[v0] ❌ PLAYER NOT FOUND IN DATABASE")
      console.error("[v0] ❌ ========================================")
      console.error("[v0] ❌ Player ID:", myPlayerId)
      console.error("[v0] ❌ This means the player record was deleted or never created")
      toast({
        title: "Player Not Found",
        description: "Your player record is missing. Please rejoin the game from the lounge.",
        variant: "destructive",
        duration: 10000,
      })

      localStorage.removeItem(storageKey)
      setTimeout(() => {
        router.push(`/game-lounge?code=${gameCode}&join=true`)
      }, 3000)
      return
    }

    if (pickedSongs.has(selectedTrack.uri)) {
      console.log("[v0] ❌ Song already picked by another player")
      toast({
        title: "Song already picked",
        description: "Another player selected this song. Please choose a different one.",
        variant: "destructive",
      })
      setSelectedTrack(null)
      return
    }

    console.log("[v0] 💾 ========================================")
    console.log("[v0] 💾 ATTEMPTING DATABASE UPDATE")
    console.log("[v0] 💾 ========================================")

    const updateData = {
      song_title: selectedTrack.name,
      song_artist: selectedTrack.artists.map((a) => a.name).join(", "),
      song_uri: selectedTrack.uri,
      song_preview_url: selectedTrack.preview_url,
      album_cover_url: selectedTrack.album.images[0]?.url || null,
      song_duration_ms: selectedTrack.duration_ms || null,
    }

    console.log("[v0] 📊 Update data:", JSON.stringify(updateData, null, 2))
    console.log("[v0] 🎯 Updating player ID:", myPlayerId)
    console.log("[v0] 🔐 RLS Context:")
    console.log("[v0] 🔐   - Authenticated user:", user?.id || "NULL")
    console.log("[v0] 🔐   - Player user_id:", existingPlayer.user_id || "NULL")
    console.log("[v0] 🔐   - Match:", user?.id === existingPlayer.user_id ? "YES" : "NO")
    console.log("[v0] 🎯 SQL: UPDATE game_players SET ... WHERE id =", myPlayerId)

    const { data: updateResult, error: updateError } = await supabase
      .from("game_players")
      .update(updateData)
      .eq("id", myPlayerId)
      .select()

    console.log("[v0] 📤 ========================================")
    console.log("[v0] 📤 DATABASE UPDATE RESPONSE")
    console.log("[v0] 📤 ========================================")
    console.log("[v0] 📤 Update result:", updateResult)
    console.log("[v0] 📤 Update error:", updateError)

    if (updateError) {
      console.error("[v0] ❌ ========================================")
      console.error("[v0] ❌ DATABASE UPDATE FAILED")
      console.error("[v0] ❌ ========================================")
      console.error("[v0] ❌ Error code:", updateError.code)
      console.error("[v0] ❌ Error message:", updateError.message)
      console.error("[v0] ❌ Error details:", updateError.details)
      console.error("[v0] ❌ Error hint:", updateError.hint)
      if (updateError.code === "42501" || updateError.message.includes("policy")) {
        console.error("[v0] ❌ RLS POLICY BLOCKED THE UPDATE!")
        console.error("[v0] ❌ This means the user_id doesn't match or RLS policy is too restrictive")
        toast({
          title: "Permission Error",
          description: "You don't have permission to update this player. Please rejoin the game.",
          variant: "destructive",
        })
        setTimeout(() => {
          router.push(`/game-lounge?code=${gameCode}&join=true`)
        }, 3000)
      } else {
        toast({
          title: "Error saving song",
          description: updateError.message,
          variant: "destructive",
        })
      }
      return
    }

    if (!updateResult || updateResult.length === 0) {
      console.error("[v0] ❌ ========================================")
      console.error("[v0] ❌ UPDATE RETURNED NO ROWS")
      console.error("[v0] ❌ ========================================")
      console.error("[v0] ❌ This likely means RLS policy blocked the update")
      console.error("[v0] ❌ Check if user_id matches authenticated user")
      toast({
        title: "Error saving song",
        description: "Failed to update player record. Please try again or rejoin the game.",
        variant: "destructive",
      })
      return
    }

    console.log("[v0] ✅ ========================================")
    console.log("[v0] ✅ DATABASE UPDATE SUCCESSFUL!")
    console.log("[v0] ✅ ========================================")
    console.log("[v0] ✅ Updated row:", updateResult[0])

    if (updateResult[0].song_uri === selectedTrack.uri) {
      console.log("[v0] ✅ VERIFICATION SUCCESSFUL - Song saved correctly!")
    } else {
      console.error("[v0] ❌ VERIFICATION FAILED - Song not saved correctly!")
      console.error("[v0] ❌ Expected URI:", selectedTrack.uri)
      console.error("[v0] ❌ Actual URI:", updateResult[0].song_uri)
      toast({
        title: "Error saving song",
        description: "Song data mismatch. Please try again.",
        variant: "destructive",
      })
      return
    }

    // NEW: Check if ALL players have picked their songs
    console.log("[v0] 🔍 Checking if all players have picked songs...")
    const { data: allPlayers, error: checkAllError } = await supabase
      .from('game_players')
      .select('id, song_uri, player_name')
      .eq('game_id', existingPlayer.game_id)

    if (checkAllError) {
      console.error("[v0] ❌ Error checking all players:", checkAllError)
    } else if (allPlayers) {
      const playersWithSongs = allPlayers.filter(p => p.song_uri !== null && p.song_uri !== '')
      const playersWithoutSongs = allPlayers.filter(p => !p.song_uri || p.song_uri === '')
      const allPicked = playersWithoutSongs.length === 0

      console.log("[v0] 📊 Total players:", allPlayers.length)
      console.log("[v0] 📊 Players with songs:", playersWithSongs.length)
      console.log("[v0] 📊 Players WITHOUT songs:", playersWithoutSongs.length)

      // If timer expired and some players don't have songs, assign penalty songs
      if (isExpired && playersWithoutSongs.length > 0) {
        console.log("[v0] ⏰ Timer expired - assigning penalty songs to players who didn't pick")

        const fallbackSongs = [
          { uri: "spotify:track:4PTG3Z6ehGkBFwjybzWkR8", name: "Never Gonna Give You Up", artist: "Rick Astley", albumCover: "https://i.scdn.co/image/ab67616d0000b27315ebbedaacef61af244262a8" },
          { uri: "spotify:track:5ygDXis42ncn6kYG14lEVG", name: "Baby Shark", artist: "Pinkfong", albumCover: "https://i.scdn.co/image/ab67616d0000b27311723f2867f29b2134ae47e4" },
          { uri: "spotify:track:1KEdF3FNF9bKRCxN3KUMbx", name: "Friday", artist: "Rebecca Black", albumCover: "https://i.scdn.co/image/ab67616d0000b2733589de3ede5dabf351227be9" },
          { uri: "spotify:track:0lnxrQAd9ZxbhBBe7d8FO8", name: "MMMBop", artist: "Hanson", albumCover: "https://i.scdn.co/image/ab67616d0000b273184227f002623fc19f44551a" },
          { uri: "spotify:track:6SIDRn0OX4I8sGsDa4eCOZ", name: "Barbie Girl", artist: "Aqua", albumCover: "https://i.scdn.co/image/ab67616d0000b273dac64e1520920139583dd07a" },
        ]

        for (const player of playersWithoutSongs) {
          const randomFallback = fallbackSongs[Math.floor(Math.random() * fallbackSongs.length)]
          console.log("[v0] 🎲 Assigning penalty song to", player.player_name, ":", randomFallback.name)

          await supabase
            .from("game_players")
            .update({
              song_uri: randomFallback.uri,
              song_title: randomFallback.name,
              song_artist: randomFallback.artist,
              song_preview_url: null,
              album_cover_url: randomFallback.albumCover,
              song_duration_ms: 180000,
              song_played: false,
            })
            .eq("id", player.id)
        }
      }

      // Proceed if all picked OR timer expired (after assigning penalties)
      if (allPicked || isExpired) {
        console.log("[v0] 🎉 ALL PLAYERS HAVE SONGS - proceeding to playback!")
        console.log("[v0] 🔄 Transitioning to players_locked_in phase...")

        // Transition to players_locked_in phase - this will navigate ALL players
        if (gameId) {
          await setGamePhase(gameId, 'players_locked_in')
          console.log("[v0] ✅ Phase transition complete - all players will be redirected")
        }
      } else {
        console.log("[v0] ⏳ Waiting for other players to pick...")
        const unpicked = allPlayers.filter(p => !p.song_uri).map(p => p.player_name)
        console.log("[v0] ⏳ Still waiting for:", unpicked.join(", "))
      }
    }

    setPickedSongs((prev) => new Set([...prev, selectedTrack.uri]))

    console.log("[v0] 🎉 Showing success toast")
    toast({
      title: "Song confirmed!",
      description: `${selectedTrack.name} by ${selectedTrack.artists.map((a) => a.name).join(", ")}`,
    })

    // KEEP existing navigation as fallback (phase sync will also redirect if all picked)
    console.log("[v0] 🚀 Navigating to players-locked-in page")
    router.push(
      `/players-locked-in?category=${encodeURIComponent(category)}&code=${gameCode || ""}`,
    )
  }

  useEffect(() => {
    async function checkDuplicates() {
      const gameCode = searchParams.get("code")
      if (!gameCode) return

      const supabase = createClient()
      const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()

      if (game?.id) {
        const result = await checkDuplicateSpotifyAccounts(game.id)
        if (result.hasDuplicates && result.message) {
          console.error("[v0] Duplicate Spotify accounts detected:", result.message)
          toast({
            title: "⚠️ Spotify Account Conflict",
            description: result.message,
            variant: "destructive",
            duration: 10000,
          })
        }
      }
    }
    checkDuplicates()
  }, [searchParams, toast])

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col relative overflow-hidden">
      {SHOW_DEBUG && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white p-3 text-xs max-h-48 overflow-y-auto">
          <div className="font-bold mb-1">🔍 DEBUG: Token & Search Status</div>
          {debugInfo.map((info, i) => (
            <div key={i} className="font-mono">
              {info}
            </div>
          ))}
        </div>
      )}

      <header className="fixed top-[160px] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000022] pb-4">
        <Link href="/category-selected">
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
          PICK YOUR SONG
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

      <div className="fixed top-[212px] left-0 right-0 z-40 bg-[#000022] px-9">
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
                  width: `${(timeRemaining / 60) * 100}%`,
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
      >
        <div style={{ padding: "24px 36px 0" }}>
          <h2 className="text-[20px] font-semibold text-white mb-4">Search for your song</h2>

          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={countdown !== null ? "Wait for countdown..." : "Search..."}
              disabled={countdown !== null}
              className="w-full text-white rounded-2xl px-4 pr-12 outline-none"
              style={{
                background: "#000022",
                border: "2px solid #C7D2FF",
                fontSize: "16px",
                height: "56px",
                opacity: countdown !== null ? 0.5 : 1,
                cursor: countdown !== null ? "not-allowed" : "text",
              }}
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C7D2FF]" />
            {isSearching && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[#C7D2FF] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <p className="text-[12px] font-light mt-3" style={{ color: "#B9F3FF" }}>
            Get more points for a direct song match on search
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-9 pb-[180px] mt-6">
          {searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((track) => {
                const isSelected = selectedTrack?.id === track.id
                const isPicked = track.isAlreadyPicked

                return (
                  <button
                    key={track.id}
                    onClick={() => handleTrackSelect(track)}
                    disabled={isPicked}
                    className="w-full flex items-center gap-0 pr-3 rounded-xl transition-all duration-200 hover:bg-[#141826] disabled:opacity-50 disabled:cursor-not-allowed relative"
                  >
                    <img
                      src={track.album.images[0]?.url || "/placeholder.svg"}
                      alt={track.album.name}
                      className="w-12 h-12 rounded-xl flex-shrink-0"
                      style={{ borderRadius: "12px" }}
                    />
                    <div className="flex-1 text-left min-w-0 px-3">
                      <h3 className="text-[14px] font-medium text-white truncate">{track.name}</h3>
                      <p className="text-[12px] truncate" style={{ color: "#D2FFFF" }}>
                        {track.artists.map((a) => a.name).join(", ")}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {isPicked ? (
                        <div
                          className="px-2 py-1 rounded text-[10px] font-bold"
                          style={{ background: "#FF5858", color: "white" }}
                        >
                          PICKED
                        </div>
                      ) : isSelected ? (
                        <img
                          src="/check-square.png"
                          alt="Selected"
                          className="w-6 h-6"
                          style={{ width: "24px", height: "24px" }}
                        />
                      ) : (
                        <Plus className="w-6 h-6" style={{ width: "24px", height: "24px", color: "#B9F3FF" }} />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : searchInput.trim() && !isSearching ? (
            <div className="flex flex-col items-center justify-center h-64 text-white/50">
              <Music className="w-16 h-16 mb-4" />
              <p className="text-lg">No results found</p>
              <p className="text-sm mt-2">Try a different search term</p>
            </div>
          ) : !searchInput.trim() ? (
            <div className="flex flex-col items-center justify-center h-64 text-white/50">
              <Music className="w-16 h-16 mb-4" />
              <p className="text-lg">Start typing to search</p>
            </div>
          ) : null}
        </div>
      </div>

      {selectedTrack && (
        <>
          <div
            className="fixed left-0 right-0 z-50 flex flex-col items-center"
            style={{
              bottom: 0,
              height: "140px",
              background: "linear-gradient(to top, #141826 0%, rgba(13, 17, 59, 0) 100%)",
              padding: "0 36px",
              display: "flex",
              justifyContent: "flex-end",
              paddingBottom: "50px",
            }}
          >
            <button
              onClick={handleConfirmPick}
              className="w-full text-[18px] font-bold animate-scaleIn"
              style={{
                background: "#FFD03B",
                color: "#000033",
                height: "56px",
                borderRadius: "16px",
                border: "2px solid #FFF8C4",
                boxShadow: "0px 4px 0px 0px #7C5100",
              }}
            >
              Confirm your pick
            </button>
            <p
              className="text-[12px] font-light absolute"
              style={{
                color: "#B9F3FF",
                bottom: "16px",
              }}
            >
              You can still change your mind.
            </p>
          </div>
        </>
      )}

      {/* Countdown overlay (3-2-1-GO) */}
      {countdown !== null && (
        <>
          <div
            className="fixed inset-0 z-[200]"
            style={{
              background: "rgba(0, 0, 34, 0.95)",
            }}
          />
          <div
            className="fixed inset-0 z-[201] flex items-center justify-center"
          >
            <div
              className="text-center"
              style={{
                animation: countdown === "GO" ? "scaleInBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)" : "pulse 0.8s ease-in-out",
              }}
            >
              <div
                className="font-black"
                style={{
                  fontSize: countdown === "GO" ? "8rem" : "12rem",
                  background: countdown === "GO"
                    ? "linear-gradient(to right, #00FF88, #00D4AA)"
                    : "linear-gradient(to right, #8BE1FF, #0D91EA)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textShadow: "0 8px 16px rgba(0, 0, 0, 0.5)",
                  lineHeight: 1,
                }}
              >
                {countdown === "GO" ? "GO!" : countdown}
              </div>
            </div>
          </div>
          <style jsx>{`
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.8; }
            }
            @keyframes scaleInBounce {
              0% { transform: scale(0.3); opacity: 0; }
              50% { transform: scale(1.15); }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </>
      )}
    </div>
  )
}
