export const spendingData = [
  { month: "Mar", income: 86000, expense: 51200 },
  { month: "Apr", income: 79000, expense: 48700 },
  { month: "May", income: 92000, expense: 55100 },
  { month: "Jun", income: 88000, expense: 63500 },
  { month: "Jul", income: 95000, expense: 57400 },
  { month: "Aug", income: 98000, expense: 42680 },
];

export const categories = [
  { name: "Food & dining", value: 12480, color: "#ff7b54" },
  { name: "Home", value: 10200, color: "#3a7d6f" },
  { name: "Transport", value: 7200, color: "#e7b25b" },
  { name: "Subscriptions", value: 3800, color: "#8a78c2" },
  { name: "Other", value: 9000, color: "#aeb7b4" },
];

export const transactions = [
  { id: "1", title: "Villa Market", category: "Groceries", date: "Today, 18:42", amount: -1840, icon: "basket" },
  { id: "2", title: "Salary", category: "Income", date: "Today, 09:00", amount: 98000, icon: "wallet" },
  { id: "3", title: "MEA electricity", category: "Utilities", date: "23 Aug", amount: -2180, icon: "zap" },
  { id: "4", title: "BTS Rabbit", category: "Transport", date: "22 Aug", amount: -500, icon: "train" },
  { id: "5", title: "Netflix", category: "Subscriptions", date: "20 Aug", amount: -419, icon: "play" },
];

export const upcoming = [
  { id: "1", day: "25", month: "AUG", title: "Pay home insurance", meta: "Reminder · ฿8,400", tone: "coral" },
  { id: "2", day: "27", month: "AUG", title: "Dinner with Mum", meta: "19:00 · Baan Nual", tone: "green" },
  { id: "3", day: "30", month: "AUG", title: "Monthly home review", meta: "10:30 · Home", tone: "yellow" },
];

export const calendarDays = [
  { date: 24, current: true, events: [{ label: "Market", type: "money" }] },
  { date: 25, events: [{ label: "Insurance", type: "reminder" }] },
  { date: 26, events: [] },
  { date: 27, events: [{ label: "Dinner · Mum", type: "event" }, { label: "Green curry", type: "meal" }] },
  { date: 28, events: [{ label: "Water bill", type: "money" }] },
  { date: 29, events: [] },
  { date: 30, events: [{ label: "Home review", type: "reminder" }] },
];

export const recipes = [
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
];

export const debts = [
  { name: "Home renovation", paid: 180000, total: 300000, next: "฿15,000 · 1 Sep" },
  { name: "MacBook Pro", paid: 52900, total: 79900, next: "฿4,500 · 8 Sep" },
];
