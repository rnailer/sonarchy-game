"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

const SHOW_DEBUG = false

export default function GameStarting() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameCode = searchParams.get("code")
  const [countdown, setCountdown] = useState(3)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasNavigated = useRef(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [picker, setPicker] = useState<any | null>(null)

  const addDebug = (msg: string) => {
    setDebugInfo((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  useEffect(() => {
    addDebug(`Page loaded. GameCode: ${gameCode || "MISSING"}`)
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  useEffect(() => {
    if (countdown !== 0 || hasNavigated.current || !gameCode) return

    const navigatePlayer = async () => {
      hasNavigated.current = true
      addDebug("Countdown finished, determining navigation...")
      const supabase = createClient()
      const currentPlayerId = localStorage.getItem(`player_id_${gameCode}`)
      const isHost = localStorage.getItem(`is_host_${gameCode}`) === "true"

      addDebug(`PlayerId: ${currentPlayerId}, IsHost: ${isHost}`)

      try {
        const { data: game } = await supabase.from("games").select("*").eq("game_code", gameCode).single()

        if (!game) throw new Error("Game not found")

        const { data: players } = await supabase
          .from("game_players")
          .select("*")
          .eq("game_id", game.id)
          .order("joined_at", { ascending: true })

        if (!players || players.length === 0) throw new Error("No players found")

        let startingIndex = game.starting_player_index
        if (startingIndex === null || startingIndex === undefined) {
          // Generate random starting player index
          startingIndex = Math.floor(Math.random() * players.length)
          addDebug(`Randomly selected starting player index: ${startingIndex}`)

          // Update database with starting index
          await supabase.from("games").update({ starting_player_index: startingIndex }).eq("id", game.id)

          addDebug(`Set starting_player_index to ${startingIndex} in database`)
        } else {
          addDebug(`Using existing starting_player_index: ${startingIndex}`)
        }

        // First player is determined by starting_player_index
        const firstPicker = players[startingIndex]
        setPicker(firstPicker)

        addDebug(`First picker: ${firstPicker.player_name} (ID: ${firstPicker.id})`)

        if (currentPlayerId === firstPicker.id) {
          // I'm the picker - go to select category
          const url = `/select-category?code=${gameCode}&round=1&player=${currentPlayerId}`
          addDebug(`I'm picker! Navigating to: ${url}`)
          router.push(url)
        } else {
          const url = `/playtime-waiting?code=${gameCode}&choosingPlayer=${encodeURIComponent(firstPicker.id)}`
          addDebug(`Not picker. Navigating to: ${url}`)
          router.push(url)
        }
      } catch (error) {
        addDebug(`Database error: ${error}. Using fallback...`)
        // Fallback to localStorage if database fails
        if (isHost) {
          const url = `/select-category?code=${gameCode}&round=1&player=${currentPlayerId}`
          addDebug(`Fallback: Host navigating to: ${url}`)
          router.push(url)
        } else {
          const url = `/playtime-waiting?code=${gameCode}&choosingPlayer=${encodeURIComponent(picker?.id || "")}`
          addDebug(`Fallback: Non-host navigating to: ${url}`)
          router.push(url)
        }
      }
    }

    const timer = setTimeout(navigatePlayer, 1000)
    return () => clearTimeout(timer)
  }, [countdown, gameCode, router])

  useEffect(() => {
    const audioTimeout = setTimeout(() => {
      audioRef.current = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/8-bit%20Countdown%20D-q2pOCsVe8lEbv9dXtvx4WMLm1hyxOx.wav")
      audioRef.current.loop = false
      audioRef.current.volume = isMuted ? 0 : 1
      audioRef.current.play().catch(() => {})
    }, 1000)

    return () => {
      clearTimeout(audioTimeout)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [isMuted])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : 1
    }
  }, [isMuted])

  return (
    <div className="min-h-screen bg-[#000022] text-white flex flex-col">
      {SHOW_DEBUG && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-green-600 text-white p-2 text-xs max-h-32 overflow-y-auto">
          <div className="font-bold">DEBUG: game-starting</div>
          {debugInfo.map((info, i) => (
            <div key={i}>{info}</div>
          ))}
        </div>
      )}

      <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-between px-3 bg-[#000022] pb-4">
        <Link href={`/game-lounge?code=${gameCode}`}>
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
          GAME STARTING
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
        <p className="text-[20px] font-light text-[#B9F3FF] text-center mb-12 leading-relaxed w-full">
          The first music category is being assigned to a random player...
        </p>

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
