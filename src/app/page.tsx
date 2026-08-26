import { SebastianApp } from "@/components/sebastian-app";
import { SignIn } from "@/components/sign-in";
import { AccessPending } from "@/components/access-pending";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { calendarEventFromRow } from "@/lib/calendar";
import { relatedName, relatedProfile } from "@/lib/utils";

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

  const [{ data: profileRow }, { data: rows }, { data: calendarRows }, { data: categoryRows }, { data: debtRows }, { data: memberRows }, { data: invitationRows }, { data: activityRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,email,avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id,title,type,amount,occurred_on,categories(name)")
      .eq("household_id", membership.household_id)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("calendar_events")
      .select("id,title,description,starts_at,recurrence_rule,item_type")
      .eq("household_id", membership.household_id)
      .order("starts_at", { ascending: true }),
    supabase
      .from("categories")
      .select("id,name,name_th,color")
      .eq("household_id", membership.household_id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("debt_installments")
      .select("id,title,original_amount,remaining_amount,installment_amount,next_due_date")
      .eq("household_id", membership.household_id)
      .eq("status", "active")
      .order("next_due_date", { ascending: true }),
    supabase
      .from("household_members")
      .select("user_id,role,joined_at,profiles!household_members_user_id_fkey(display_name,email)")
      .eq("household_id", membership.household_id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id,email,role,created_at,expires_at")
      .eq("household_id", membership.household_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("id,action,entity_type,created_at,profiles!audit_logs_actor_id_fkey(display_name,email)")
      .eq("household_id", membership.household_id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const initialTransactions = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: relatedName(row.categories),
    date: row.occurred_on,
    amount: row.type === "income" ? Number(row.amount) : -Number(row.amount),
    icon: row.type === "income" ? "wallet" : "basket",
  }));
  const initialCalendarEvents = (calendarRows ?? []).map(calendarEventFromRow);
  const initialCategories = (categoryRows ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    nameTh: category.name_th ?? "",
    color: category.color,
  }));
  const initialDebts = (debtRows ?? []).flatMap((debt) => debt.next_due_date ? [{
    id: debt.id,
    name: debt.title,
    paid: Math.max(Number(debt.original_amount) - Number(debt.remaining_amount), 0),
    total: Number(debt.original_amount),
    installment: Number(debt.installment_amount),
    dueDate: debt.next_due_date,
  }] : []);
  const initialMembers = (memberRows ?? []).map((member) => {
    const profile = relatedProfile(member.profiles);
    return { userId: member.user_id, name: profile.displayName, email: profile.email, role: member.role, joinedAt: member.joined_at };
  });
  const initialInvitations = (invitationRows ?? []).map((invitation) => ({ id: invitation.id, email: invitation.email, role: invitation.role, createdAt: invitation.created_at, expiresAt: invitation.expires_at }));
  const initialActivities = (activityRows ?? []).map((activity) => {
    const actor = relatedProfile(activity.profiles);
    return { id: String(activity.id), action: activity.action, entityType: activity.entity_type, actorName: actor.displayName || actor.email || "Household member", createdAt: activity.created_at };
  });
  const accountEmail = profileRow?.email ?? String(data.claims.email ?? "");
  const initialProfile = {
    displayName: profileRow?.display_name?.trim() || accountEmail.split("@")[0] || "Household member",
    email: accountEmail,
    avatarUrl: profileRow?.avatar_url ?? undefined,
  };

  return <SebastianApp demoMode={false} householdId={membership.household_id} userId={userId} initialProfile={initialProfile} initialTransactions={initialTransactions} initialCalendarEvents={initialCalendarEvents} initialCategories={initialCategories} initialDebts={initialDebts} initialMembers={initialMembers} initialInvitations={initialInvitations} initialActivities={initialActivities} />;
}
