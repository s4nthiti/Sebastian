export const demoDataEnabled =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === 'true';

function whenDemoDataEnabled<T>(items: T[]) {
  return demoDataEnabled ? items : [];
}

export const financialSummary = demoDataEnabled
  ? {
      balance: 55320,
      income: 98000,
      expenses: 42680,
      dueSoon: 12900,
      dueSoonCount: 3,
      balanceTrend: "+18.4%",
      expenseTrend: "−8.2%",
    }
  : null;

export const spendingData = whenDemoDataEnabled([
  { month: "Mar", income: 86000, expense: 51200 },
  { month: "Apr", income: 79000, expense: 48700 },
  { month: "May", income: 92000, expense: 55100 },
  { month: "Jun", income: 88000, expense: 63500 },
  { month: "Jul", income: 95000, expense: 57400 },
  { month: "Aug", income: 98000, expense: 42680 },
]);

export const categories = whenDemoDataEnabled([
  { id: "category-groceries", name: "Groceries", nameTh: "ของใช้และอาหาร", color: "#ff7b54" },
  { id: "category-home", name: "Home", nameTh: "บ้าน", color: "#3a7d6f" },
  { id: "category-transport", name: "Transport", nameTh: "เดินทาง", color: "#e7b25b" },
  { id: "category-subscriptions", name: "Subscriptions", nameTh: "สมาชิกบริการ", color: "#8a78c2" },
  { id: "category-income", name: "Income", nameTh: "รายรับ", color: "#4f8ec9" },
  { id: "category-other", name: "Other", nameTh: "อื่น ๆ", color: "#aeb7b4" },
]);

export const transactions = whenDemoDataEnabled([
  { id: "1", title: "Villa Market", category: "Groceries", date: "Today, 18:42", amount: -1840, icon: "basket" },
  { id: "2", title: "Salary", category: "Income", date: "Today, 09:00", amount: 98000, icon: "wallet" },
  { id: "3", title: "MEA electricity", category: "Utilities", date: "23 Aug", amount: -2180, icon: "zap" },
  { id: "4", title: "BTS Rabbit", category: "Transport", date: "22 Aug", amount: -500, icon: "train" },
  { id: "5", title: "Netflix", category: "Subscriptions", date: "20 Aug", amount: -419, icon: "play" },
]);

export const upcoming = whenDemoDataEnabled([
  { id: "1", day: "25", month: "AUG", title: "Pay home insurance", meta: "Reminder · ฿8,400", tone: "coral" },
  { id: "2", day: "27", month: "AUG", title: "Dinner with Mum", meta: "19:00 · Baan Nual", tone: "green" },
  { id: "3", day: "30", month: "AUG", title: "Monthly home review", meta: "10:30 · Home", tone: "yellow" },
]);

export const calendarDays = whenDemoDataEnabled([
  { date: 24, current: true, events: [{ label: "Market", type: "money" }] },
  { date: 25, events: [{ label: "Insurance", type: "reminder" }] },
  { date: 26, events: [] },
  { date: 27, events: [{ label: "Dinner · Mum", type: "event" }, { label: "Green curry", type: "meal" }] },
  { date: 28, events: [{ label: "Water bill", type: "money" }] },
  { date: 29, events: [] },
  { date: 30, events: [{ label: "Home review", type: "reminder" }] },
]);

export const calendarEvents = whenDemoDataEnabled([
  {
    id: "calendar-1",
    title: "Market",
    description: "Weekly grocery run",
    date: "2026-08-24",
    time: "18:30",
    repeat: "weekly" as const,
    type: "money" as const,
  },
  {
    id: "calendar-2",
    title: "Pay home insurance",
    description: "Annual home insurance payment",
    date: "2026-08-25",
    time: "09:00",
    repeat: "yearly" as const,
    type: "reminder" as const,
  },
  {
    id: "calendar-3",
    title: "Dinner with Mum",
    description: "Dinner at Baan Nual",
    date: "2026-08-27",
    time: "19:00",
    repeat: "none" as const,
    type: "event" as const,
  },
  {
    id: "calendar-4",
    title: "Green curry",
    description: "Planned household dinner",
    date: "2026-08-27",
    time: "20:00",
    repeat: "none" as const,
    type: "meal" as const,
  },
  {
    id: "calendar-5",
    title: "Water bill",
    description: "Monthly utility payment",
    date: "2026-08-28",
    time: "09:00",
    repeat: "monthly" as const,
    type: "money" as const,
  },
  {
    id: "calendar-6",
    title: "Monthly home review",
    description: "Review finances and plans",
    date: "2026-08-30",
    time: "10:30",
    repeat: "monthly" as const,
    type: "reminder" as const,
  },
]);

export const recipes = whenDemoDataEnabled([
  {
    id: "1",
    title: "Thai green curry",
    thai: "แกงเขียวหวานไก่",
    time: "45 min",
    difficulty: "Easy",
    tags: ["Thai", "Dinner"],
    image: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "2",
    title: "Salmon rice bowl",
    thai: "ข้าวหน้าปลาแซลมอน",
    time: "30 min",
    difficulty: "Easy",
    tags: ["Japanese", "Healthy"],
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "3",
    title: "Mushroom pasta",
    thai: "พาสต้าเห็ดครีมซอส",
    time: "35 min",
    difficulty: "Medium",
    tags: ["Italian", "Vegetarian"],
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80",
  },
]);

export const debts = whenDemoDataEnabled([
  { id: "debt-renovation", name: "Home renovation", paid: 180000, total: 300000, installment: 15000, dueDate: "2026-09-01" },
  { id: "debt-macbook", name: "MacBook Pro", paid: 52900, total: 79900, installment: 4500, dueDate: "2026-09-08" },
]);

export const scheduledPayments = whenDemoDataEnabled([
  { id: "payment-insurance", title: "Home insurance", amount: 8400, dueDate: "2026-08-25" },
  { id: "payment-internet", title: "Home internet", amount: 3000, dueDate: "2026-08-27" },
  { id: "payment-water", title: "Water service", amount: 1500, dueDate: "2026-08-28" },
]);
