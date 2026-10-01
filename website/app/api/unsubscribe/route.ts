import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// POST /api/unsubscribe - Stop marketing emails. The token is an HMAC of the
// email made by marketing/send.py. Email clients' one-click unsubscribe POSTs
// with email and token in the query string, the /unsubscribe page sends JSON.
export async function POST(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let email = params.get("email") || "";
  let token = params.get("token") || "";
  let source = "one-click";

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    email = typeof body.email === "string" ? body.email : email;
    token = typeof body.token === "string" ? body.token : token;
    source = "web";
  }

  email = email.trim().toLowerCase();
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Unsubscribe is not configured" }, { status: 503 });
  }
  if (!email || !/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
  }

  const expected = createHmac("sha256", secret).update(email).digest();
  if (!timingSafeEqual(expected, Buffer.from(token, "hex"))) {
    return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await admin
    .from("email_unsubscribes")
    .upsert({ email, source }, { onConflict: "email", ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
