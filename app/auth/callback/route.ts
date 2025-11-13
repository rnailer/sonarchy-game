import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      try {
        const { error: profileError } = await supabase.from("user_profiles").upsert(
          {
            user_id: data.user.id,
            email: data.user.email!,
            display_name: data.user.user_metadata.full_name || data.user.email?.split("@")[0],
            avatar_url: data.user.user_metadata.avatar_url,
            provider: data.user.app_metadata.provider || "unknown",
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          },
        )

        if (profileError) {
          console.log("[v0] Profile creation skipped (table may not exist):", profileError.message)
        }
      } catch (profileError) {
        console.log("[v0] Profile creation skipped:", profileError)
      }

      // Note: We can't access localStorage on the server, so we redirect to a client-side route
      // that will check profile completion and redirect appropriately
      return NextResponse.redirect(`${origin}/auth/check-profile`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
