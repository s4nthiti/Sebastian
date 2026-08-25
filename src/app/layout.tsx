import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "@fontsource/kanit/400.css";
import "@fontsource/kanit/500.css";
import "@fontsource/kanit/600.css";
import "@fontsource/kanit/700.css";
import "@daypicker/react/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sebastian — Your home, thoughtfully managed",
  description: "A private household operating system for money, plans, meals, and everything in between.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
