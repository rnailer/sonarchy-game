import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gameCode = searchParams.get("code")

    console.log("[v0] ========================================")
    console.log("[v0] HOST TOKEN API CALLED")
    console.log("[v0] ========================================")
    console.log("[v0] Game code:", gameCode)

    if (!gameCode) {
      console.log("[v0] ❌ No game code provided")
      return NextResponse.json({ error: "Game code required" }, { status: 400 })
    }

    const supabase = await createClient()
    console.log("[v0] ✅ Supabase client created")

    // Get the game and host_user_id
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, host_user_id")
      .eq("game_code", gameCode)
      .single()

    if (gameError || !game) {
      console.error("[v0] ❌ Game not found:", gameError)
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    console.log("[v0] ✅ Found game:", game.id)
    console.log("[v0] 👑 Host user ID:", game.host_user_id)

    if (!game.host_user_id) {
      console.error("[v0] ❌ Game has no host_user_id set")
      return NextResponse.json({ error: "Game has no host assigned" }, { status: 400 })
    }
    // </CHANGE>

    // Get the host's Spotify tokens from user_profiles
    const { data: hostProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("spotify_access_token, spotify_refresh_token, spotify_token_expires_at")
      .eq("user_id", game.host_user_id)
      .single()

    if (profileError || !hostProfile) {
      console.error("[v0] ❌ Host profile not found:", profileError)
      console.error("[v0] ❌ Error code:", profileError?.code)
      console.error("[v0] ❌ Error message:", profileError?.message)
      return NextResponse.json({ error: "Host profile not found" }, { status: 404 })
    }

    console.log("[v0] ✅ Host profile found")
    console.log("[v0] 🔑 Has access token:", !!hostProfile.spotify_access_token)
    console.log("[v0] 🔑 Has refresh token:", !!hostProfile.spotify_refresh_token)
    console.log("[v0] ⏰ Token expires at:", hostProfile.spotify_token_expires_at)

    if (!hostProfile.spotify_access_token) {
      console.error("[v0] ❌ Host has no Spotify token")
      return NextResponse.json({ error: "Host not connected to Spotify" }, { status: 400 })
    }

    // Check if token is expired
    const expiresAt = new Date(hostProfile.spotify_token_expires_at)
    const now = new Date()
    const isExpired = expiresAt <= now

    console.log("[v0] 🕐 Current time:", now.toISOString())
    console.log("[v0] 🕐 Token expires:", expiresAt.toISOString())
    console.log("[v0] ⚠️ Token expired:", isExpired)

    let accessToken = hostProfile.spotify_access_token

    // Refresh token if expired
    if (isExpired) {
      console.log("[v0] 🔄 Token expired, refreshing...")

      const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

      console.log("[v0] 🔑 Client ID available:", !!clientId)
      console.log("[v0] 🔑 Client secret available:", !!clientSecret)

      if (!clientSecret || !hostProfile.spotify_refresh_token) {
        console.error("[v0] ❌ Missing refresh credentials")
        return NextResponse.json({ error: "Cannot refresh token" }, { status: 500 })
      }

      console.log("[v0] 📡 Calling Spotify token refresh API...")
      const refreshResponse = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: hostProfile.spotify_refresh_token,
        }),
      })

      console.log("[v0] 📡 Refresh response status:", refreshResponse.status)

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text()
        console.error("[v0] ❌ Token refresh failed:", errorText)
        return NextResponse.json({ error: "Token refresh failed" }, { status: 500 })
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      console.log("[v0] ✅ New access token received")
      console.log("[v0] ⏰ Expires in:", refreshData.expires_in, "seconds")

      // Update the host's token in database
      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          spotify_access_token: accessToken,
          spotify_token_expires_at: newExpiresAt,
        })
        .eq("user_id", game.host_user_id)

      if (updateError) {
        console.error("[v0] ⚠️ Failed to update token in database:", updateError)
      } else {
        console.log("[v0] ✅ Token updated in database")
      }
    }

    // Check if host is premium by fetching their Spotify profile
    console.log("[v0] 📡 Fetching host Spotify profile...")
    const userResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    console.log("[v0] 📡 Profile response status:", userResponse.status)

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error("[v0] ❌ Failed to fetch host Spotify profile:", errorText)
      return NextResponse.json({ error: "Failed to verify host account" }, { status: 500 })
    }

    const userData = await userResponse.json()
    const isPremium = userData.product === "premium"

    console.log("[v0] 👤 Host Spotify account type:", userData.product)
    console.log("[v0] ✅ Is premium:", isPremium)
    console.log("[v0] ========================================")
    console.log("[v0] HOST TOKEN API SUCCESS")
    console.log("[v0] ========================================")

    return NextResponse.json({
      access_token: accessToken,
      is_premium: isPremium,
    })
  } catch (error: any) {
    console.error("[v0] ❌ FATAL ERROR in host-token API:", error)
    console.error("[v0] ❌ Error stack:", error.stack)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
