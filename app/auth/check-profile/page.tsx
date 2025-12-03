"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function CheckProfile() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const supabase = createClient()

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          console.error("[v0] No authenticated user, redirecting to login")
          router.push("/login")
          return
        }

        console.log("[v0] Checking profile for user:", user.id)

        // Clear localStorage if it doesn't match current user
        const storedUserId = localStorage.getItem("current_user_id")
        if (storedUserId && storedUserId !== user.id) {
          console.log("[v0] User ID mismatch, clearing stale localStorage data")
          localStorage.removeItem("player_name")
          localStorage.removeItem("player_avatar")
          localStorage.removeItem("profile_complete")
          localStorage.removeItem("spotify_access_token")
          localStorage.removeItem("spotify_refresh_token")
          localStorage.removeItem("spotify_token_expiry")
        }
        localStorage.setItem("current_user_id", user.id)

        // Check profile in database
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("player_name, avatar_id, spotify_access_token, spotify_token_expires_at")
          .eq("user_id", user.id)
          .maybeSingle()

        if (profileError) {
          console.error("[v0] Error fetching profile:", profileError)
          router.push("/profile-setup")
          return
        }

        const hasName = !!profile?.player_name
        const hasAvatar = !!profile?.avatar_id
        const hasSpotifyToken = !!profile?.spotify_access_token
        const spotifyTokenValid = profile?.spotify_token_expires_at
          ? new Date(profile.spotify_token_expires_at) > new Date()
          : false

        console.log("[v0] Profile check:", {
          hasName,
          hasAvatar,
          hasSpotifyToken,
          spotifyTokenValid,
          userId: user.id
        })

        // Profile is complete if user has name, avatar, and valid Spotify token
        if (hasName && hasAvatar && hasSpotifyToken && spotifyTokenValid) {
          console.log("[v0] Profile complete, redirecting to game-mode")

          // Sync to localStorage for offline access
          localStorage.setItem("player_name", profile.player_name!)
          localStorage.setItem("player_avatar", profile.avatar_id!)
          localStorage.setItem("profile_complete", "true")

          router.push("/game-mode")
        } else {
          console.log("[v0] Profile incomplete, redirecting to profile-setup")
          router.push("/profile-setup")
        }
      } catch (error) {
        console.error("[v0] Error in profile check:", error)
        router.push("/profile-setup")
      } finally {
        setIsChecking(false)
      }
    }

    checkProfile()
  }, [router])

  return (
    <div className="min-h-screen bg-[#000033] flex items-center justify-center">
      <div className="text-white text-xl">
        {isChecking ? "Checking your profile..." : "Redirecting..."}
      </div>
    </div>
  )
}
