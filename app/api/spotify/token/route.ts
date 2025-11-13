import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch Spotify tokens from user_profiles
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("spotify_access_token, spotify_refresh_token, spotify_token_expires_at")
      .eq("user_id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Spotify not connected" }, { status: 404 })
    }

    const expiresAt = new Date(profile.spotify_token_expires_at)
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

    let accessToken = profile.spotify_access_token

    if (expiresAt <= fiveMinutesFromNow) {
      console.log("[v0] Spotify token expired or expiring soon, refreshing...")

      const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!

      if (!clientSecret || !profile.spotify_refresh_token) {
        console.error("[v0] Missing Spotify credentials for refresh")
        return NextResponse.json(
          {
            error: "Token expired",
            details: "Please reconnect your Spotify account",
            reconnectUrl: "/profile-setup",
          },
          { status: 401 },
        )
      }

      try {
        const refreshResponse = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: profile.spotify_refresh_token,
          }),
        })

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text()
          console.error("[v0] Spotify token refresh failed:", {
            status: refreshResponse.status,
            error: errorText,
          })

          return NextResponse.json(
            {
              error: "Token refresh failed",
              details: "Your Spotify connection has expired. Please reconnect Spotify.",
              reconnectUrl: "/profile-setup",
            },
            { status: 401 },
          )
        }

        const refreshData = await refreshResponse.json()
        accessToken = refreshData.access_token

        // Update the token in the database
        const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
        await supabase
          .from("user_profiles")
          .update({
            spotify_access_token: accessToken,
            spotify_token_expires_at: newExpiresAt,
          })
          .eq("user_id", user.id)

        console.log("[v0] Spotify token refreshed successfully")
      } catch (error) {
        console.error("[v0] Token refresh error:", error)
        return NextResponse.json(
          {
            error: "Token refresh failed",
            details: "Please reconnect your Spotify account",
            reconnectUrl: "/profile-setup",
          },
          { status: 401 },
        )
      }
    }

    // Check if user has Premium by calling Spotify API
    let isPremium = false
    try {
      const userResponse = await fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (userResponse.ok) {
        const userData = await userResponse.json()
        isPremium = userData.product === "premium"
      }
    } catch (error) {
      console.error("Failed to check Premium status:", error)
    }

    return NextResponse.json({
      access_token: accessToken,
      is_premium: isPremium,
    })
  } catch (error) {
    console.error("Token fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
