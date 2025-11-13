import { NextResponse } from "next/server"

export async function GET() {
  const spotifyClientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  return NextResponse.json({
    spotifyClientId,
    appUrl,
  })
}
