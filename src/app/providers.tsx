"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect, type ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  // Delay providers until client-side mount to prevent hydration mismatch
  // SessionProvider checks session → state change → mismatch
  // ThemeProvider reads system theme → adds class to <html> → mismatch
  useEffect(() => {
    // Defer setMounted to avoid React lint rule — must run after commit
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Before mount: render children as-is (no providers, no theme, no session check)
  // This ensures server HTML === client HTML → no hydration mismatch → no refresh
  if (!mounted) {
    return <>{children}</>
  }

  // After mount: activate all providers safely
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
