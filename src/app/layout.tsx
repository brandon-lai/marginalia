import type { Metadata } from "next"
import "./globals.css"
import { getConfig } from "@/lib/config"
import { ThemeToggle } from "@/components/ThemeToggle"
import Link from "next/link"

export const metadata: Metadata = {
  title: "marginalia",
  description: "A research and reading frontend for the brain vault.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cfg = getConfig()
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Applied before first paint so the chosen theme never flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("marginalia-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div className="app">
          <header className="topbar">
            <Link href="/" className="brand">
              marginalia<span className="dot">.</span>
            </Link>
            <nav className="nav">
              <Link href="/">Sources</Link>
              <Link href="/vault">Vault</Link>
              <Link href="/backlog">Backlog</Link>
            </nav>
            <div className="topbar-right">
              <span className={`mode-chip ${cfg.hasVault ? "live" : "demo"}`}>
                {cfg.hasVault ? "vault" : "demo vault"}
              </span>
              <ThemeToggle />
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
