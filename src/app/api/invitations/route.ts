import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; role?: "admin" | "member" | "viewer" };
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase.from("household_members").select("household_id,role").eq("user_id", userId).in("role", ["owner", "admin"]).limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Only an owner or admin can invite members." }, { status: 403 });

  const { error } = await supabase.from("invitations").upsert({ household_id: membership.household_id, email, role: body.role ?? "member", invited_by: userId, accepted_at: null, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }, { onConflict: "household_id,email" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let emailSent = false;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existing) {
      await admin.from("household_members").upsert({ household_id: membership.household_id, user_id: existing.id, role: body.role ?? "member" });
      await admin.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("household_id", membership.household_id).eq("email", email);
    } else {
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin}/auth/callback`;
      const result = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      emailSent = !result.error;
    }
  }

  return NextResponse.json({ ok: true, emailSent });
}
