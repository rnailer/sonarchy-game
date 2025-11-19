"use client"

 /* Test deployment update - Richard */
const SHOW_DEBUG = false

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

// ...rest of the file stays the same

export default function SonarchySplash() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const router = useRouter()

  const addDebug = (message: string) => {
    console.log(`[v0] ${message}`)
    setDebugInfo((prev) => [...prev.slice(-8), message])
  }

  useEffect(() => {
    addDebug("Page mounted")
    addDebug(`User agent: ${navigator.userAgent}`)
    addDebug(`Window size: ${window.innerWidth}x${window.innerHeight}`)

    const checkAuth = async () => {
      try {
        addDebug("Checking auth...")
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        addDebug(`Auth check complete. Session: ${session ? "exists" : "none"}`)
        setIsCheckingAuth(false)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        addDebug(`Auth check error: ${errorMsg}`)
        console.error("[v0] Auth check error:", error)
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [])

  const handleGetStarted = async () => {
    try {
      addDebug("Get Started clicked")
      const supabase = createClient()

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        addDebug(`Session error: ${error.message}`)
        console.error("[v0] Session check error:", error)
        router.push("/login")
        return
      }

      if (session) {
        addDebug("Session found, going to game-mode")
        router.push("/game-mode")
      } else {
        addDebug("No session, going to login")
        router.push("/login")
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      addDebug(`handleGetStarted error: ${errorMsg}`)
      console.error("[v0] handleGetStarted error:", error)
      router.push("/login")
    }
  }

  return (
    <div
      style={{
        backgroundColor: "#000022",
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {SHOW_DEBUG && debugInfo.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(255, 0, 0, 0.9)",
            color: "white",
            padding: "10px",
            fontSize: "10px",
            fontFamily: "monospace",
            zIndex: 9999,
            maxHeight: "150px",
            overflow: "auto",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>DEBUG INFO (Android):</div>
          {debugInfo.map((info, i) => (
            <div key={i} style={{ marginBottom: "2px" }}>
              {i + 1}. {info}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 20,
          top: "47px",
          width: "364px",
          maxWidth: "90vw",
          height: "auto",
          left: "50%",
          transform: "translateX(-50%)",
          filter: "drop-shadow(0 0 15px rgba(255, 115, 255, 0.4)) drop-shadow(0 0 25px rgba(23, 189, 229, 0.3))",
        }}
      >
        <Image
          src="/note-decorations-1.svg"
          alt="Musical note decorations"
          width={364}
          height={217}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "auto",
            objectFit: "contain",
            mixBlendMode: "normal",
          }}
          onLoad={() => addDebug("Note decorations loaded")}
          onError={() => addDebug("Note decorations failed to load")}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          top: "92px",
          width: "319px",
          maxWidth: "85vw",
          height: "auto",
          filter: "drop-shadow(0 0 20px rgba(23, 189, 229, 0.6)) drop-shadow(0 0 40px rgba(182, 73, 197, 0.4))",
        }}
      >
        <Image
          src="/SonarchyOutline02.svg"
          alt="Sonarchy"
          width={319}
          height={123}
          priority
          style={{ width: "100%", height: "auto" }}
          onLoad={() => addDebug("Sonarchy logo loaded")}
          onError={() => addDebug("Sonarchy logo failed to load")}
        />
      </div>

      <div
        style={{
          position: "absolute",
          zIndex: 10,
          top: "195px",
          left: "50%",
          transform: "translateX(calc(-50% - 15px))",
          maxWidth: "195px",
        }}
      >
        <Image
          src="/tagline.svg"
          alt="Playlist Clash, Party Bash"
          width={195}
          height={86}
          style={{ width: "auto", height: "auto", maxWidth: "195px" }}
          priority
          onLoad={() => addDebug("Tagline loaded")}
          onError={() => addDebug("Tagline failed to load")}
        />
      </div>

      <div
        style={{
          position: "absolute",
          zIndex: 0,
          top: "184px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "360px",
          maxWidth: "100vw",
        }}
      >
        <div style={{ position: "relative", width: "100%" }}>
          <Image
            src="/speaker-bg.jpg"
            alt="Sonarchy Speaker"
            width={600}
            height={900}
            style={{
              width: "100%",
              height: "auto",
            }}
            priority
            onLoad={() => addDebug("Speaker background loaded")}
            onError={() => addDebug("Speaker background failed to load")}
          />
        </div>
      </div>

                  <div
        style={{
          position: "absolute",
          zIndex: 10,
          bottom: "120px", // same baseline as MP3 player
          right: "-10px",
          maxWidth: "180px",
        }}
      >
        <Image
          src="/walkman-right.png"
          alt="Dancing Walkman Character"
          width={221}
          height={216}
          style={{
            width: "100%",
            height: "auto",
            maxWidth: "180px",
            filter: "drop-shadow(0 25px 25px rgba(0, 0, 0, 0.5))",
          }}
          onLoad={() => addDebug("Walkman character loaded")}
          onError={() => addDebug("Walkman character failed to load")}
        />
      </div>

      <div
        style={{
          position: "absolute",
          zIndex: 10,
          bottom: "130px", // sits above the Get Started button
          right: "0px",
          maxWidth: "180px",
          pointerEvents: "none", // so it never blocks taps
        }}
      >
        <Image
          src="/walkman-right.png"
          alt="Dancing Walkman Character"
          width={221}
          height={216}
          style={{
            width: "100%",
            height: "auto",
            maxWidth: "180px",
            filter: "drop-shadow(0 25px 25px rgba(0, 0, 0, 0.5))",
          }}
          onLoad={() => addDebug("Walkman character loaded")}
          onError={() => addDebug("Walkman character failed to load")}
        />
      </div>

      <div
        style={{
          position: "absolute",
          zIndex: 10,
          bottom: "63px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "267px",
          maxWidth: "80vw",
        }}
      >
        <Button
          onClick={handleGetStarted}
          disabled={isCheckingAuth}
          style={{
            width: "100%",
            height: "48px",
            fontSize: "20px",
            fontWeight: 700,
            borderRadius: "9999px",
            background: "linear-gradient(to right, #FFC2FF, #FF73FF, #FF00A4, #D6006D)",
            color: "white",
            border: "2px solid #FFD0F5",
            boxShadow: "0 4px 0 0 #7A0066",
            textShadow: "2px 2px 0px #FF00A4",
            cursor: isCheckingAuth ? "not-allowed" : "pointer",
            opacity: isCheckingAuth ? 0.5 : 1,
            transition: "transform 0.15s ease",
          }}
          onMouseDown={(e) => {
            if (!isCheckingAuth) {
              e.currentTarget.style.transform = "translateY(4px)"
              e.currentTarget.style.boxShadow = "none"
            }
          }}
          onMouseUp={(e) => {
            if (!isCheckingAuth) {
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "0 4px 0 0 #7A0066"
            }
          }}
          onMouseLeave={(e) => {
            if (!isCheckingAuth) {
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "0 4px 0 0 #7A0066"
            }
          }}
        >
          Get Started
        </Button>
      </div>
    </div>
  )
}
