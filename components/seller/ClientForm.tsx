'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Client } from '@/types'

interface Props {
  initialPhone?: string
  onClientCreated: (client: Client) => void
  onCancel: () => void
}

export default function ClientForm({ initialPhone = '', onClientCreated, onCancel }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState(initialPhone)
  const [email, setEmail] = useState('')
  const [nit, setNit] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim() || !phone.trim()) {
      setError('Nombre y teléfono son obligatorios')
      return
    }

    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data, error: dbError } = await supabase
      .from('clients')
      .insert({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        nit: nit.trim() || null,
      })
      .select('*, phones:client_phones(*), addresses:client_addresses(*)')
      .single()

    if (dbError) {
      setError('Error al crear el cliente')
      setLoading(false)
      return
    }

    onClientCreated(data as Client)
    setLoading(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-1)',
    fontFamily: 'inherit',
    fontSize: 13,
    outline: 'none',
  }

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-3)',
    marginBottom: 5,
  } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
          Nuevo cliente
        </div>
        <button
          onClick={onCancel}
          style={{
            fontSize: 12,
            color: 'var(--text-3)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cancelar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Nombre completo *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Pérez" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Teléfono *</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5555-1234" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>NIT (opcional)</label>
          <input type="text" value={nit} onChange={(e) => setNit(e.target.value)} placeholder="12345678-9" style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Correo (opcional)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" style={inputStyle} />
        </div>
      </div>

      {error && (
        <div style={{
          padding: '8px 12px',
          background: 'var(--danger-bg)',
          border: '1px solid var(--danger)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--danger)',
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={loading}
        style={{
          width: '100%',
          padding: '11px',
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
        {loading ? 'Creando...' : 'Crear cliente'}
      </button>
    </div>
  )
}
