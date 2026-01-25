import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Handle email confirmation callback
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to home with error
  return NextResponse.redirect(`${origin}/auth/signin?error=EmailConfirmationFailed`);
}
