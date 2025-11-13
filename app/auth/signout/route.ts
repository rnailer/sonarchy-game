import { getSupabaseServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient()
  await supabase.auth.signOut()

  // Redirect to splash screen instead of login
  return NextResponse.redirect(new URL("/", request.url))
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()
  await supabase.auth.signOut()

  // Redirect to splash screen instead of login
  return NextResponse.redirect(new URL("/", request.url))
}
