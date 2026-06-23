'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  title: string
  hint?: string
}

export default function Topbar({ title, hint }: Props) {
  const [time, setTime] = useState('')
  const router = useRouter()

  useEffect(() => {
    function updateTime() {
      const now = new Date()
      setTime(now.toLocaleTimeString('es-GT', {
        hour: '2-digit',
        minute: '2-digit',
      }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header style={{
      flexShrink: 0,
      height: 62,
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
    }}>
      <div>
        <div style={{
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '-0.2px',
          color: 'var(--text-1)',
        }}>
          {title}
        </div>
        {hint && (
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
            {hint}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 12,
          color: 'var(--text-2)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '7px 11px',
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--success)',
          }} />
          Local abierto
        </div>

        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: 'var(--text-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 11px',
        }}>
          {time}
        </div>

        <button
          onClick={handleLogout}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-3)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 500,
            padding: '6px 10px',
            borderRadius: 6,
          }}
        >
          Salir
        </button>
      </div>
    </header>
  )
}