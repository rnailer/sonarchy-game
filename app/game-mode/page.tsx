"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"

export default function GameModePage() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch("/auth/signout", { method: "POST" })
      router.push("/")
    } catch (error) {
      console.error("Logout error:", error)
      router.push("/")
    }
  }

  return (
    <div className="min-h-screen bg-[#000033] px-4 py-8">
      <Link
        href="/profile-setup"
        className="fixed left-4 bottom-4 z-50 bg-[#8DE2FF] hover:bg-[#6CD9FF] rounded-full p-3 w-12 h-12 flex items-center justify-center"
        aria-label="Edit Profile"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000033"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </Link>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="fixed right-4 bottom-4 z-50 bg-[#FF4D6D] hover:bg-[#E63E5D] rounded-full p-3 w-12 h-12 flex items-center justify-center"
        aria-label="Logout"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>

      {/* Header */}
      <div className="text-center mb-12 mt-16">
        <h1 className="text-2xl font-black text-[#8DE2FF]">SELECT A GAME TYPE</h1>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto space-y-8">
        {/* With Friends Card */}
        <div className="rounded-3xl border-2 border-[#6CD9FF] bg-[#1a1a4d] p-6 relative">
          <div className="bg-[#000033] border-2 border-[#6CD9FF] rounded-xl px-4 py-2 inline-block mb-4">
            <h2 className="text-white text-lg font-bold">With friends</h2>
          </div>

          <p className="text-white text-base mb-6 leading-relaxed">
            Play with your friends in a private game, whether they're in the same room or on the other side of the world
          </p>

          <Link href="/remote" className="block mb-4">
            <button className="w-full h-14 bg-[#43D4AF] hover:bg-[#3BC49F] text-[#000033] font-bold text-base rounded-2xl border-2 border-[#D0FFF3]">
              Join with code
            </button>
          </Link>

          <Link href="/with-friends" className="block">
            <button className="w-full h-14 bg-[#FFD03B] hover:bg-[#FFC700] text-[#000033] font-bold text-base rounded-2xl border-2 border-[#FFF8C4]">
              Create a game with friends
            </button>
          </Link>
        </div>

        {/* Online Game Card */}
        <div className="rounded-3xl border-2 border-[#6CD9FF] bg-[#1a1a4d] p-6 relative">
          <div className="bg-[#000033] border-2 border-[#6CD9FF] rounded-xl px-4 py-2 inline-block mb-4">
            <h2 className="text-white text-lg font-bold">Online game</h2>
          </div>

          <p className="text-white text-base mb-6 leading-relaxed">
            Party and play with players around the world in our online party rooms.
          </p>

          <button className="w-full h-14 bg-[#43D4AF] hover:bg-[#3BC49F] text-[#000033] font-bold text-base rounded-2xl border-2 border-[#D0FFF3]">
            Play online
          </button>
        </div>
      </div>
    </div>
  )
}
