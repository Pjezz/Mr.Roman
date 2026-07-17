'use client'

/**
 * ─────────────────────────────────────────────────────────────
 * WizardStep1 · Punto de venta (rol SELLER)
 * ─────────────────────────────────────────────────────────────
 * NUEVA DISTRIBUCIÓN: antes se buscaba primero al cliente; ahora
 * lo PRIMERO es escoger la modalidad de la orden:
 *
 *   · Domicilio        → buscar cliente + dirección (igual que antes)
 *   · Recoger en local → buscar cliente (igual que antes)
 *   · Plataformas      → escoger la app de delivery (PedidosYa, etc.)
 *                        y luego la misma interfaz de recoger en local
 *   · Venta rápida     → SIN buscador de clientes: pasa directo a
 *                        agregar productos (ahorra tiempo en mostrador)
 *
 * Las apps de delivery disponibles vienen de la tabla
 * `delivery_platforms`, administrada por el owner en /owner/platforms.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OrderType, DeliveryPlatform } from '@/types'
import { useOrderStore } from '@/lib/store/orderStore'
import ClientSearch from './ClientSearch'
import ClientForm from './ClientForm'
import AddressSelector from './AddressSelector'
import ClientHistory from './ClientHistory'

// Modalidad interna del paso 1: incluye 'quick' (venta rápida),
// que a nivel de base de datos se guarda como pickup + is_quick_sale
type Modality = 'delivery' | 'pickup' | 'platform' | 'quick'

export default function WizardStep1() {
  const {
    draft, setClient, setAddress, setOrderType,
    setPlatform, setQuickSale, setStep,
  } = useOrderStore()

  const [mode, setMode] = useState<'search' | 'create'>('search')
  const [noZone, setNoZone] = useState(false)
  // Modalidad elegida por el vendedor (primer paso de la nueva distribución)
  const [modality, setModality] = useState<Modality | null>(null)
  // Apps de delivery disponibles (solo para la modalidad Plataformas)
  const [platforms, setPlatforms] = useState<DeliveryPlatform[]>([])
  const [loadingPlatforms, setLoadingPlatforms] = useState(false)

  // ── Cargar servicios de delivery al entrar en "Plataformas" ──
  useEffect(() => {
    if (modality !== 'platform') return
    setLoadingPlatforms(true)
    const supabase = createClient()
    supabase
      .from('delivery_platforms')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        setPlatforms((data ?? []) as DeliveryPlatform[])
        setLoadingPlatforms(false)
      })
  }, [modality])

  /**
   * Al escoger la modalidad se configura el borrador de la orden:
   * - quick:    tipo pickup + bandera de venta rápida, sin cliente
   * - platform: tipo platform, falta escoger la app antes de seguir
   * - resto:    comportamiento original
   */
  function handleModality(m: Modality) {
    setModality(m)
    setNoZone(false)
    setQuickSale(m === 'quick')
    if (m === 'quick') {
      // Venta rápida se comporta como pickup pero sin cliente
      setOrderType('pickup')
    } else {
      setOrderType(m as OrderType)
    }
    if (m !== 'platform') setPlatform(null)
  }

  // Sin cobertura de zona: se fuerza recoger en local (lógica original)
  function handleNoZone() {
    setNoZone(true)
    setModality('pickup')
    setOrderType('pickup')
    setAddress(null)
  }

  /**
   * Condición para poder avanzar al paso 2:
   * - Venta rápida: basta con haberla escogido (no lleva cliente)
   * - Plataformas:  app escogida + cliente
   * - Domicilio:    cliente + dirección
   * - Recoger:      cliente
   */
  const canContinue =
    modality === 'quick'
      ? true
      : modality === 'platform'
        ? !!draft.platform && !!draft.client
        : draft.client &&
          (draft.order_type === 'pickup' ||
            (draft.order_type === 'delivery' && draft.address))

  // Botón de modalidad con la estética de los botones de tipo de entrega
  const modalityBtn = (active: boolean, disabled = false) => ({
    padding: '14px 10px',
    borderRadius: 8,
    border: '1px solid',
    borderColor: active ? 'var(--primary)' : 'var(--border)',
    background: active ? 'var(--primary-bg)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-2)',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  } as const)

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: 24,
      maxWidth: 560,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── 1. Modalidad de la orden (SIEMPRE es lo primero) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
            Modalidad de la orden
          </div>
          {noZone && (
            <div style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--danger)',
            }}>
              Sin cobertura para esa colonia. Solo disponible recoger en local.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              { key: 'pickup' as Modality,   label: 'Recoger en local', disabled: false },
              { key: 'delivery' as Modality, label: 'Domicilio',        disabled: noZone },
              { key: 'platform' as Modality, label: 'Plataformas',      disabled: false },
              { key: 'quick' as Modality,    label: 'Venta rápida',     disabled: false },
            ]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => !opt.disabled && handleModality(opt.key)}
                disabled={opt.disabled}
                style={modalityBtn(modality === opt.key, opt.disabled)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 2. Selección de app de delivery (solo modalidad Plataformas) ──
            El vendedor debe escoger QUÉ aplicación originó el pedido antes
            de llegar a la interfaz normal de cliente/productos. */}
        {modality === 'platform' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
              Aplicación de delivery
            </div>
            {loadingPlatforms ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Cargando servicios…</div>
            ) : platforms.length === 0 ? (
              <div style={{
                fontSize: 12,
                color: 'var(--warning)',
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning)',
                borderRadius: 8,
                padding: '8px 12px',
              }}>
                No hay servicios de delivery registrados. El owner puede
                agregarlos en su apartado de Plataformas.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {platforms.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p)}
                    style={modalityBtn(draft.platform?.id === p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 3. Cliente ──
            Se muestra DESPUÉS de escoger modalidad, excepto en venta
            rápida (punto 6: sin buscador para no perder tiempo).
            En Plataformas aparece cuando ya se escogió la app. */}
        {modality && modality !== 'quick' && (modality !== 'platform' || draft.platform) && (
          !draft.client ? (
            mode === 'search' ? (
              <ClientSearch
                onClientFound={(client) => setClient(client)}
                onCreateNew={() => setMode('create')}
              />
            ) : (
              <ClientForm
                onClientCreated={(client) => { setClient(client); setMode('search') }}
                onCancel={() => setMode('search')}
              />
            )
          ) : (
            <>
              {/* Cliente ya seleccionado */}
              <div style={{
                background: 'var(--success-bg)',
                border: '1px solid var(--success)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                    {draft.client.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {draft.client.phone}
                  </div>
                </div>
                <button
                  onClick={() => { useOrderStore.getState().resetDraft() }}
                  style={{
                    fontSize: 11,
                    color: 'var(--text-3)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Cambiar
                </button>
              </div>
              <ClientHistory clientId={draft.client.id} />
            </>
          )
        )}

        {/* Aviso de venta rápida: no se registra cliente */}
        {modality === 'quick' && (
          <div style={{
            background: 'var(--info-bg)',
            border: '1px solid var(--info)',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 12,
            color: 'var(--info)',
          }}>
            Venta rápida: la orden no lleva cliente. Continúa directo a los productos.
          </div>
        )}

        {/* ── 4. Dirección (solo domicilio) ── */}
        {draft.client && modality === 'delivery' && (
          <AddressSelector
            client={draft.client}
            onAddressSelected={(addr) => setAddress(addr)}
            onNoZone={handleNoZone}
          />
        )}

        {/* ── 5. Continuar al paso de productos ── */}
        {canContinue && (
          <button
            onClick={() => setStep(2)}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--primary)',
              border: 'none',
              borderRadius: 9,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Continuar a productos →
          </button>
        )}
      </div>
    </div>
  )
}
