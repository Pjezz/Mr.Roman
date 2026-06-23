'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Client, ClientAddress } from '@/types'

interface Props {
  client: Client
  onAddressSelected: (address: ClientAddress) => void
  onNoZone: () => void
}

export default function AddressSelector({ client, onAddressSelected, onNoZone }: Props) {
  const [showNew, setShowNew] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [newSector, setNewSector] = useState('')
  const [loading, setLoading] = useState(false)
  const [zoneError, setZoneError] = useState('')

  const addresses = client.addresses ?? []

  async function resolveZone(sector: string): Promise<string | null> {
    const supabase = createClient()
    const { data } = await supabase
      .from('zone_sectors')
      .select('zone_id')
      .ilike('sector_name', sector.trim())
      .single()
    return data?.zone_id ?? null
  }

  async function handleSelectExisting(address: ClientAddress) {
    if (!address.zone_id) { onNoZone(); return }
    onAddressSelected(address)
  }

  async function handleSaveNew() {
    if (!newAddress.trim() || !newSector.trim()) return
    setLoading(true)
    setZoneError('')

    const zone_id = await resolveZone(newSector)
    if (!zone_id) {
      setZoneError('Sin cobertura para esa colonia.')
      setLoading(false)
      onNoZone()
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('client_addresses')
      .insert({
        client_id: client.id,
        address: newAddress.trim(),
        sector: newSector.trim(),
        zone_id,
        is_default: addresses.length === 0,
      })
      .select('*, zone:zones(*)')
      .single()

    if (error || !data) {
      setZoneError('Error al guardar la dirección')
      setLoading(false)
      return
    }

    onAddressSelected(data as ClientAddress)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
        Dirección de entrega
      </div>

      {addresses.map((addr) => (
        <button
          key={addr.id}
          onClick={() => handleSelectExisting(addr)}
          style={{
            textAlign: 'left',
            padding: '12px 14px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
            {addr.address}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            {addr.sector}
            {addr.zone && (
              <span style={{ color: 'var(--primary)', marginLeft: 6 }}>
                Zona {(addr as any).zone?.label}
              </span>
            )}
          </div>
        </button>
      ))}

      {!showNew ? (
        <button
          onClick={() => setShowNew(true)}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--primary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
            padding: 0,
          }}
        >
          + Agregar nueva dirección
        </button>
      ) : (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Dirección"
            style={inputStyle}
          />
          <input
            type="text"
            value={newSector}
            onChange={(e) => setNewSector(e.target.value)}
            placeholder="Colonia / Sector"
            style={inputStyle}
          />
          {zoneError && (
            <div style={{ fontSize: 11, color: 'var(--danger)' }}>{zoneError}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSaveNew}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px',
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
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-3)',
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}