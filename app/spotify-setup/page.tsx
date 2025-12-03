"use client"

/**
 * SPOTIFY SETUP PAGE
 *
 * PURPOSE: This is a STOPGAP solution for web browser playback.
 * The Spotify Web Playback SDK does NOT work on mobile browsers.
 * Instead, we use Spotify Connect to play on the user's Spotify app.
 *
 * FUTURE: When we wrap in a native mobile app, this page will be
 * removed and replaced with native Spotify SDK integration.
 *
 * FLOW:
 * 1. Host is redirected here before first playback
 * 2. Page auto-polls for available Spotify devices every 2 seconds
 * 3. Once device found, store deviceId in game state or pass via URL
 * 4. Navigate to playback page
 */

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function SpotifySetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameCode = searchParams.get("code")
  const category = searchParams.get("category") || ""

  const [spotifyAccessToken, setSpotifyAccessToken] = useState<string | null>(null)
  const [availableDevices, setAvailableDevices] = useState<any[]>([])
  const [selectedDevice, setSelectedDevice] = useState<{ id: string; name: string } | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    setIsMobile(mobile)
  }, [])

  // Fetch Spotify token
  useEffect(() => {
    const fetchToken = async () => {
      if (!gameCode) return

      try {
        const response = await fetch(`/api/spotify/host-token?code=${gameCode}`)
        if (response.ok) {
          const data = await response.json()
          setSpotifyAccessToken(data.access_token)
        }
      } catch (error) {
        console.error("Failed to fetch Spotify token:", error)
      }
    }

    fetchToken()
  }, [gameCode])

  // Fetch available devices
  const fetchDevices = async () => {
    if (!spotifyAccessToken) return

    try {
      const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setAvailableDevices(data.devices || [])

        if (data.devices && data.devices.length > 0 && !selectedDevice) {
          // Auto-select active device or first available
          const activeDevice = data.devices.find((d: any) => d.is_active)
          const device = activeDevice || data.devices[0]

          setSelectedDevice({ id: device.id, name: device.name })
          setIsPolling(false)

          // Auto-navigate after brief success message
          setTimeout(() => {
            navigateToPlayback(device.id)
          }, 1500)
        }
      }
    } catch (error) {
      console.error("Failed to fetch devices:", error)
    }
  }

  // Auto-poll for devices
  useEffect(() => {
    if (!isPolling || !spotifyAccessToken) return

    fetchDevices()

    const pollInterval = setInterval(() => {
      if (isPolling) {
        fetchDevices()
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [isPolling, spotifyAccessToken])

  const navigateToPlayback = (deviceId?: string) => {
    const device = deviceId || selectedDevice?.id
    const timestamp = Date.now()

    if (device) {
      // Store device ID in localStorage for playback page to use
      localStorage.setItem(`spotify_device_${gameCode}`, device)
    }

    router.push(`/playtime-playback?category=${encodeURIComponent(category)}&code=${gameCode}&t=${timestamp}`)
  }

  const skipSpotifySetup = () => {
    // Skip to playback with 30-sec preview fallback
    const timestamp = Date.now()
    router.push(`/playtime-playback?category=${encodeURIComponent(category)}&code=${gameCode}&t=${timestamp}`)
  }

  return (
    <div className="min-h-screen bg-[#000022] text-white flex items-center justify-center p-6">
      <div className="bg-[#0D113B] rounded-2xl p-8 max-w-md w-full border-2 border-[#8BE1FF] text-center">
        {/* Header */}
        <div className="text-6xl mb-6">🎵</div>
        <h1 className="text-3xl font-bold text-white mb-4">Let's Connect Your Spotify</h1>

        {/* Status Messages */}
        {!selectedDevice ? (
          <>
            <p className="text-lg text-white/80 mb-6">
              {isMobile ? "Open Spotify on your phone to get started" : "Open Spotify on any device to continue"}
            </p>

            {/* Open Spotify Button (Mobile) */}
            {isMobile && (
              <a
                href="spotify://"
                className="block w-full px-8 py-5 text-2xl font-bold text-white rounded-2xl mb-4 text-center"
                style={{
                  background: "linear-gradient(135deg, #1DB954 0%, #1ED760 100%)",
                  border: "3px solid #1ED760",
                  boxShadow: "0 8px 0 0 #117A37",
                  textDecoration: "none",
                }}
              >
                📱 Open Spotify
              </a>
            )}

            {/* Polling Indicator */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-4 h-4 border-2 border-[#8BE1FF] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/60">Searching for your Spotify device...</p>
            </div>

            {/* Available Devices List */}
            {availableDevices.length > 0 && (
              <div className="mb-6">
                <p className="text-sm text-white/70 mb-3">Found devices:</p>
                <div className="space-y-2">
                  {availableDevices.map((device) => (
                    <div key={device.id} className="text-sm text-white/50">
                      • {device.name} ({device.type})
                      {device.is_active && <span className="text-green-400"> - Active</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Success State */}
            <div className="mb-6">
              <div className="text-5xl mb-4">✓</div>
              <p className="text-xl font-bold text-green-400 mb-2">Connected!</p>
              <p className="text-lg text-white/80">Playing on: {selectedDevice.name}</p>
            </div>
            <p className="text-sm text-white/60">Starting playback...</p>
          </>
        )}

        {/* Skip Option */}
        {!selectedDevice && (
          <button
            onClick={skipSpotifySetup}
            className="w-full px-6 py-3 text-sm text-white/70 hover:text-white/90 transition-colors"
          >
            Skip for now (use 30-sec preview)
          </button>
        )}

        {/* Temporary Notice */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs text-white/40">
            Note: This is a web browser limitation. Native mobile app coming soon with seamless playback!
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SpotifySetup() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#000022] text-white flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#8BE1FF] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SpotifySetupContent />
    </Suspense>
  )
}
