'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderStatus } from '@/types'
import { formatDistanceToNow, differenceInSeconds } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  order: Order
  onUpdated: () => void
}

const OVEN_TIMER_SECONDS = 5 * 60 // 5 minutos

export default function KitchenOrderCard({ order, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const supabase = createClient()

  const totalPizzas = order.items?.filter((i) =>
    ['pizza_40', 'pizza_specialty', 'pizza_premium'].includes(i.product?.category ?? '')
  ).reduce((acc, i) => acc + i.quantity, 0) ?? 0

  const isLate = order.status === 'preparing' && elapsed > OVEN_TIMER_SECONDS

  // Timer para pedidos en estado 'preparing'
  useEffect(() => {
    if (order.status !== 'preparing') return

    function tick() {
      const secs = differenceInSeconds(new Date(), new Date(order.confirmed_at))
      setElapsed(secs)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [order.confirmed_at, order.status])

  async function updateStatus(newStatus: OrderStatus) {
    setLoading(true)
    const updates: any = { status: newStatus }
    if (newStatus === 'in_oven') {
      updates.in_oven_at = new Date().toISOString()
    }
    await supabase
      .from('orders')
      .update(updates)
      .eq('id', order.id)
    onUpdated()
    setLoading(false)
  }

  async function incrementCompleted() {
    if (order.pizzas_completed >= totalPizzas) return
    setLoading(true)
    await supabase
      .from('orders')
      .update({ pizzas_completed: order.pizzas_completed + 1 })
      .eq('id', order.id)
    onUpdated()
    setLoading(false)
  }

  async function decrementCompleted() {
    if (order.pizzas_completed <= 0) return
    setLoading(true)
    await supabase
      .from('orders')
      .update({ pizzas_completed: order.pizzas_completed - 1 })
      .eq('id', order.id)
    onUpdated()
    setLoading(false)
  }

  function formatTimer(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')} min`
  }

  const timerPct = Math.min(100, (elapsed / OVEN_TIMER_SECONDS) * 100)

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isLate ? 'var(--danger)' : 'var(--border)'}`,
      borderRadius: 12,
      padding: 16,
      transition: 'border-color 0.3s',
    }}>

      {/* Alerta de retraso */}
      {isLate && (
        <div style={{
          background: 'var(--danger-bg)',
          border: '1px solid var(--danger)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>
            Retraso — no marcado en horno a tiempo
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-1)',
          }}>
            {order.client?.name ?? 'Cliente'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>
            {order.type === 'delivery'
              ? `Domicilio · Zona ${(order as any).address?.zone?.label ?? '?'}`
              : 'Recoger en local'}
          </div>
        </div>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: isLate ? 'var(--danger)' : 'var(--text-3)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 7,
          padding: '4px 9px',
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: 'nowrap',
        }}>
          {formatDistanceToNow(new Date(order.created_at), {
            addSuffix: true,
            locale: es,
          })}
        </span>
      </div>

      {/* Items */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '12px 0',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        marginBottom: 12,
      }}>
        {order.items?.map((item) => (
          <div key={item.id} style={{ display: 'flex', gap: 9 }}>
            <span style={{
              fontWeight: 700,
              color: 'var(--accent)',
              minWidth: 22,
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {item.quantity}×
            </span>
            <div>
              <span style={{ fontSize: 14, color: 'var(--text-1)' }}>
                {item.product?.name}
              </span>
              {item.extras && item.extras.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  + {item.extras.map((e: any) => e.ingredient?.name).join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Timer — solo en estado preparing */}
      {order.status === 'preparing' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Tiempo sin hornear
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: isLate ? 'var(--timer-warn)' : 'var(--timer-ok)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {formatTimer(elapsed)}
            </span>
          </div>
          <div style={{
            height: 4,
            background: 'var(--surface-2)',
            borderRadius: 2,
          }}>
            <div style={{
              height: 4,
              borderRadius: 2,
              background: isLate ? 'var(--danger)' : 'var(--warning)',
              width: `${timerPct}%`,
              transition: 'width 1s linear',
            }} />
          </div>
        </div>
      )}

      {/* Contador pizzas — en horno */}
      {order.status === 'in_oven' && totalPizzas > 1 && (
        <div style={{
          background: 'var(--info-bg)',
          border: '1px solid var(--info)',
          borderRadius: 8,
          padding: '8px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, color: 'var(--info)', fontWeight: 500 }}>
            Pizzas listas: {order.pizzas_completed}/{totalPizzas}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={decrementCompleted}
              disabled={loading || order.pizzas_completed <= 0}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--info-bg)',
                border: '1px solid var(--info)',
                color: 'var(--info)',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >
              −
            </button>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--info)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {order.pizzas_completed}
            </span>
            <button
              onClick={incrementCompleted}
              disabled={loading || order.pizzas_completed >= totalPizzas}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--info-bg)',
                border: '1px solid var(--info)',
                color: 'var(--info)',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Acciones */}
      {order.status === 'preparing' && (
        <button
          onClick={() => updateStatus('in_oven')}
          disabled={loading}
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
          Marcar en horno
        </button>
      )}

      {order.status === 'in_oven' && (
        <button
          onClick={() => updateStatus('ready')}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: 'var(--success-bg)',
            border: `1px solid var(--success)`,
            borderRadius: 9,
            color: 'var(--success)',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Marcar como listo
        </button>
      )}

      {order.status === 'ready' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={() => alert('Función de factura próximamente')}
            style={{
              padding: '11px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 9,
              color: 'var(--text-2)',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Generar factura
          </button>
          <button
            onClick={() => updateStatus('in_delivery')}
            disabled={loading}
            style={{
              padding: '11px',
              background: '#7C3AED',
              border: 'none',
              borderRadius: 9,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {order.type === 'delivery' ? 'Enviar a entrega' : 'Listo para recoger'}
          </button>
        </div>
      )}
    </div>
  )
}