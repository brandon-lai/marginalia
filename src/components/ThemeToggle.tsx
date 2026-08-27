"use client"
import { useEffect, useState } from "react"

/** Rule 7: both themes are real, and reading happens at night. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("marginalia-theme")
      if (stored === "dark" || stored === "light") setTheme(stored)
    } catch {
      /* private browsing: fall back to the system preference */
    }
  }, [])

  const toggle = () => {
    const current =
      theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    const next = current === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.setAttribute("data-theme", next)
    try {
      localStorage.setItem("marginalia-theme", next)
    } catch {
      /* nothing to persist to; the attribute still applies for this page */
    }
  }

  return (
    <button className="icon-btn" onClick={toggle} aria-label="Toggle light and dark" title="Toggle light and dark">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    </button>
  )
}
