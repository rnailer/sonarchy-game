import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  console.log("[v0] Spotify callback route hit")
  console.log("[v0] Code:", code)
  console.log("[v0] Error:", error)

  if (error) {
    console.log("[v0] Redirecting with error:", error)
    const redirectUrl = new URL("/profile-setup?error=spotify_auth_failed", request.url)
    return NextResponse.redirect(redirectUrl)
  }

  if (!code) {
    console.log("[v0] No code received, redirecting with error")
    const redirectUrl = new URL("/profile-setup?error=no_code", request.url)
    return NextResponse.redirect(redirectUrl)
  }

  const returnUrl = request.cookies.get("spotify_return_url")?.value

  if (returnUrl) {
    // Clear the cookie
    const response = NextResponse.redirect(new URL(`${returnUrl}&spotify_code=${code}`, request.url))
    response.cookies.delete("spotify_return_url")
    console.log("[v0] Redirecting back to game:", returnUrl)
    return response
  }

  const redirectUrl = new URL(`/profile-setup?spotify_code=${code}`, request.url)
  console.log("[v0] Redirecting to:", redirectUrl.toString())
  return NextResponse.redirect(redirectUrl)
}
