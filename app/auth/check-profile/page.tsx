"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CheckProfile() {
  const router = useRouter()

  useEffect(() => {
    // Check if profile is complete
    const profileComplete = localStorage.getItem("profile_complete") === "true"
    const hasName = !!localStorage.getItem("player_name")
    const hasAvatar = !!localStorage.getItem("player_avatar")
    const spotifyToken = localStorage.getItem("spotify_access_token")
    const spotifyExpiry = localStorage.getItem("spotify_token_expiry")

    // Check if Spotify token is still valid
    const hasValidSpotify = spotifyToken && spotifyExpiry && Number.parseInt(spotifyExpiry) > Date.now()

    console.log("[v0] Checking profile completion:", {
      profileComplete,
      hasName,
      hasAvatar,
      hasValidSpotify,
    })

    if (profileComplete && hasName && hasAvatar && hasValidSpotify) {
      console.log("[v0] Profile complete with valid Spotify, redirecting to game-mode")
      router.push("/game-mode")
    } else {
      console.log("[v0] Profile incomplete or Spotify expired, redirecting to profile-setup")
      router.push("/profile-setup")
    }
  }, [router])

  return (
    <div className="min-h-screen bg-[#000033] flex items-center justify-center">
      <div className="text-white text-xl">Checking your profile...</div>
    </div>
  )
}
