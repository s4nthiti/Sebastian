export type CalendarRepeat = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type CalendarItemType = "event" | "reminder" | "planner" | "money" | "meal";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  repeat: CalendarRepeat;
  endDate?: string;
  type: CalendarItemType;
};

type CalendarEventRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  recurrence_rule: string | null;
  item_type: CalendarItemType;
};

const recurrenceRules: Record<Exclude<CalendarRepeat, "none">, string> = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
};

export function repeatToRecurrenceRule(repeat: CalendarRepeat, endDate?: string) {
  if (repeat === "none") return null;
  const until = endDate?.replaceAll("-", "");
  return `${recurrenceRules[repeat]}${until ? `;UNTIL=${until}` : ""}`;
}

export function recurrenceRuleToRepeat(rule: string | null): CalendarRepeat {
  const frequency = rule?.match(/(?:^|;)FREQ=([^;]+)/i)?.[1]?.toLowerCase();
  return frequency === "daily" || frequency === "weekly" || frequency === "monthly" || frequency === "yearly"
    ? frequency
    : "none";
}

export function recurrenceRuleToEndDate(rule: string | null) {
  const until = rule?.match(/(?:^|;)UNTIL=(\d{4})(\d{2})(\d{2})/i);
  return until ? `${until[1]}-${until[2]}-${until[3]}` : undefined;
}

export function bangkokDateTimeToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

export function calendarEventFromRow(row: CalendarEventRow): CalendarEvent {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(row.starts_at));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
    repeat: recurrenceRuleToRepeat(row.recurrence_rule),
    endDate: recurrenceRuleToEndDate(row.recurrence_rule),
    type: row.item_type,
  };
}

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function calendarEventOccursOn(event: CalendarEvent, date: string) {
  if (event.date === date) return true;
  if (event.repeat === "none" || date < event.date || (event.endDate && date > event.endDate)) return false;

  const start = parseDate(event.date);
  const target = parseDate(date);
  const elapsedDays = Math.round((target.getTime() - start.getTime()) / 86_400_000);

  if (event.repeat === "daily") return true;
  if (event.repeat === "weekly") return elapsedDays % 7 === 0;
  if (event.repeat === "monthly") return target.getUTCDate() === start.getUTCDate();
  return target.getUTCMonth() === start.getUTCMonth() && target.getUTCDate() === start.getUTCDate();
}

export function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
