'use client'

/**
 * ─────────────────────────────────────────────────────────────
 * PlatformsManager · EXCLUSIVO DEL ROL OWNER
 * ─────────────────────────────────────────────────────────────
 * Permite al owner AGREGAR y BORRAR servicios de delivery externos
 * (PedidosYa, UberEats, etc.). Estos servicios son los que el
 * vendedor verá al escoger la modalidad "Plataformas" en el punto
 * de venta. Los datos viven en la tabla `delivery_platforms` de
 * Supabase (ver SUPABASE_SETUP.md), que ya incluye "PedidosYa"
 * como registro inicial.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DeliveryPlatform } from '@/types'

export default function PlatformsManager() {
  const [platforms, setPlatforms] = useState<DeliveryPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')   // Nombre del nuevo servicio
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Cargar servicios existentes ──
  async function fetchPlatforms() {
    const supabase = createClient()
    const { data } = await supabase
      .from('delivery_platforms')
      .select('*')
      .order('created_at')
    setPlatforms((data ?? []) as DeliveryPlatform[])
    setLoading(false)
  }

  useEffect(() => { fetchPlatforms() }, [])

  // ── Agregar un servicio nuevo ──
  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    // Evitamos duplicados por nombre (comparación sin mayúsculas)
    if (platforms.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setError('Ese servicio ya existe')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: insertError } = await supabase
      .from('delivery_platforms')
      .insert({ name, active: true })
    if (insertError) {
      setError('Error al agregar. ¿Ya conectaste la tabla delivery_platforms en Supabase?')
    } else {
      setNewName('')
      fetchPlatforms()
    }
    setSaving(false)
  }

  // ── Borrar un servicio (con confirmación) ──
  async function handleDelete(platform: DeliveryPlatform) {
    if (!confirm(`¿Borrar el servicio "${platform.name}"? Las órdenes antiguas conservarán su registro.`)) return
    const supabase = createClient()
    // Nota: la FK de orders.platform_id usa ON DELETE SET NULL, por lo que
    // borrar un servicio NO borra las órdenes históricas (ver SUPABASE_SETUP.md)
    await supabase.from('delivery_platforms').delete().eq('id', platform.id)
    fetchPlatforms()
  }

  return (
    <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Formulario para agregar un servicio */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 16,
        display: 'flex',
        gap: 8,
      }}>
        <input
          placeholder="Nombre del servicio (ej. UberEats)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          style={{
            flex: 1,
            padding: '9px 12px',
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
          onClick={handleAdd}
          disabled={saving || !newName.trim()}
          style={{
            padding: '9px 18px',
            background: saving || !newName.trim() ? 'var(--border)' : 'var(--primary)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: saving || !newName.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Agregar
        </button>
      </div>

      {/* Errores de validación o de conexión con Supabase */}
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

      {/* Listado de servicios */}
      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Cargando…</div>
      ) : platforms.length === 0 ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
          No hay servicios registrados. Corre el script de SUPABASE_SETUP.md para
          crear la tabla con &quot;PedidosYa&quot; incluido, o agrega uno arriba.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {platforms.map((platform) => (
            <div
              key={platform.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                {platform.name}
              </div>
              {/* Botón de borrado del servicio */}
              <button
                onClick={() => handleDelete(platform)}
                style={{
                  padding: '6px 14px',
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger)',
                  borderRadius: 8,
                  color: 'var(--danger)',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
