import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")

    if (!query) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("[v0] ❌ No authenticated user")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] 🔍 User ID:", user.id)
    console.log("[v0] 🔍 Fetching user profile for tokens...")

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("spotify_access_token, spotify_refresh_token, spotify_token_expires_at")
      .eq("user_id", user.id)
      .maybeSingle() // Use maybeSingle instead of single to avoid error if no row exists

    console.log("[v0] 📊 Profile query result:", {
      hasProfile: !!profile,
      hasToken: !!profile?.spotify_access_token,
      error: profileError,
    })

    if (profileError) {
      console.error("[v0] ❌ Database error fetching profile:", profileError)
      return NextResponse.json(
        {
          error: "Database error",
          message: "Failed to fetch profile. Please try reconnecting Spotify.",
        },
        { status: 500 },
      )
    }

    if (!profile || !profile.spotify_access_token) {
      console.error("[v0] ❌ Spotify not connected - no tokens found")
      console.error("[v0] Profile exists:", !!profile)
      console.error("[v0] Has access token:", !!profile?.spotify_access_token)
      return NextResponse.json(
        {
          error: "Spotify not connected",
          message: "Please connect Spotify in Profile Settings",
        },
        { status: 401 },
      )
    }

    console.log("[v0] ✅ Tokens found in database")
    console.log("[v0] Token expires at:", profile.spotify_token_expires_at)

    let accessToken = profile.spotify_access_token
    const expiresAt = new Date(profile.spotify_token_expires_at)
    const now = new Date()

    if (expiresAt <= now) {
      console.log("[v0] ⏰ Token expired, refreshing...")

      const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!

      if (!clientSecret) {
        console.error("[v0] SPOTIFY_CLIENT_SECRET not configured")
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
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
          console.error("[v0] Token refresh failed:", errorText)

          return NextResponse.json(
            {
              error: "Spotify token expired",
              message: "Please reconnect Spotify in Profile Settings",
            },
            { status: 401 },
          )
        }

        const refreshData = await refreshResponse.json()
        accessToken = refreshData.access_token

        console.log("[v0] Token refreshed successfully")

        const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
        const updateData: any = {
          spotify_access_token: accessToken,
          spotify_token_expires_at: newExpiresAt,
        }

        if (refreshData.refresh_token) {
          updateData.spotify_refresh_token = refreshData.refresh_token
          console.log("[v0] New refresh token received")
        }

        const { error: updateError } = await supabase.from("user_profiles").update(updateData).eq("user_id", user.id)

        if (updateError) {
          console.error("[v0] Failed to update tokens:", updateError)
        }
      } catch (refreshError) {
        console.error("[v0] Token refresh exception:", refreshError)
        return NextResponse.json(
          {
            error: "Token refresh failed",
            message: "Please reconnect Spotify in Profile Settings",
          },
          { status: 401 },
        )
      }
    } else {
      const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60)
      console.log("[v0] ✅ Token still valid, expires in", minutesUntilExpiry, "minutes")
    }

    console.log("[v0] 🔍 Searching Spotify for:", query)
    console.log("[v0] 🔑 Using access token (first 20 chars):", accessToken.substring(0, 20) + "...")

    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text()
      let errorJson
      try {
        errorJson = JSON.parse(errorText)
      } catch {
        errorJson = { raw: errorText }
      }

      console.error("[v0] ❌ Spotify search failed:")
      console.error("[v0]   Status:", searchResponse.status)
      console.error("[v0]   Status Text:", searchResponse.statusText)
      console.error("[v0]   Error Body:", errorJson)
      console.error("[v0]   Headers:", Object.fromEntries(searchResponse.headers.entries()))

      return NextResponse.json(
        {
          error: "Spotify search failed",
          message: `Spotify API error (${searchResponse.status}): ${errorJson.error?.message || errorText}. Please reconnect Spotify in Profile Settings.`,
          details: {
            status: searchResponse.status,
            spotifyError: errorJson,
          },
        },
        { status: searchResponse.status },
      )
    }

    const data = await searchResponse.json()

    console.log("[v0] ✅ Search successful, found", data.tracks?.items?.length || 0, "tracks")

    return NextResponse.json({
      tracks: data.tracks.items.map((track: any) => ({
        id: track.id,
        name: track.name,
        artists: track.artists,
        album: track.album,
        preview_url: track.preview_url,
        uri: track.uri,
        duration_ms: track.duration_ms,
      })),
    })
  } catch (error) {
    console.error("[v0] ❌ Search error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
