'use client'

/**
 * ─────────────────────────────────────────────────────────────
 * OffersManager · EXCLUSIVO DEL ROL OWNER
 * ─────────────────────────────────────────────────────────────
 * Apartado de ofertas dentro de la página de Menú del owner.
 * Renderiza un botón "Ofertas" que abre un display (modal) con:
 *   · Habilitar oferta   · Deshabilitar oferta
 *   · Crear oferta       · Borrar oferta
 *   · Cerrar (✕)
 * Cada oferta se muestra como tarjeta con una "luz" en la esquina
 * superior izquierda: VERDE = habilitada, ROJA = deshabilitada.
 *
 * Las ofertas aplican POR ITEM (producto), nunca a la orden entera.
 * Los datos viven en la tabla `offers` de Supabase (ver SUPABASE_SETUP.md).
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Offer, Product, OfferDiscountType } from '@/types'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

export default function OffersManager() {
  const { user } = useCurrentUser()          // Usuario actual (para created_by y guardia de rol)
  const [open, setOpen] = useState(false)    // Controla el display/modal
  const [offers, setOffers] = useState<Offer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null) // Oferta seleccionada
  const [showCreate, setShowCreate] = useState(false)               // Formulario de creación
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Estado del formulario de nueva oferta
  const [form, setForm] = useState({
    name: '',
    product_id: '',
    discount_type: 'percent' as OfferDiscountType,
    discount_value: '',
  })

  // ── Carga inicial de ofertas y productos (para el selector) ──
  async function fetchAll() {
    setLoading(true)
    const supabase = createClient()
    const [{ data: offersData }, { data: productsData }] = await Promise.all([
      supabase.from('offers').select('*, product:products(*)').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('name'),
    ])
    setOffers((offersData ?? []) as Offer[])
    setProducts((productsData ?? []) as Product[])
    setLoading(false)
  }

  useEffect(() => { if (open) fetchAll() }, [open])

  // Guardia de rol: este componente solo se muestra al owner.
  // (La ruta /owner ya está protegida, esto es una segunda barrera.)
  if (user && user.role !== 'owner') return null

  const selected = offers.find((o) => o.id === selectedId) ?? null

  // ── Habilitar / Deshabilitar la oferta seleccionada ──
  async function setEnabled(enabled: boolean) {
    if (!selected) { setError('Selecciona una oferta primero'); return }
    setError('')
    const supabase = createClient()
    await supabase.from('offers').update({ enabled }).eq('id', selected.id)
    fetchAll()
  }

  // ── Borrar la oferta seleccionada (con confirmación) ──
  async function handleDelete() {
    if (!selected) { setError('Selecciona una oferta primero'); return }
    if (!confirm(`¿Borrar la oferta "${selected.name}"? Esta acción no se puede deshacer.`)) return
    setError('')
    const supabase = createClient()
    await supabase.from('offers').delete().eq('id', selected.id)
    setSelectedId(null)
    fetchAll()
  }

  // ── Crear una oferta nueva ──
  async function handleCreate() {
    const value = parseFloat(form.discount_value)
    if (!form.name.trim() || !form.product_id || isNaN(value) || value <= 0) {
      setError('Completa nombre, producto y un descuento válido')
      return
    }
    // Un porcentaje mayor a 100 no tiene sentido
    if (form.discount_type === 'percent' && value > 100) {
      setError('El porcentaje no puede ser mayor a 100')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: insertError } = await supabase.from('offers').insert({
      name: form.name.trim(),
      product_id: form.product_id,
      discount_type: form.discount_type,
      discount_value: value,
      enabled: true,                 // Las ofertas nacen habilitadas
      created_by: user?.id ?? null,
    })
    if (insertError) {
      setError('Error al crear la oferta. ¿Ya conectaste la tabla offers en Supabase?')
    } else {
      setForm({ name: '', product_id: '', discount_type: 'percent', discount_value: '' })
      setShowCreate(false)
      fetchAll()
    }
    setSaving(false)
  }

  // ── Estilos reutilizados (misma estética del resto del programa) ──
  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-1)',
    fontFamily: 'inherit',
    fontSize: 13,
    outline: 'none',
  } as const

  const actionBtn = (bg: string, color: string, border: string) => ({
    padding: '9px 14px',
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontFamily: 'inherit',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
  } as const)

  return (
    <>
      {/* Botón que abre el display de ofertas (visible en la página de Menú) */}
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '9px 18px',
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
        Ofertas
      </button>

      {/* ── Display / modal de ofertas ── */}
      {open && (
        <div
          // Fondo oscuro que cubre la pantalla
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: 760,
            maxHeight: '85vh',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>

            {/* Encabezado con título y botón de cerrar */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                  Ofertas
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  Los descuentos se aplican por producto (item), no por orden
                </div>
              </div>
              {/* Botón de cerrar el display */}
              <button
                onClick={() => { setOpen(false); setShowCreate(false); setSelectedId(null); setError('') }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontFamily: 'inherit',
                }}
              >
                ✕
              </button>
            </div>

            {/* Barra de acciones: los 4 botones pedidos */}
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}>
              <button onClick={() => setEnabled(true)}  style={actionBtn('var(--success-bg)', 'var(--success)', 'var(--success)')}>
                Habilitar oferta
              </button>
              <button onClick={() => setEnabled(false)} style={actionBtn('var(--warning-bg)', 'var(--warning)', 'var(--warning)')}>
                Deshabilitar oferta
              </button>
              <button onClick={() => { setShowCreate(!showCreate); setError('') }} style={actionBtn('var(--primary-bg)', 'var(--primary)', 'var(--primary)')}>
                Crear oferta
              </button>
              <button onClick={handleDelete} style={actionBtn('var(--danger-bg)', 'var(--danger)', 'var(--danger)')}>
                Borrar oferta
              </button>
            </div>

            {/* Mensaje de error (validaciones o falta de tabla en Supabase) */}
            {error && (
              <div style={{
                margin: '10px 20px 0',
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

            {/* Formulario de creación de oferta */}
            {showCreate && (
              <div style={{
                margin: '12px 20px 0',
                padding: 16,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}>
                {/* Nombre visible de la oferta */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <input
                    placeholder="Nombre de la oferta (ej. Martes de Pepperoni)"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                {/* Producto al que aplica: puede ser pizza, combo, bebida, etc. */}
                <select
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Producto…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · Q{p.price.toFixed(2)}</option>
                  ))}
                </select>
                {/* Tipo de descuento */}
                <select
                  value={form.discount_type}
                  onChange={(e) => setForm({ ...form, discount_type: e.target.value as OfferDiscountType })}
                  style={inputStyle}
                >
                  <option value="percent">Porcentaje (%)</option>
                  <option value="fixed">Monto fijo (Q)</option>
                </select>
                {/* Valor del descuento */}
                <input
                  type="number"
                  min="0"
                  placeholder={form.discount_type === 'percent' ? 'Ej. 15 (%)' : 'Ej. 10 (Q)'}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  style={inputStyle}
                />
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  style={{
                    padding: '9px',
                    background: saving ? 'var(--border)' : 'var(--primary)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Guardando…' : 'Guardar oferta'}
                </button>
              </div>
            )}

            {/* Listado de ofertas creadas */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {loading ? (
                <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Cargando…</div>
              ) : offers.length === 0 ? (
                <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
                  No hay ofertas creadas todavía. Usa &quot;Crear oferta&quot; para agregar la primera.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {offers.map((offer) => {
                    const isSelected = offer.id === selectedId
                    return (
                      <button
                        key={offer.id}
                        // Al hacer clic se selecciona la oferta sobre la que
                        // actuarán los botones Habilitar/Deshabilitar/Borrar
                        onClick={() => setSelectedId(isSelected ? null : offer.id)}
                        style={{
                          position: 'relative',
                          textAlign: 'left',
                          padding: '14px 16px 14px 30px',
                          background: isSelected ? 'var(--primary-bg)' : 'var(--surface-2)',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                          borderRadius: 10,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {/* ── Luz indicadora en la esquina superior izquierda ──
                            VERDE  = oferta habilitada
                            ROJA   = oferta deshabilitada */}
                        <span style={{
                          position: 'absolute',
                          top: 10,
                          left: 10,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: offer.enabled ? 'var(--success)' : 'var(--danger)',
                          boxShadow: `0 0 6px ${offer.enabled ? 'var(--success)' : 'var(--danger)'}`,
                        }} />

                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                          {offer.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                          {offer.product?.name ?? 'Producto eliminado'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                          Descuento:{' '}
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                            {offer.discount_type === 'percent'
                              ? `${offer.discount_value}%`
                              : `Q${offer.discount_value.toFixed(2)}`}
                          </span>
                          {' '}por unidad · {offer.enabled ? 'Habilitada' : 'Deshabilitada'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
