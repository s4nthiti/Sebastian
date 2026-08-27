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
  { id: "category-savings", name: "Savings", nameTh: "เงินออม", color: "#3a7d6f", isSystem: true },
  { id: "category-groceries", name: "Groceries", nameTh: "ของใช้และอาหาร", color: "#ff7b54" },
  { id: "category-home", name: "Home", nameTh: "บ้าน", color: "#3a7d6f" },
  { id: "category-transport", name: "Transport", nameTh: "เดินทาง", color: "#e7b25b" },
  { id: "category-subscriptions", name: "Subscriptions", nameTh: "สมาชิกบริการ", color: "#8a78c2" },
  { id: "category-income", name: "Income", nameTh: "รายรับ", color: "#4f8ec9" },
  { id: "category-other", name: "Other", nameTh: "อื่น ๆ", color: "#aeb7b4" },
]);

export const transactions = whenDemoDataEnabled([
  { id: "savings-opening-emergency", title: "Opening balance: Emergency fund", category: "Savings", date: "2026-08-01", amount: -85000, icon: "piggy-bank", savingsGoalId: "savings-emergency" },
  { id: "savings-opening-holiday", title: "Opening balance: Family holiday", category: "Savings", date: "2026-08-01", amount: -24000, icon: "piggy-bank", savingsGoalId: "savings-holiday" },
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

export type RecipeCategory = "food" | "dessert" | "beverage";
export type RecipeDifficulty = "easy" | "medium" | "hard";
export type RecipeIngredient = { name: string; unit?: string };
export type Recipe = {
  id: string;
  title: string;
  titleTh?: string;
  description?: string;
  image?: string;
  prepMinutes: number;
  cookMinutes: number;
  servings?: number;
  difficulty: RecipeDifficulty;
  category: RecipeCategory;
  tags: string[];
  ingredients: RecipeIngredient[];
};

const recipeCategories = new Set<RecipeCategory>(["food", "dessert", "beverage"]);

export function recipeFromRow(row: {
  id: string;
  title: string;
  title_th: string | null;
  description: string | null;
  image_path: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  difficulty: string | null;
  tags: string[] | null;
  ingredients: unknown;
}): Recipe {
  const tags = row.tags ?? [];
  const storedCategory = tags.find((tag): tag is RecipeCategory => recipeCategories.has(tag.toLowerCase() as RecipeCategory));
  const difficulty = row.difficulty === "medium" || row.difficulty === "hard" ? row.difficulty : "easy";
  return {
    id: row.id,
    title: row.title,
    titleTh: row.title_th ?? undefined,
    description: row.description ?? undefined,
    image: row.image_path ?? undefined,
    prepMinutes: row.prep_minutes ?? 0,
    cookMinutes: row.cook_minutes ?? 0,
    servings: row.servings ?? undefined,
    difficulty,
    category: storedCategory ?? "food",
    tags: tags.filter((tag) => !recipeCategories.has(tag.toLowerCase() as RecipeCategory)),
    ingredients: Array.isArray(row.ingredients) ? row.ingredients.flatMap((ingredient): RecipeIngredient[] => {
      if (typeof ingredient === "string") return ingredient.trim() ? [{ name: ingredient.trim() }] : [];
      if (!ingredient || typeof ingredient !== "object") return [];
      const value = ingredient as Record<string, unknown>;
      const name = typeof value.name === "string" ? value.name.trim() : typeof value.ingredient === "string" ? value.ingredient.trim() : "";
      const unit = typeof value.unit === "string" ? value.unit.trim() : "";
      return name ? [{ name, unit: unit || undefined }] : [];
    }) : [],
  };
}

export const recipes: Recipe[] = whenDemoDataEnabled([
  {
    id: "1",
    title: "Thai green curry",
    titleTh: "แกงเขียวหวานไก่",
    description: "A fragrant coconut curry with chicken, Thai basil, and crisp vegetables.",
    prepMinutes: 15,
    cookMinutes: 30,
    servings: 4,
    difficulty: "easy",
    category: "food",
    tags: ["Thai", "Dinner"],
    ingredients: [{ name: "Chicken", unit: "400 g" }, { name: "Coconut milk", unit: "400 ml" }, { name: "Green curry paste", unit: "2 tbsp" }, { name: "Thai basil", unit: "1 handful" }],
    image: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "2",
    title: "Salmon rice bowl",
    titleTh: "ข้าวหน้าปลาแซลมอน",
    description: "Glazed salmon, steamed rice, cucumber, and a quick sesame dressing.",
    prepMinutes: 10,
    cookMinutes: 20,
    servings: 2,
    difficulty: "easy",
    category: "food",
    tags: ["Japanese", "Healthy"],
    ingredients: [{ name: "Salmon fillets", unit: "2" }, { name: "Cooked rice", unit: "2 cups" }, { name: "Cucumber", unit: "1" }, { name: "Sesame dressing", unit: "2 tbsp" }],
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "3",
    title: "Mushroom pasta",
    titleTh: "พาสต้าเห็ดครีมซอส",
    description: "Silky cream sauce, golden mushrooms, and parmesan tossed with pasta.",
    prepMinutes: 10,
    cookMinutes: 25,
    servings: 3,
    difficulty: "medium",
    category: "food",
    tags: ["Italian", "Vegetarian"],
    ingredients: [{ name: "Pasta", unit: "250 g" }, { name: "Mushrooms", unit: "250 g" }, { name: "Cream", unit: "200 ml" }, { name: "Parmesan", unit: "50 g" }],
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "4",
    title: "Mango sticky rice",
    titleTh: "ข้าวเหนียวมะม่วง",
    description: "Sweet coconut sticky rice served with ripe mango and toasted mung beans.",
    prepMinutes: 20,
    cookMinutes: 35,
    servings: 4,
    difficulty: "medium",
    category: "dessert",
    tags: ["Thai", "Coconut"],
    ingredients: [{ name: "Sticky rice", unit: "2 cups" }, { name: "Ripe mangoes", unit: "2" }, { name: "Coconut milk", unit: "400 ml" }, { name: "Sugar", unit: "3 tbsp" }],
    image: "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "5",
    title: "Thai iced tea",
    titleTh: "ชาไทยเย็น",
    description: "Strong spiced tea softened with milk and poured over plenty of ice.",
    prepMinutes: 5,
    cookMinutes: 10,
    servings: 2,
    difficulty: "easy",
    category: "beverage",
    tags: ["Thai", "Cold"],
    ingredients: [{ name: "Thai tea mix", unit: "4 tbsp" }, { name: "Water", unit: "500 ml" }, { name: "Milk", unit: "120 ml" }, { name: "Ice" }],
    image: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=1200&q=80",
  },
]);

export const debts = whenDemoDataEnabled([
  { id: "debt-renovation", name: "Home renovation", paid: 180000, total: 300000, installment: 15000, totalMonths: 20, paidMonths: 12, dueDay: 1, dueDate: "2026-09-01" },
  { id: "debt-macbook", name: "MacBook Pro", paid: 53266.67, total: 79900, installment: 4438.89, totalMonths: 18, paidMonths: 12, dueDay: 8, dueDate: "2026-09-08" },
]);

export const savingsGoals = whenDemoDataEnabled([
  { id: "savings-emergency", name: "Emergency fund", current: 85000, target: 180000, targetDate: "2026-12-31" },
  { id: "savings-holiday", name: "Family holiday", current: 24000, target: 60000, targetDate: "2026-11-15" },
]);

export const scheduledPayments = whenDemoDataEnabled([
  { id: "payment-insurance", title: "Home insurance", amount: 8400, dueDate: "2026-08-25" },
  { id: "payment-internet", title: "Home internet", amount: 3000, dueDate: "2026-08-27" },
  { id: "payment-water", title: "Water service", amount: 1500, dueDate: "2026-08-28" },
]);
