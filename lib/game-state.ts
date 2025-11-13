interface PlayerData {
  name: string
  avatar: string
  color?: string
  songTitle?: string
  songArtist?: string
  albumCover?: string
  songUri?: string
  songPreviewUrl?: string
  spotifyTrack?: {
    duration_ms: number
    id: string
    name: string
    artists: Array<{ name: string }>
    album: {
      images: Array<{ url: string }>
    }
  }
}

interface GameState {
  players: Record<string, PlayerData>
  currentRound: number
  showNames: boolean | null // Changed from boolean to boolean | null to track if vote has happened
  playedSongs: string[]
  currentSongNumber: number
  leaderboard: Array<{
    playerId: string
    playerName: string
    songTitle: string
    songArtist: string
    albumCover: string
    color: string
  } | null>
}

const GAME_STATE_KEY = "sonarchy_game_state"

export function getGameState(): GameState {
  if (typeof window === "undefined")
    return {
      players: {},
      currentRound: 1,
      showNames: null, // Changed from false to null
      playedSongs: [],
      currentSongNumber: 1,
      leaderboard: [],
    }

  const stored = localStorage.getItem(GAME_STATE_KEY)
  if (!stored)
    return {
      players: {},
      currentRound: 1,
      showNames: null, // Changed from false to null
      playedSongs: [],
      currentSongNumber: 1,
      leaderboard: [],
    }

  try {
    return JSON.parse(stored)
  } catch {
    return {
      players: {},
      currentRound: 1,
      showNames: null, // Changed from false to null
      playedSongs: [],
      currentSongNumber: 1,
      leaderboard: [],
    }
  }
}

export function saveGameState(state: Partial<GameState>) {
  if (typeof window === "undefined") return

  const current = getGameState()
  const updated = { ...current, ...state }
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(updated))
}

export function savePlayerData(playerId: string, data: Partial<PlayerData>) {
  const state = getGameState()
  state.players[playerId] = { ...state.players[playerId], ...data } as PlayerData
  saveGameState(state)
}

export function getPlayerData(playerId: string): PlayerData | null {
  const state = getGameState()
  return state.players[playerId] || null
}

export function clearGameState() {
  if (typeof window === "undefined") return
  localStorage.removeItem(GAME_STATE_KEY)
}

export function markSongAsPlayed(playerId: string) {
  const state = getGameState()
  const playedSongs = state.playedSongs || []
  if (!playedSongs.includes(playerId)) {
    state.playedSongs = [...playedSongs, playerId]
    state.currentSongNumber = state.playedSongs.length + 1
    saveGameState(state)
  }
}

export function getNextUnplayedSong(): string | null {
  const state = getGameState()
  const allPlayerIds = Object.keys(state.players)
  const playedSongs = state.playedSongs || []
  const remainingPlayers = allPlayerIds.filter((id) => !playedSongs.includes(id))

  if (remainingPlayers.length > 0) {
    return remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)]
  }

  return null
}

export function updateLeaderboard(leaderboard: GameState["leaderboard"]) {
  saveGameState({ leaderboard })
}

export function startNewRound() {
  const state = getGameState()
  saveGameState({
    currentRound: state.currentRound + 1,
    playedSongs: [],
    currentSongNumber: 1,
    leaderboard: [],
    showNames: state.showNames, // Don't reset showNames - keep the preference from round 1
  })
}

export function areAllRoundsComplete(): boolean {
  const state = getGameState()
  const totalPlayers = Object.keys(state.players).length
  return state.currentRound >= totalPlayers
}

export function getRandomPlayerForCategory(): string | null {
  const state = getGameState()
  const allPlayerIds = Object.keys(state.players)
  if (allPlayerIds.length === 0) return null
  return allPlayerIds[Math.floor(Math.random() * allPlayerIds.length)]
}

export function resetGameState() {
  if (typeof window === "undefined") return

  const state = getGameState()
  const resetState: GameState = {
    players: state.players, // Keep players but reset everything else
    currentRound: 1,
    showNames: null,
    playedSongs: [],
    currentSongNumber: 1,
    leaderboard: [],
  }

  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(resetState))
  console.log("[v0] Game state reset to round 1")
}
