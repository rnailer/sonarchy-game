"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { Slider } from "@/components/ui/slider"

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: any
  }
}

export default function SpotifyPlaybackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Track data from URL params
  const trackId = searchParams.get("trackId")
  const trackName = searchParams.get("trackName")
  const trackArtists = searchParams.get("trackArtists")
  const trackAlbum = searchParams.get("trackAlbum")
  const trackImage = searchParams.get("trackImage")
  const trackUri = searchParams.get("trackUri")
  const trackPreview = searchParams.get("trackPreview")

  const artists = trackArtists ? JSON.parse(trackArtists) : []

  const [player, setPlayer] = useState<any>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(50)
  const [isLoading, setIsLoading] = useState(true)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!trackId) {
      router.push("/spotify-test")
      return
    }

    const script = document.createElement("script")
    script.src = "https://sdk.scdn.co/spotify-player.js"
    script.async = true
    document.body.appendChild(script)

    // Fetch access token
    fetch("/api/spotify/token")
      .then((res) => res.json())
      .then((data) => {
        setAccessToken(data.access_token)
        setIsPremium(data.is_premium || false)
        setIsLoading(false)
      })
      .catch((error) => {
        console.error("Failed to fetch access token:", error)
        toast({
          title: "Authentication error",
          description: "Failed to authenticate with Spotify. Please reconnect.",
          variant: "destructive",
        })
        setIsLoading(false)
      })

    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log("Spotify SDK ready")
    }

    return () => {
      if (player) {
        player.disconnect()
      }
      if (audioRef.current) {
        audioRef.current.pause()
      }
      document.body.removeChild(script)
    }
  }, [trackId])

  // Initialize Spotify Web Playback SDK for Premium users
  useEffect(() => {
    if (!accessToken || !window.Spotify || !isPremium || player) return

    const spotifyPlayer = new window.Spotify.Player({
      name: "Sonarchy Web Player",
      getOAuthToken: (cb: (token: string) => void) => {
        cb(accessToken)
      },
      volume: volume / 100,
    })

    spotifyPlayer.addListener("ready", ({ device_id }: { device_id: string }) => {
      console.log("Player ready with device ID:", device_id)
      setDeviceId(device_id)
      toast({
        title: "Player ready",
        description: "Full playback enabled!",
      })
    })

    spotifyPlayer.addListener("not_ready", ({ device_id }: { device_id: string }) => {
      console.log("Device ID has gone offline:", device_id)
    })

    spotifyPlayer.addListener("player_state_changed", (state: any) => {
      if (!state) return

      setIsPlaying(!state.paused)
      setCurrentPosition(state.position)
      setDuration(state.duration)
    })

    spotifyPlayer.connect()
    setPlayer(spotifyPlayer)
  }, [accessToken, isPremium, volume])

  // Update position for playing track
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      if (isPremium) {
        setCurrentPosition((prev) => Math.min(prev + 1000, duration))
      } else if (audioRef.current) {
        setCurrentPosition(audioRef.current.currentTime * 1000)
        setDuration(audioRef.current.duration * 1000)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isPlaying, duration, isPremium])

  const handlePlayPause = async () => {
    if (isPremium && deviceId && accessToken && trackUri) {
      // Premium: Use Web Playback SDK
      if (!isPlaying) {
        try {
          const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              uris: [trackUri],
            }),
          })

          if (!response.ok) {
            throw new Error("Failed to start playback")
          }

          setIsPlaying(true)
        } catch (error) {
          console.error("Playback error:", error)
          toast({
            title: "Playback failed",
            description: "Failed to play track. Make sure Spotify is not playing on another device.",
            variant: "destructive",
          })
        }
      } else if (player) {
        player.togglePlay()
      }
    } else if (!isPremium && trackPreview) {
      // Free: Use preview URL with HTML5 audio
      if (!audioRef.current) {
        audioRef.current = new Audio(trackPreview)
        audioRef.current.volume = volume / 100

        audioRef.current.addEventListener("ended", () => {
          setIsPlaying(false)
          setCurrentPosition(0)
        })

        audioRef.current.addEventListener("loadedmetadata", () => {
          setDuration(audioRef.current!.duration * 1000)
        })
      }

      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    } else {
      toast({
        title: "No preview available",
        description: "This track doesn't have a preview available. Spotify Premium required for full playback.",
        variant: "destructive",
      })
    }
  }

  const handleSkipNext = () => {
    if (player) {
      player.nextTrack()
    }
  }

  const handleSkipPrevious = () => {
    if (player) {
      player.previousTrack()
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    if (player) {
      player.setVolume(newVolume / 100)
    }
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100
    }
  }

  const handleSeek = (value: number[]) => {
    const position = value[0]
    if (isPremium && player) {
      player.seek(position)
      setCurrentPosition(position)
    } else if (audioRef.current) {
      audioRef.current.currentTime = position / 1000
      setCurrentPosition(position)
    }
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#000033] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#6CD9FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading player...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000033] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#6CD9FF]/20">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#6CD9FF] to-[#B649C5] bg-clip-text text-transparent">
            Now Playing
          </h1>
          <span className="text-xs text-white/50 mt-1">
            {isPremium ? "Premium - Full Playback" : "Free - 30s Preview"}
          </span>
        </div>
        <div className="w-10" />
      </div>

      {/* Album Art and Track Info */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
        {trackImage && (
          <img
            src={trackImage || "/placeholder.svg"}
            alt={trackAlbum || "Album"}
            className="w-64 h-64 rounded-2xl shadow-2xl"
          />
        )}

        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-3xl font-bold text-white">{trackName}</h2>
          <p className="text-lg text-white/70">{artists.map((a: any) => a.name).join(", ")}</p>
          <p className="text-sm text-white/50">{trackAlbum}</p>
        </div>
      </div>

      {/* Player Controls */}
      <div className="border-t-2 border-[#6CD9FF] bg-[#0D113B] p-8 space-y-6">
        {/* Progress bar */}
        {duration > 0 && (
          <div className="space-y-2">
            <Slider
              value={[currentPosition]}
              max={duration}
              step={1000}
              className="w-full"
              onValueChange={handleSeek}
            />
            <div className="flex justify-between text-xs text-white/50">
              <span>{formatTime(currentPosition)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-6">
          {isPremium && (
            <Button
              onClick={handleSkipPrevious}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 w-12 h-12"
            >
              <SkipBack className="w-6 h-6" />
            </Button>
          )}

          <Button
            onClick={handlePlayPause}
            className="w-16 h-16 rounded-full bg-[#6CD9FF] hover:bg-[#17BDE5] text-[#000033] flex items-center justify-center"
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </Button>

          {isPremium && (
            <Button
              onClick={handleSkipNext}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 w-12 h-12"
            >
              <SkipForward className="w-6 h-6" />
            </Button>
          )}
        </div>

        {/* Volume control */}
        <div className="flex items-center gap-4">
          <Volume2 className="w-5 h-5 text-white/70" />
          <Slider value={[volume]} max={100} step={1} className="flex-1" onValueChange={handleVolumeChange} />
          <span className="text-sm text-white/70 w-12 text-right">{volume}%</span>
        </div>

        {!isPremium && !trackPreview && (
          <div className="text-center text-white/50 text-sm">
            <p>No preview available for this track.</p>
            <p className="mt-1">Spotify Premium required for full playback.</p>
          </div>
        )}
      </div>
    </div>
  )
}
