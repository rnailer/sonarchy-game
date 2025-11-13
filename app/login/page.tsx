"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const router = useRouter()
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    try {
      const client = createClient()
      setSupabase(client)
    } catch (err) {
      console.error("[v0] Failed to initialize Supabase:", err)
      setSupabaseError(err instanceof Error ? err.message : "Failed to initialize authentication")
    }
  }, [])

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError("Authentication service not available. Please refresh the page.")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (err) {
      console.error("[v0] Google login error:", err)
      setError(err instanceof Error ? err.message : "Failed to login with Google")
      setIsLoading(false)
    }
  }

  const handleAppleLogin = async () => {
    if (!supabase) {
      setError("Authentication service not available. Please refresh the page.")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (err) {
      console.error("[v0] Apple login error:", err)
      setError(err instanceof Error ? err.message : "Failed to login with Apple")
      setIsLoading(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase) {
      setError("Authentication service not available. Please refresh the page.")
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

      console.log("[v0] Starting email signup process")

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      console.log("[v0] Signup response:", { hasData: !!data, hasError: !!error, userId: data?.user?.id })

      if (error) {
        if (error.message.includes("already registered")) {
          throw new Error("This email is already registered. Please sign in instead.")
        }
        throw error
      }

      if (data?.user) {
        console.log("[v0] Signup successful, checking profile completion")
        const profileComplete = localStorage.getItem("profile_complete") === "true"
        const hasName = !!localStorage.getItem("player_name")
        const hasAvatar = !!localStorage.getItem("player_avatar")
        const hasSpotify = !!localStorage.getItem("spotify_access_token")

        if (profileComplete && hasName && hasAvatar && hasSpotify) {
          console.log("[v0] Profile complete, redirecting to game-mode")
          router.push("/game-mode")
        } else {
          console.log("[v0] Profile incomplete, redirecting to profile-setup")
          router.push("/profile-setup")
        }
      }
    } catch (err) {
      console.error("[v0] Signup error:", err)
      setError(err instanceof Error ? err.message : "Failed to create account")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase) {
      setError("Authentication service not available. Please refresh the page.")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      console.log("[v0] Starting email signin process")

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log("[v0] Signin response:", { hasData: !!data, hasError: !!error, userId: data?.user?.id })

      if (error) throw error

      if (data?.user) {
        console.log("[v0] Sign in successful, checking profile completion")
        const profileComplete = localStorage.getItem("profile_complete") === "true"
        const hasName = !!localStorage.getItem("player_name")
        const hasAvatar = !!localStorage.getItem("player_avatar")
        const spotifyToken = localStorage.getItem("spotify_access_token")
        const spotifyExpiry = localStorage.getItem("spotify_token_expiry")

        // Check if Spotify token is still valid
        const hasValidSpotify = spotifyToken && spotifyExpiry && Number.parseInt(spotifyExpiry) > Date.now()

        if (profileComplete && hasName && hasAvatar && hasValidSpotify) {
          console.log("[v0] Profile complete with valid Spotify, redirecting to game-mode")
          router.push("/game-mode")
        } else {
          console.log("[v0] Profile incomplete or Spotify expired, redirecting to profile-setup")
          router.push("/profile-setup")
        }
      }
    } catch (err) {
      console.error("[v0] Signin error:", err)
      setError(err instanceof Error ? err.message : "Failed to sign in")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#000033] relative overflow-hidden flex flex-col items-center px-[36px]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-32 right-12 text-[#e7260f] text-3xl animate-bounce">♪</div>
        <div
          className="absolute top-40 right-24 text-[#b649c5] text-2xl animate-pulse"
          style={{ animationDelay: "0.3s" }}
        >
          ♪
        </div>
        <div
          className="absolute top-36 right-32 text-[#57c680] text-2xl animate-bounce"
          style={{ animationDelay: "0.5s" }}
        >
          ♪
        </div>
      </div>

      <div className="w-full max-w-md pt-[72px] mb-8">
        <h1 className="text-[22px] font-black text-center tracking-tight leading-tight bg-gradient-to-r from-[#8DE2FF] to-[#109AEB] bg-clip-text text-transparent animate-[fadeInUp_0.8s_ease-out]">
          WELCOME TO THE PARTY
        </h1>
      </div>

      <div className="absolute top-[100px] right-[49px] w-[84px] h-[93px] z-30 animate-[slideInBounce_1s_ease-out]">
        <Image
          src="/scroll-character.png"
          alt="Scroll character"
          width={84}
          height={93}
          className="w-full h-full object-contain scale-x-[-1]"
        />
      </div>

      <div className="w-full relative z-20">
        <div className="bg-gradient-to-tr from-[#0D113B] to-[#5E6590] rounded-3xl border-2 border-[#6CD9FF] p-4 shadow-2xl">
          <h2 className="text-[18px] font-semibold text-white mb-4">{mode === "signin" ? "Sign in" : "Sign up"}</h2>

          <form onSubmit={mode === "signup" ? handleEmailSignUp : handleEmailSignIn}>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/50">
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}

            <div className="relative">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                required
                className="w-full h-[48px] px-4 pr-12 text-base rounded-[16px] bg-[#000033] border-2 border-[#6CD9FF] text-white placeholder:text-[#6CD9FF] placeholder:text-[14px] focus:outline-none focus:border-[#8DE2FF] transition-colors"
              />
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
              >
                <path
                  d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6M22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6M22 6L12 13L2 6"
                  stroke={emailFocused ? "#FFFFFF" : "#D2FFFF"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="relative mt-4">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                minLength={6}
                className="w-full h-[48px] px-4 pr-12 text-base rounded-[16px] bg-[#000033] border-2 border-[#6CD9FF] text-white placeholder:text-[#6CD9FF] placeholder:text-[14px] focus:outline-none focus:border-[#8DE2FF] transition-colors"
              />
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
              >
                <path
                  d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11M5 11H19C20.1046 11 21 11.8954 21 13V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V13C3 11.8954 3.89543 11 5 11Z"
                  stroke={passwordFocused ? "#FFFFFF" : "#D2FFFF"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full mt-4">
              {isLoading ? "Loading..." : mode === "signin" ? "Sign in" : "Sign up"}
            </button>

            <div
              className="border border-dashed rounded-xl pt-2 pb-2 pr-2 pl-4 flex items-center justify-between mt-4"
              style={{ borderColor: "#C7D2FF" }}
            >
              <span className="text-white text-base">
                {mode === "signin" ? "Need an account" : "Already have an account?"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin")
                  setError(null)
                  setSuccess(null)
                }}
                className="text-[14px] font-normal py-2 px-3 rounded-xl border-2 border-[#C7D2FF] text-white hover:bg-[#C7D2FF]/10 transition-colors flex items-center justify-center"
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </div>

            <div className="flex items-center justify-between py-2 mt-3">
              <span className="text-white text-[18px] font-bold">Or</span>
              <Link
                href="#"
                className="text-[#B9F3FF] text-[14px] font-light underline hover:text-[#8DE2FF] transition-colors"
              >
                {mode === "signin" ? "Forgot password?" : ""}
              </Link>
            </div>

            <div className="space-y-3 mt-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full h-[48px] text-[16px] font-semibold rounded-[16px] bg-[#5162DD] border-2 border-[#C7D2FF] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
              >
                Continue with Google
              </button>

              <button
                type="button"
                onClick={handleAppleLogin}
                disabled={isLoading}
                className="w-full h-[48px] text-[16px] font-semibold rounded-[16px] bg-[#30303C] border-2 border-[#D8D8E0] text-white hover:bg-[#3a3a46] transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                Continue with Apple
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="w-full mt-4 relative z-20">
        <div className="bg-gradient-to-tr from-[#0D113B] to-[#5E6590] rounded-3xl border-2 border-[#6CD9FF] p-4 shadow-2xl relative">
          <svg className="w-8 h-8 text-white absolute top-4 right-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>

          <h3 className="text-[16px] font-semibold text-white mb-3">Ready to play?</h3>

          <p className="text-white text-[14px] font-normal leading-relaxed">
            You'll need a Spotify account to join the fun and start your music adventure!
          </p>
        </div>
      </div>

      <div className="absolute left-[37px] bottom-[-57px] w-[150px] h-[150px] z-30 animate-slide-in-left">
        <Image
          src="/midi-keyboard.png"
          alt="MIDI keyboard character"
          width={150}
          height={150}
          className="w-full h-full object-contain"
        />
      </div>

      <div className="absolute right-[47px] bottom-[-59px] w-[150px] h-[150px] z-30 animate-slide-in-right">
        <Image
          src="/record-sleeve-left-01.png"
          alt="Record sleeve character"
          width={150}
          height={150}
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  )
}
