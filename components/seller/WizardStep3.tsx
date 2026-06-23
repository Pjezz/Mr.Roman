'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrderStore } from '@/lib/store/orderStore'
import { PaymentMethod } from '@/types'

interface Props {
  sellerId: string
  onOrderCreated: (orderId: string) => void
}

export default function WizardStep3({ sellerId, onOrderCreated }: Props) {
  const { draft, setPaymentMethod, setScheduledFor, setStep } = useOrderStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)

  async function handleConfirm() {
    if (!draft.payment_method) {
      setError('Selecciona un método de pago')
      return
    }

    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        client_id: draft.client!.id,
        seller_id: sellerId,
        address_id: draft.address?.id ?? null,
        type: draft.order_type!,
        status: 'preparing',
        subtotal: draft.subtotal,
        delivery_fee: draft.delivery_fee,
        total: draft.total,
        payment_method: draft.payment_method,
        scheduled_for: draft.scheduled_for ?? null,
      })
      .select()
      .single()

    if (orderError || !order) {
      setError('Error al crear la orden')
      setLoading(false)
      return
    }

    for (const item of draft.items) {
      const { data: orderItem } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          extras_total: item.extras_total,
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

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: 24,
      maxWidth: 520,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Resumen */}
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
            <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{draft.client?.name}</span>
          </div>

          <div style={rowStyle}>
            <span>Entrega</span>
            <span style={{ color: 'var(--text-1)' }}>
              {draft.order_type === 'delivery'
                ? `Domicilio — Zona ${(draft.address as any)?.zone?.label ?? '?'}`
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
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Q{(item.unit_price * item.quantity + item.extras_total).toFixed(2)}
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

        {/* Pedido agendado */}
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
              style={{
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
          )}
        </div>

        {/* Método de pago */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
            Método de pago
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['cash', 'card'] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                style={{
                  padding: '11px',
                  borderRadius: 8,
                  border: '1px solid',
                  borderColor: draft.payment_method === method ? 'var(--success)' : 'var(--border)',
                  background: draft.payment_method === method ? 'var(--success-bg)' : 'transparent',
                  color: draft.payment_method === method ? 'var(--success)' : 'var(--text-2)',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {method === 'cash' ? 'Efectivo' : 'Tarjeta'}
              </button>
            ))}
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

        {/* Botones */}
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
            onClick={handleConfirm}
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
    </div>
  )
}