import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cheese TOEIC Command Deck",
  description: "A designed TOEIC sprint workspace for timing drills, review logging, unfinished tracking, and score projection across a 20-session plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased bg-zinc-50 text-zinc-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-50`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
