"use client";

import * as Avatar from "@radix-ui/react-avatar";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChefHat,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Ellipsis,
  Languages,
  LayoutDashboard,
  Moon,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShoppingBasket,
  Sparkles,
  Sun,
  TrainFront,
  Users,
  Utensils,
  WalletCards,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { copy, type Locale } from "@/lib/i18n";
import { calendarDays, categories, debts, recipes, spendingData, transactions as seedTransactions, upcoming } from "@/lib/demo-data";
import { cn, formatMoney, relatedName } from "@/lib/utils";
import { useHouseholdRealtime } from "@/hooks/use-household-realtime";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/providers";

type View = "overview" | "finances" | "calendar" | "recipes" | "household" | "settings";
type Transaction = (typeof seedTransactions)[number];

const navIcons: Record<View, React.ElementType> = {
  overview: LayoutDashboard,
  finances: CircleDollarSign,
  calendar: CalendarDays,
  recipes: BookOpen,
  household: Users,
  settings: Settings,
};

function PageHeading({ locale, view, onAdd }: { locale: Locale; view: View; onAdd: () => void }) {
  const t = copy[locale];
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
  const action = view === "recipes" ? t.newRecipe : view === "calendar" ? t.addEvent : view === "household" ? t.invite : t.quickAdd;

  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">Monday · 24 August 2026</div>
        <h1>{titles[view]}{view === "overview" ? ", Santhiti." : ""}</h1>
        <p>{subtitles[view]}</p>
      </div>
      {view !== "settings" && (
        <button className="primary-btn" onClick={onAdd}><Plus size={15} /> {action}</button>
      )}
    </div>
  );
}

function TransactionIcon({ name }: { name: string }) {
  const Icon = name === "basket" ? ShoppingBasket : name === "wallet" ? WalletCards : name === "zap" ? Zap : name === "train" ? TrainFront : CreditCard;
  return <Icon size={15} />;
}

function Transactions({ items, limit }: { items: Transaction[]; limit?: number }) {
  return (
    <div className="transaction-list">
      {items.slice(0, limit).map((item) => (
        <div className="transaction-row" key={item.id}>
          <div className="transaction-icon"><TransactionIcon name={item.icon} /></div>
          <div className="transaction-copy"><strong>{item.title}</strong><span>{item.category} · {item.date}</span></div>
          <div className={cn("transaction-amount", item.amount > 0 ? "positive" : "")}>{item.amount > 0 ? "+" : "−"}{formatMoney(Math.abs(item.amount))}</div>
        </div>
      ))}
    </div>
  );
}

function MoneyChart() {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={spendingData} margin={{ left: -22, right: 4, top: 8, bottom: 0 }} barGap={4}>
          <CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 8 }} tickFormatter={(v) => `${v / 1000}k`} />
          <Tooltip cursor={{ fill: "var(--surface-muted)", radius: 8 }} contentStyle={{ background: "var(--surface-strong)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 10 }} formatter={(v) => formatMoney(Number(v))} />
          <Bar dataKey="income" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expense" fill="var(--yellow)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Metrics({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const values = [
    { label: t.balance, value: 55320, meta: "+18.4% " + t.fromLastMonth, icon: WalletCards, tone: "var(--brand-soft)", color: "var(--brand)" },
    { label: t.income, value: 98000, meta: t.thisMonth, icon: ArrowDownLeft, tone: "#e5f1ec", color: "#37826f" },
    { label: t.expenses, value: 42680, meta: "−8.2% " + t.fromLastMonth, icon: ArrowUpRight, tone: "#fff0ea", color: "var(--coral)" },
    { label: t.dueSoon, value: 12900, meta: locale === "th" ? "3 รายการใน 7 วัน" : "3 items in the next 7 days", icon: ReceiptText, tone: "#fff4dc", color: "#bd8123" },
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

function Overview({ locale, transactions, onNavigate }: { locale: Locale; transactions: Transaction[]; onNavigate: (view: View) => void }) {
  const t = copy[locale];
  return <>
    <Metrics locale={locale} />
    <div className="dashboard-grid">
      <div className="stack">
        <div className="card">
          <div className="card-header"><div><h2 className="card-title">{t.spending}</h2><p className="card-subtitle">March — August 2026</p></div><div className="legend"><span><i style={{ background: "var(--brand)" }} />{t.income}</span><span><i style={{ background: "var(--yellow)" }} />{t.expenses}</span></div></div>
          <MoneyChart />
        </div>
        <div className="card">
          <div className="card-header"><div><h2 className="card-title">{t.recent}</h2><p className="card-subtitle">{locale === "th" ? "อัปเดตล่าสุดจากทุกคนในบ้าน" : "Latest updates from your household"}</p></div><button className="text-button" onClick={() => onNavigate("finances")}>{t.allTransactions}<ArrowRight size={12} /></button></div>
          <Transactions items={transactions} limit={4} />
        </div>
      </div>
      <div className="stack">
        <div className="card">
          <div className="card-header"><div><h2 className="card-title">{t.upcoming}</h2><p className="card-subtitle">24 — 30 August</p></div><button className="text-button" onClick={() => onNavigate("calendar")}>{t.seeCalendar}<ArrowRight size={12} /></button></div>
          <div className="upcoming-list">{upcoming.map((event) => <div className="event-row" key={event.id}><div className="date-tile"><strong>{event.day}</strong><span>{event.month}</span></div><div className={cn("event-line", event.tone)} /><div className="event-copy"><strong>{event.title}</strong><span>{event.meta}</span></div></div>)}</div>
        </div>
        <div className="card meal-card">
          <div className="meal-kicker">{t.menu} · {t.dinner}</div>
          <h3>Thai green curry</h3><p>แกงเขียวหวานไก่ · planned by Santhiti</p>
          <div className="meal-meta"><span>◷ 45 min</span><span>● 4 servings</span></div>
        </div>
      </div>
    </div>
  </>;
}

function Finances({ locale, transactions }: { locale: Locale; transactions: Transaction[] }) {
  const t = copy[locale];
  const [period, setPeriod] = useState("month");
  return <>
    <div className="section-toolbar"><div className="period-tabs">{(["week", "month", "year"] as const).map((p) => <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>{t[p]}</button>)}</div><button className="secondary-btn"><CalendarDays size={14} /> Aug 2026 <ChevronDown size={13} /></button></div>
    <Metrics locale={locale} />
    <div className="finance-grid">
      <div className="stack">
        <div className="card"><div className="card-header"><div><h2 className="card-title">{t.spending}</h2><p className="card-subtitle">{period === "week" ? "18 — 24 August" : period === "year" ? "January — December 2026" : "August 2026"}</p></div><div className="legend"><span><i style={{ background: "var(--brand)" }} />{t.income}</span><span><i style={{ background: "var(--yellow)" }} />{t.expenses}</span></div></div><MoneyChart /></div>
        <div className="card"><div className="card-header"><div><h2 className="card-title">{t.allTransactions}</h2><p className="card-subtitle">5 transactions · August 2026</p></div><button className="icon-btn" aria-label="Transaction options"><Ellipsis size={15}/></button></div><Transactions items={transactions} /></div>
      </div>
      <div className="stack">
        <div className="card"><div className="card-header"><div><h2 className="card-title">{t.category}</h2><p className="card-subtitle">{t.expenses} · {t.thisMonth}</p></div></div>{categories.map((cat) => <div className="category-row" key={cat.name}><div className="category-name"><i className="dot" style={{background: cat.color}} />{cat.name}</div><div className="category-value">{formatMoney(cat.value)}</div><div className="progress"><div className="progress-bar" style={{ width: `${(cat.value / 42680) * 100}%`, background: cat.color }} /></div></div>)}</div>
        <div className="card"><div className="card-header"><div><h2 className="card-title">{t.debt}</h2><p className="card-subtitle">{locale === "th" ? "ติดตามยอดผ่อนและกำหนดชำระ" : "Installments and upcoming payments"}</p></div></div>{debts.map((debt) => { const pct = Math.round(debt.paid / debt.total * 100); return <div className="debt-item" key={debt.name}><div className="debt-top"><strong>{debt.name}</strong><span>{pct}%</span></div><div className="progress"><div className="progress-bar" style={{width: `${pct}%`, background: "var(--brand)"}} /></div><span>{formatMoney(debt.total - debt.paid)} {t.remaining} · {debt.next}</span></div>; })}</div>
      </div>
    </div>
  </>;
}

function CalendarView({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const days = locale === "th" ? ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return <>
    <div className="section-toolbar"><div className="period-tabs"><button>{t.today}</button><button className="active">{t.week}</button><button>{t.month}</button></div><button className="secondary-btn">24 — 30 August 2026 <ChevronDown size={13} /></button></div>
    <div className="calendar-layout">
      <div className="card calendar-card"><div className="calendar-head">{days.map(d => <span key={d}>{d}</span>)}</div><div className="calendar-grid">{calendarDays.map(day => <div className={cn("calendar-day", day.current && "current")} key={day.date}><div className="day-number">{day.date}</div>{day.events.map(event => <div className={cn("day-event", event.type)} key={event.label}>{event.label}</div>)}</div>)}</div></div>
      <div className="stack">
        <div className="card"><div className="card-header"><div><h2 className="card-title">Monday, 24</h2><p className="card-subtitle">3 items today</p></div></div><div className="agenda-block"><h3>{locale === "th" ? "กำหนดการ" : "Schedule"}</h3><div className="agenda-item"><div className="agenda-time">09:00</div><div className="agenda-copy"><strong>Weekly planning</strong><span>Home · 45 min</span></div></div><div className="agenda-item"><div className="agenda-time">18:30</div><div className="agenda-copy"><strong>Villa Market</strong><span>Groceries · ฿1,840</span></div></div></div><div className="agenda-block"><h3>{t.menu}</h3><div className="agenda-item"><div className="agenda-time"><Utensils size={13}/></div><div className="agenda-copy"><strong>Pad kra pao</strong><span>{t.dinner} · 30 min</span></div></div></div></div>
        <div className="card"><div className="card-header"><h2 className="card-title">Filters</h2></div><div className="tag-row"><span className="tag">● Events</span><span className="tag">● Reminders</span><span className="tag">● Money</span><span className="tag">● Meals</span></div></div>
      </div>
    </div>
  </>;
}

function RecipesView({ locale }: { locale: Locale }) {
  return <><div className="section-toolbar"><div className="period-tabs"><button className="active">{locale === "th" ? "ทั้งหมด" : "All recipes"}</button><button>Thai</button><button>{locale === "th" ? "มื้อเย็น" : "Dinner"}</button></div><button className="secondary-btn"><Search size={14} /> {locale === "th" ? "ค้นหาสูตร" : "Find a recipe"}</button></div><div className="recipe-grid">{recipes.map(recipe => <article className="card recipe-card" key={recipe.id}><Image className="recipe-image" src={recipe.image} alt={recipe.title} width={700} height={450}/><div className="recipe-body"><h3>{recipe.title}</h3><div className="recipe-thai">{recipe.thai}</div><div className="tag-row">{recipe.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><div className="recipe-meta"><span><Clock3 size={11}/> {recipe.time}</span><span><ChefHat size={11}/> {recipe.difficulty}</span></div></div></article>)}</div></>;
}

function HouseholdView({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const members = [{ name: "Santhiti S.", email: "s4nthiti@gmail.com", role: t.owner, initials: "SS" }, { name: "Mali S.", email: "mali@example.com", role: t.member, initials: "MS" }];
  return <div className="people-grid"><div className="card"><div className="card-header"><div><h2 className="card-title">{t.members}</h2><p className="card-subtitle">2 active · 1 invitation pending</p></div><button className="text-button"><Plus size={12}/>{t.invite}</button></div>{members.map(member => <div className="member-row" key={member.email}><Avatar.Root><Avatar.Fallback className="avatar">{member.initials}</Avatar.Fallback></Avatar.Root><div className="member-info"><strong>{member.name}</strong><span>{member.email}</span></div><span className="role">{member.role}</span><button className="icon-btn" aria-label={`Options for ${member.name}`}><MoreHorizontal size={14}/></button></div>)}<div className="member-row"><div className="avatar" style={{background: "var(--surface-muted)", color: "var(--muted)"}}>?</div><div className="member-info"><strong>nina@example.com</strong><span>{locale === "th" ? "ส่งคำเชิญเมื่อ 2 วันก่อน" : "Invited 2 days ago"}</span></div><span className="role">Pending</span></div></div><div className="card"><div className="card-header"><div><h2 className="card-title">{t.activity}</h2><p className="card-subtitle">{locale === "th" ? "บันทึกการเปลี่ยนแปลงในบ้าน" : "A secure record of household changes"}</p></div></div>{[{text:"Santhiti added ฿1,840 at Villa Market", time:"18:42 today"},{text:"Mali updated Thai green curry",time:"Yesterday"},{text:"Santhiti invited nina@example.com",time:"22 Aug"},{text:"Mali created Dinner with Mum",time:"21 Aug"}].map(item => <div className="activity-row" key={item.text}><i className="activity-dot"/><div><p>{item.text}</p><span>{item.time}</span></div></div>)}</div></div>;
}

function SettingsView({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  const t = copy[locale]; const { theme, setTheme } = useTheme();
  return <div className="card settings-card"><div className="card-header"><div><h2 className="card-title">{t.preferences}</h2><p className="card-subtitle">{locale === "th" ? "ใช้กับบัญชีของคุณทุกอุปกรณ์" : "Applied to your account across devices"}</p></div></div><div className="setting-row"><div><strong>{t.language}</strong><span>English / ภาษาไทย</span></div><select className="control" value={locale} onChange={e => setLocale(e.target.value as Locale)}><option value="en">English</option><option value="th">ภาษาไทย</option></select></div><div className="setting-row"><div><strong>{t.theme}</strong><span>{locale === "th" ? "สว่าง มืด หรือตามระบบ" : "Light, dark, or follow your system"}</span></div><select className="control" value={theme} onChange={e => setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></div><div className="setting-row"><div><strong>{t.currency}</strong><span>{locale === "th" ? "สกุลเงินหลักของบ้าน" : "Your household’s reporting currency"}</span></div><select className="control"><option>THB — Thai Baht</option></select></div><div className="setting-row"><div><strong>{t.timezone}</strong><span>{locale === "th" ? "ใช้กับปฏิทินและแจ้งเตือน" : "Used for calendar and reminders"}</span></div><select className="control"><option>Asia/Bangkok (GMT+7)</option></select></div><div className="setting-row"><div><strong>Realtime editing</strong><span>{locale === "th" ? "แสดงการเปลี่ยนแปลงจากสมาชิกทันที" : "Show member changes as they happen"}</span></div><div className="tag" style={{width: "fit-content"}}>● Enabled</div></div></div>;
}

function AddDialog({ open, onOpenChange, locale, view, onAdd, demoMode, householdId, userId }: { open: boolean; onOpenChange: (v: boolean) => void; locale: Locale; view: View; onAdd: (transaction: Transaction) => void | Promise<void>; demoMode: boolean; householdId?: string; userId?: string }) {
  const t = copy[locale];
  async function submit(formData: FormData) {
    const title = String(formData.get("title") || (view === "calendar" ? "New event" : view === "recipes" ? "New recipe" : "New transaction"));
    if (view === "household" && !demoMode) {
      const response = await fetch("/api/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: title }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { toast.error(result.error ?? "Could not send invitation"); return; }
    }
    if (!demoMode && householdId && userId && view === "calendar") {
      const { error } = await createSupabaseClient().from("calendar_events").insert({ household_id: householdId, created_by: userId, title, item_type: "event", starts_at: new Date().toISOString() });
      if (error) { toast.error(error.message); return; }
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
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="overlay"/><Dialog.Content className="dialog"><Dialog.Title>{description}</Dialog.Title><Dialog.Description className="dialog-description">{locale === "th" ? "รายละเอียดจะซิงก์ให้สมาชิกทุกคนทันที" : "Details will sync with everyone in your household."}</Dialog.Description><form action={submit}><div className="field-grid"><div className="field full"><label>{view === "household" ? "Email" : t.title}</label><input name="title" type={view === "household" ? "email" : "text"} required placeholder={view === "household" ? "name@example.com" : "e.g. Grocery shopping"}/></div>{(view === "overview" || view === "finances") && <><div className="field"><label>{t.type}</label><select name="type"><option value="expense">{t.expense}</option><option value="income">{t.income}</option></select></div><div className="field"><label>{t.amount}</label><input name="amount" type="number" min="0" step="0.01" required placeholder="0.00"/></div><div className="field"><label>{t.category}</label><select name="category"><option>Groceries</option><option>Home</option><option>Transport</option><option>Income</option><option>Other</option></select></div><div className="field"><label>{t.date}</label><input name="date" type="date" defaultValue="2026-08-24"/></div></>}</div><div className="dialog-actions"><Dialog.Close asChild><button type="button" className="secondary-btn">{t.cancel}</button></Dialog.Close><button className="primary-btn" type="submit">{t.add}</button></div></form></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function SebastianApp({ demoMode = true, householdId, userId, initialTransactions }: { demoMode?: boolean; householdId?: string; userId?: string; initialTransactions?: Transaction[] }) {
  const [view, setView] = useState<View>("overview");
  const [locale, setLocale] = useState<Locale>("en");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(demoMode ? [...seedTransactions] : (initialTransactions ?? []));
  const { resolvedTheme, setTheme } = useTheme();
  const t = copy[locale];
  const nav = useMemo(() => (["overview", "finances", "calendar", "recipes", "household", "settings"] as View[]), []);
  const notifyRealtimeChange = useCallback(async () => {
    if (!householdId) return;
    const { data } = await createSupabaseClient().from("transactions").select("id,title,type,amount,occurred_on,categories(name)").eq("household_id", householdId).order("occurred_on", { ascending: false }).limit(30);
    if (data) setTransactions(data.map(row => ({ id: row.id, title: row.title, category: relatedName(row.categories), date: row.occurred_on, amount: row.type === "income" ? Number(row.amount) : -Number(row.amount), icon: row.type === "income" ? "wallet" : "basket" })));
    toast.info(locale === "th" ? "ข้อมูลอัปเดตจากสมาชิกในบ้าน" : "Household data updated");
  }, [householdId, locale]);
  useHouseholdRealtime(!demoMode, notifyRealtimeChange);

  async function addTransaction(item: Transaction) {
    if (demoMode) { setTransactions(current => [item, ...current]); return; }
    if (!householdId || !userId) throw new Error("Missing household session");
    const supabase = createSupabaseClient();
    const { data: category } = await supabase.from("categories").select("id").eq("household_id", householdId).eq("name", item.category).maybeSingle();
    const { error } = await supabase.from("transactions").insert({ household_id: householdId, created_by: userId, type: item.amount > 0 ? "income" : "expense", amount: Math.abs(item.amount), title: item.title, category_id: category?.id ?? null, occurred_on: new Date().toISOString().slice(0, 10) });
    if (error) { toast.error(error.message); throw error; }
    await notifyRealtimeChange();
  }

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Sparkles size={18}/></div><div><div className="brand-name">Sebastian</div><div className="brand-kicker">Home, handled</div></div></div><div className="nav-label">Workspace</div><nav className="nav">{nav.map(item => { const Icon = navIcons[item]; return <button key={item} className={cn("nav-item", view === item && "active")} onClick={() => setView(item)}><Icon size={16}/>{t[item]}{item === "calendar" && <span className="badge">3</span>}</button>; })}</nav><div className="sidebar-bottom">{demoMode && <div className="demo-note"><strong>{t.demo}</strong><span>{t.demoHint}</span></div>}<div className="profile"><Avatar.Root><Avatar.Fallback className="avatar">SS</Avatar.Fallback></Avatar.Root><div className="profile-copy"><strong>Santhiti</strong><span>s4nthiti@gmail.com</span></div><DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="icon-btn" style={{border:0, width:30, height:30}}><MoreHorizontal size={15}/></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="dropdown" sideOffset={6}><DropdownMenu.Item className="dropdown-item" onSelect={() => setView("settings")}><Settings size={13}/> {t.settings}</DropdownMenu.Item><DropdownMenu.Item className="dropdown-item"><Users size={13}/> {t.household}</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div></div></aside>
    <main className="main"><header className="topbar"><label className="search"><Search size={15}/><input placeholder={t.search}/></label><div className="top-actions"><button className="icon-btn lang-button" onClick={() => setLocale(locale === "en" ? "th" : "en")}><Languages size={14}/>{locale === "en" ? "TH" : "EN"}</button><button className="icon-btn" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}</button><button className="icon-btn" aria-label="Notifications"><Bell size={15}/></button></div></header><div className="content"><PageHeading locale={locale} view={view} onAdd={() => setDialogOpen(true)}/>{view === "overview" && <Overview locale={locale} transactions={transactions} onNavigate={setView}/>} {view === "finances" && <Finances locale={locale} transactions={transactions}/>} {view === "calendar" && <CalendarView locale={locale}/>} {view === "recipes" && <RecipesView locale={locale}/>} {view === "household" && <HouseholdView locale={locale}/>} {view === "settings" && <SettingsView locale={locale} setLocale={setLocale}/>}</div></main>
    <nav className="mobile-nav">{nav.slice(0,5).map(item => { const Icon = navIcons[item]; return <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}><Icon size={18}/><span>{t[item]}</span></button>; })}</nav>
    <AddDialog open={dialogOpen} onOpenChange={setDialogOpen} locale={locale} view={view} onAdd={addTransaction} demoMode={demoMode} householdId={householdId} userId={userId}/>
  </div>;
}
