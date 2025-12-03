"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"

// Auth step states
type AuthStep = "initial" | "email-entry" | "email-sent" | "signin"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [authStep, setAuthStep] = useState<AuthStep>("initial")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push("/auth/check-profile")
      }
    }
    checkAuth()
  }, [router])

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      console.error("[v0] Google auth error:", err)
      setError("Google sign in is not available yet. Please use email.")
      toast({
        title: "Coming soon",
        description: "Google sign in will be available soon. Please use email for now.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAppleAuth = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      console.error("[v0] Apple auth error:", err)
      setError("Apple sign in is not available yet. Please use email.")
      toast({
        title: "Coming soon",
        description: "Apple sign in will be available soon. Please use email for now.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignup = async () => {
    if (!email.trim()) {
      setError("Please enter your email address")
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address (e.g. you@example.com)")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: crypto.randomUUID(), // Generate random password for magic link flow
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        // Check if user already exists
        if (error.message.includes("already registered")) {
          setError("This email is already registered. Please sign in instead.")
          setAuthStep("signin")
          return
        }
        throw error
      }

      if (data?.user) {
        console.log("[v0] Signup successful, creating profile record")

        // Create initial profile record for email signups
        try {
          const { error: profileError } = await supabase.from("user_profiles").upsert({
            user_id: data.user.id,
            email: data.user.email!,
            display_name: data.user.email?.split("@")[0],
            provider: "email",
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "user_id"
          })

          if (profileError) {
            console.error("[v0] Profile creation failed:", profileError)
          }
        } catch (err) {
          console.error("[v0] Error creating profile:", err)
        }
      }

      console.log("[v0] Signup email sent to:", email)
      setAuthStep("email-sent")

    } catch (err: any) {
      console.error("[v0] Signup error:", err)
      setError(err.message || "Failed to send verification email. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignin = async () => {
    if (!email.trim()) {
      setError("Please enter your email address")
      return
    }
    if (!password.trim()) {
      setError("Please enter your password")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (error) throw error

      if (data?.user) {
        console.log("[v0] Sign in successful")
        router.push("/auth/check-profile")
      }
    } catch (err: any) {
      console.error("[v0] Signin error:", err)
      if (err.message.includes("Invalid login")) {
        setError("Invalid email or password. Please try again.")
      } else {
        setError(err.message || "Failed to sign in. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError("Please enter your email address")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      console.log("[v0] Magic link sent to:", email)
      setAuthStep("email-sent")

    } catch (err: any) {
      console.error("[v0] Magic link error:", err)
      setError(err.message || "Failed to send sign in link. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Render different auth steps
  const renderInitialStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full space-y-6"
    >
      {/* Social Auth Buttons - Leading */}
      <div className="space-y-3">
        <Button
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className="w-full h-14 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-xl border border-gray-200 transition-all duration-200 flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>

        <Button
          onClick={handleAppleAuth}
          disabled={isLoading}
          className="w-full h-14 bg-black hover:bg-gray-900 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Continue with Apple
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-[#000033] text-white/60">or continue with email</span>
        </div>
      </div>

      {/* Email Options */}
      <div className="space-y-3">
        <Button
          onClick={() => setAuthStep("email-entry")}
          variant="outline"
          className="w-full h-14 bg-transparent hover:bg-white/10 text-white border-white/30 hover:border-white/50 font-medium rounded-xl transition-all duration-200"
        >
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Sign up with Email
        </Button>

        <button
          onClick={() => setAuthStep("signin")}
          className="w-full text-center text-white/70 hover:text-white text-sm transition-colors py-2"
        >
          Already have an account? <span className="text-cyan-400 hover:text-cyan-300 underline">Sign in</span>
        </button>
      </div>
    </motion.div>
  )

  const renderEmailEntryStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white">Create your account</h2>
        <p className="text-white/60 text-sm">Enter your email and we'll send you a verification link</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm text-white/80">Email address</label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => e.key === "Enter" && handleEmailSignup()}
            className="h-14 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl focus:border-cyan-400 focus:ring-cyan-400/20"
            autoFocus
            autoComplete="email"
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </motion.p>
        )}

        <Button
          onClick={handleEmailSignup}
          disabled={isLoading || !email.trim()}
          className="w-full h-14 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Sending...
            </span>
          ) : (
            "Continue"
          )}
        </Button>
      </div>

      <button
        onClick={() => {
          setAuthStep("initial")
          setError(null)
        }}
        className="w-full text-center text-white/50 hover:text-white/80 text-sm transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to all options
      </button>
    </motion.div>
  )

  const renderEmailSentStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full space-y-6 text-center"
    >
      {/* Success Icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-bold text-white">Check your email</h2>
        <p className="text-white/70">
          We sent a verification link to<br />
          <span className="text-cyan-400 font-medium">{email}</span>
        </p>
      </div>

      <div className="bg-white/5 rounded-xl p-4 space-y-2">
        <p className="text-white/60 text-sm">
          📧 Click the link in the email to verify your account
        </p>
        <p className="text-white/40 text-xs">
          Can't find it? Check your spam folder
        </p>
      </div>

      <div className="space-y-3 pt-4">
        <button
          onClick={handleMagicLink}
          disabled={isLoading}
          className="text-cyan-400 hover:text-cyan-300 text-sm underline transition-colors"
        >
          {isLoading ? "Sending..." : "Resend email"}
        </button>

        <button
          onClick={() => {
            setAuthStep("initial")
            setEmail("")
            setError(null)
          }}
          className="block w-full text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          Use a different email
        </button>
      </div>
    </motion.div>
  )

  const renderSigninStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white">Welcome back</h2>
        <p className="text-white/60 text-sm">Sign in to your account</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="signin-email" className="text-sm text-white/80">Email address</label>
          <Input
            id="signin-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            className="h-14 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl focus:border-cyan-400 focus:ring-cyan-400/20"
            autoFocus
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="password" className="text-sm text-white/80">Password</label>
            <button
              onClick={handleMagicLink}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => e.key === "Enter" && handleEmailSignin()}
            className="h-14 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl focus:border-cyan-400 focus:ring-cyan-400/20"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </motion.p>
        )}

        <Button
          onClick={handleEmailSignin}
          disabled={isLoading || !email.trim() || !password.trim()}
          className="w-full h-14 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </Button>

        {/* Magic Link Option */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-[#000033] text-white/40">or</span>
          </div>
        </div>

        <button
          onClick={handleMagicLink}
          disabled={isLoading || !email.trim()}
          className="w-full h-12 bg-transparent hover:bg-white/5 text-white/70 hover:text-white border border-white/20 hover:border-white/30 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 text-sm"
        >
          Send me a sign in link instead
        </button>
      </div>

      <button
        onClick={() => {
          setAuthStep("initial")
          setError(null)
          setPassword("")
        }}
        className="w-full text-center text-white/50 hover:text-white/80 text-sm transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to all options
      </button>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-[#000033] flex flex-col">
      {/* Header with back button */}
      <header className="p-4">
        <button
          onClick={() => router.push("/")}
          className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* Logo/Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 mb-2">
            SONARCHY
          </h1>
          <p className="text-white/60">The music guessing game</p>
        </div>

        {/* Auth Container */}
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {authStep === "initial" && renderInitialStep()}
            {authStep === "email-entry" && renderEmailEntryStep()}
            {authStep === "email-sent" && renderEmailSentStep()}
            {authStep === "signin" && renderSigninStep()}
          </AnimatePresence>
        </div>

        {/* Terms */}
        <p className="mt-8 text-white/40 text-xs text-center max-w-xs">
          By continuing, you agree to our{" "}
          <a href="/terms" className="text-white/60 hover:text-white underline">Terms of Service</a>
          {" "}and{" "}
          <a href="/privacy" className="text-white/60 hover:text-white underline">Privacy Policy</a>
        </p>
      </main>
    </div>
  )
}
