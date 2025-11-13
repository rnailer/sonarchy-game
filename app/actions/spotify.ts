"use server"

import { createServerClient } from "@/lib/supabase/server"

export async function saveSpotifyTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  spotifyUserId?: string,
) {
  console.log("[v0] 💾 saveSpotifyTokens called")
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error("[v0] ❌ No authenticated user")
    return { success: false, error: "User not authenticated" }
  }

  console.log("[v0] ✅ User authenticated:", user.id)
  console.log("[v0] 📧 User email:", user.email)

  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  const updateData: any = {
    email: user.email || "",
    provider: "spotify", // Required field for database constraint
    spotify_access_token: accessToken,
    spotify_refresh_token: refreshToken,
    spotify_token_expires_at: expiresAt.toISOString(),
    spotify_connected_at: new Date().toISOString(),
    spotify_connected: true,
  }

  if (spotifyUserId) {
    updateData.spotify_user_id = spotifyUserId
    console.log("[v0] 📝 Spotify user ID:", spotifyUserId)
  } else {
    console.log("[v0] ⚠️ No Spotify user ID provided (this is OK)")
  }

  console.log("[v0] 💾 Saving tokens to database...")
  console.log("[v0] Token expires at:", expiresAt.toISOString())

  const { data: existingProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  let error

  if (existingProfile) {
    console.log("[v0] 📝 Profile exists, updating...")
    const result = await supabase.from("user_profiles").update(updateData).eq("user_id", user.id)
    error = result.error
  } else {
    console.log("[v0] ➕ Profile doesn't exist, inserting...")
    const result = await supabase.from("user_profiles").insert({
      user_id: user.id,
      ...updateData,
    })
    error = result.error
  }

  if (error) {
    console.error("[v0] ❌ Error saving Spotify tokens:", error)
    console.error("[v0] Error details:", JSON.stringify(error, null, 2))
    return { success: false, error: `Failed to save Spotify tokens: ${error.message}` }
  }

  console.log("[v0] ✅ Tokens saved successfully to database")

  const { data: verifyData, error: verifyError } = await supabase
    .from("user_profiles")
    .select("spotify_access_token, spotify_token_expires_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (verifyError || !verifyData?.spotify_access_token) {
    console.error("[v0] ❌ Verification failed - tokens not found after save!")
    console.error("[v0] Verify error:", verifyError)
    console.error("[v0] Verify data:", verifyData)
    return { success: false, error: "Token save verification failed - tokens not in database" }
  }

  console.log("[v0] ✅ Token save verified successfully")
  console.log("[v0] ✅ Verified token expires at:", verifyData.spotify_token_expires_at)
  return { success: true }
}

export async function getSpotifyConnection() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { connected: false }
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("spotify_connected_at, spotify_token_expires_at")
    .eq("user_id", user.id)
    .single()

  if (error || !data) {
    return { connected: false }
  }

  const isConnected = !!data.spotify_connected_at
  const isExpired = data.spotify_token_expires_at ? new Date(data.spotify_token_expires_at) < new Date() : true

  return {
    connected: isConnected && !isExpired,
    needsRefresh: isConnected && isExpired,
  }
}

export async function checkDuplicateSpotifyAccounts(gameId: string) {
  const supabase = await createServerClient()

  const { data: players, error: playersError } = await supabase
    .from("game_players")
    .select("user_id")
    .eq("game_id", gameId)

  if (playersError || !players) {
    return { hasDuplicates: false }
  }

  const userIds = players.map((p) => p.user_id)
  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("user_id, spotify_user_id")
    .in("user_id", userIds)

  if (profilesError || !profiles) {
    return { hasDuplicates: false }
  }

  const spotifyUserIds = profiles.map((p) => p.spotify_user_id).filter(Boolean)
  const uniqueSpotifyUserIds = new Set(spotifyUserIds)

  return {
    hasDuplicates: spotifyUserIds.length > uniqueSpotifyUserIds.size,
    message:
      spotifyUserIds.length > uniqueSpotifyUserIds.size
        ? "Multiple players are using the same Spotify account. Each player must use their own Spotify account to avoid connection issues."
        : null,
  }
}
