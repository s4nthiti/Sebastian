import { SebastianApp } from "@/components/sebastian-app";
import { SignIn } from "@/components/sign-in";
import { AccessPending } from "@/components/access-pending";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { relatedName } from "@/lib/utils";

export default async function HomePage() {
  if (!isSupabaseConfigured()) return <SebastianApp demoMode />;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return <SignIn />;

  const userId = String(data.claims.sub);
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!membership) return <AccessPending email={String(data.claims.email ?? "this account")} />;

  const { data: rows } = await supabase
    .from("transactions")
    .select("id,title,type,amount,occurred_on,categories(name)")
    .eq("household_id", membership.household_id)
    .order("occurred_on", { ascending: false })
    .limit(30);
  const initialTransactions = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: relatedName(row.categories),
    date: row.occurred_on,
    amount: row.type === "income" ? Number(row.amount) : -Number(row.amount),
    icon: row.type === "income" ? "wallet" : "basket",
  }));

  return <SebastianApp demoMode={false} householdId={membership.household_id} userId={userId} initialTransactions={initialTransactions} />;
}
