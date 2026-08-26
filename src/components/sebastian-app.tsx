"use client";

import * as Avatar from "@radix-ui/react-avatar";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Select from "@radix-ui/react-select";
import { DayPicker, type DateRange } from "@daypicker/react";
import { enGB, th } from "@daypicker/react/locale";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Ellipsis,
  Languages,
  LayoutDashboard,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShoppingBasket,
  Sparkles,
  Sun,
  Trash2,
  TrainFront,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { copy, type Locale } from "@/lib/i18n";
import { calendarEvents as seedCalendarEvents, categories as seedFinancialCategories, debts, recipes, scheduledPayments, transactions as seedTransactions } from "@/lib/demo-data";
import {
  bangkokDateTimeToIso,
  calendarEventFromRow,
  calendarEventOccursOn,
  repeatToRecurrenceRule,
  todayInputValue,
  type CalendarEvent,
  type CalendarRepeat,
} from "@/lib/calendar";
import { cn, formatMoney, initials, relatedName, relatedProfile } from "@/lib/utils";
import { useHouseholdRealtime } from "@/hooks/use-household-realtime";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { useLocale, useTheme } from "@/components/providers";

type View = "overview" | "finances" | "calendar" | "recipes" | "household" | "settings";
type Transaction = (typeof seedTransactions)[number];
type FinancialCategory = { id: string; name: string; nameTh: string; color: string };
type ScheduledPayment = { id: string; title: string; amount: number; dueDate: string };
type DebtInstallment = { id: string; name: string; paid: number; total: number; installment: number; dueDate: string };
type HouseholdMember = { userId: string; name: string; email: string; role: string; joinedAt: string };
type HouseholdInvitation = { id: string; email: string; role: string; createdAt: string; expiresAt: string };
type HouseholdActivity = { id: string; action: string; entityType: string; actorName: string; createdAt: string };
type UserProfile = { displayName: string; email: string; avatarUrl?: string };
type PendingConfirmation =
  | { kind: "category"; category: FinancialCategory }
  | { kind: "calendar"; event: CalendarEvent };

const navIcons: Record<View, React.ElementType> = {
  overview: LayoutDashboard,
  finances: CircleDollarSign,
  calendar: CalendarDays,
  recipes: BookOpen,
  household: Users,
  settings: Settings,
};

function LanguageSwitcher({ locale, onChange }: { locale: Locale; onChange: (locale: Locale) => void }) {
  return (
    <div className="language-switcher" role="group" aria-label={locale === "th" ? "เลือกภาษา" : "Choose language"}>
      <span className="language-switcher-icon" aria-hidden="true"><Languages size={15} /></span>
      <button className={cn("language-option", locale === "en" && "active")} type="button" aria-pressed={locale === "en"} onClick={() => onChange("en")} lang="en">EN</button>
      <button className={cn("language-option", locale === "th" && "active")} type="button" aria-pressed={locale === "th"} onClick={() => onChange("th")} lang="th">ไทย</button>
    </div>
  );
}

function PageHeading({ locale, view, profileName, onAdd }: { locale: Locale; view: View; profileName: string; onAdd: () => void }) {
  const t = copy[locale];
  const today = dateFromInputValue(todayInputValue());
  const todayLabel = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(today);
  const titles: Record<View, string> = {
    overview: t.greeting,
    finances: t.finances,
    calendar: t.calendar,
    recipes: t.recipes,
    household: t.household,
    settings: t.settings,
  };
  const subtitles: Record<View, string> = {
    overview: t.subtitle,
    finances: locale === "th" ? "เห็นภาพเงินของบ้านอย่างชัดเจนในที่เดียว" : "A clear view of every baht flowing through your home.",
    calendar: locale === "th" ? "กิจกรรม เตือนความจำ ค่าใช้จ่าย และมื้ออาหาร" : "Events, reminders, money, and meals in one calm view.",
    recipes: locale === "th" ? "สูตรโปรดของทุกคนในบ้าน" : "Your household’s collection of recipes worth making again.",
    household: locale === "th" ? "จัดการสมาชิก สิทธิ์ และตรวจสอบกิจกรรม" : "Manage members, access, and household activity.",
    settings: locale === "th" ? "ปรับ Sebastian ให้เข้ากับบ้านของคุณ" : "Make Sebastian feel at home in your household.",
  };
  const actions: Partial<Record<View, string>> = {
    finances: t.quickAdd,
    calendar: t.addEvent,
    recipes: t.newRecipe,
    household: t.invite,
  };
  const action = actions[view];

  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{todayLabel}</div>
        <h1>{titles[view]}{view === "overview" ? `, ${profileName}.` : ""}</h1>
        <p>{subtitles[view]}</p>
      </div>
      {action ? (
        <button className="primary-btn" onClick={onAdd}><Plus size={15} /> {action}</button>
      ) : null}
    </div>
  );
}

function TransactionIcon({ name }: { name: string }) {
  const Icon = name === "basket" ? ShoppingBasket : name === "wallet" ? WalletCards : name === "zap" ? Zap : name === "train" ? TrainFront : CreditCard;
  return <Icon size={15} />;
}

function Transactions({ items, limit, emptyMessage = "No transactions in this period." }: { items: Transaction[]; limit?: number; emptyMessage?: string }) {
  const visibleItems = limit === undefined ? items : items.slice(0, limit);
  if (visibleItems.length === 0) return <div className="transaction-empty">{emptyMessage}</div>;

  return (
    <div className="transaction-list">
      {visibleItems.map((item) => (
        <div className="transaction-row" key={item.id}>
          <div className="transaction-icon"><TransactionIcon name={item.icon} /></div>
          <div className="transaction-copy"><strong>{item.title}</strong><span>{item.category} · {item.date}</span></div>
          <div className={cn("transaction-amount", item.amount > 0 ? "positive" : "")}>{item.amount > 0 ? "+" : "−"}{formatMoney(Math.abs(item.amount))}</div>
        </div>
      ))}
    </div>
  );
}

function DailyJournal({ locale, transactions, rangeLabel }: { locale: Locale; transactions: Transaction[]; rangeLabel: string }) {
  const income = transactions.reduce((total, transaction) => total + Math.max(transaction.amount, 0), 0);
  const expenses = transactions.reduce((total, transaction) => total + Math.abs(Math.min(transaction.amount, 0)), 0);
  const dateFormatter = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="card daily-journal-card">
      <div className="card-header daily-journal-header">
        <div><h2 className="card-title">{locale === "th" ? "บันทึกรายวัน" : "Daily journal"}</h2><p className="card-subtitle">{rangeLabel} · {transactions.length} {locale === "th" ? "รายการ" : `entr${transactions.length === 1 ? "y" : "ies"}`}</p></div>
        <div className="journal-summary" aria-label={locale === "th" ? "สรุปรายรับรายจ่ายตามช่วงวันที่เลือก" : "Financial summary for the selected dates"}>
          <div><span>{locale === "th" ? "รายรับ" : "Income"}</span><strong className="positive">+{formatMoney(income)}</strong></div>
          <div><span>{locale === "th" ? "รายจ่าย" : "Expenses"}</span><strong className="negative">−{formatMoney(expenses)}</strong></div>
          <div><span>{locale === "th" ? "สุทธิ" : "Net"}</span><strong>{formatMoney(income - expenses)}</strong></div>
        </div>
      </div>
      <div className="journal-table-wrap">
        <table className="journal-table">
          <thead><tr><th scope="col">{locale === "th" ? "รายการ" : "Entry"}</th><th scope="col">{locale === "th" ? "วันที่" : "Date"}</th><th scope="col">{locale === "th" ? "หมวดหมู่" : "Category"}</th><th scope="col">{locale === "th" ? "ประเภท" : "Type"}</th><th className="journal-amount" scope="col">{locale === "th" ? "จำนวนเงิน" : "Amount"}</th></tr></thead>
          <tbody>{transactions.length === 0 ? <tr><td className="journal-empty" colSpan={5}>{locale === "th" ? "ยังไม่มีรายการในช่วงวันที่เลือก" : "No income or expenses in the selected dates."}</td></tr> : transactions.map((transaction) => { const occurredOn = transactionDate(transaction.date); return <tr key={transaction.id}><td><div className="journal-entry"><span className="transaction-icon"><TransactionIcon name={transaction.icon} /></span><strong>{transaction.title}</strong></div></td><td>{occurredOn ? dateFormatter.format(occurredOn) : transaction.date}</td><td>{transaction.category}</td><td><span className={cn("journal-type", transaction.amount >= 0 ? "income" : "expense")}>{transaction.amount >= 0 ? (locale === "th" ? "รายรับ" : "Income") : (locale === "th" ? "รายจ่าย" : "Expense")}</span></td><td className={cn("journal-amount", transaction.amount >= 0 ? "positive" : "negative")}>{transaction.amount >= 0 ? "+" : "−"}{formatMoney(Math.abs(transaction.amount))}</td></tr>; })}</tbody>
        </table>
      </div>
    </div>
  );
}

type SpendingPoint = { month: string; income: number; expense: number };

function MoneyChart({ data, locale }: { data: SpendingPoint[]; locale: Locale }) {
  if (data.length === 0 || data.every((item) => item.income === 0 && item.expense === 0)) return <div className="chart-empty">{locale === "th" ? "ยังไม่มีประวัติธุรกรรม" : "No transaction history yet"}</div>;

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -12, right: 4, top: 8, bottom: 0 }} barGap={4}>
          <CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
          <Tooltip cursor={{ fill: "var(--surface-muted)", radius: 8 }} contentStyle={{ background: "var(--surface-strong)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13 }} formatter={(v) => formatMoney(Number(v))} />
          <Bar dataKey="income" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expense" fill="var(--yellow)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type CategoryChartItem = { id?: string; name: string; value: number; color: string; archived?: boolean };

function CategoryPieChart({ data, total, locale }: { data: CategoryChartItem[]; total: number; locale: Locale }) {
  if (data.length === 0) {
    return <div className="chart-empty">{locale === "th" ? "ยังไม่มีข้อมูลค่าใช้จ่าย" : "No expense data yet"}</div>;
  }

  return (
    <>
      <div className="pie-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3} cornerRadius={5} stroke="none">
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--surface-strong)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13 }} formatter={(value) => formatMoney(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pie-chart-center">
          <span>{locale === "th" ? "ค่าใช้จ่าย" : "Expenses"}</span>
          <strong>{formatMoney(total)}</strong>
        </div>
      </div>
      <div className="pie-chart-legend">
        {data.map((item) => (
          <div key={item.name}>
            <span><i style={{ background: item.color }} />{item.name}</span>
            <strong>{total > 0 ? Math.round((item.value / total) * 100) : 0}%</strong>
          </div>
        ))}
      </div>
    </>
  );
}

function Metrics({ locale, transactions, rangeLabel, duePayments }: { locale: Locale; transactions: Transaction[]; rangeLabel?: string; duePayments?: ScheduledPayment[] }) {
  const t = copy[locale];
  const income = transactions.reduce((total, item) => total + Math.max(item.amount, 0), 0);
  const expenses = transactions.reduce((total, item) => total + Math.abs(Math.min(item.amount, 0)), 0);
  const balance = income - expenses;
  const dueSoon = (duePayments ?? []).reduce((total, payment) => total + payment.amount, 0);
  const dueSoonCount = duePayments?.length ?? 0;
  const dueSoonMeta = locale === "th"
    ? `${dueSoonCount} รายการ · ${rangeLabel ?? "ใน 7 วัน"}`
    : `${dueSoonCount} item${dueSoonCount === 1 ? "" : "s"} · ${rangeLabel ?? "next 7 days"}`;
  const values = [
    { label: t.balance, value: balance, meta: rangeLabel ?? t.thisMonth, icon: WalletCards, tone: "var(--brand-soft)", color: "var(--brand)" },
    { label: t.income, value: income, meta: rangeLabel ?? t.thisMonth, icon: ArrowDownLeft, tone: "#e5f1ec", color: "#37826f" },
    { label: t.expenses, value: expenses, meta: rangeLabel ?? t.thisMonth, icon: ArrowUpRight, tone: "#fff0ea", color: "var(--coral)" },
    { label: t.dueSoon, value: dueSoon, meta: dueSoonMeta, icon: ReceiptText, tone: "#fff4dc", color: "#bd8123" },
  ];
  return (
    <div className="metric-grid">
      {values.map(({ label, value, meta, icon: Icon, tone, color }) => (
        <div className="metric-card" key={label}>
          <div className="metric-top"><span>{label}</span><span className="metric-icon" style={{ background: tone, color }}><Icon size={15} /></span></div>
          <div className="metric-value">{formatMoney(value)}</div>
          <div className="metric-meta">{meta}</div>
        </div>
      ))}
    </div>
  );
}

function Overview({ locale, transactions, calendarEvents, debtInstallments, onNavigate, onOpenCalendar }: { locale: Locale; transactions: Transaction[]; calendarEvents: CalendarEvent[]; debtInstallments: DebtInstallment[]; onNavigate: (view: View) => void; onOpenCalendar: (date: string) => void }) {
  const t = copy[locale];
  const today = useMemo(() => dateFromInputValue(todayInputValue()), []);
  const currentMonthRange = useMemo<FinanceRange>(() => financeRange("month", today), [today]);
  const currentMonthTransactions = useMemo(() => transactions.filter((transaction) => {
    const occurredOn = transactionDate(transaction.date);
    return occurredOn ? dateIsInRange(occurredOn, currentMonthRange) : false;
  }), [currentMonthRange, transactions]);
  const spendingChart = useMemo<SpendingPoint[]>(() => {
    const formatter = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { month: "short" });
    const buckets = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
      return { key: `${date.getFullYear()}-${date.getMonth()}`, month: formatter.format(date), income: 0, expense: 0 };
    });
    const bucketsByMonth = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    for (const transaction of transactions) {
      const occurredOn = transactionDate(transaction.date);
      if (!occurredOn) continue;
      const bucket = bucketsByMonth.get(`${occurredOn.getFullYear()}-${occurredOn.getMonth()}`);
      if (!bucket) continue;
      if (transaction.amount >= 0) bucket.income += transaction.amount;
      else bucket.expense += Math.abs(transaction.amount);
    }
    return buckets.map(({ month, income, expense }) => ({ month, income, expense }));
  }, [locale, today, transactions]);
  const spendingRangeLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { month: "short", year: "numeric" });
    const firstMonth = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return `${formatter.format(firstMonth)} — ${formatter.format(today)}`;
  }, [locale, today]);
  const todayValue = useMemo(() => inputValueFromDate(today), [today]);
  const upcomingEvents = useMemo(() => {
    return calendarEvents
      .filter((event) => calendarEventOccursOn(event, todayValue))
      .map((event) => ({ id: `${event.id}-${todayValue}`, date: todayValue, event }))
      .sort((a, b) => a.event.time.localeCompare(b.event.time));
  }, [calendarEvents, todayValue]);
  const dueSoonEnd = useMemo(() => { const date = new Date(today); date.setDate(date.getDate() + 6); return date; }, [today]);
  const upcomingPayments = useMemo<ScheduledPayment[]>(() => [
    ...scheduledPayments,
    ...debtInstallments.map((debt) => ({ id: `debt-${debt.id}`, title: debt.name, amount: debt.installment, dueDate: debt.dueDate })),
  ].filter((payment) => dateIsInRange(dateFromInputValue(payment.dueDate), { start: today, end: dueSoonEnd })), [debtInstallments, dueSoonEnd, today]);
  const nextMeal = upcomingEvents.find(({ event }) => event.type === "meal");
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short" }), [locale]);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { month: "short" }), [locale]);
  const typeLabels: Record<CalendarEvent["type"], string> = locale === "th"
    ? { event: "กิจกรรม", reminder: "เตือนความจำ", planner: "แผน", money: "การเงิน", meal: "มื้ออาหาร" }
    : { event: "Event", reminder: "Reminder", planner: "Plan", money: "Money", meal: "Meal" };

  return <>
    <Metrics locale={locale} transactions={currentMonthTransactions} duePayments={upcomingPayments} />
    <div className="dashboard-grid">
      <div className="stack">
        <div className="card">
          <div className="card-header"><div><h2 className="card-title">{t.spending}</h2><p className="card-subtitle">{spendingRangeLabel}</p></div><div className="overview-card-actions"><div className="legend"><span><i style={{ background: "var(--brand)" }} />{t.income}</span><span><i style={{ background: "var(--yellow)" }} />{t.expenses}</span></div><button className="text-button" type="button" onClick={() => onNavigate("finances")}>{locale === "th" ? "ดูการเงิน" : "See financial"}<ArrowRight size={12} /></button></div></div>
          <MoneyChart data={spendingChart} locale={locale} />
        </div>
        <div className="card">
          <div className="card-header"><div><h2 className="card-title">{t.recent}</h2><p className="card-subtitle">{locale === "th" ? "อัปเดตล่าสุดจากทุกคนในบ้าน" : "Latest updates from your household"}</p></div><button className="text-button" onClick={() => onNavigate("finances")}>{t.allTransactions}<ArrowRight size={12} /></button></div>
          <Transactions items={transactions} limit={4} />
        </div>
      </div>
      <div className="stack">
        <div className="card">
          <div className="card-header"><div><h2 className="card-title">{t.upcoming}</h2><p className="card-subtitle">{t.today} · {financeRangeLabel({ start: today, end: today }, locale)}</p></div><button className="text-button" onClick={() => onOpenCalendar(todayValue)}>{t.seeCalendar}<ArrowRight size={12} /></button></div>
          {upcomingEvents.length > 0 ? <div className="upcoming-list">{upcomingEvents.slice(0, 5).map(({ id, date, event }) => { const occurrenceDate = dateFromInputValue(date); const tone = event.type === "money" || event.type === "planner" ? "yellow" : event.type === "event" || event.type === "meal" ? "green" : ""; return <button className="event-row overview-event-row" type="button" key={id} onClick={() => onOpenCalendar(date)}><div className="date-tile"><strong>{occurrenceDate.getDate()}</strong><span>{monthFormatter.format(occurrenceDate)}</span></div><div className={cn("event-line", tone)} /><div className="event-copy"><strong>{event.title}</strong><span>{event.time} · {event.description || typeLabels[event.type]}</span></div></button>; })}</div> : <div className="overview-empty">{locale === "th" ? "ไม่มีกิจกรรมวันนี้" : "Nothing scheduled today."}</div>}
        </div>
        <button className="card meal-card overview-meal-card" type="button" onClick={() => onOpenCalendar(nextMeal?.date ?? todayValue)}>
          <div className="meal-kicker">{t.menu}{nextMeal ? ` · ${dateFormatter.format(dateFromInputValue(nextMeal.date))}` : ""}</div>
          <h3>{nextMeal?.event.title ?? t.noMeal}</h3>
          <p>{nextMeal?.event.description || (locale === "th" ? "เปิดปฏิทินเพื่อวางแผนมื้ออาหาร" : "Open Calendar to plan a household meal.")}</p>
          <div className="meal-meta"><span>{nextMeal ? `◷ ${nextMeal.event.time}` : t.seeCalendar}</span><span>→</span></div>
        </button>
      </div>
    </div>
  </>;
}

type FinancePeriod = "day" | "week" | "month" | "year" | "range";
type FinanceRange = { start: Date; end: Date };

function financeRange(period: Exclude<FinancePeriod, "range">, selected: Date): FinanceRange {
  const start = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
  const end = new Date(start);
  if (period === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
  } else if (period === "month") {
    start.setDate(1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
  } else if (period === "year") {
    start.setMonth(0, 1);
    end.setFullYear(start.getFullYear(), 11, 31);
  }
  return { start, end };
}

function financeRangeLabel({ start, end }: FinanceRange, locale: Locale) {
  const language = locale === "th" ? "th-TH" : "en-GB";
  const fullDate = new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" });
  if (inputValueFromDate(start) === inputValueFromDate(end)) return fullDate.format(start);
  const startDate = new Intl.DateTimeFormat(language, start.getFullYear() === end.getFullYear() ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  return `${startDate.format(start)} — ${fullDate.format(end)}`;
}

function dateIsInRange(date: Date, range: FinanceRange) {
  return date >= range.start && date <= range.end;
}

function inclusiveDayCount(start: Date, end: Date) {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86_400_000) + 1;
}

function transactionDate(date: string) {
  const iso = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const today = dateFromInputValue(todayInputValue());
  if (date.startsWith("Today") || date === "Just now") return today;
  const short = date.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  if (!short) return undefined;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return new Date(today.getFullYear(), months.indexOf(short[2].toLowerCase()), Number(short[1]));
}

function FinanceDateSelector({ value, range, period, locale, onDateChange, onRangeChange }: { value: string; range: FinanceRange; period: FinancePeriod; locale: Locale; onDateChange: (value: string) => void; onRangeChange: (range: FinanceRange) => void }) {
  const [open, setOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"single" | "range">(period === "range" ? "range" : "single");
  const [draftDate, setDraftDate] = useState(() => dateFromInputValue(value));
  const [draftRange, setDraftRange] = useState<DateRange>({ from: range.start, to: range.end });
  const selected = dateFromInputValue(value);
  const label = financeRangeLabel(range, locale);

  function applyDate() {
    onDateChange(inputValueFromDate(draftDate));
    setOpen(false);
  }

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setPickerMode(period === "range" ? "range" : "single");
      setDraftDate(selected);
      setDraftRange({ from: range.start, to: range.end });
    }
    setOpen(nextOpen);
  }

  function changePickerMode(nextMode: "single" | "range") {
    setPickerMode(nextMode);
    if (nextMode === "single") setDraftDate(draftRange.from ?? range.start);
    else setDraftRange({ from: draftDate, to: draftDate });
  }

  function applyRange() {
    if (!draftRange.from || !draftRange.to) return;
    const start = draftRange.from <= draftRange.to ? draftRange.from : draftRange.to;
    const end = draftRange.from <= draftRange.to ? draftRange.to : draftRange.from;
    onRangeChange({ start, end });
    setOpen(false);
  }

  const draftLabel = draftRange.from
    ? draftRange.to
      ? financeRangeLabel({ start: draftRange.from, end: draftRange.to }, locale)
      : locale === "th" ? "เลือกวันที่สิ้นสุด" : "Select an end date"
    : locale === "th" ? "เลือกวันที่เริ่มต้นและสิ้นสุด" : "Select start and end dates";

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger asChild>
        <button className="date-selector finance-date-selector" type="button" aria-label={locale === "th" ? "เลือกช่วงวันที่" : "Select reporting date"}>
          <CalendarDays size={15} />
          <span>{label}</span>
          <ChevronDown className="date-selector-chevron" size={13} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={cn("date-picker-popover", "finance-date-popover", pickerMode === "range" && "finance-range-popover")} align="end" sideOffset={8} collisionPadding={12}>
          <div className="date-picker-mode-tabs" role="group" aria-label={locale === "th" ? "รูปแบบการเลือกวันที่" : "Date selection mode"}>
            <button type="button" className={pickerMode === "single" ? "active" : ""} aria-pressed={pickerMode === "single"} onClick={() => changePickerMode("single")}>{locale === "th" ? "วันเดียว" : "Single date"}</button>
            <button type="button" className={pickerMode === "range" ? "active" : ""} aria-pressed={pickerMode === "range"} onClick={() => changePickerMode("range")}>{locale === "th" ? "ช่วงวันที่" : "Date range"}</button>
          </div>
          {pickerMode === "range" ? (
            <DayPicker animate fixedWeeks mode="range" resetOnSelect defaultMonth={draftRange.from ?? range.start} locale={locale === "th" ? th : enGB} selected={draftRange} onSelect={(nextRange) => setDraftRange(nextRange ?? { from: undefined })} weekStartsOn={1} showOutsideDays />
          ) : (
            <DayPicker animate fixedWeeks mode="single" required defaultMonth={draftDate} locale={locale === "th" ? th : enGB} selected={draftDate} onSelect={setDraftDate} weekStartsOn={1} showOutsideDays />
          )}
          {pickerMode === "range" ? (
            <div className="date-picker-footer range-picker-footer">
              <span>{draftLabel}</span>
              <div className="range-picker-actions">
                <button className="range-picker-cancel" type="button" onClick={() => setOpen(false)}>{copy[locale].cancel}</button>
                <button type="button" disabled={!draftRange.from || !draftRange.to} onClick={applyRange}>{locale === "th" ? "ใช้ช่วงวันที่" : "Apply range"}</button>
              </div>
            </div>
          ) : (
            <div className="date-picker-footer range-picker-footer">
              <span>{financeRangeLabel({ start: draftDate, end: draftDate }, locale)}</span>
              <div className="range-picker-actions">
                <button className="range-picker-cancel" type="button" onClick={() => setDraftDate(new Date())}>{locale === "th" ? "วันนี้" : "Today"}</button>
                <button type="button" onClick={applyDate}>{locale === "th" ? "ใช้วันที่" : "Apply date"}</button>
              </div>
            </div>
          )}
          <Popover.Arrow className="date-picker-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Finances({ locale, transactions, financialCategories, debtInstallments, onAddCategory, onDeleteCategory }: { locale: Locale; transactions: Transaction[]; financialCategories: FinancialCategory[]; debtInstallments: DebtInstallment[]; onAddCategory: () => void; onDeleteCategory: (category: FinancialCategory) => void }) {
  const t = copy[locale];
  const [period, setPeriod] = useState<FinancePeriod>("month");
  const [selectedDate, setSelectedDate] = useState(todayInputValue);
  const [customRange, setCustomRange] = useState(() => { const today = todayInputValue(); return { from: today, to: today }; });
  const selected = useMemo(() => dateFromInputValue(selectedDate), [selectedDate]);
  const range = useMemo<FinanceRange>(() => {
    if (period !== "range") return financeRange(period, selected);
    const from = dateFromInputValue(customRange.from);
    const to = dateFromInputValue(customRange.to);
    return from <= to ? { start: from, end: to } : { start: to, end: from };
  }, [customRange.from, customRange.to, period, selected]);
  const periodLabel = useMemo(() => financeRangeLabel(range, locale), [locale, range]);
  const filteredTransactions = useMemo(() => transactions.filter((transaction) => {
    const occurredOn = transactionDate(transaction.date);
    return occurredOn ? dateIsInRange(occurredOn, range) : false;
  }), [range, transactions]);
  const duePayments = useMemo<ScheduledPayment[]>(() => [
    ...scheduledPayments,
    ...debtInstallments.map((debt) => ({ id: `debt-${debt.id}`, title: debt.name, amount: debt.installment, dueDate: debt.dueDate })),
  ], [debtInstallments]);
  const filteredPayments = useMemo(() => duePayments.filter((payment) => dateIsInRange(dateFromInputValue(payment.dueDate), range)), [duePayments, range]);
  const filteredDebts = useMemo(() => debtInstallments.filter((debt) => dateIsInRange(dateFromInputValue(debt.dueDate), range)), [debtInstallments, range]);
  const categoryRows = useMemo<CategoryChartItem[]>(() => {
    const palette = ["#ff7b54", "#3a7d6f", "#e7b25b", "#8a78c2", "#aeb7b4", "#4f8ec9"];
    const totals = new Map<string, number>();
    for (const transaction of filteredTransactions) {
      if (transaction.amount >= 0) continue;
      totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + Math.abs(transaction.amount));
    }
    const knownNames = new Set(financialCategories.map((category) => category.name));
    const configured = financialCategories.map((category) => ({
      id: category.id,
      name: locale === "th" ? category.nameTh || category.name : category.name,
      value: totals.get(category.name) ?? 0,
      color: category.color,
    }));
    const unconfigured = Array.from(totals)
      .filter(([name]) => !knownNames.has(name))
      .map(([name, value], index) => ({ name: `${name} (${locale === "th" ? "เก็บถาวร" : "Archived"})`, value, color: palette[index % palette.length], archived: true }));
    return [...configured, ...unconfigured].sort((a, b) => b.value - a.value);
  }, [filteredTransactions, financialCategories, locale]);
  const categoryData = categoryRows.filter((category) => category.value > 0);
  const barChartData = useMemo<SpendingPoint[]>(() => {
    const language = locale === "th" ? "th-TH" : "en-GB";
    const buckets: Array<SpendingPoint & { start: Date; end: Date }> = [];
    const numberOfDays = inclusiveDayCount(range.start, range.end);
    if (numberOfDays <= 14) {
      for (let index = 0; index < numberOfDays; index += 1) {
        const day = new Date(range.start);
        day.setDate(range.start.getDate() + index);
        buckets.push({ month: new Intl.DateTimeFormat(language, numberOfDays === 1 ? { day: "numeric", month: "short" } : { weekday: "short", day: "numeric" }).format(day), income: 0, expense: 0, start: day, end: day });
      }
    } else if (numberOfDays <= 92) {
      for (let start = new Date(range.start); start <= range.end;) {
        const end = new Date(start);
        end.setDate(Math.min(start.getDate() + 6, start.getDate() + inclusiveDayCount(start, range.end) - 1));
        buckets.push({ month: `${new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(start)}–${new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(end)}`, income: 0, expense: 0, start: new Date(start), end });
        start = new Date(end);
        start.setDate(start.getDate() + 1);
      }
    } else if (numberOfDays <= 731) {
      for (let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1); cursor <= range.end; cursor.setMonth(cursor.getMonth() + 1)) {
        const monthStart = new Date(cursor);
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const start = monthStart < range.start ? new Date(range.start) : monthStart;
        const end = monthEnd > range.end ? new Date(range.end) : monthEnd;
        buckets.push({ month: new Intl.DateTimeFormat(language, { month: "short", year: numberOfDays > 365 ? "2-digit" : undefined }).format(cursor), income: 0, expense: 0, start, end });
      }
    } else {
      for (let year = range.start.getFullYear(); year <= range.end.getFullYear(); year += 1) {
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        buckets.push({ month: String(year), income: 0, expense: 0, start: yearStart < range.start ? new Date(range.start) : yearStart, end: yearEnd > range.end ? new Date(range.end) : yearEnd });
      }
    }
    for (const transaction of filteredTransactions) {
      const occurredOn = transactionDate(transaction.date);
      if (!occurredOn) continue;
      const bucket = buckets.find((item) => occurredOn >= item.start && occurredOn <= item.end);
      if (!bucket) continue;
      if (transaction.amount >= 0) bucket.income += transaction.amount;
      else bucket.expense += Math.abs(transaction.amount);
    }
    return buckets.map(({ month, income, expense }) => ({ month, income, expense }));
  }, [filteredTransactions, locale, range]);
  const categoryTotal = categoryData.reduce((total, category) => total + category.value, 0);
  const transactionLabel = locale === "th" ? `${filteredTransactions.length} รายการ` : `${filteredTransactions.length} transaction${filteredTransactions.length === 1 ? "" : "s"}`;
  const periodNames: Record<FinancePeriod, string> = { day: locale === "th" ? "วัน" : "Day", week: t.week, month: t.month, year: t.year, range: locale === "th" ? "ช่วงวันที่" : "Range" };

  function changePeriod(nextPeriod: FinancePeriod) {
    if (nextPeriod === "range") setCustomRange({ from: inputValueFromDate(range.start), to: inputValueFromDate(range.end) });
    else if (period === "range") setSelectedDate(inputValueFromDate(range.start));
    setPeriod(nextPeriod);
  }

  function changeCustomRange(nextRange: FinanceRange) {
    setCustomRange({ from: inputValueFromDate(nextRange.start), to: inputValueFromDate(nextRange.end) });
    setSelectedDate(inputValueFromDate(nextRange.start));
    setPeriod("range");
  }

  function changeSingleDate(nextDate: string) {
    setSelectedDate(nextDate);
    setPeriod("day");
  }

  return <>
    <div className="section-toolbar finance-toolbar"><div className="period-tabs finance-period-tabs">{(["day", "week", "month", "year", "range"] as const).map((item) => <button type="button" key={item} className={period === item ? "active" : ""} aria-pressed={period === item} onClick={() => changePeriod(item)}>{periodNames[item]}</button>)}</div><FinanceDateSelector value={selectedDate} range={range} period={period} locale={locale} onDateChange={changeSingleDate} onRangeChange={changeCustomRange} /></div>
    <Metrics locale={locale} transactions={filteredTransactions} rangeLabel={periodLabel} duePayments={filteredPayments} />
    <div className="finance-visual-grid">
      <div className="card"><div className="card-header"><div><h2 className="card-title">{t.spending}</h2><p className="card-subtitle">{periodLabel}</p></div><div className="legend"><span><i style={{ background: "var(--brand)" }} />{t.income}</span><span><i style={{ background: "var(--yellow)" }} />{t.expenses}</span></div></div><MoneyChart data={barChartData} locale={locale} /></div>
      <div className="card category-chart-card"><div className="card-header"><div><h2 className="card-title">{locale === "th" ? "สัดส่วนค่าใช้จ่าย" : "Expense breakdown"}</h2><p className="card-subtitle">{periodLabel}</p></div></div><CategoryPieChart data={categoryData} total={categoryTotal} locale={locale} /></div>
    </div>
    <DailyJournal locale={locale} transactions={filteredTransactions} rangeLabel={periodLabel} />
    <div className="finance-grid">
      <div className="stack"><div className="card"><div className="card-header"><div><h2 className="card-title">{t.allTransactions}</h2><p className="card-subtitle">{transactionLabel} · {periodLabel}</p></div><button className="icon-btn" aria-label="Transaction options"><Ellipsis size={15}/></button></div><Transactions items={filteredTransactions} emptyMessage={locale === "th" ? "ไม่มีรายการในช่วงวันที่เลือก" : "No transactions in the selected dates."} /></div></div>
      <div className="stack">
        <div className="card"><div className="card-header"><div><h2 className="card-title">{t.category}</h2><p className="card-subtitle">{t.expenses} · {periodLabel}</p></div><button className="text-button" type="button" onClick={onAddCategory}><Plus size={13} />{locale === "th" ? "เพิ่มหมวดหมู่" : "Add Category"}</button></div>{categoryRows.length > 0 ? categoryRows.map((cat) => <div className="category-row" key={cat.id ?? cat.name}><div className="category-name"><i className="dot" style={{background: cat.color}} />{cat.name}</div><div className="category-row-actions"><div className="category-value">{formatMoney(cat.value)}</div>{cat.id ? <button className="category-delete" type="button" aria-label={`${locale === "th" ? "ลบหมวดหมู่" : "Remove category"} ${cat.name}`} onClick={() => { const category = financialCategories.find((item) => item.id === cat.id); if (category) onDeleteCategory(category); }}><Trash2 size={13} /></button> : null}</div><div className="progress"><div className="progress-bar" style={{ width: `${categoryTotal > 0 ? (cat.value / categoryTotal) * 100 : 0}%`, background: cat.color }} /></div></div>) : <div className="category-empty">{locale === "th" ? "ยังไม่มีหมวดหมู่" : "No categories yet"}</div>}</div>
        <div className="card"><div className="card-header"><div><h2 className="card-title">{t.debt}</h2><p className="card-subtitle">{periodLabel}</p></div></div>{filteredDebts.length > 0 ? filteredDebts.map((debt) => { const pct = Math.round(debt.paid / debt.total * 100); const dueDate = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(dateFromInputValue(debt.dueDate)); return <div className="debt-item" key={debt.name}><div className="debt-top"><strong>{debt.name}</strong><span>{pct}%</span></div><div className="progress"><div className="progress-bar" style={{width: `${pct}%`, background: "var(--brand)"}} /></div><span>{formatMoney(debt.total - debt.paid)} {t.remaining} · {formatMoney(debt.installment)} {locale === "th" ? "ครบกำหนด" : "due"} {dueDate}</span></div>; }) : <div className="category-empty">{locale === "th" ? "ไม่มียอดผ่อนครบกำหนดในช่วงวันที่เลือก" : "No installments due in the selected dates."}</div>}</div>
      </div>
    </div>
  </>;
}

function CalendarView({ locale, events, transactions, selectedDate, onSelectDate, onEdit, onDelete }: { locale: Locale; events: CalendarEvent[]; transactions: Transaction[]; selectedDate: string; onSelectDate: (date: string) => void; onEdit: (event: CalendarEvent) => void; onDelete: (event: CalendarEvent) => void }) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const selectedCalendarDate = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDate]);
  const selectedDateLabel = useMemo(() => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(selectedCalendarDate), [locale, selectedCalendarDate]);
  const visibleMonthLabel = useMemo(() => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    month: "long",
    year: "numeric",
  }).format(selectedCalendarDate), [locale, selectedCalendarDate]);
  const days = locale === "th" ? ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const spendingByDate = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.amount >= 0) continue;
      const occurredOn = transactionDate(transaction.date);
      if (!occurredOn) continue;
      const isoDate = inputValueFromDate(occurredOn);
      totals.set(isoDate, (totals.get(isoDate) ?? 0) + Math.abs(transaction.amount));
    }
    return totals;
  }, [transactions]);
  const monthDays = useMemo(() => {
    const monthStart = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const isoDate = inputValueFromDate(date);
      const dayEvents = events
        .filter((event) => calendarEventOccursOn(event, isoDate))
        .sort((a, b) => a.time.localeCompare(b.time));

      return {
        date: date.getDate(),
        events: dayEvents,
        isoDate,
        outside: date.getMonth() !== selectedCalendarDate.getMonth(),
        selected: isoDate === selectedDate,
        spent: spendingByDate.get(isoDate) ?? 0,
        today: isoDate === todayInputValue(),
      };
    });
  }, [events, selectedCalendarDate, selectedDate, spendingByDate]);

  const selectedEvents = useMemo(
    () => events
      .filter((event) => calendarEventOccursOn(event, selectedDate))
      .sort((a, b) => a.time.localeCompare(b.time)),
    [events, selectedDate],
  );
  const selectedSpend = spendingByDate.get(selectedDate) ?? 0;

  function selectDate(date: Date) {
    onSelectDate(inputValueFromDate(date));
    setDatePickerOpen(false);
  }

  function moveMonth(offset: number) {
    const targetMonth = new Date(selectedCalendarDate.getFullYear(), selectedCalendarDate.getMonth() + offset, 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    targetMonth.setDate(Math.min(selectedCalendarDate.getDate(), lastDay));
    onSelectDate(inputValueFromDate(targetMonth));
  }

  return <>
    <div className="section-toolbar calendar-toolbar">
      <div className="calendar-month-navigation">
        <button className="icon-btn" type="button" aria-label={locale === "th" ? "เดือนก่อนหน้า" : "Previous month"} onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></button>
        <Popover.Root open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <Popover.Trigger asChild>
            <button className="date-selector calendar-month-selector" type="button" aria-label={locale === "th" ? "เลือกเดือนหรือวันที่" : "Select month or date"}>
              <CalendarDays size={15} />
              <span>{visibleMonthLabel}</span>
              <ChevronDown className="date-selector-chevron" size={13} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="date-picker-popover" align="end" sideOffset={8} collisionPadding={12}>
              <DayPicker animate fixedWeeks mode="single" required defaultMonth={selectedCalendarDate} locale={locale === "th" ? th : enGB} selected={selectedCalendarDate} onSelect={selectDate} weekStartsOn={1} showOutsideDays />
              <div className="date-picker-footer">
                <span>{selectedDateLabel}</span>
                <button type="button" onClick={() => selectDate(new Date())}>{locale === "th" ? "วันนี้" : "Today"}</button>
              </div>
              <Popover.Arrow className="date-picker-arrow" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <button className="icon-btn" type="button" aria-label={locale === "th" ? "เดือนถัดไป" : "Next month"} onClick={() => moveMonth(1)}><ChevronRight size={16} /></button>
      </div>
    </div>
    <div className="calendar-layout">
      <div className="card calendar-card">
        <div className="calendar-head">{days.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {monthDays.map((day) => (
            <button className={cn("calendar-day", day.outside && "outside", day.selected && "current", day.today && "today")} key={day.isoDate} type="button" onClick={() => onSelectDate(day.isoDate)} aria-label={`${day.isoDate}, ${day.events.length} event${day.events.length === 1 ? "" : "s"}${day.spent > 0 ? `, ${formatMoney(day.spent)} spent` : ""}`}>
              <span className="calendar-day-top"><span className="day-number">{day.date}</span>{day.spent > 0 ? <span className="calendar-day-spend">−{formatMoney(day.spent)}</span> : null}</span>
              <span className="calendar-day-events">
                {day.events.slice(0, 2).map((event) => <span className={cn("day-event", event.type)} key={`${event.id}-${day.isoDate}`} title={event.description || event.title}><span>{event.time}</span><strong>{event.title}</strong></span>)}
                {day.events.length > 2 ? <span className="calendar-more">+{day.events.length - 2} {locale === "th" ? "รายการ" : "more"}</span> : null}
              </span>
            </button>
          ))}
        </div>
      </div>
      <aside className="card calendar-agenda">
        <div className="calendar-agenda-heading">
          <div>
            <span>{locale === "th" ? "กำหนดการ" : "Schedule"}</span>
            <h2>{selectedDateLabel}</h2>
            {selectedSpend > 0 ? <p className="calendar-agenda-spend">{locale === "th" ? "ใช้จ่าย" : "Spent"} −{formatMoney(selectedSpend)}</p> : null}
          </div>
          <span className="calendar-event-count">{selectedEvents.length}</span>
        </div>
        <div className="calendar-agenda-list">
          {selectedEvents.length === 0 ? (
            <div className="calendar-empty">
              <CalendarDays size={20} />
              <strong>{locale === "th" ? "ไม่มีกิจกรรม" : "No events"}</strong>
              <span>{locale === "th" ? "เลือกวันอื่นหรือเพิ่มกิจกรรมใหม่" : "Choose another day or add an event."}</span>
            </div>
          ) : selectedEvents.map((event) => (
            <article className={cn("calendar-agenda-event", event.type)} key={event.id}>
              <div className="calendar-agenda-time">{event.time}</div>
              <div>
                <div className="calendar-agenda-title">
                  <strong>{event.title}</strong>
                  <div className="calendar-agenda-actions">
                    {event.repeat !== "none" && <span>{event.repeat}</span>}
                    <button type="button" aria-label={`Edit ${event.title}`} onClick={() => onEdit(event)}><Pencil size={12} /></button>
                    <button type="button" aria-label={`Delete ${event.title}`} onClick={() => onDelete(event)}><Trash2 size={12} /></button>
                  </div>
                </div>
                {event.description && <p>{event.description}</p>}
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  </>;
}

function RecipesView({ locale }: { locale: Locale }) {
  return <><div className="section-toolbar"><div className="period-tabs"><button className="active">{locale === "th" ? "ทั้งหมด" : "All recipes"}</button><button>Thai</button><button>{locale === "th" ? "มื้อเย็น" : "Dinner"}</button></div><button className="secondary-btn"><Search size={14} /> {locale === "th" ? "ค้นหาสูตร" : "Find a recipe"}</button></div><div className="recipe-grid">{recipes.map(recipe => <article className="card recipe-card" key={recipe.id}><Image className="recipe-image" src={recipe.image} alt={recipe.title} width={700} height={450}/><div className="recipe-body"><h3>{recipe.title}</h3><div className="recipe-thai">{recipe.thai}</div><div className="tag-row">{recipe.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><div className="recipe-meta"><span><Clock3 size={11}/> {recipe.time}</span><span><ChefHat size={11}/> {recipe.difficulty}</span></div></div></article>)}</div></>;
}

function relativeDate(value: string, locale: Locale) {
  const elapsedDays = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (Math.abs(elapsedDays) < 1) return locale === "th" ? "วันนี้" : "Today";
  return new Intl.RelativeTimeFormat(locale === "th" ? "th-TH" : "en-GB", { numeric: "auto" }).format(elapsedDays, "day");
}

function activityDescription(activity: HouseholdActivity, locale: Locale) {
  const action = activity.action.toLowerCase();
  const entity = activity.entityType.replaceAll("_", " ");
  if (locale === "th") {
    const verb = action === "insert" ? "เพิ่ม" : action === "update" ? "แก้ไข" : "ลบ";
    return `${activity.actorName} ${verb} ${entity}`;
  }
  const verb = action === "insert" ? "added" : action === "update" ? "updated" : "deleted";
  return `${activity.actorName} ${verb} ${entity}`;
}

function HouseholdView({ locale, members, invitations, activities, onInvite }: { locale: Locale; members: HouseholdMember[]; invitations: HouseholdInvitation[]; activities: HouseholdActivity[]; onInvite: () => void }) {
  const t = copy[locale];
  const [activityPage, setActivityPage] = useState(0);
  const activityPageSize = 6;
  const activityPageCount = Math.max(1, Math.ceil(activities.length / activityPageSize));
  const currentActivityPage = Math.min(activityPage, activityPageCount - 1);
  const visibleActivities = activities.slice(currentActivityPage * activityPageSize, (currentActivityPage + 1) * activityPageSize);
  const activityStart = activities.length === 0 ? 0 : currentActivityPage * activityPageSize + 1;
  const activityEnd = Math.min((currentActivityPage + 1) * activityPageSize, activities.length);
  const summary = locale === "th" ? `${members.length} คน · ${invitations.length} คำเชิญที่รอดำเนินการ` : `${members.length} active · ${invitations.length} pending invitation${invitations.length === 1 ? "" : "s"}`;
  return (
    <div className="people-grid">
      <div className="card household-members-card">
        <div className="card-header household-card-header"><div><h2 className="card-title">{t.members}</h2><p className="card-subtitle">{summary}</p></div><button className="text-button" type="button" onClick={onInvite}><Plus size={12}/>{t.invite}</button></div>
        {members.length === 0 && invitations.length === 0 ? <div className="household-empty"><Users size={20}/><strong>{locale === "th" ? "ยังไม่มีสมาชิก" : "No household members yet"}</strong><span>{locale === "th" ? "เชิญสมาชิกเพื่อเริ่มทำงานร่วมกัน" : "Invite someone to start collaborating."}</span></div> : <>{members.map(member => <div className="member-row" key={member.userId}><Avatar.Root><Avatar.Fallback className="avatar">{initials(member.name || member.email)}</Avatar.Fallback></Avatar.Root><div className="member-info"><strong>{member.name || member.email}</strong><span>{member.email}</span></div><span className="role">{member.role}</span></div>)}{invitations.map(invitation => <div className="member-row" key={invitation.id}><div className="avatar pending-avatar">?</div><div className="member-info"><strong>{invitation.email}</strong><span>{locale === "th" ? "เชิญแล้ว" : "Invited"} · {relativeDate(invitation.createdAt, locale)}</span></div><span className="role">{locale === "th" ? "รอดำเนินการ" : "Pending"}</span></div>)}</>}
      </div>
      <div className="card activity-card">
        <div className="card-header household-card-header"><div><h2 className="card-title">{t.activity}</h2><p className="card-subtitle">{locale === "th" ? "บันทึกการเปลี่ยนแปลงในบ้าน" : "A secure record of household changes"}</p></div>{activities.length > 0 ? <span className="activity-total">{activities.length}</span> : null}</div>
        {activities.length === 0 ? <div className="household-empty"><Clock3 size={20}/><strong>{locale === "th" ? "ยังไม่มีกิจกรรม" : "No activity yet"}</strong><span>{locale === "th" ? "การเปลี่ยนแปลงในบ้านจะแสดงที่นี่" : "Household changes will appear here."}</span></div> : (
          <>
            <div className="activity-list">{visibleActivities.map(activity => <article className="activity-row" key={activity.id}><div className="activity-avatar" aria-hidden="true">{initials(activity.actorName)}</div><div className="activity-content"><p>{activityDescription(activity, locale)}</p><div className="activity-meta"><span>{relativeDate(activity.createdAt, locale)}</span><span className="activity-entity">{activity.entityType.replaceAll("_", " ")}</span></div></div></article>)}</div>
            <nav className="activity-pagination" aria-label={locale === "th" ? "แบ่งหน้ากิจกรรม" : "Activity pagination"}>
              <span>{activityStart}–{activityEnd} {locale === "th" ? "จาก" : "of"} {activities.length}</span>
              <div>
                <button type="button" aria-label={locale === "th" ? "หน้าก่อนหน้า" : "Previous page"} disabled={currentActivityPage === 0} onClick={() => setActivityPage(Math.max(0, currentActivityPage - 1))}><ChevronLeft size={15} /></button>
                {Array.from({ length: activityPageCount }, (_, page) => <button type="button" className={page === currentActivityPage ? "active" : ""} aria-label={`${locale === "th" ? "หน้า" : "Page"} ${page + 1}`} aria-current={page === currentActivityPage ? "page" : undefined} key={page} onClick={() => setActivityPage(page)}>{page + 1}</button>)}
                <button type="button" aria-label={locale === "th" ? "หน้าถัดไป" : "Next page"} disabled={currentActivityPage === activityPageCount - 1} onClick={() => setActivityPage(Math.min(activityPageCount - 1, currentActivityPage + 1))}><ChevronRight size={15} /></button>
              </div>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsView({ locale, setLocale, profile, onUpdateProfile }: { locale: Locale; setLocale: (locale: Locale) => void; profile: UserProfile; onUpdateProfile: (displayName: string) => Promise<void> }) {
  const t = copy[locale];
  const { theme, setTheme } = useTheme();
  const [savingProfile, setSavingProfile] = useState(false);

  async function saveProfile(formData: FormData) {
    const displayName = String(formData.get("displayName") ?? "").trim().replace(/\s+/g, " ");
    if (!displayName || displayName === profile.displayName) return;
    setSavingProfile(true);
    try {
      await onUpdateProfile(displayName);
    } finally {
      setSavingProfile(false);
    }
  }

  return <div className="settings-stack">
    <div className="card settings-card profile-settings-card">
      <div className="profile-settings-heading">
        <Avatar.Root className="profile-settings-avatar">
          {profile.avatarUrl ? <Avatar.Image className="profile-avatar-image" src={profile.avatarUrl} alt="" /> : null}
          <Avatar.Fallback className="profile-settings-fallback">{initials(profile.displayName || profile.email)}</Avatar.Fallback>
        </Avatar.Root>
        <div><h2 className="card-title">{locale === "th" ? "โปรไฟล์" : "Profile"}</h2><p className="card-subtitle">{profile.email}</p></div>
      </div>
      <form className="profile-name-form" action={saveProfile}>
        <div className="field">
          <label htmlFor="profile-display-name">{locale === "th" ? "ชื่อที่แสดง" : "Display name"}</label>
          <input key={profile.displayName} id="profile-display-name" name="displayName" type="text" defaultValue={profile.displayName} minLength={2} maxLength={60} required autoComplete="name" />
        </div>
        <button className="primary-btn" type="submit" disabled={savingProfile}>{savingProfile ? (locale === "th" ? "กำลังบันทึก…" : "Saving…") : (locale === "th" ? "บันทึกการเปลี่ยนแปลง" : "Save changes")}</button>
        <p className="profile-name-hint">{locale === "th" ? "ชื่อนี้จะแสดงให้สมาชิกในบ้านเห็น" : "This is how household members will see you."}</p>
      </form>
    </div>
    <div className="card settings-card"><div className="card-header"><div><h2 className="card-title">{t.preferences}</h2><p className="card-subtitle">{locale === "th" ? "บันทึกไว้ในเบราว์เซอร์นี้" : "Saved on this browser"}</p></div></div><div className="setting-row"><div><strong>{t.language}</strong><span>English / ภาษาไทย</span></div><select className="control" value={locale} onChange={e => setLocale(e.target.value as Locale)}><option value="en">English</option><option value="th">ภาษาไทย</option></select></div><div className="setting-row"><div><strong>{t.theme}</strong><span>{locale === "th" ? "สว่าง มืด หรือตามระบบ" : "Light, dark, or follow your system"}</span></div><select className="control" value={theme} onChange={e => setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></div><div className="setting-row"><div><strong>{t.currency}</strong><span>{locale === "th" ? "สกุลเงินหลักของบ้าน" : "Your household’s reporting currency"}</span></div><select className="control"><option>THB — Thai Baht</option></select></div><div className="setting-row"><div><strong>{t.timezone}</strong><span>{locale === "th" ? "ใช้กับปฏิทินและแจ้งเตือน" : "Used for calendar and reminders"}</span></div><select className="control"><option>Asia/Bangkok (GMT+7)</option></select></div><div className="setting-row"><div><strong>Realtime editing</strong><span>{locale === "th" ? "แสดงการเปลี่ยนแปลงจากสมาชิกทันที" : "Show member changes as they happen"}</span></div><div className="tag" style={{width: "fit-content"}}>● Enabled</div></div></div>
  </div>;
}

function dateFromInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function inputValueFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CalendarDateField({ name, value, onChange, locale, placeholder, min, clearable = false }: { name: string; value?: string; onChange: (value: string) => void; locale: Locale; placeholder: string; min?: string; clearable?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = value ? dateFromInputValue(value) : undefined;
  const minimum = min ? dateFromInputValue(min) : undefined;
  const label = selected
    ? new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(selected)
    : placeholder;

  function selectDate(date: Date | undefined) {
    if (!date) return;
    onChange(inputValueFromDate(date));
    setOpen(false);
  }

  return (
    <>
      <input name={name} type="hidden" value={value ?? ""} />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button className={cn("date-selector", "modal-date-selector", !selected && "placeholder")} type="button" aria-label={placeholder}>
            <CalendarDays size={14} />
            <span>{label}</span>
            <ChevronDown className="date-selector-chevron" size={13} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="date-picker-popover" align="start" sideOffset={7} collisionPadding={12}>
            <DayPicker
              animate
              fixedWeeks
              mode="single"
              defaultMonth={selected ?? minimum ?? new Date()}
              disabled={minimum ? { before: minimum } : undefined}
              locale={locale === "th" ? th : enGB}
              selected={selected}
              onSelect={selectDate}
              weekStartsOn={1}
              showOutsideDays
            />
            <div className="date-picker-footer">
              <span>{selected ? label : placeholder}</span>
              {clearable && value ? <button type="button" onClick={() => { onChange(""); setOpen(false); }}>Clear</button> : null}
            </div>
            <Popover.Arrow className="date-picker-arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}

const timeHours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const timeMinutes = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

function TimePartSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <div className="time-picker-part">
      <span>{label}</span>
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger className="time-select-trigger" aria-label={label}>
          <Select.Value />
          <Select.Icon><ChevronDown size={13} /></Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="time-select-content" position="popper" sideOffset={5}>
            <Select.Viewport className="time-select-viewport">
              {values.map((option) => (
                <Select.Item className="time-select-item" key={option} value={option}>
                  <Select.ItemText>{option}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

function TimePickerField({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hour = "09", minute = "00"] = value.split(":");

  return (
    <>
      <input name={name} type="hidden" value={value} />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button className="date-selector modal-date-selector modal-time-selector" type="button" aria-label="Select time">
            <Clock3 size={14} />
            <span>{value}</span>
            <ChevronDown className="date-selector-chevron" size={13} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="time-picker-popover" align="end" sideOffset={7} collisionPadding={12}>
            <strong>Select time</strong>
            <div className="time-picker-parts">
              <TimePartSelect label="Hour" value={hour} values={timeHours} onChange={(nextHour) => onChange(`${nextHour}:${minute}`)} />
              <span className="time-picker-separator">:</span>
              <TimePartSelect label="Minute" value={minute} values={timeMinutes} onChange={(nextMinute) => onChange(`${hour}:${nextMinute}`)} />
            </div>
            <button className="time-picker-done" type="button" onClick={() => setOpen(false)}>Done</button>
            <Popover.Arrow className="date-picker-arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}

function CalendarEventDialog({ open, onOpenChange, locale, defaultDate, event: existingEvent, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; locale: Locale; defaultDate: string; event?: CalendarEvent; onSave: (event: CalendarEvent) => void | Promise<void> }) {
  const t = copy[locale];
  const [repeat, setRepeat] = useState<CalendarRepeat>(existingEvent?.repeat ?? "none");
  const [eventDate, setEventDate] = useState(existingEvent?.date ?? defaultDate);
  const [endDate, setEndDate] = useState(existingEvent?.endDate ?? "");
  const [eventTime, setEventTime] = useState(existingEvent?.time ?? "09:00");

  async function submit(formData: FormData) {
    const recurrenceEndDate = repeat === "daily" ? endDate || undefined : undefined;
    if (recurrenceEndDate && recurrenceEndDate < eventDate) {
      toast.error("Due date must be on or after the start date");
      return;
    }
    const event: CalendarEvent = {
      id: existingEvent?.id ?? crypto.randomUUID(),
      title: String(formData.get("title") || "New event"),
      description: String(formData.get("description") ?? "").trim(),
      date: eventDate,
      time: eventTime,
      repeat,
      endDate: recurrenceEndDate,
      type: existingEvent?.type ?? "event",
    };

    try {
      await onSave(event);
    } catch {
      return;
    }

    toast.success(existingEvent ? `“${event.title}” updated` : locale === "th" ? `Added “${event.title}”` : `“${event.title}” added`);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog calendar-event-dialog">
          <Dialog.Title>{existingEvent ? "Edit event" : t.addEvent}</Dialog.Title>
          <Dialog.Description className="dialog-description">{existingEvent ? "Update this event or recurring series." : "Add the details everyone in your household needs."}</Dialog.Description>
          <form action={submit}>
            <div className="field-grid">
              <div className="field full">
                <label>{t.title}</label>
                <input name="title" type="text" required defaultValue={existingEvent?.title} placeholder="e.g. Dinner with Mum" />
              </div>
              <div className="field full">
                <label>Repeat</label>
                <div className="select-control">
                  <select name="repeat" value={repeat} onChange={(event) => setRepeat(event.target.value as CalendarRepeat)}>
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <ChevronDown size={14} aria-hidden="true" />
                </div>
              </div>
              <div className="event-schedule full">
                <div className="event-date-fields">
                  <div className="field">
                    <label>{t.date}</label>
                    <CalendarDateField name="date" value={eventDate} onChange={(value) => { setEventDate(value); if (endDate && endDate < value) setEndDate(""); }} locale={locale} placeholder="Select date" />
                  </div>
                  {repeat === "daily" ? (
                    <div className="field">
                      <label>Due date <span className="field-optional">Optional</span></label>
                      <CalendarDateField name="endDate" value={endDate} onChange={setEndDate} locale={locale} placeholder="No due date" min={eventDate} clearable />
                    </div>
                  ) : null}
                </div>
                <div className="field event-time-field">
                  <label>Time</label>
                  <TimePickerField name="time" value={eventTime} onChange={setEventTime} />
                </div>
              </div>
              <div className="field full">
                <label>Description <span className="field-optional">Optional</span></label>
                <textarea name="description" rows={3} defaultValue={existingEvent?.description} placeholder="Add a note, location, or anything useful" />
              </div>
            </div>
            <div className="dialog-actions">
              <Dialog.Close asChild><button type="button" className="secondary-btn">{t.cancel}</button></Dialog.Close>
              <button className="primary-btn" type="submit">{existingEvent ? "Save changes" : t.add}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CategoryDialog({ open, onOpenChange, locale, onAdd }: { open: boolean; onOpenChange: (open: boolean) => void; locale: Locale; onAdd: (category: { name: string; nameTh: string }) => void | Promise<void> }) {
  async function submit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const nameTh = String(formData.get("nameTh") ?? "").trim();
    if (!name || !nameTh) return;
    try {
      await onAdd({ name, nameTh });
    } catch {
      return;
    }
    toast.success(locale === "th" ? `เพิ่มหมวดหมู่ “${nameTh}” แล้ว` : `Category “${name}” added`);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog category-dialog">
          <Dialog.Title>{locale === "th" ? "เพิ่มหมวดหมู่" : "Add Category"}</Dialog.Title>
          <Dialog.Description className="dialog-description">{locale === "th" ? "ตั้งชื่อหมวดหมู่ทั้งภาษาอังกฤษและภาษาไทย" : "Name this category in both English and Thai."}</Dialog.Description>
          <form action={submit}>
            <div className="field-grid category-field-grid">
              <div className="field full">
                <label htmlFor="category-name-en">English name</label>
                <input id="category-name-en" name="name" type="text" required autoComplete="off" placeholder="e.g. Healthcare…" />
              </div>
              <div className="field full">
                <label htmlFor="category-name-th">Thai name · ชื่อภาษาไทย</label>
                <input id="category-name-th" name="nameTh" type="text" required autoComplete="off" placeholder="เช่น สุขภาพ…" />
              </div>
            </div>
            <div className="dialog-actions">
              <Dialog.Close asChild><button className="secondary-btn" type="button">{copy[locale].cancel}</button></Dialog.Close>
              <button className="primary-btn" type="submit">{locale === "th" ? "เพิ่มหมวดหมู่" : "Add Category"}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ConfirmDialog({ open, onOpenChange, locale, title, description, confirmLabel, pendingLabel, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; locale: Locale; title: string; description: string; confirmLabel: string; pendingLabel: string; onConfirm: () => void | Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The destructive action reports its own error and the modal stays open for retry.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!submitting) onOpenChange(nextOpen); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog confirm-dialog">
          <div className="confirm-dialog-icon" aria-hidden="true"><Trash2 size={20} /></div>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description className="dialog-description">{description}</Dialog.Description>
          <div className="dialog-actions">
            <button className="secondary-btn" type="button" disabled={submitting} onClick={() => onOpenChange(false)}>{copy[locale].cancel}</button>
            <button className="danger-btn" type="button" disabled={submitting} onClick={confirm}>{submitting ? pendingLabel : confirmLabel}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AddDialog({ open, onOpenChange, locale, view, onAdd, demoMode, householdId, userId, financialCategories, onHouseholdChange }: { open: boolean; onOpenChange: (v: boolean) => void; locale: Locale; view: View; onAdd: (transaction: Transaction) => void | Promise<void>; demoMode: boolean; householdId?: string; userId?: string; financialCategories: FinancialCategory[]; onHouseholdChange: () => void | Promise<void> }) {
  const t = copy[locale];
  async function submit(formData: FormData) {
    const title = String(formData.get("title") || (view === "calendar" ? "New event" : view === "recipes" ? "New recipe" : "New transaction"));
    if (view === "household" && !demoMode) {
      const response = await fetch("/api/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: title }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { toast.error(result.error ?? "Could not send invitation"); return; }
      await onHouseholdChange();
    }
    if (!demoMode && householdId && userId && view === "recipes") {
      const { error } = await createSupabaseClient().from("recipes").insert({ household_id: householdId, created_by: userId, title });
      if (error) { toast.error(error.message); return; }
    }
    if (view === "overview" || view === "finances") {
      const amount = Number(formData.get("amount") || 0);
      const type = String(formData.get("type"));
      await onAdd({ id: crypto.randomUUID(), title, category: String(formData.get("category") || "Other"), date: "Just now", amount: type === "income" ? amount : -amount, icon: type === "income" ? "wallet" : "basket" });
    }
    toast.success(locale === "th" ? `เพิ่ม “${title}” แล้ว` : `“${title}” added`);
    onOpenChange(false);
  }
  const description = view === "calendar" ? t.addEvent : view === "recipes" ? t.newRecipe : view === "household" ? t.invite : t.addTransaction;
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="overlay"/><Dialog.Content className="dialog"><Dialog.Title>{description}</Dialog.Title><Dialog.Description className="dialog-description">{locale === "th" ? "รายละเอียดจะซิงก์ให้สมาชิกทุกคนทันที" : "Details will sync with everyone in your household."}</Dialog.Description><form action={submit}><div className="field-grid"><div className="field full"><label>{view === "household" ? "Email" : t.title}</label><input name="title" type={view === "household" ? "email" : "text"} required placeholder={view === "household" ? "name@example.com" : "e.g. Grocery shopping"}/></div>{(view === "overview" || view === "finances") && <><div className="field"><label>{t.type}</label><select name="type"><option value="expense">{t.expense}</option><option value="income">{t.income}</option></select></div><div className="field"><label>{t.amount}</label><input name="amount" type="number" min="0" step="0.01" required placeholder="0.00"/></div><div className="field"><label>{t.category}</label><select name="category">{financialCategories.map((category) => <option key={category.id} value={category.name}>{locale === "th" ? category.nameTh || category.name : category.name}</option>)}</select></div><div className="field"><label>{t.date}</label><input name="date" type="date" defaultValue="2026-08-24"/></div></>}</div><div className="dialog-actions"><Dialog.Close asChild><button type="button" className="secondary-btn">{t.cancel}</button></Dialog.Close><button className="primary-btn" type="submit">{t.add}</button></div></form></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function SebastianApp({ demoMode = true, householdId, userId, initialProfile, initialTransactions, initialCalendarEvents, initialCategories, initialDebts, initialMembers, initialInvitations, initialActivities }: { demoMode?: boolean; householdId?: string; userId?: string; initialProfile?: UserProfile; initialTransactions?: Transaction[]; initialCalendarEvents?: CalendarEvent[]; initialCategories?: FinancialCategory[]; initialDebts?: DebtInstallment[]; initialMembers?: HouseholdMember[]; initialInvitations?: HouseholdInvitation[]; initialActivities?: HouseholdActivity[] }) {
  const [view, setView] = useState<View>("overview");
  const { locale, setLocale } = useLocale();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCalendarEvent, setEditingCalendarEvent] = useState<CalendarEvent>();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>();
  const [transactions, setTransactions] = useState<Transaction[]>(demoMode ? [...seedTransactions] : (initialTransactions ?? []));
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(demoMode ? [...seedCalendarEvents] : (initialCalendarEvents ?? []));
  const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>(demoMode ? [...seedFinancialCategories] : (initialCategories ?? []));
  const [debtInstallments, setDebtInstallments] = useState<DebtInstallment[]>(demoMode ? [...debts] : (initialDebts ?? []));
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>(initialMembers ?? []);
  const [householdInvitations, setHouseholdInvitations] = useState<HouseholdInvitation[]>(initialInvitations ?? []);
  const [householdActivities, setHouseholdActivities] = useState<HouseholdActivity[]>(initialActivities ?? []);
  const [profile, setProfile] = useState<UserProfile>(initialProfile ?? { displayName: "Santhiti", email: "s4nthiti@gmail.com" });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(todayInputValue);
  const { resolvedTheme, setTheme } = useTheme();
  const t = copy[locale];
  const nav = useMemo(() => (["overview", "finances", "calendar", "recipes", "household", "settings"] as View[]), []);
  const refreshHouseholdData = useCallback(async () => {
    if (!householdId) return;
    const supabase = createSupabaseClient();
    const [{ data: memberRows }, { data: invitationRows }, { data: activityRows }] = await Promise.all([
      supabase.from("household_members").select("user_id,role,joined_at,profiles!household_members_user_id_fkey(display_name,email)").eq("household_id", householdId).order("joined_at", { ascending: true }),
      supabase.from("invitations").select("id,email,role,created_at,expires_at").eq("household_id", householdId).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("id,action,entity_type,created_at,profiles!audit_logs_actor_id_fkey(display_name,email)").eq("household_id", householdId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (memberRows) setHouseholdMembers(memberRows.map((member) => { const profile = relatedProfile(member.profiles); return { userId: member.user_id, name: profile.displayName, email: profile.email, role: member.role, joinedAt: member.joined_at }; }));
    if (invitationRows) setHouseholdInvitations(invitationRows.map((invitation) => ({ id: invitation.id, email: invitation.email, role: invitation.role, createdAt: invitation.created_at, expiresAt: invitation.expires_at })));
    if (activityRows) setHouseholdActivities(activityRows.map((activity) => { const actor = relatedProfile(activity.profiles); return { id: String(activity.id), action: activity.action, entityType: activity.entity_type, actorName: actor.displayName || actor.email || "Household member", createdAt: activity.created_at }; }));
  }, [householdId]);
  const notifyRealtimeChange = useCallback(async () => {
    if (!householdId) return;
    const supabase = createSupabaseClient();
    const [{ data }, { data: eventRows }, { data: debtRows }] = await Promise.all([
      supabase.from("transactions").select("id,title,type,amount,occurred_on,categories(name)").eq("household_id", householdId).order("occurred_on", { ascending: false }),
      supabase.from("calendar_events").select("id,title,description,starts_at,recurrence_rule,item_type").eq("household_id", householdId).order("starts_at", { ascending: true }),
      supabase.from("debt_installments").select("id,title,original_amount,remaining_amount,installment_amount,next_due_date").eq("household_id", householdId).eq("status", "active").order("next_due_date", { ascending: true }),
    ]);
    if (data) setTransactions(data.map(row => ({ id: row.id, title: row.title, category: relatedName(row.categories), date: row.occurred_on, amount: row.type === "income" ? Number(row.amount) : -Number(row.amount), icon: row.type === "income" ? "wallet" : "basket" })));
    if (eventRows) setCalendarEvents(eventRows.map(calendarEventFromRow));
    if (debtRows) setDebtInstallments(debtRows.flatMap((debt) => debt.next_due_date ? [{ id: debt.id, name: debt.title, paid: Math.max(Number(debt.original_amount) - Number(debt.remaining_amount), 0), total: Number(debt.original_amount), installment: Number(debt.installment_amount), dueDate: debt.next_due_date }] : []));
    toast.info(locale === "th" ? "ข้อมูลอัปเดตจากสมาชิกในบ้าน" : "Household data updated");
  }, [householdId, locale]);
  useHouseholdRealtime(!demoMode, notifyRealtimeChange);

  async function updateProfileName(displayName: string) {
    const normalizedDisplayName = displayName.trim().replace(/\s+/g, " ");
    if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 60) {
      toast.error(locale === "th" ? "ชื่อต้องมีความยาว 2–60 ตัวอักษร" : "Name must be between 2 and 60 characters.");
      return;
    }

    let nextProfile = { ...profile, displayName: normalizedDisplayName };
    if (!demoMode) {
      if (!userId) {
        toast.error(locale === "th" ? "ไม่พบข้อมูลบัญชีผู้ใช้" : "Your account session could not be found.");
        return;
      }
      const { data, error } = await createSupabaseClient()
        .from("profiles")
        .update({ display_name: normalizedDisplayName })
        .eq("id", userId)
        .select("display_name,email,avatar_url")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      nextProfile = {
        displayName: data.display_name?.trim() || normalizedDisplayName,
        email: data.email || profile.email,
        avatarUrl: data.avatar_url ?? undefined,
      };
    }

    setProfile(nextProfile);
    if (userId) setHouseholdMembers((current) => current.map((member) => member.userId === userId ? { ...member, name: nextProfile.displayName } : member));
    toast.success(locale === "th" ? "อัปเดตชื่อโปรไฟล์แล้ว" : "Profile name updated");
  }

  async function addTransaction(item: Transaction) {
    if (demoMode) { setTransactions(current => [item, ...current]); return; }
    if (!householdId || !userId) throw new Error("Missing household session");
    const supabase = createSupabaseClient();
    const { data: category } = await supabase.from("categories").select("id").eq("household_id", householdId).eq("name", item.category).is("deleted_at", null).maybeSingle();
    const { error } = await supabase.from("transactions").insert({ household_id: householdId, created_by: userId, type: item.amount > 0 ? "income" : "expense", amount: Math.abs(item.amount), title: item.title, category_id: category?.id ?? null, occurred_on: new Date().toISOString().slice(0, 10) });
    if (error) { toast.error(error.message); throw error; }
    await notifyRealtimeChange();
  }

  async function addCalendarEvent(event: CalendarEvent) {
    if (demoMode) {
      setCalendarEvents((current) => [...current, event]);
      setSelectedCalendarDate(event.date);
      return;
    }
    if (!householdId || !userId) throw new Error("Missing household session");

    const { data, error } = await createSupabaseClient()
      .from("calendar_events")
      .insert({
        household_id: householdId,
        created_by: userId,
        title: event.title,
        description: event.description || null,
        item_type: event.type,
        starts_at: bangkokDateTimeToIso(event.date, event.time),
        recurrence_rule: repeatToRecurrenceRule(event.repeat, event.endDate),
      })
      .select("id,title,description,starts_at,recurrence_rule,item_type")
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }

    const createdEvent = calendarEventFromRow(data);
    setCalendarEvents((current) => [...current.filter((item) => item.id !== createdEvent.id), createdEvent]);
    setSelectedCalendarDate(createdEvent.date);
  }

  async function addFinancialCategory(category: { name: string; nameTh: string }) {
    if (financialCategories.some((item) => item.name.toLocaleLowerCase() === category.name.toLocaleLowerCase())) {
      const error = new Error("A category with this English name already exists");
      toast.error(error.message);
      throw error;
    }
    const palette = ["#ff7b54", "#3a7d6f", "#e7b25b", "#8a78c2", "#4f8ec9", "#aeb7b4"];
    const color = palette[financialCategories.length % palette.length];
    if (demoMode) {
      setFinancialCategories((current) => [...current, { id: crypto.randomUUID(), ...category, color }]);
      return;
    }
    if (!householdId) throw new Error("Missing household session");
    const { data, error } = await createSupabaseClient()
      .from("categories")
      .upsert({ household_id: householdId, name: category.name, name_th: category.nameTh, color, deleted_at: null }, { onConflict: "household_id,name" })
      .select("id,name,name_th,color")
      .single();
    if (error) {
      toast.error(error.code === "23505" ? "A category with this English name already exists" : error.message);
      throw error;
    }
    setFinancialCategories((current) => [...current, { id: data.id, name: data.name, nameTh: data.name_th ?? "", color: data.color }]);
  }

  async function deleteFinancialCategory(category: FinancialCategory) {
    if (!demoMode) {
      if (!householdId) throw new Error("Missing household session");
      const { error } = await createSupabaseClient().from("categories").update({ deleted_at: new Date().toISOString() }).eq("id", category.id).eq("household_id", householdId);
      if (error) { toast.error(error.message); throw error; }
    }
    setFinancialCategories((current) => current.filter((item) => item.id !== category.id));
    toast.success(locale === "th" ? `นำหมวดหมู่ “${category.nameTh || category.name}” ออกแล้ว` : `Category “${category.name}” removed`);
  }

  async function updateCalendarEvent(event: CalendarEvent) {
    if (demoMode) {
      setCalendarEvents((current) => current.map((item) => item.id === event.id ? event : item));
      setSelectedCalendarDate(event.date);
      return;
    }
    if (!householdId || !userId) throw new Error("Missing household session");

    const { data, error } = await createSupabaseClient()
      .from("calendar_events")
      .update({
        title: event.title,
        description: event.description || null,
        item_type: event.type,
        starts_at: bangkokDateTimeToIso(event.date, event.time),
        recurrence_rule: repeatToRecurrenceRule(event.repeat, event.endDate),
        updated_by: userId,
      })
      .eq("id", event.id)
      .eq("household_id", householdId)
      .select("id,title,description,starts_at,recurrence_rule,item_type")
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }

    const updatedEvent = calendarEventFromRow(data);
    setCalendarEvents((current) => current.map((item) => item.id === updatedEvent.id ? updatedEvent : item));
    setSelectedCalendarDate(updatedEvent.date);
  }

  async function deleteCalendarEvent(event: CalendarEvent) {
    if (!demoMode) {
      if (!householdId) throw new Error("Missing household session");
      const { error } = await createSupabaseClient().from("calendar_events").delete().eq("id", event.id).eq("household_id", householdId);
      if (error) { toast.error(error.message); throw error; }
    }
    setCalendarEvents((current) => current.filter((item) => item.id !== event.id));
    toast.success(`“${event.title}” deleted`);
  }

  function openCalendarEditor(event?: CalendarEvent) {
    setEditingCalendarEvent(event);
    setDialogOpen(true);
  }

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Sparkles size={18}/></div><div><div className="brand-name">Sebastian</div><div className="brand-kicker">Home, handled</div></div></div><div className="nav-label">Workspace</div><nav className="nav">{nav.map(item => { const Icon = navIcons[item]; return <button key={item} className={cn("nav-item", view === item && "active")} onClick={() => setView(item)}><Icon size={16}/>{t[item]}</button>; })}</nav><div className="sidebar-bottom">{demoMode && <div className="demo-note"><strong>{t.demo}</strong><span>{t.demoHint}</span></div>}<div className="profile"><Avatar.Root className="sidebar-avatar">{profile.avatarUrl ? <Avatar.Image className="profile-avatar-image" src={profile.avatarUrl} alt="" /> : null}<Avatar.Fallback className="avatar">{initials(profile.displayName || profile.email)}</Avatar.Fallback></Avatar.Root><div className="profile-copy"><strong>{profile.displayName}</strong><span>{profile.email}</span></div><DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="icon-btn" style={{border:0, width:30, height:30}} aria-label={locale === "th" ? "เมนูโปรไฟล์" : "Profile menu"}><MoreHorizontal size={15}/></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="dropdown" sideOffset={6}><DropdownMenu.Item className="dropdown-item" onSelect={() => setView("settings")}><Settings size={13}/> {t.settings}</DropdownMenu.Item><DropdownMenu.Item className="dropdown-item" onSelect={() => setView("household")}><Users size={13}/> {t.household}</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div></div></aside>
    <main className="main"><header className="topbar"><button className="mobile-profile-button" type="button" onClick={() => setView("settings")} aria-label={locale === "th" ? "เปิดโปรไฟล์" : "Open profile settings"}><Avatar.Root className="topbar-profile-avatar">{profile.avatarUrl ? <Avatar.Image className="profile-avatar-image" src={profile.avatarUrl} alt="" /> : null}<Avatar.Fallback className="topbar-profile-fallback">{initials(profile.displayName || profile.email)}</Avatar.Fallback></Avatar.Root><span>{profile.displayName}</span></button><div className="top-actions"><LanguageSwitcher locale={locale} onChange={setLocale}/><button className="icon-btn" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}</button><button className="icon-btn" aria-label="Notifications"><Bell size={15}/></button></div></header><div className="content"><PageHeading locale={locale} view={view} profileName={profile.displayName} onAdd={() => view === "calendar" ? openCalendarEditor() : setDialogOpen(true)}/>{view === "overview" && <Overview locale={locale} transactions={transactions} calendarEvents={calendarEvents} debtInstallments={debtInstallments} onNavigate={setView} onOpenCalendar={(date) => { setSelectedCalendarDate(date); setView("calendar"); }}/>} {view === "finances" && <Finances locale={locale} transactions={transactions} financialCategories={financialCategories} debtInstallments={debtInstallments} onAddCategory={() => setCategoryDialogOpen(true)} onDeleteCategory={(category) => setPendingConfirmation({ kind: "category", category })}/>} {view === "calendar" && <CalendarView locale={locale} events={calendarEvents} transactions={transactions} selectedDate={selectedCalendarDate} onSelectDate={setSelectedCalendarDate} onEdit={openCalendarEditor} onDelete={(event) => setPendingConfirmation({ kind: "calendar", event })}/>} {view === "recipes" && <RecipesView locale={locale}/>} {view === "household" && <HouseholdView locale={locale} members={householdMembers} invitations={householdInvitations} activities={householdActivities} onInvite={() => setDialogOpen(true)}/>} {view === "settings" && <SettingsView locale={locale} setLocale={setLocale} profile={profile} onUpdateProfile={updateProfileName}/>}</div></main>
    <nav className="mobile-nav">{nav.slice(0,5).map(item => { const Icon = navIcons[item]; return <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}><Icon size={18}/><span>{t[item]}</span></button>; })}</nav>
    {view === "calendar" ? (
      <CalendarEventDialog key={editingCalendarEvent?.id ?? `new-${selectedCalendarDate}`} open={dialogOpen} onOpenChange={setDialogOpen} locale={locale} defaultDate={selectedCalendarDate} event={editingCalendarEvent} onSave={editingCalendarEvent ? updateCalendarEvent : addCalendarEvent} />
    ) : (
      <AddDialog open={dialogOpen} onOpenChange={setDialogOpen} locale={locale} view={view} onAdd={addTransaction} demoMode={demoMode} householdId={householdId} userId={userId} financialCategories={financialCategories} onHouseholdChange={refreshHouseholdData}/>
    )}
    <CategoryDialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen} locale={locale} onAdd={addFinancialCategory} />
    <ConfirmDialog
      open={Boolean(pendingConfirmation)}
      onOpenChange={(open) => { if (!open) setPendingConfirmation(undefined); }}
      locale={locale}
      title={pendingConfirmation?.kind === "category" ? (locale === "th" ? "นำหมวดหมู่นี้ออกหรือไม่" : "Remove this category?") : (locale === "th" ? "ลบกิจกรรมนี้หรือไม่" : "Delete this event?")}
      description={pendingConfirmation?.kind === "category"
        ? (locale === "th" ? `หมวดหมู่ “${pendingConfirmation.category.nameTh || pendingConfirmation.category.name}” จะไม่แสดงในรายการใหม่ แต่ธุรกรรมเดิมจะยังคงอยู่` : `“${pendingConfirmation.category.name}” will no longer be available for new transactions. Existing transactions will keep this category.`)
        : pendingConfirmation?.kind === "calendar"
          ? (locale === "th" ? `กิจกรรม “${pendingConfirmation.event.title}”${pendingConfirmation.event.repeat !== "none" ? " และรายการที่เกิดซ้ำทั้งหมด" : ""} จะถูกลบอย่างถาวร` : `“${pendingConfirmation.event.title}”${pendingConfirmation.event.repeat !== "none" ? " and its recurring series" : ""} will be permanently deleted.`)
          : ""}
      confirmLabel={pendingConfirmation?.kind === "category" ? (locale === "th" ? "นำหมวดหมู่ออก" : "Remove category") : (locale === "th" ? "ลบกิจกรรม" : "Delete event")}
      pendingLabel={pendingConfirmation?.kind === "category" ? (locale === "th" ? "กำลังนำออก…" : "Removing…") : (locale === "th" ? "กำลังลบ…" : "Deleting…")}
      onConfirm={async () => {
        if (pendingConfirmation?.kind === "category") await deleteFinancialCategory(pendingConfirmation.category);
        if (pendingConfirmation?.kind === "calendar") await deleteCalendarEvent(pendingConfirmation.event);
      }}
    />
  </div>;
}
