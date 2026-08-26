import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "@fontsource/kanit/400.css";
import "@fontsource/kanit/500.css";
import "@fontsource/kanit/600.css";
import "@fontsource/kanit/700.css";
import "@daypicker/react/style.css";
import "./globals.css";

const restorePreferencesScript = `(function(){try{var t=localStorage.getItem("sebastian-theme");var r=t==="dark"||t==="light"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.classList.toggle("dark",r==="dark");var l=localStorage.getItem("sebastian-locale");document.documentElement.lang=l==="th"?"th":"en"}catch(e){}})()`;

export const metadata: Metadata = {
  title: "Sebastian — Your home, thoughtfully managed",
  description: "A private household operating system for money, plans, meals, and everything in between.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: restorePreferencesScript }} /></head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
