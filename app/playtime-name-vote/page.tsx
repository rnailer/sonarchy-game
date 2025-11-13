"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { saveGameState, getGameState } from "@/lib/game-state"
import { createClient } from "@/lib/supabase/client"

export default function PlaytimeNameVote() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedCategory = searchParams.get("category") || "Songs about cars or driving"
  const gameCode = searchParams.get("code")

  const gameState = getGameState()
  const currentRound = gameState.currentRound || 1
  const showNames = gameState.showNames
  const hasVotedBefore = showNames !== null

  const [totalPlayers, setTotalPlayers] = useState(2)
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(10) // Reduced timer from 30 to 10 seconds
  const [isMuted, setIsMuted] = useState(false)
  const [selectedVote, setSelectedVote] = useState<"hide" | "show" | null>(null)
  const [hideVotes, setHideVotes] = useState(0)
  const [showVotes, setShowVotes] = useState(0)
  const [showOverlay, setShowOverlay] = useState(false)
  const [voteResult, setVoteResult] = useState<"hide" | "show" | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [isSavingVote, setIsSavingVote] = useState(false)

  const addDebug = (msg: string) => {
    console.log(`[v0] ${msg}`)
    setDebugInfo((prev) => [...prev.slice(-5), `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  useEffect(() => {
    addDebug(`Page loaded. GameCode: ${gameCode || "MISSING"}`)
  }, [])

  useEffect(() => {
    const fetchPlayerCount = async () => {
      if (!gameCode) {
        addDebug("No game code provided")
        setIsLoadingPlayers(false)
        return
      }

      const supabase = createClient()
      if (!supabase) {
        addDebug("Supabase client not available")
        setIsLoadingPlayers(false)
        return
      }

      addDebug("Fetching game and player data...")
      const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()

      if (game) {
        setGameId(game.id)
        addDebug(`Game ID: ${game.id}`)

        const { data: players, error } = await supabase.from("game_players").select("id").eq("game_id", game.id)

        if (!error && players) {
          addDebug(`Player count: ${players.length}`)
          setTotalPlayers(players.length)

          const userId = localStorage.getItem(`player_id_${gameCode}`)
          setCurrentUserId(userId)
          addDebug(`Current user ID from localStorage: ${userId || "NOT FOUND"}`)

          if (!userId) {
            addDebug("WARNING: No player ID in localStorage - voting will not work!")
          }
        } else {
          addDebug(`Error fetching players: ${error?.message}`)
        }
      } else {
        addDebug("Game not found in database")
      }

      setIsLoadingPlayers(false)
    }

    fetchPlayerCount()
  }, [gameCode])

  useEffect(() => {
    if (!gameId || !currentUserId) {
      addDebug(`Skipping vote sync - gameId: ${gameId || "NULL"}, currentUserId: ${currentUserId || "NULL"}`)
      return
    }

    const supabase = createClient()
    if (!supabase) {
      addDebug("Supabase not available for vote sync")
      return
    }

    addDebug("Setting up vote sync...")

    const fetchVotes = async () => {
      const { data: players, error } = await supabase.from("game_players").select("id, name_vote").eq("game_id", gameId)

      if (error) {
        addDebug(`Error fetching votes: ${error.message}`)
        return
      }

      if (players) {
        const hide = players.filter((p) => p.name_vote === "hide").length
        const show = players.filter((p) => p.name_vote === "show").length

        setHideVotes(hide)
        setShowVotes(show)
        addDebug(`Vote counts updated - Hide: ${hide}, Show: ${show} (from ${players.length} players)`)

        // Check if current user has voted
        const currentPlayer = players.find((p) => p.id === currentUserId)
        if (currentPlayer?.name_vote) {
          setSelectedVote(currentPlayer.name_vote as "hide" | "show")
          addDebug(`Current user vote: ${currentPlayer.name_vote}`)
        } else {
          setSelectedVote(null)
        }
      }
    }

    fetchVotes()

    // Subscribe to vote changes
    const channel = supabase
      .channel(`game_${gameId}_votes`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "game_players",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          addDebug(`Vote change detected: ${payload.eventType}`)
          fetchVotes()
        },
      )
      .subscribe((status) => {
        addDebug(`Vote subscription status: ${status}`)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, currentUserId])

  useEffect(() => {
    if (currentRound > 1 && hasVotedBefore) {
      console.log("[v0] Skipping name vote, using previous preference:", showNames)
      router.push(
        `/playtime-waiting?category=${encodeURIComponent(selectedCategory)}&showNames=${showNames}&code=${gameCode}`,
      )
    }
  }, [currentRound, hasVotedBefore, showNames, router, selectedCategory, gameCode])

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      const result = showVotes > hideVotes ? "show" : "hide"
      setVoteResult(result)
      setShowOverlay(true)

      saveGameState({ showNames: result === "show" })

      setTimeout(() => {
        router.push(
          `/playtime-waiting?category=${encodeURIComponent(selectedCategory)}&showNames=${result === "show"}&code=${gameCode}`,
        )
      }, 1000)
    }
  }, [timeRemaining, hideVotes, showVotes, router, selectedCategory, gameCode])

  const handleVote = async (vote: "hide" | "show") => {
    addDebug(`🔘 Vote button clicked: ${vote}`)

    if (isSavingVote) {
      addDebug("⏳ Vote already in progress, ignoring click")
      return
    }

    if (selectedVote === vote) {
      addDebug("✓ Already voted for this option")
      return
    }

    if (!currentUserId) {
      addDebug("❌ ERROR: No user ID found")
      alert("Cannot vote: No player ID found. Please rejoin the game.")
      return
    }

    if (!gameCode) {
      addDebug("❌ ERROR: No game code")
      return
    }

    const supabase = createClient()
    if (!supabase) {
      addDebug("❌ ERROR: Supabase not available")
      return
    }

    setIsSavingVote(true)
    addDebug(`💾 Saving vote to database...`)

    try {
      const { error } = await supabase.from("game_players").update({ name_vote: vote }).eq("id", currentUserId)

      if (error) {
        addDebug(`❌ Database error: ${error.message}`)
        alert(`Vote failed: ${error.message}`)
        return
      }

      setSelectedVote(vote)
      addDebug(`✅ Vote saved successfully: ${vote}`)

      // Don't update local counts - let the realtime subscription handle it
      // This ensures all players see the same counts
    } catch (err) {
      addDebug(`❌ Exception: ${err}`)
      alert("Vote failed. Please try again.")
    } finally {
      setIsSavingVote(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (isLoadingPlayers) {
    return (
      <div className="min-h-screen bg-[#000022] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white p-2 text-[10px] max-h-24 overflow-y-auto">
        <div className="font-bold">DEBUG: playtime-name-vote</div>
        <div>
          GameID: {gameId?.slice(0, 8)}... | UserID: {currentUserId?.slice(0, 8)}...
        </div>
        <div>
          Votes - Hide: {hideVotes} | Show: {showVotes} | Selected: {selectedVote || "NONE"}
        </div>
        {debugInfo.slice(-2).map((info, i) => (
          <div key={i} className="truncate">
            {info}
          </div>
        ))}
      </div>

      <header className="fixed top-[60px] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000022] pb-4">
        <Link href="/players-locked-in">
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
          IT'S PLAYTIME, ROUND {currentRound}
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

      <div
        className="fixed top-[128px] left-0 right-0 bottom-0 overflow-hidden"
        style={{
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          borderTop: "3px solid rgb(185, 243, 255)",
          background: "#0D113B",
        }}
      >
        <h2
          className="absolute left-0 right-0 text-[36px] font-extrabold text-center leading-tight bg-clip-text text-transparent px-9"
          style={{
            top: "36px",
            backgroundImage: "linear-gradient(to right, #FFF1AB, #DC9C00)",
          }}
        >
          {selectedCategory}
        </h2>

        <div
          className="absolute left-1/2"
          style={{
            top: "166px",
            transform: "translateX(-50%)",
            maxWidth: "472px",
            width: "100%",
          }}
        >
          <Image src="/group-53.png" alt="Dancing music devices" width={472} height={400} className="w-full h-auto" />
        </div>

        <h3
          className="absolute left-0 right-0 text-[22px] font-extrabold text-white text-center leading-tight"
          style={{
            top: "420px",
          }}
        >
          Vote to show
          <br />
          players names
        </h3>

        <div
          className="absolute flex items-center justify-center"
          style={{
            top: "445px",
            left: "24px",
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            background: "#FFD0F5",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              border: "1px solid #7A0066",
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
              {hideVotes}
            </span>
          </div>
        </div>

        <div
          className="absolute flex items-center justify-center"
          style={{
            top: "445px",
            right: "24px",
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            background: "#D0FFF3",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              border: "1px solid #066B5C",
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
              {showVotes}
            </span>
          </div>
        </div>

        <button
          onClick={() => handleVote("hide")}
          disabled={isSavingVote}
          className="absolute text-[16px] font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
          style={{
            top: "510px",
            left: "36px",
            height: "56px",
            borderRadius: "26px",
            maxWidth: "156px",
            width: "156px",
            border: "2px solid #FFD0F5",
            background: "#FF58C9",
            boxShadow: "0px 4px 0px 0px #7A0066",
            opacity: selectedVote === "hide" ? 1 : selectedVote === null ? 1 : 0.5,
          }}
        >
          {isSavingVote && selectedVote !== "hide" ? "..." : "Hide names"}
        </button>

        <button
          onClick={() => handleVote("show")}
          disabled={isSavingVote}
          className="absolute text-[16px] font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
          style={{
            top: "510px",
            right: "36px",
            height: "56px",
            borderRadius: "26px",
            maxWidth: "156px",
            width: "156px",
            border: "2px solid #D0FFF3",
            background: "#43D4AF",
            boxShadow: "0px 4px 0px 0px #066B5C",
            opacity: selectedVote === "show" ? 1 : selectedVote === null ? 1 : 0.5,
          }}
        >
          {isSavingVote && selectedVote !== "show" ? "..." : "Show names"}
        </button>

        <p
          className="absolute left-1/2 text-[14px] font-light text-white text-center leading-relaxed"
          style={{
            top: "582px",
            transform: "translateX(-50%)",
            width: "322px",
          }}
        >
          Player names are revealed if a majority votes to show. A tie or loss player names are hidden.
        </p>

        <div
          className="absolute left-1/2"
          style={{
            bottom: "24px",
            transform: "translateX(-50%)",
          }}
        >
          <div className="text-[38px] font-extrabold italic text-white text-center">{formatTime(timeRemaining)}</div>
        </div>
      </div>

      {showOverlay && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            style={{
              background: "rgba(20, 24, 38, 0.5)",
            }}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center overflow-hidden stampIn">
            <Image
              src={voteResult === "show" ? "/show-stamp.svg" : "/hide-stamp.svg"}
              alt={voteResult === "show" ? "SHOW" : "HIDE"}
              width={488}
              height={339}
              style={{
                width: "488px",
                height: "auto",
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
