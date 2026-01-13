"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

const SHOW_DEBUG = false

export default function CategorySelected() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedCategory = searchParams.get("category") || "Songs about cars or driving"
  const gameCode = searchParams.get("code")
  const [countdown, setCountdown] = useState(3)
  const [isMuted, setIsMuted] = useState(false)
  // TODO: Add host-only sounds later
  // const audioRef = useRef<HTMLAudioElement | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebug = (msg: string) => {
    setDebugInfo((prev) => [...prev.slice(-8), `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  const [selectingPlayerId, setSelectingPlayerId] = useState<string | null>(null)
  const [isMyTurn, setIsMyTurn] = useState(false)

  useEffect(() => {
    addDebug(`✓ Page loaded: category-selected`)
    addDebug(`📝 Game Code: ${gameCode || "MISSING!"}`)
    addDebug(`🎵 Category: ${selectedCategory}`)
    addDebug(`🔗 Current URL: ${window.location.href}`)

    const checkIfMyTurn = async () => {
      if (!gameCode) return

      const myPlayerId = localStorage.getItem(`player_id_${gameCode}`)
      const supabase = createClient()

      const { data: game } = await supabase.from("games").select("id").eq("game_code", gameCode).single()

      if (!game) return

      // Get all players who need to select a category
      const { data: players } = await supabase
        .from("game_players")
        .select("id, player_name, has_selected_category")
        .eq("game_id", game.id)
        .order("joined_at", { ascending: true })

      const playersNeedingSelection = players?.filter((p) => !p.has_selected_category) || []

      console.log("[v0] 🔍 Players needing selection:", playersNeedingSelection)
      console.log("[v0] 🔍 My player ID:", myPlayerId)

      // If I'm in the list of players needing selection, it's my turn
      const amINext = playersNeedingSelection.some((p) => p.id === myPlayerId)

      setIsMyTurn(amINext)
      setSelectingPlayerId(amINext ? myPlayerId : null)

      addDebug(`👤 My player ID: ${myPlayerId}`)
      addDebug(`👤 Am I selecting? ${amINext}`)
      addDebug(`👥 Players needing selection: ${playersNeedingSelection.length}`)
    }

    checkIfMyTurn()
  }, [gameCode, selectedCategory])

  useEffect(() => {
    const updateCategory = async () => {
      if (gameCode && selectedCategory) {
        // Save to localStorage for immediate access
        localStorage.setItem(`category_${gameCode}`, selectedCategory)
        addDebug(`✓ Stored category in localStorage`)

        // Save to Supabase for realtime updates to other players
        const supabase = createClient()
        const { error } = await supabase
          .from("games")
          .update({ current_category: selectedCategory })
          .eq("game_code", gameCode)

        if (error) {
          console.error("[v0] Error updating category in Supabase:", error)
          addDebug(`❌ Supabase update failed: ${error.message}`)
        } else {
          console.log("[v0] Category updated in Supabase successfully")
          addDebug(`✓ Updated category in Supabase`)
        }
      }
    }

    updateCategory()
  }, [gameCode, selectedCategory])

  // TODO: Add host-only sounds later
  // useEffect(() => {
  //   const audioTimeout = setTimeout(() => {
  //     audioRef.current = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/8-bit%20Countdown%20D-q2pOCsVe8lEbv9dXtvx4WMLm1hyxOx.wav")
  //     audioRef.current.loop = false
  //     audioRef.current.volume = isMuted ? 0 : 1
  //     audioRef.current.play().catch((e) => console.log("[v0] Audio play failed:", e))
  //   }, 1000)

  //   return () => {
  //     clearTimeout(audioTimeout)
  //     if (audioRef.current) {
  //       audioRef.current.pause()
  //       audioRef.current = null
  //     }
  //   }
  // }, [])

  // TODO: Add host-only sounds later
  // useEffect(() => {
  //   if (audioRef.current) {
  //     audioRef.current.volume = isMuted ? 0 : 1
  //   }
  // }, [isMuted])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setTimeout(() => {
        const targetUrl = `/pick-your-song?code=${gameCode}&category=${encodeURIComponent(selectedCategory)}`
        addDebug(`🎯 NAVIGATING to pick-your-song`)
        addDebug(`📍 Target: /pick-your-song`)
        addDebug(`🔗 Full URL: ${targetUrl}`)
        console.log("[v0] ✅ Navigating to pick-your-song:", targetUrl)
        router.push(targetUrl)
      }, 1000)
    }
  }, [countdown, router, gameCode, selectedCategory])

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col">
      {SHOW_DEBUG && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-green-600 text-white p-3 text-xs max-h-40 overflow-y-auto">
          <div className="font-bold mb-1">DEBUG: category-selected</div>
          {debugInfo.map((info, i) => (
            <div key={i}>{info}</div>
          ))}
        </div>
      )}

      <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000022] pb-4">
        <Link href={`/select-category?code=${gameCode}`}>
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
          the category is...
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
          {selectedCategory}
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
                  animation: countdown === 0 ? "goAnimation 0.6s ease-out" : "none",
                }}
              >
                {countdown > 0 ? countdown : "GO"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
