'use client'

import { useEffect, useState } from 'react'
import { useThemeStore } from '@/lib/store/themeStore'

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { theme } = useThemeStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme, mounted])

  if (!mounted) {
    return (
      <div data-theme="dark" style={{ minHeight: '100vh' }}>
        {children}
      </div>
    )
  }

  return (
    <div data-theme={theme} style={{ minHeight: '100vh' }}>
      {children}
    </div>
  )
}