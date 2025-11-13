"use client"

import { useState, useEffect } from "react"
import { X, SkipForward, Clock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getGameState } from "@/lib/game-state"

interface DebugPanelProps {
  onClose: () => void
  onFastForward?: (seconds: number) => void
  onSkipToEnd?: () => void
  currentPlayerId?: string
  onSwitchPlayer?: (playerId: string) => void
}

export function DebugPanel({ onClose, onFastForward, onSkipToEnd }: DebugPanelProps) {
  const [gameState, setGameState] = useState(getGameState())
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setGameState(getGameState())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleClearGameState = () => {
    if (confirm("Clear all game state? This will reset everything.")) {
      localStorage.removeItem("sonarchy_game_state")
      setGameState(getGameState())
    }
  }

  const playerCount = Object.keys(gameState.players).length

  return (
    <div className="fixed bottom-4 right-4 z-[200]">
      {!isExpanded ? (
        <Button
          onClick={() => setIsExpanded(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-full w-14 h-14 shadow-lg"
        >
          🐛
        </Button>
      ) : (
        <div className="bg-gray-900 text-white rounded-lg shadow-2xl w-80 max-h-[600px] overflow-hidden flex flex-col border-2 border-purple-500">
          <div className="bg-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🐛</span>
              <h3 className="font-bold">Debug Panel</h3>
            </div>
            <button onClick={() => setIsExpanded(false)} className="hover:bg-purple-700 rounded p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-purple-300">Game State</h4>
              <div className="bg-gray-800 rounded p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Round:</span>
                  <span className="font-mono">{gameState.currentRound}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Show Names:</span>
                  <span className="font-mono">{gameState.showNames ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Players:</span>
                  <span className="font-mono">{playerCount}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-purple-300">Quick Actions</h4>
              <div className="space-y-2">
                {onFastForward && (
                  <>
                    <Button
                      onClick={() => onFastForward(10)}
                      className="w-full bg-green-600 hover:bg-green-700 text-xs"
                      size="sm"
                    >
                      <Clock className="w-3 h-3 mr-2" />
                      Fast Forward 10s
                    </Button>
                    <Button
                      onClick={() => onFastForward(25)}
                      className="w-full bg-green-600 hover:bg-green-700 text-xs"
                      size="sm"
                    >
                      <Clock className="w-3 h-3 mr-2" />
                      Fast Forward 25s
                    </Button>
                  </>
                )}

                {onSkipToEnd && (
                  <Button onClick={onSkipToEnd} className="w-full bg-orange-600 hover:bg-orange-700 text-xs" size="sm">
                    <SkipForward className="w-3 h-3 mr-2" />
                    Skip to Timer End
                  </Button>
                )}

                <Button onClick={handleClearGameState} className="w-full bg-red-600 hover:bg-red-700 text-xs" size="sm">
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Clear Game State
                </Button>
              </div>
            </div>

            {playerCount > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-purple-300">Players in Game</h4>
                <div className="bg-gray-800 rounded p-3 text-xs">
                  <p className="text-gray-400">{playerCount} player(s) from database</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
