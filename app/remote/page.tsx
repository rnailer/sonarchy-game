"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function RemotePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [gameCode, setGameCode] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const supabase = createClient()

  const handleJoinGame = async (e?: FormEvent) => {
    if (e) e.preventDefault()

    if (!gameCode.trim()) {
      toast({
        title: "Enter a game code",
        description: "Please enter a valid 6-digit game code",
        variant: "destructive",
      })
      return
    }

    if (gameCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Game code must be 6 digits",
        variant: "destructive",
      })
      return
    }

    setIsJoining(true)
    console.log("[v0] Validating game code:", gameCode)

    if (supabase) {
      const { data: game, error } = await supabase
        .from("games")
        .select("id, game_code, status")
        .eq("game_code", gameCode)
        .single()

      if (error || !game) {
        console.error("[v0] Game not found:", error)
        toast({
          title: "Game not found",
          description: "This game code doesn't exist. Please check and try again.",
          variant: "destructive",
        })
        setIsJoining(false)
        return
      }

      if (game.status !== "waiting") {
        toast({
          title: "Game already started",
          description: "This game has already started. You cannot join now.",
          variant: "destructive",
        })
        setIsJoining(false)
        return
      }

      console.log("[v0] Game found, navigating to game-lounge")
      router.push(`/game-lounge?code=${gameCode}&join=true`)
      return
    }

    router.push(`/game-lounge?code=${gameCode}&join=true`)
  }

  return (
    <div className="min-h-screen bg-[#000033] text-white flex flex-col">
      <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-between px-3">
        <Link href="/with-friends">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 w-[24px] h-[24px] p-0">
            <ArrowLeft className="h-[24px] w-[24px]" />
          </Button>
        </Link>
        <h1
          className="text-[22px] font-black text-center bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D97EA)",
          }}
        >
          JOIN GAME
        </h1>
        <div className="w-[24px]" />
      </header>

      <div className="pt-[160px] px-4 flex-1">
        <div className="max-w-md mx-auto">
          <h2 className="text-[20px] font-semibold text-white mb-6 text-center">Enter the 6-digit game code</h2>

          <form onSubmit={handleJoinGame} className="space-y-6">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={gameCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "")
                setGameCode(value)
              }}
              placeholder="000000"
              className="bg-[#000033] border-2 border-[#6CD9FF] rounded-[16px] h-[56px] px-4 text-white text-[24px] text-center tracking-widest placeholder:text-[#6CD9FF]/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#8DE2FF]"
              style={{
                letterSpacing: "0.5em",
              }}
            />

            <Button
              type="submit"
              disabled={gameCode.length !== 6 || isJoining}
              className="w-full h-[56px] bg-[#FFD03B] hover:bg-[#FFD03B]/90 text-[#000033] text-[18px] font-bold rounded-[16px] border-2 border-[#FFF8C4] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                boxShadow: "0px 4px 0px 0px #7C5100",
              }}
            >
              {isJoining ? "Joining..." : "Join Game"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
