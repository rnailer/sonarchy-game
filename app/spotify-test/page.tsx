"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Music, Filter, ChevronRight, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string }[]
  }
  preview_url: string | null
  uri: string
}

export default function SpotifyTestPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null)
  const [showOnlyWithPreviews, setShowOnlyWithPreviews] = useState(false)

  const filteredResults = showOnlyWithPreviews
    ? searchResults.filter((track) => track.preview_url !== null)
    : searchResults

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch()
      } else {
        setSearchResults([])
      }
    }, 500) // 500ms delay after user stops typing

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`)

      if (!response.ok) {
        throw new Error("Search failed")
      }

      const data = await response.json()
      setSearchResults(data.tracks || [])
    } catch (error) {
      console.error("Search error:", error)
      toast({
        title: "Search failed",
        description: "Failed to search Spotify. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleTrackSelect = (track: SpotifyTrack) => {
    setSelectedTrack(track)
  }

  const handleNext = () => {
    if (!selectedTrack) return

    const params = new URLSearchParams({
      trackId: selectedTrack.id,
      trackName: selectedTrack.name,
      trackArtists: JSON.stringify(selectedTrack.artists),
      trackAlbum: selectedTrack.album.name,
      trackImage: selectedTrack.album.images[0]?.url || "",
      trackUri: selectedTrack.uri,
      trackPreview: selectedTrack.preview_url || "",
    })

    router.push(`/spotify-playback?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-[#000033] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#6CD9FF]/20">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#6CD9FF] to-[#B649C5] bg-clip-text text-transparent">
          Select a Song
        </h1>
        <div className="w-10" />
      </div>

      {/* Search Section */}
      <div className="p-6 space-y-4">
        <div className="relative">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for songs..."
            className="flex-1 bg-[#0D113B] border-2 border-[#6CD9FF] rounded-2xl h-12 px-4 pr-12 text-white placeholder:text-white/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#17BDE5]"
          />
          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 className="w-5 h-5 text-[#6CD9FF] animate-spin" />
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <Button
            onClick={() => setShowOnlyWithPreviews(!showOnlyWithPreviews)}
            variant="outline"
            className={`w-full border-2 rounded-2xl h-10 font-semibold transition-all ${
              showOnlyWithPreviews
                ? "bg-[#6CD9FF] border-[#6CD9FF] text-[#000033] hover:bg-[#17BDE5] hover:text-[#000033]"
                : "bg-transparent border-[#6CD9FF]/30 text-white hover:bg-[#6CD9FF]/10 hover:border-[#6CD9FF]"
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            {showOnlyWithPreviews ? "Showing tracks with previews only" : "Show only tracks with previews"}
          </Button>
        )}
      </div>

      {/* Search Results */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        {filteredResults.length > 0 ? (
          <div className="space-y-3">
            {filteredResults.map((track) => (
              <button
                key={track.id}
                onClick={() => handleTrackSelect(track)}
                className={`w-full p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                  selectedTrack?.id === track.id
                    ? "bg-[#6CD9FF]/20 border-[#6CD9FF]"
                    : "bg-[#0D113B] border-[#6CD9FF]/30 hover:border-[#6CD9FF]"
                }`}
              >
                <div className="flex items-center gap-4">
                  {track.album.images[0] ? (
                    <img
                      src={track.album.images[0].url || "/placeholder.svg"}
                      alt={track.album.name}
                      className="w-16 h-16 rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[#262C87] flex items-center justify-center">
                      <Music className="w-8 h-8 text-[#6CD9FF]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{track.name}</h3>
                    <p className="text-sm text-white/70 truncate">{track.artists.map((a) => a.name).join(", ")}</p>
                    <p className="text-xs text-white/50 truncate">{track.album.name}</p>
                  </div>
                  {!track.preview_url && (
                    <span className="text-xs font-semibold text-white/70 px-3 py-1 bg-white/10 rounded-full border border-white/20">
                      No preview
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : searchResults.length > 0 && showOnlyWithPreviews ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/50">
            <Music className="w-16 h-16 mb-4" />
            <p className="text-lg">No tracks with previews found</p>
            <Button
              onClick={() => setShowOnlyWithPreviews(false)}
              variant="outline"
              className="mt-4 border-[#6CD9FF] text-white hover:bg-[#6CD9FF]/10"
            >
              Show all results
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-white/50">
            <Music className="w-16 h-16 mb-4" />
            <p className="text-lg">Search for songs to test Spotify integration</p>
          </div>
        )}
      </div>

      {selectedTrack && (
        <div className="border-t-2 border-[#6CD9FF] bg-[#0D113B] p-6">
          <div className="flex items-center gap-4 mb-4">
            {selectedTrack.album.images[0] && (
              <img
                src={selectedTrack.album.images[0].url || "/placeholder.svg"}
                alt={selectedTrack.album.name}
                className="w-16 h-16 rounded-lg"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white truncate">{selectedTrack.name}</h3>
              <p className="text-sm text-white/70 truncate">{selectedTrack.artists.map((a) => a.name).join(", ")}</p>
            </div>
          </div>
          <Button
            onClick={handleNext}
            className="w-full bg-[#6CD9FF] hover:bg-[#17BDE5] text-[#000033] h-12 rounded-2xl font-semibold"
          >
            Next
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
