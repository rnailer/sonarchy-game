
"use client"

const SHOW_DEBUG = false

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { initiateSpotifyAuth, exchangeCodeForToken } from "@/lib/spotify/oauth"
import { saveSpotifyTokens } from "@/app/actions/spotify"
import { useToast } from "@/hooks/use-toast"
import { Suspense } from "react"
import { safeStorage } from "@/lib/utils/safe-storage"

const AVATARS = [
  { id: "boombox", src: "/beatbox-sq.png", label: "Boombox" },
  { id: "vinyl", src: "/vinyl-deck-sq.png", label: "Vinyl" },
  { id: "jukebox", src: "/jukebox-sq.png", label: "Jukebox" },
  { id: "mp3", src: "/walkman-right.png", label: "MP3 Player" },
  { id: "cassette", src: "/casette-right.png", label: "Cassette" },
  { id: "minidisc", src: "/midi-sq.png", label: "MiniDisc" },
]

function ProfileSetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [playerName, setPlayerName] = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState("")
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(SHOW_DEBUG)

  useEffect(() => {
    const loadProfile = async () => {
      setDebugInfo([`✅ Profile setup page loaded`, `🔍 Loading profile from database...`])

      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          console.error("[v0] No authenticated user")
          setDebugInfo((prev) => [...prev, `❌ No authenticated user`])
          return
        }

        // Clear localStorage if user ID doesn't match
        const storedUserId = safeStorage.getItem("current_user_id")
        if (storedUserId && storedUserId !== user.id) {
          console.log("[v0] User ID mismatch, clearing stale localStorage")
          setDebugInfo((prev) => [...prev, `🧹 Clearing stale data for different user`])
          safeStorage.removeItem("player_name")
          safeStorage.removeItem("player_avatar")
          safeStorage.removeItem("profile_complete")
          safeStorage.removeItem("spotify_access_token")
          safeStorage.removeItem("spotify_refresh_token")
          safeStorage.removeItem("spotify_token_expiry")
        }
        safeStorage.setItem("current_user_id", user.id)

        // Load profile from database
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("player_name, avatar_id, spotify_access_token, spotify_token_expires_at")
          .eq("user_id", user.id)
          .maybeSingle()

        if (profileError) {
          console.error("[v0] Error loading profile:", profileError)
          setDebugInfo((prev) => [...prev, `❌ Error loading profile: ${profileError.message}`])
        }

        // Load profile data from database (not localStorage)
        if (profile?.player_name) {
          setPlayerName(profile.player_name)
          setDebugInfo((prev) => [...prev, `✅ Loaded player name from DB`])
        }
        if (profile?.avatar_id) {
          setSelectedAvatar(profile.avatar_id)
          setDebugInfo((prev) => [...prev, `✅ Loaded avatar from DB`])
        }

        // Check Spotify connection from database
        const hasSpotifyToken = !!profile?.spotify_access_token
        const tokenValid = profile?.spotify_token_expires_at
          ? new Date(profile.spotify_token_expires_at) > new Date()
          : false

        if (hasSpotifyToken && tokenValid) {
          setIsSpotifyConnected(true)
          setDebugInfo((prev) => [...prev, `✅ Spotify connected in DB`])

          // Sync to localStorage
          if (profile.spotify_access_token) {
            safeStorage.setItem("spotify_access_token", profile.spotify_access_token)
          }
        } else {
          setIsSpotifyConnected(false)
          setDebugInfo((prev) => [...prev, `❌ No valid Spotify connection in DB`])
        }
      } catch (error) {
        console.error("[v0] Error in loadProfile:", error)
        setDebugInfo((prev) => [...prev, `❌ Error: ${error}`])
      }

      // Handle Spotify OAuth callback
      const spotifyCode = searchParams.get("spotify_code")
      const state = searchParams.get("state")
      const error = searchParams.get("error")

      if (error) {
        console.error("[v0] Spotify auth error:", error)
        setDebugInfo((prev) => [...prev, `❌ Spotify auth error: ${error}`])
        toast({
          title: "Connection failed",
          description: "Failed to connect to Spotify. Please try again.",
          variant: "destructive",
        })
        window.history.replaceState({}, "", "/profile-setup")
        return
      }

      if (spotifyCode && !isSpotifyConnected) {
        setDebugInfo((prev) => [...prev, `🔄 Processing Spotify callback...`])
        handleSpotifyCallback(spotifyCode, state || undefined)
      }
    }

    loadProfile()
  }, [searchParams])

  const handleSpotifyCallback = async (code: string, state?: string) => {
    setIsConnecting(true)
    try {
      console.log("[v0] 🔄 Processing Spotify callback in profile setup")
      setDebugInfo((prev) => [...prev, `📝 Authorization code received`])

      let tokens
      try {
        tokens = await exchangeCodeForToken(code, state) // Pass state to token exchange
        console.log("[v0] ✅ Tokens exchanged successfully")
        setDebugInfo((prev) => [...prev, `✅ Tokens exchanged successfully`, `⏰ Expires in: ${tokens.expires_in}s`])
      } catch (tokenError: any) {
        console.error("[v0] ❌ Token exchange failed:", tokenError)
        setDebugInfo((prev) => [...prev, `❌ Token exchange failed: ${tokenError.message}`])
        throw new Error(`Token exchange failed: ${tokenError.message}`)
      }

      console.log("[v0] 🔍 Validating access token with Spotify API...")
      setDebugInfo((prev) => [...prev, `🔍 Validating access token...`])

      let spotifyUserId: string | undefined
      let tokenIsValid = false

      try {
        const testResponse = await fetch("https://api.spotify.com/v1/me", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            "Content-Type": "application/json",
          },
        })

        if (testResponse.ok) {
          const userData = await testResponse.json()
          spotifyUserId = userData.id
          tokenIsValid = true
          console.log("[v0] ✅ Token validated successfully, user ID:", spotifyUserId)
          setDebugInfo((prev) => [...prev, `✅ Token validated successfully`, `✅ Spotify user ID: ${spotifyUserId}`])
        } else {
          const errorText = await testResponse.text()
          console.error("[v0] ❌ Token validation failed:", testResponse.status, errorText)
          setDebugInfo((prev) => [...prev, `❌ Token validation failed: ${testResponse.status}`])
          throw new Error(`Token validation failed: ${testResponse.status} - ${errorText}`)
        }
      } catch (validationError: any) {
        console.error("[v0] ❌ Token validation error:", validationError)
        setDebugInfo((prev) => [...prev, `❌ Token validation error: ${validationError.message}`])
        throw new Error(`Token validation failed: ${validationError.message}`)
      }

      if (!tokenIsValid) {
        throw new Error("Token validation failed - token is not working with Spotify API")
      }

      try {
        console.log("[v0] 💾 Saving validated tokens to database...")
        setDebugInfo((prev) => [...prev, `💾 Saving tokens to database...`])

        const saveResult = await saveSpotifyTokens(
          tokens.access_token,
          tokens.refresh_token,
          tokens.expires_in,
          spotifyUserId,
        )

        if (!saveResult.success) {
          setDebugInfo((prev) => [...prev, `❌ Token save failed: ${saveResult.error}`])
          throw new Error(`Token save failed: ${saveResult.error}`)
        }

        console.log("[v0] ✅ Tokens saved and verified in database")
        setDebugInfo((prev) => [...prev, `✅ Tokens saved to database`, `✅ Verification passed`])
      } catch (saveError: any) {
        console.error("[v0] ❌ Token save failed:", saveError)
        setDebugInfo((prev) => [...prev, `❌ Token save failed: ${saveError.message}`])
        throw new Error(`Failed to save tokens: ${saveError.message}`)
      }

      console.log("[v0] 💾 Saving tokens to localStorage...")
      const accessSaved = safeStorage.setItem("spotify_access_token", tokens.access_token)
      const refreshSaved = safeStorage.setItem("spotify_refresh_token", tokens.refresh_token)
      const expirySaved = safeStorage.setItem(
        "spotify_token_expiry",
        (Date.now() + tokens.expires_in * 1000).toString(),
      )

      if (accessSaved && refreshSaved && expirySaved) {
        console.log("[v0] ✅ All tokens saved to localStorage successfully")
        setDebugInfo((prev) => [...prev, `✅ Tokens saved to localStorage`])
      } else {
        console.warn("[v0] ⚠️ Some localStorage writes failed")
        setDebugInfo((prev) => [
          ...prev,
          `⚠️ localStorage partial failure (access: ${accessSaved}, refresh: ${refreshSaved}, expiry: ${expirySaved})`,
        ])
      }

      setIsSpotifyConnected(true)
      toast({
        title: "Connected!",
        description: "Your Spotify account has been connected successfully.",
      })

      const returnToGame = safeStorage.getItem("return_to_game")
      if (returnToGame) {
        try {
          const gameContext = JSON.parse(returnToGame)
          if (Date.now() - gameContext.timestamp < 10 * 60 * 1000) {
            console.log("[v0] 🎮 Returning to game:", gameContext)
            setDebugInfo((prev) => [...prev, `🎮 Verifying database write before redirect...`])

            await new Promise((resolve) => setTimeout(resolve, 5000))

            // Verify tokens are actually in the database before redirecting
            const { createClient } = await import("@/lib/supabase/client")
            const supabase = createClient()
            const {
              data: { user },
            } = await supabase.auth.getUser()

            if (user) {
              let profile = null
              for (let attempt = 1; attempt <= 3; attempt++) {
                const { data } = await supabase
                  .from("user_profiles")
                  .select("spotify_access_token")
                  .eq("user_id", user.id)
                  .maybeSingle()

                if (data?.spotify_access_token) {
                  profile = data
                  break
                }

                if (attempt < 3) {
                  console.warn(`[v0] ⚠️ Tokens not in database yet (attempt ${attempt}/3), waiting...`)
                  setDebugInfo((prev) => [...prev, `⚠️ Waiting for database (attempt ${attempt}/3)...`])
                  await new Promise((resolve) => setTimeout(resolve, 2000))
                }
              }

              if (profile?.spotify_access_token) {
                console.log("[v0] ✅ Verified tokens in database, safe to redirect")
                setDebugInfo((prev) => [...prev, `✅ Database verified, redirecting...`])
              } else {
                console.error("[v0] ❌ Tokens still not in database after 3 attempts")
                setDebugInfo((prev) => [...prev, `❌ Database verification failed`])
                throw new Error("Tokens not found in database after save")
              }
            }

            toast({
              title: "Returning to game...",
              description: "Taking you back to where you left off",
            })

            safeStorage.removeItem("return_to_game")

            router.push(
              `/pick-your-song?code=${gameContext.gameCode}&category=${encodeURIComponent(gameContext.category)}&player=${encodeURIComponent(gameContext.playerName)}`,
            )
          } else {
            console.log("[v0] ⏰ Game context expired, clearing")
            setDebugInfo((prev) => [...prev, `⏰ Game context expired`])
            safeStorage.removeItem("return_to_game")
          }
        } catch (e) {
          console.error("[v0] ❌ Error parsing return_to_game context:", e)
          setDebugInfo((prev) => [...prev, `❌ Error parsing game context`])
          safeStorage.removeItem("return_to_game")
        }
      }
    } catch (error: any) {
      console.error("[v0] ❌ Error in Spotify callback:", error)
      const errorMessage = error.message || "Unknown error occurred"
      setDebugInfo((prev) => [...prev, `❌ FATAL ERROR: ${errorMessage}`])

      toast({
        title: "Connection failed",
        description: `${errorMessage}. Please try again.`,
        variant: "destructive",
      })

      safeStorage.removeItem("spotify_access_token")
      safeStorage.removeItem("spotify_refresh_token")
      safeStorage.removeItem("spotify_token_expiry")
      setIsSpotifyConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSpotifyConnect = async () => {
    if (isSpotifyConnected) return

    try {
      setIsConnecting(true)
      if (playerName) safeStorage.setItem("player_name", playerName.trim())
      if (selectedAvatar) safeStorage.setItem("player_avatar", selectedAvatar)

      await initiateSpotifyAuth()
    } catch (error) {
      console.error("[v0] Error initiating Spotify auth:", error)
      toast({
        title: "Connection failed",
        description: "Failed to start Spotify connection. Please check your configuration.",
        variant: "destructive",
      })
      setIsConnecting(false)
    }
  }

  const handleSave = async () => {
    if (!playerName.trim() || !selectedAvatar || !isSpotifyConnected) return

    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        console.error("[v0] No authenticated user")
        toast({
          title: "Error",
          description: "You must be logged in to save your profile.",
          variant: "destructive",
        })
        return
      }

      console.log("[v0] Saving profile to database:", { playerName, selectedAvatar, userId: user.id })

      // Save to database (upsert to handle both new and existing users)
      const { error: upsertError } = await supabase
        .from("user_profiles")
        .upsert({
          user_id: user.id,
          email: user.email!,
          player_name: playerName.trim(),
          avatar_id: selectedAvatar,
          profile_complete: true,
          display_name: user.user_metadata?.full_name || user.email?.split("@")[0],
          avatar_url: user.user_metadata?.avatar_url,
          provider: user.app_metadata?.provider || "email",
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id"
        })

      if (upsertError) {
        console.error("[v0] Error saving profile:", upsertError)
        toast({
          title: "Save failed",
          description: "Failed to save your profile. Please try again.",
          variant: "destructive",
        })
        return
      }

      console.log("[v0] Profile saved to database successfully")

      // Also save to localStorage for offline access
      safeStorage.setItem("player_name", playerName.trim())
      safeStorage.setItem("player_avatar", selectedAvatar)
      safeStorage.setItem("profile_complete", "true")

      toast({
        title: "Profile saved!",
        description: "Your profile has been saved successfully.",
      })

      // Check if returning to game
      const returnToGame = safeStorage.getItem("return_to_game")
      if (returnToGame) {
        try {
          const gameContext = JSON.parse(returnToGame)
          if (Date.now() - gameContext.timestamp < 10 * 60 * 1000) {
            safeStorage.removeItem("return_to_game")
            router.push(
              `/pick-your-song?code=${gameContext.gameCode}&category=${encodeURIComponent(gameContext.category)}&player=${encodeURIComponent(gameContext.playerName)}`,
            )
            return
          } else {
            safeStorage.removeItem("return_to_game")
          }
        } catch (e) {
          console.error("[v0] ❌ Error parsing return_to_game context:", e)
          safeStorage.removeItem("return_to_game")
        }
      }

      router.push("/game-mode")
    } catch (error) {
      console.error("[v0] Error in handleSave:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen bg-[#000033] text-white flex flex-col p-9">
      {SHOW_DEBUG && showDebug && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] bg-blue-600 text-white p-3 text-xs max-h-48 overflow-y-auto"
          onClick={() => setShowDebug(false)}
        >
          <div className="font-bold mb-1">🔍 DEBUG: Profile Setup (tap to hide)</div>
          {debugInfo.map((info, i) => (
            <div key={i} className="font-mono">
              {info}
            </div>
          ))}
        </div>
      )}

      <h1
        className="text-[28px] font-black text-center mb-8 mt-20 bg-clip-text text-transparent"
        style={{
          backgroundImage: "linear-gradient(to bottom left, #8BE1FF, #0D97EA)",
        }}
      >
        CREATE YOUR PROFILE
      </h1>

      <div className="mb-8">
        <h2 className="text-[20px] font-semibold text-white mb-4">Enter your name</h2>
        <Input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          className="bg-[#0D113B] border-2 border-[#6CD9FF] rounded-[16px] h-[56px] px-4 text-white text-[18px] placeholder:text-[#6CD9FF]/60 placeholder:text-[16px] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#8DE2FF]"
        />
        <p className="text-[#B9F3FF] text-[12px] font-light mt-2 px-2">
          This will be displayed to other players in all games
        </p>
      </div>

      <div className="mb-8">
        <h2 className="text-[20px] font-semibold text-white mb-6">Select avatar</h2>
        <div className="grid grid-cols-3 gap-6">
          {AVATARS.map((avatar) => (
            <button key={avatar.id} onClick={() => setSelectedAvatar(avatar.id)} className="relative aspect-square">
              <div
                className={`w-[90px] h-[90px] max-w-[90px] max-h-[90px] rounded-full flex items-center justify-center transition-all duration-300 ${
                  selectedAvatar === avatar.id
                    ? "bg-[#066B5C] border-2 border-[#D0FFF3]"
                    : "bg-[#262C87] border-2 border-[#C7D2FF] hover:bg-[#1CB6B8] hover:border-[#D2FFFF]"
                }`}
              >
                <Image
                  src={avatar.src || "/placeholder.svg"}
                  alt={avatar.label}
                  width={70}
                  height={70}
                  className="object-contain"
                />
              </div>
              {selectedAvatar === avatar.id && (
                <div className="absolute bottom-0 right-0 w-[24px] h-[24px] flex items-center justify-center">
                  <Image src="/check-square.png" alt="Selected" width={24} height={24} className="object-contain" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-[20px] font-semibold text-white mb-4">Connect your music</h2>
        <div
          className={`h-[56px] rounded-xl flex items-center justify-between px-4 ${
            isSpotifyConnected ? "border-2 border-solid border-[#00E5CC]" : "border border-dashed border-[#C7D2FF]"
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="#000000" />
              <path
                d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
                fill="#1DB954"
              />
            </svg>
            <span className="text-white text-[18px] font-semibold">Spotify</span>
          </div>
          <button
            onClick={handleSpotifyConnect}
            disabled={isSpotifyConnected || isConnecting}
            className="text-[16px] font-normal py-2 px-3 rounded-xl border-2 border-[#C7D2FF] text-white hover:bg-[#C7D2FF]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? "Connecting..." : isSpotifyConnected ? "Connected" : "Connect"}
          </button>
        </div>
        <p className="text-[#B9F3FF] text-[12px] font-light mt-2 px-2">
          Required to search and play music during games
        </p>
      </div>

      <div className="flex-1" />

      <Button
        onClick={handleSave}
        disabled={!playerName.trim() || !selectedAvatar || !isSpotifyConnected}
        className="w-full h-[56px] bg-[#FFD03B] hover:bg-[#FFD03B]/90 text-[#000033] text-[18px] font-bold rounded-[16px] border-2 border-[#FFF8C4] disabled:opacity-50 disabled:cursor-not-allowed mt-8"
        style={{
          boxShadow: "0px 4px 0px 0px #7C5100",
        }}
      >
        Save Profile
      </Button>
    </div>
  )
}

export default function ProfileSetup() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#000033]" />}>
      <ProfileSetupContent />
    </Suspense>
  )
}
