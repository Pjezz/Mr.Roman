'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
} from 'date-fns'

type Period = 'day' | 'week' | 'month'

interface Stats {
  total_orders: number
  total_revenue: number
  cash_total: number
  card_total: number
  avg_ticket: number
  top_products: { name: string; count: number }[]
}

export default function SalesDashboard() {
  const [period, setPeriod] = useState<Period>('day')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [period])

  async function fetchStats() {
    setLoading(true)
    const supabase = createClient()
    const now = new Date()

    let from: Date, to: Date
    if (period === 'day') {
      from = startOfDay(now); to = endOfDay(now)
    } else if (period === 'week') {
      from = startOfWeek(now, { weekStartsOn: 1 })
      to = endOfWeek(now, { weekStartsOn: 1 })
    } else {
      from = startOfMonth(now); to = endOfMonth(now)
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('total, payment_method, items:order_items(quantity, product:products(name))')
      .eq('status', 'delivered')
      .gte('confirmed_at', from.toISOString())
      .lte('confirmed_at', to.toISOString())

    if (!orders) { setLoading(false); return }

    const total_revenue = orders.reduce((acc, o) => acc + o.total, 0)
    const cash_total = orders.filter((o) => o.payment_method === 'cash').reduce((acc, o) => acc + o.total, 0)
    const card_total = orders.filter((o) => o.payment_method === 'card').reduce((acc, o) => acc + o.total, 0)
    const avg_ticket = orders.length > 0 ? total_revenue / orders.length : 0

    const productCount: Record<string, number> = {}
    for (const order of orders) {
      for (const item of (order.items as any[])) {
        const name = item.product?.name ?? 'Desconocido'
        productCount[name] = (productCount[name] ?? 0) + item.quantity
      }
    }

    const top_products = Object.entries(productCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    setStats({ total_orders: orders.length, total_revenue, cash_total, card_total, avg_ticket, top_products })
    setLoading(false)
  }

  const PERIODS = [
    { key: 'day' as Period, label: 'Hoy' },
    { key: 'week' as Period, label: 'Semana' },
    { key: 'month' as Period, label: 'Mes' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6 }}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: '1px solid',
              borderColor: period === p.key ? 'var(--primary)' : 'var(--border)',
              background: period === p.key ? 'var(--primary)' : 'transparent',
              color: period === p.key ? '#fff' : 'var(--text-2)',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Cargando...</div>
      ) : !stats ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Sin datos</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total vendido', value: `Q${stats.total_revenue.toFixed(2)}`, color: 'var(--primary)' },
              { label: 'Pedidos', value: stats.total_orders.toString(), color: 'var(--text-1)' },
              { label: 'Efectivo', value: `Q${stats.cash_total.toFixed(2)}`, color: 'var(--success)' },
              { label: 'Tarjeta', value: `Q${stats.card_total.toFixed(2)}`, color: 'var(--info)' },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 16,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
                  {stat.label}
                </div>
                <div style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: stat.color,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Top productos */}
          {stats.top_products.length > 0 && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 14 }}>
                Más vendidos
              </div>
              {stats.top_products.map((p, i) => (
                <div key={p.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', width: 16 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.count} uds</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2 }}>
                      <div style={{
                        height: 4,
                        background: 'var(--primary)',
                        borderRadius: 2,
                        width: `${(p.count / stats.top_products[0].count) * 100}%`,
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}