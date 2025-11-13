export interface MockPlayer {
  id: string
  name: string
  avatar: string
  color: string
  songTitle: string
  songArtist: string
  albumCover: string
  spotifyTrack: {
    duration_ms: number
    id: string
    name: string
    artists: Array<{ name: string }>
    album: {
      images: Array<{ url: string }>
    }
  }
}

export const MOCK_PLAYERS: MockPlayer[] = [
  {
    id: "player1",
    name: "Rich",
    avatar: "vinyl",
    color: "#E879F9",
    songTitle: "Bicycle Race",
    songArtist: "Queen",
    albumCover: "/queen-greatest-hits-album-cover.jpg",
    spotifyTrack: {
      duration_ms: 60000,
      id: "mock-track-1",
      name: "Bicycle Race",
      artists: [{ name: "Queen" }],
      album: {
        images: [{ url: "/queen-greatest-hits-album-cover.jpg" }],
      },
    },
  },
  {
    id: "player2",
    name: "Sarah",
    avatar: "jukebox",
    color: "#3B82F6",
    songTitle: "Bohemian Rhapsody",
    songArtist: "Queen",
    albumCover: "/queen-greatest-hits-album-cover.jpg",
    spotifyTrack: {
      duration_ms: 60000,
      id: "mock-track-2",
      name: "Bohemian Rhapsody",
      artists: [{ name: "Queen" }],
      album: {
        images: [{ url: "/queen-greatest-hits-album-cover.jpg" }],
      },
    },
  },
  {
    id: "player3",
    name: "Mike",
    avatar: "cassette",
    color: "#F97316",
    songTitle: "Don't Stop Me Now",
    songArtist: "Queen",
    albumCover: "/queen-greatest-hits-album-cover.jpg",
    spotifyTrack: {
      duration_ms: 60000,
      id: "mock-track-3",
      name: "Don't Stop Me Now",
      artists: [{ name: "Queen" }],
      album: {
        images: [{ url: "/queen-greatest-hits-album-cover.jpg" }],
      },
    },
  },
  {
    id: "player4",
    name: "Emma",
    avatar: "walkman",
    color: "#14B8A6",
    songTitle: "We Will Rock You",
    songArtist: "Queen",
    albumCover: "/queen-greatest-hits-album-cover.jpg",
    spotifyTrack: {
      duration_ms: 60000,
      id: "mock-track-4",
      name: "We Will Rock You",
      artists: [{ name: "Queen" }],
      album: {
        images: [{ url: "/queen-greatest-hits-album-cover.jpg" }],
      },
    },
  },
]

// This function is kept for manual testing only, not called automatically
export function initializeMockPlayers() {
  console.warn("[v0] Mock players should not be used in production. Use real players from database.")
}

export function getRandomUnplayedPlayer(playedPlayerIds: string[]): MockPlayer | null {
  const unplayed = MOCK_PLAYERS.filter((p) => !playedPlayerIds.includes(p.id))
  if (unplayed.length === 0) return null
  return unplayed[Math.floor(Math.random() * unplayed.length)]
}
