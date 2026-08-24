"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const realtimeTables = ["transactions", "debt_installments", "calendar_events", "recipes", "meal_plans"];

export function useHouseholdRealtime(enabled: boolean, onChange: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channel = supabase.channel("household-live");
    realtimeTables.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
    });
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [enabled, onChange]);
}
