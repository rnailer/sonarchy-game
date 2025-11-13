// Spotify OAuth utilities with PKCE flow

// Generate a random string for code verifier
function generateRandomString(length: number): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const values = crypto.getRandomValues(new Uint8Array(length))
  return values.reduce((acc, x) => acc + possible[x % possible.length], "")
}

// Generate code challenge from verifier
async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return crypto.subtle.digest("SHA-256", data)
}

function base64encode(input: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hashed = await sha256(codeVerifier)
  return base64encode(hashed)
}

// Helper function to get correct redirect URI
export function getSpotifyRedirectUri(): string {
  if (typeof window !== "undefined") {
    // Use 127.0.0.1 for local development (Spotify requirement as of Nov 2025)
    const origin = window.location.origin.replace("localhost", "127.0.0.1")
    return `${origin}/api/spotify/callback`
  }

  // Server-side fallback - use NEXT_PUBLIC_APP_URL if available
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    return `${appUrl}/api/spotify/callback`
  }

  // Final fallback for local development
  return "http://127.0.0.1:3000/api/spotify/callback"
}

async function getSpotifyClientId(): Promise<string> {
  try {
    const response = await fetch("/api/config")

    if (!response.ok) {
      throw new Error(`Config API error: ${response.status}`)
    }

    const config = await response.json()
    return config.spotifyClientId
  } catch (error) {
    console.error("Failed to fetch Spotify config:", error)
    throw new Error("Failed to fetch Spotify configuration")
  }
}

// Initiate Spotify OAuth flow
export async function initiateSpotifyAuth() {
  const codeVerifier = generateRandomString(64)
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  if (typeof window !== "undefined") {
    localStorage.setItem("spotify_code_verifier", codeVerifier)
    sessionStorage.setItem("spotify_code_verifier", codeVerifier)
    console.log("[v0] 🔐 Code verifier stored in both localStorage and sessionStorage")
  }

  const clientId = await getSpotifyClientId()

  if (!clientId) {
    throw new Error("Spotify Client ID not configured")
  }

  const scope = "user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state"
  const redirectUri = getSpotifyRedirectUri()

  const state = JSON.stringify({
    cv: codeVerifier, // Store full verifier in state
    timestamp: Date.now(),
  })

  const authUrl = new URL("https://accounts.spotify.com/authorize")
  const params = {
    response_type: "code",
    client_id: clientId,
    scope,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
    state: state,
  }

  authUrl.search = new URLSearchParams(params).toString()
  window.location.href = authUrl.toString()
}

// Exchange authorization code for access token
export async function exchangeCodeForToken(code: string, state?: string) {
  let codeVerifier = sessionStorage.getItem("spotify_code_verifier")

  if (!codeVerifier) {
    console.log("[v0] ⚠️ Code verifier not in sessionStorage, trying localStorage")
    codeVerifier = localStorage.getItem("spotify_code_verifier")
  }

  if (!codeVerifier && state) {
    try {
      console.log("[v0] ⚠️ Code verifier not in storage, recovering from state parameter")
      const stateData = JSON.parse(state)
      codeVerifier = stateData.cv

      if (codeVerifier) {
        console.log("[v0] ✅ Code verifier recovered from state parameter")
      }
    } catch (e) {
      console.error("[v0] ❌ Failed to parse state parameter:", e)
    }
  }

  if (!codeVerifier) {
    console.error("[v0] ❌ Code verifier not found in any storage location")
    throw new Error(
      "Code verifier not found. This may be due to browser storage being cleared. Please try connecting again.",
    )
  }

  console.log("[v0] ✅ Code verifier found, proceeding with token exchange")

  const clientId = await getSpotifyClientId()

  if (!clientId) {
    throw new Error("Spotify Client ID not configured")
  }

  const redirectUri = getSpotifyRedirectUri()

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to exchange code for token: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  localStorage.removeItem("spotify_code_verifier")
  sessionStorage.removeItem("spotify_code_verifier")
  console.log("[v0] 🧹 Code verifier cleaned up from storage")

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  }
}

export async function fetchSpotifyUserInfo(accessToken: string, retries = 5): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[v0] 🔍 Fetching Spotify user info (attempt ${attempt}/${retries})...`)

      const response = await fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const userData = await response.json()
        console.log("[v0] ✅ Spotify user info fetched successfully:", userData.id)
        return userData.id
      }

      // Log detailed error information
      const errorText = await response.text()
      console.warn(`[v0] ⚠️ Spotify user info fetch failed (${response.status}):`, errorText)

      // If it's a 401 (unauthorized) or 403 (forbidden), don't retry
      if (response.status === 401 || response.status === 403) {
        console.error(`[v0] ❌ Access token issue (${response.status}), not retrying`)
        return null
      }

      // For other errors, retry with exponential backoff
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s, 16s, 32s
        console.log(`[v0] ⏳ Retrying in ${delay / 1000}s...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    } catch (error) {
      console.error(`[v0] ❌ Error fetching Spotify user info (attempt ${attempt}):`, error)

      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000
        console.log(`[v0] ⏳ Retrying in ${delay / 1000}s...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  console.warn("[v0] ⚠️ Failed to fetch Spotify user info after all retries, continuing without user ID")
  return null
}
