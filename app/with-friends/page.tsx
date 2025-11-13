"use client"

import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import Link from "next/link"

const AVATARS = [
  { id: "boombox", src: "/beatbox-sq.png", label: "Boombox" },
  { id: "vinyl", src: "/vinyl-deck-sq.png", label: "Vinyl" },
  { id: "jukebox", src: "/jukebox-sq.png", label: "Jukebox" },
  { id: "mp3", src: "/walkman-right.png", label: "MP3 Player" },
  { id: "cassette", src: "/casette-right.png", label: "Cassette" },
  { id: "minidisc", src: "/midi-sq.png", label: "MiniDisc" },
]

function WithFriendsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isJoining, setIsJoining] = useState(false)
  const [joinGameCode, setJoinGameCode] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState("")

  useEffect(() => {
    const profileComplete = localStorage.getItem("profile_complete")
    const savedName = localStorage.getItem("player_name")
    const savedAvatar = localStorage.getItem("player_avatar")
    const spotifyToken = localStorage.getItem("spotify_access_token")

    if (!profileComplete || !savedName || !savedAvatar || !spotifyToken) {
      console.log("[v0] Profile incomplete, redirecting to profile-setup")
      router.push("/profile-setup")
      return
    }

    setPlayerName(savedName)
    setSelectedAvatar(savedAvatar)
  }, [router])

  const handleNavigateToLounge = (code?: string, joining?: boolean) => {
    const gameCode = code || Math.floor(100000 + Math.random() * 900000).toString()
    const isJoin = joining || isJoining

    console.log("[v0] Navigating to lounge:", { gameCode, isJoin, playerName, selectedAvatar })

    const url = `/game-lounge?code=${gameCode}${isJoin ? "&join=true" : ""}`
    router.push(url)
  }

  const handleInRoomClick = () => {
    handleNavigateToLounge()
  }

  return (
    <div className="min-h-screen bg-[#000033] text-white flex flex-col relative overflow-hidden">
      <header className="fixed top-[72px] left-0 right-0 z-50 flex items-center justify-between px-3">
        <Link href="/game-mode">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 w-[24px] h-[24px] p-0">
            <svg className="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="none">
              <path d="M15.41 7.41L14 6L8 12l6 6l1.41-1.41L10.83 12z" fill="#FFFFFF" />
            </svg>
          </Button>
        </Link>
        <h1
          className="text-[22px] font-black text-center bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D97EA)",
          }}
        >
          WITH FRIENDS
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 w-[24px] h-[24px] p-0"
          onClick={() => {}}
        >
          <svg className="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="none">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V8H3z" fill="#FFFFFF" />
          </svg>
        </Button>
      </header>

      <div className="pt-[120px] px-9 flex-1 relative z-10">
        <div className="mt-[48px] mb-16">
          <div className="absolute -left-8 top-12 w-6 h-6 animate-bob opacity-60">
            <span className="text-2xl">✨</span>
          </div>
          <div className="absolute -right-6 top-24 w-6 h-6 animate-bob opacity-60" style={{ animationDelay: "0.5s" }}>
            <span className="text-2xl">🎵</span>
          </div>
          <div className="absolute -left-10 top-64 w-6 h-6 animate-bob opacity-60" style={{ animationDelay: "0.8s" }}>
            <span className="text-xl">🎶</span>
          </div>
          <div className="absolute -right-8 top-80 w-6 h-6 animate-bob opacity-60" style={{ animationDelay: "1.2s" }}>
            <span className="text-2xl">✨</span>
          </div>

          <div
            onClick={handleInRoomClick}
            className="relative rounded-[20px] border-2 border-[#D2FFFF] overflow-visible cursor-pointer transition-all mb-[56px]"
            style={{
              background: "linear-gradient(135deg, #5F6691 0%, transparent 100%)",
              boxShadow: "0 8px 0 0 #262C87",
              paddingLeft: "16px",
              paddingRight: "16px",
              paddingTop: "16px",
              paddingBottom: "24px",
              transition: "all 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(8px)"
              e.currentTarget.style.boxShadow = "0 0 0 0 #262C87"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "0 8px 0 0 #262C87"
            }}
          >
            <h2 className="text-[18px] font-semibold text-white mb-[12px]">In the same room</h2>

            <div className="absolute top-[-25px] right-0 w-[130px] h-[195px] z-10 animate-fade-in-bounce">
              <Image
                src="/images/design-mode/speaker.png"
                alt="Speaker with rainbow circles"
                width={130}
                height={195}
                className="object-contain"
              />
            </div>
            <div className="absolute top-[33px] right-[-4px] w-[63px] h-[98px] z-10 animate-fade-in-bounce">
              <Image
                src="/guitar-small01.png"
                alt="Electric guitar"
                width={63}
                height={98}
                className="object-contain animate-bob"
                style={{ animationDelay: "0.3s" }}
              />
            </div>
            <div className="absolute top-[-50px] right-[16px] w-[81px] h-[81px] z-10 animate-fade-in-bounce">
              <Image
                src="/muic-note.png"
                alt="Musical note"
                width={81}
                height={81}
                className="object-contain animate-bob"
                style={{ animationDelay: "0.4s" }}
              />
            </div>

            <p className="text-[14px] text-white/90 leading-relaxed max-w-[65%]">
              The songs will be played on a connected device or on the device of the player who created the game
            </p>
          </div>

          <div
            onClick={() => router.push("/remote")}
            className="relative rounded-[20px] border-2 border-[#D2FFFF] overflow-visible cursor-pointer transition-all"
            style={{
              background: "linear-gradient(135deg, #5F6691 0%, transparent 100%)",
              boxShadow: "0 8px 0 0 #262C87",
              paddingLeft: "16px",
              paddingRight: "16px",
              paddingTop: "16px",
              paddingBottom: "24px",
              transition: "all 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(8px)"
              e.currentTarget.style.boxShadow = "0 0 0 0 #262C87"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "0 8px 0 0 #262C87"
            }}
          >
            <h2 className="text-[18px] font-semibold text-white mb-[12px]">Remote</h2>

            <div className="absolute top-[15px] right-[4px] w-[117px] h-[117px] z-10 animate-fade-in-bounce">
              <Image src="/globe.png" alt="Globe" width={117} height={117} className="object-contain" />
            </div>
            <div
              className="absolute top-[-34px] right-[48px] w-[80px] h-[80px] z-10 animate-fade-in-bounce"
              style={{ transform: "rotate(-31.98deg)" }}
            >
              <Image
                src="/retro-speaker.png"
                alt="Retro speaker"
                width={80}
                height={80}
                className="object-contain mt-2 ml-[-17px] animate-bob"
              />
            </div>
            <div
              className="absolute bottom-[15px] right-[25px] w-[60px] h-[60px] z-10 animate-fade-in-bounce animate-bob"
              style={{ transform: "rotate(45deg)" }}
            >
              <Image
                src="/images/design-mode/record-sleeve-left-01.png"
                alt="Record sleeve"
                width={60}
                height={60}
                className="object-contain mt-[-36px] mb-0 mr-0 ml-[-5px]"
              />
            </div>

            <p className="text-[14px] text-white/90 leading-relaxed max-w-[65%]">
              Party and play with players around the world in our online party rooms.
            </p>
          </div>
        </div>

        <div className="absolute left-[-63px] bottom-[-94px] w-[313px] h-[313px] z-10 animate-slide-in-left">
          <Image
            src="/images/design-mode/audio-jack.png"
            alt="Audio jack character"
            width={313}
            height={313}
            className="object-contain"
          />
        </div>

        <div className="absolute right-[-90px] bottom-[-74px] w-[290px] h-[290px] z-10 animate-slide-in-right">
          <Image
            src="/images/design-mode/neon-speaker.png"
            alt="Neon speaker character"
            width={290}
            height={290}
            className="object-contain"
          />
        </div>
      </div>
    </div>
  )
}

export default function WithFriendsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#000033]" />}>
      <WithFriendsContent />
    </Suspense>
  )
}
