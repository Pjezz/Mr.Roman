'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Client } from '@/types'

interface Props {
  onClientFound: (client: Client) => void
  onCreateNew: (phone: string) => void
}

export default function ClientSearch({ onClientFound, onCreateNew }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setNotFound(false)

    const supabase = createClient()
    const clean = query.trim()

    let { data } = await supabase
      .from('clients')
      .select('*, phones:client_phones(*), addresses:client_addresses(*, zone:zones(*))')
      .eq('phone', clean)
      .single()

    if (!data) {
      const { data: phoneData } = await supabase
        .from('client_phones')
        .select('client:clients(*, phones:client_phones(*), addresses:client_addresses(*, zone:zones(*)))')
        .eq('phone', clean)
        .single()
      data = (phoneData?.client as Client | null) ?? null
    }

    if (!data) {
      const { data: nitData } = await supabase
        .from('clients')
        .select('*, phones:client_phones(*), addresses:client_addresses(*, zone:zones(*))')
        .eq('nit', clean)
        .single()
      data = nitData
    }

    if (data) {
      onClientFound(data as Client)
    } else {
      setNotFound(true)
    }

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
        Buscar cliente
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Teléfono o NIT"
          style={{
            flex: 1,
            padding: '10px 12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-1)',
            fontFamily: 'inherit',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '10px 18px',
            background: 'var(--primary)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {loading ? '...' : 'Buscar'}
        </button>
      </div>

      {notFound && (
        <div style={{
          background: 'var(--warning-bg)',
          border: '1px solid var(--warning)',
          borderRadius: 8,
          padding: '12px 14px',
        }}>
          <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 8 }}>
            No se encontró ningún cliente con ese dato.
          </div>
          <button
            onClick={() => onCreateNew(query.trim())}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--primary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            + Crear nuevo cliente
          </button>
        </div>
      )}
    </div>
  )
}