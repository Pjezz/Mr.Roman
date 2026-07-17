'use client'

/**
 * ─────────────────────────────────────────────────────────────
 * WizardStep3 · Confirmación de la orden (rol SELLER)
 * ─────────────────────────────────────────────────────────────
 * Cambios respecto a la versión original:
 *
 *  · PAGO COMPUESTO: además de Efectivo y Tarjeta hay un botón
 *    "Pago compuesto" que permite dividir el total entre ambos
 *    métodos. Los montos deben sumar exactamente el total y se
 *    guardan desglosados (payment_cash_amount / payment_card_amount)
 *    para que la caja y la facturación sigan cuadrando.
 *
 *  · PREGUNTA DE NIT: al presionar "Confirmar pedido" aparece una
 *    ventana que pregunta si el cliente desea NIT (sí/no) en TODAS
 *    las modalidades EXCEPTO Plataformas. Si se agrega un NIT y la
 *    orden tiene cliente registrado, el NIT se guarda en su perfil
 *    para recordarlo en próximas órdenes (el NIT es único entre
 *    clientes; se valida antes de guardar).
 *
 *  · VENTA RÁPIDA: la orden se inserta sin cliente (client_id null).
 *
 *  · OFERTAS: cada item guarda su offer_id y discount_amount (el
 *    descuento es POR UNIDAD del item, nunca sobre la orden entera).
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrderStore } from '@/lib/store/orderStore'
import { PaymentMethod } from '@/types'

interface Props {
  sellerId: string
  onOrderCreated: (orderId: string) => void
}

export default function WizardStep3({ sellerId, onOrderCreated }: Props) {
  const {
    draft, setPaymentMethod, setMixedAmounts, setScheduledFor, setStep,
  } = useOrderStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)

  // ── Estado del pago compuesto (inputs como texto para edición cómoda) ──
  const [mixedCash, setMixedCash] = useState('')
  const [mixedCard, setMixedCard] = useState('')

  // ── Estado de la ventana de NIT ──
  // 'closed'  = no se ha abierto
  // 'ask'     = pregunta sí/no
  // 'input'   = el usuario dijo sí y está escribiendo el NIT
  const [nitStep, setNitStep] = useState<'closed' | 'ask' | 'input'>('closed')
  const [nitValue, setNitValue] = useState('')
  const [nitError, setNitError] = useState('')

  // Las órdenes de Plataformas NO preguntan NIT (la app externa factura)
  const asksNit = draft.order_type !== 'platform'

  /** Validación del pago compuesto: ambos montos deben sumar el total */
  function mixedIsValid(): boolean {
    if (draft.payment_method !== 'mixed') return true
    const cash = parseFloat(mixedCash) || 0
    const card = parseFloat(mixedCard) || 0
    // Toleramos 1 centavo de diferencia por redondeos
    return cash >= 0 && card >= 0 && Math.abs(cash + card - draft.total) < 0.01
  }

  /**
   * Primer clic en "Confirmar pedido":
   * valida el pago y, si corresponde, abre la pregunta de NIT.
   * Si la modalidad no pregunta NIT (Plataformas) confirma directo.
   */
  function handleConfirmClick() {
    if (!draft.payment_method) {
      setError('Selecciona un método de pago')
      return
    }
    if (!mixedIsValid()) {
      setError(`Los montos del pago compuesto deben sumar Q${draft.total.toFixed(2)}`)
      return
    }
    setError('')
    if (asksNit) {
      // Pre-cargamos el NIT del cliente si ya lo tiene guardado
      setNitValue(draft.client?.nit ?? '')
      setNitStep('ask')
    } else {
      submitOrder(null)
    }
  }

  /**
   * Inserta la orden y sus items en Supabase.
   * @param nit NIT a facturar (null = el cliente no quiso NIT)
   */
  async function submitOrder(nit: string | null) {
    setLoading(true)
    setError('')
    setNitError('')
    const supabase = createClient()

    // ── Desglose del pago para caja/facturación ──
    // Para métodos puros, el desglose es el total en su columna.
    const cashAmount =
      draft.payment_method === 'cash' ? draft.total :
      draft.payment_method === 'mixed' ? (parseFloat(mixedCash) || 0) : 0
    const cardAmount =
      draft.payment_method === 'card' ? draft.total :
      draft.payment_method === 'mixed' ? (parseFloat(mixedCard) || 0) : 0

    // ── Si hay NIT y hay cliente registrado, se guarda en su perfil ──
    // El NIT es único: verificamos que ningún OTRO cliente lo tenga.
    if (nit && draft.client) {
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('nit', nit)
        .neq('id', draft.client.id)
        .maybeSingle()

      if (existing) {
        setNitError('Ese NIT ya está registrado en otro cliente')
        setLoading(false)
        return
      }
      // Actualizamos el perfil del cliente para recordar el NIT
      await supabase.from('clients').update({ nit }).eq('id', draft.client.id)
    }

    // ── Inserción de la orden ──
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        // Venta rápida: sin cliente (client_id null)
        client_id: draft.is_quick_sale ? null : draft.client!.id,
        seller_id: sellerId,
        address_id: draft.address?.id ?? null,
        type: draft.order_type!,
        status: 'preparing',
        subtotal: draft.subtotal,
        delivery_fee: draft.delivery_fee,
        total: draft.total,
        payment_method: draft.payment_method,
        // Desglose de pago (soporta pago compuesto)
        payment_cash_amount: cashAmount,
        payment_card_amount: cardAmount,
        // App de delivery externa (solo modalidad Plataformas)
        platform_id: draft.platform?.id ?? null,
        is_quick_sale: draft.is_quick_sale,
        // NIT usado para facturar esta orden en particular
        nit: nit,
        scheduled_for: draft.scheduled_for ?? null,
      })
      .select()
      .single()

    if (orderError || !order) {
      setError('Error al crear la orden')
      setLoading(false)
      return
    }

    // ── Inserción de items (con su oferta/descuento POR UNIDAD) ──
    for (const item of draft.items) {
      const { data: orderItem } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unit_price,            // precio original
          extras_total: item.extras_total,
          offer_id: item.offer?.id ?? null,       // oferta aplicada al item
          discount_amount: item.discount_per_unit, // Q descontados por unidad
        })
        .select()
        .single()

      if (!orderItem) continue

      for (const extra of item.extras) {
        await supabase.from('order_item_extras').insert({
          order_item_id: orderItem.id,
          ingredient_id: extra.ingredient.id,
          multiplier: extra.multiplier,
          extra_price: extra.extra_price,
        })
      }
    }

    onOrderCreated(order.id)
    setLoading(false)
  }

  const rowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--text-2)',
  } as const

  const inputStyle = {
    padding: '10px 12px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-1)',
    fontFamily: 'inherit',
    fontSize: 13,
    outline: 'none',
  } as const

  // Botón de método de pago (misma estética que la versión original)
  const payBtn = (active: boolean) => ({
    padding: '11px',
    borderRadius: 8,
    border: '1px solid',
    borderColor: active ? 'var(--success)' : 'var(--border)',
    background: active ? 'var(--success-bg)' : 'transparent',
    color: active ? 'var(--success)' : 'var(--text-2)',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  } as const)

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: 24,
      maxWidth: 520,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Resumen del pedido ── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
            Resumen del pedido
          </div>

          <div style={rowStyle}>
            <span>Cliente</span>
            <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>
              {/* Venta rápida no lleva cliente */}
              {draft.is_quick_sale ? 'Venta rápida' : draft.client?.name}
            </span>
          </div>

          <div style={rowStyle}>
            <span>Entrega</span>
            <span style={{ color: 'var(--text-1)' }}>
              {draft.order_type === 'delivery'
                ? `Domicilio — Zona ${(draft.address as any)?.zone?.label ?? '?'}`
                : draft.order_type === 'platform'
                  ? `Plataforma — ${draft.platform?.name ?? '?'}`
                  : draft.is_quick_sale
                    ? 'Venta rápida (local)'
                    : 'Recoger en local'}
            </span>
          </div>

          {draft.address && (
            <div style={rowStyle}>
              <span>Dirección</span>
              <span style={{ color: 'var(--text-1)', textAlign: 'right', maxWidth: '60%' }}>
                {draft.address.address}
              </span>
            </div>
          )}

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          {draft.items.map((item, i) => (
            <div key={i} style={rowStyle}>
              <span style={{ color: 'var(--text-1)' }}>
                {item.quantity}× {item.product.name}
                {item.extras.length > 0 && (
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                    {' '}(+{item.extras.map((e) => e.ingredient.name).join(', ')})
                  </span>
                )}
                {/* Oferta aplicada a este item individual */}
                {item.discount_per_unit > 0 && (
                  <span style={{ color: 'var(--success)', fontSize: 11 }}>
                    {' '}· {item.offer?.name}
                  </span>
                )}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {/* Precio ya con el descuento por unidad aplicado */}
                Q{((item.unit_price - item.discount_per_unit) * item.quantity + item.extras_total).toFixed(2)}
              </span>
            </div>
          ))}

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <div style={rowStyle}>
            <span>Subtotal</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Q{draft.subtotal.toFixed(2)}
            </span>
          </div>

          {draft.order_type === 'delivery' && (
            <div style={rowStyle}>
              <span>Envío</span>
              <span style={{
                color: draft.delivery_fee === 0 ? 'var(--success)' : 'var(--text-2)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {draft.delivery_fee === 0 ? 'Gratis' : `Q${draft.delivery_fee.toFixed(2)}`}
              </span>
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 17,
            fontWeight: 700,
            marginTop: 4,
          }}>
            <span style={{ color: 'var(--text-1)' }}>Total</span>
            <span style={{
              color: 'var(--accent)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Q{draft.total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* ── Pedido agendado (sin cambios) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text-2)',
          }}>
            <input
              type="checkbox"
              checked={isScheduled}
              onChange={(e) => {
                setIsScheduled(e.target.checked)
                if (!e.target.checked) setScheduledFor(null)
              }}
            />
            Agendar pedido
          </label>
          {isScheduled && (
            <input
              type="datetime-local"
              onChange={(e) => setScheduledFor(e.target.value || null)}
              style={inputStyle}
            />
          )}
        </div>

        {/* ── Método de pago: Efectivo / Tarjeta / Pago compuesto ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
            Método de pago
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {([
              { key: 'cash' as PaymentMethod,  label: 'Efectivo' },
              { key: 'card' as PaymentMethod,  label: 'Tarjeta' },
              { key: 'mixed' as PaymentMethod, label: 'Pago compuesto' },
            ]).map((method) => (
              <button
                key={method.key}
                onClick={() => setPaymentMethod(method.key)}
                style={payBtn(draft.payment_method === method.key)}
              >
                {method.label}
              </button>
            ))}
          </div>

          {/* Montos del pago compuesto: deben sumar el total exacto */}
          {draft.payment_method === 'mixed' && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Divide el total (Q{draft.total.toFixed(2)}) entre efectivo y tarjeta
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Efectivo (Q)</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={mixedCash}
                    onChange={(e) => {
                      setMixedCash(e.target.value)
                      const cash = parseFloat(e.target.value) || 0
                      // Autocompletamos la tarjeta con el restante para agilizar
                      const rest = Math.max(0, Math.round((draft.total - cash) * 100) / 100)
                      setMixedCard(rest.toFixed(2))
                      setMixedAmounts(cash, rest)
                    }}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Tarjeta (Q)</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={mixedCard}
                    onChange={(e) => {
                      setMixedCard(e.target.value)
                      setMixedAmounts(parseFloat(mixedCash) || 0, parseFloat(e.target.value) || 0)
                    }}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
              </div>
              {/* Indicador visual de si la suma cuadra con el total */}
              <div style={{
                fontSize: 12,
                color: mixedIsValid() ? 'var(--success)' : 'var(--danger)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                Suma: Q{((parseFloat(mixedCash) || 0) + (parseFloat(mixedCard) || 0)).toFixed(2)}
                {mixedIsValid() ? ' ✓' : ` (debe ser Q${draft.total.toFixed(2)})`}
              </div>
            </div>
          )}
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

        {/* ── Botones de navegación ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setStep(2)}
            style={{
              flex: 1,
              padding: '11px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-2)',
              fontFamily: 'inherit',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ← Atrás
          </button>
          <button
            onClick={handleConfirmClick}
            disabled={loading || !draft.payment_method}
            style={{
              flex: 2,
              padding: '11px',
              background: loading || !draft.payment_method ? 'var(--border)' : 'var(--primary)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || !draft.payment_method ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Confirmando...' : `Confirmar pedido · Q${draft.total.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* ── Ventana de NIT (todas las modalidades excepto Plataformas) ── */}
      {nitStep !== 'closed' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 20,
        }}>
          <div style={{
            width: '100%',
            maxWidth: 380,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            {nitStep === 'ask' ? (
              <>
                {/* Pregunta sí/no */}
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                  ¿Desea agregar NIT?
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Si el cliente da su NIT, quedará guardado en su perfil
                  para próximas órdenes.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {/* NO → se confirma la orden sin NIT */}
                  <button
                    onClick={() => { setNitStep('closed'); submitOrder(null) }}
                    disabled={loading}
                    style={{
                      padding: '11px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-2)',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                  {/* SÍ → pasa al input de NIT */}
                  <button
                    onClick={() => setNitStep('input')}
                    style={{
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
                    Sí
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Captura del NIT */}
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                  NIT del cliente
                </div>
                {draft.client?.nit && (
                  <div style={{ fontSize: 12, color: 'var(--success)' }}>
                    Este cliente ya tiene un NIT guardado; puedes usarlo o corregirlo.
                  </div>
                )}
                <input
                  autoFocus
                  placeholder="Ej. 12345678-9"
                  value={nitValue}
                  onChange={(e) => { setNitValue(e.target.value); setNitError('') }}
                  style={inputStyle}
                />
                {nitError && (
                  <div style={{ fontSize: 12, color: 'var(--danger)' }}>{nitError}</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => setNitStep('ask')}
                    style={{
                      padding: '11px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-2)',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    ← Atrás
                  </button>
                  <button
                    onClick={() => {
                      const clean = nitValue.trim()
                      if (!clean) { setNitError('Escribe el NIT o presiona Atrás'); return }
                      setNitStep('closed')
                      submitOrder(clean)
                    }}
                    disabled={loading}
                    style={{
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
                    Confirmar con NIT
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
