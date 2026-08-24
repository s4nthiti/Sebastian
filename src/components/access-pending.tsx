"use client";

import { Clock3, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AccessPending({ email }: { email: string }) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return <main className="signin-page"><section className="signin-panel"><div className="brand-mark"><Sparkles size={19}/></div><Clock3 size={24} style={{color: "var(--brand)", margin: "0 auto 15px"}}/><h1>Invitation needed.</h1><p><strong>{email}</strong> is signed in, but has not been invited to this household. Ask the owner at s4nthiti@gmail.com to send an invitation, then sign in again.</p><button className="google-button" onClick={signOut}>Use another account</button></section></main>;
}
