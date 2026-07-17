'use client'

/**
 * ─────────────────────────────────────────────────────────────
 * AnalyticsCharts · EXCLUSIVO DEL ROL OWNER
 * ─────────────────────────────────────────────────────────────
 * Botón "Gráficas" en el dashboard del owner que despliega un
 * panel con 3 apartados personalizables:
 *
 *  1. VENTAS       → total vendido en el rango elegido, contrastado
 *                    contra las semanas / meses anteriores.
 *  2. PIZZAS       → qué pizza es más rentable (precio de venta vs
 *                    costo de producción según recetas + costos de
 *                    insumos), cuáles se vendieron más y cuáles menos.
 *  3. PROYECCIONES → qué insumos conviene comprar más según lo
 *                    consumido por las ventas del rango elegido
 *                    (ventas × receta de cada producto).
 *
 * Todos los apartados se pueden organizar por: fechas específicas
 * que el usuario escoja, semana actual o mes actual.
 *
 * Las gráficas están hechas con SVG puro (sin librerías nuevas)
 * para mantener el proyecto ligero y la misma estética (variables
 * CSS del tema: --primary, --success, --info, etc.).
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PIZZA_CATEGORIES } from '@/types'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subWeeks, subMonths, format,
} from 'date-fns'

// ── Tipos internos del panel ──
type Tab = 'sales' | 'pizzas' | 'projections'
type RangeMode = 'custom' | 'week' | 'month'

interface Bar { label: string; value: number; color?: string }

/**
 * Gráfica de barras horizontal en SVG puro.
 * Recibe pares label/value y los dibuja proporcionalmente,
 * usando las variables CSS del tema para respetar la estética.
 */
function BarChart({ bars, unit = '' }: { bars: Bar[]; unit?: string }) {
  if (bars.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Sin datos en este rango</div>
  }
  const max = Math.max(...bars.map((b) => b.value), 1)
  const rowH = 30                       // Altura de cada fila
  const height = bars.length * rowH

  return (
    <svg width="100%" height={height} style={{ display: 'block' }}>
      {bars.map((bar, i) => {
        const y = i * rowH
        const w = Math.max((bar.value / max) * 60, 0.5) // % del ancho destinado a la barra
        return (
          <g key={bar.label + i}>
            {/* Etiqueta del elemento (producto / periodo / insumo) */}
            <text x="0" y={y + 13} fontSize="11" fill="var(--text-2)" fontFamily="inherit">
              {bar.label.length > 24 ? bar.label.slice(0, 23) + '…' : bar.label}
            </text>
            {/* Pista de fondo */}
            <rect x="0" y={y + 18} width="60%" height="7" rx="3.5" fill="var(--surface-2)" />
            {/* Barra proporcional al valor */}
            <rect x="0" y={y + 18} width={`${w}%`} height="7" rx="3.5" fill={bar.color ?? 'var(--primary)'} />
            {/* Valor numérico al final de la barra */}
            <text x="62%" y={y + 26} fontSize="11" fill="var(--text-1)" fontFamily="'JetBrains Mono', monospace">
              {unit === 'Q' ? `Q${bar.value.toFixed(2)}` : `${bar.value.toFixed(unit === 'int' ? 0 : 2)}${unit === 'int' ? '' : ` ${unit}`}`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Tarjeta contenedora con la estética del resto del programa */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function AnalyticsCharts() {
  const [open, setOpen] = useState(false)          // Muestra/oculta el panel completo
  const [tab, setTab] = useState<Tab>('sales')     // Apartado activo
  const [rangeMode, setRangeMode] = useState<RangeMode>('week')
  // Fechas específicas elegidas por el usuario (modo 'custom')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(false)

  // ── Datos calculados para cada apartado ──
  const [salesBars, setSalesBars] = useState<Bar[]>([])            // Contraste de ventas por periodo
  const [topPizzas, setTopPizzas] = useState<Bar[]>([])            // Pizzas más vendidas
  const [bottomPizzas, setBottomPizzas] = useState<Bar[]>([])      // Pizzas menos vendidas
  const [profitPizzas, setProfitPizzas] = useState<Bar[]>([])      // Rentabilidad por pizza
  const [projectionBars, setProjectionBars] = useState<Bar[]>([])  // Insumos a comprar

  /**
   * Traduce el modo de rango a fechas concretas (from, to).
   * - custom: las fechas exactas que escogió el usuario
   * - week:   semana actual (lunes a domingo)
   * - month:  mes actual
   */
  const getRange = useCallback((): { from: Date; to: Date } | null => {
    const now = new Date()
    if (rangeMode === 'week') {
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }
    }
    if (rangeMode === 'month') {
      return { from: startOfMonth(now), to: endOfMonth(now) }
    }
    // Fechas específicas: ambas deben estar completas
    if (!customFrom || !customTo) return null
    const from = new Date(customFrom + 'T00:00:00')
    const to = new Date(customTo + 'T23:59:59')
    return { from, to }
  }, [rangeMode, customFrom, customTo])

  /** Trae órdenes entregadas con sus items en un rango dado */
  async function fetchOrders(from: Date, to: Date) {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('total, confirmed_at, items:order_items(quantity, unit_price, discount_amount, product_id, product:products(id, name, price, category))')
      .eq('status', 'delivered')
      .gte('confirmed_at', from.toISOString())
      .lte('confirmed_at', to.toISOString())
    return data ?? []
  }

  /** ── Apartado 1: VENTAS (contraste contra semanas/meses anteriores) ── */
  const loadSales = useCallback(async () => {
    const range = getRange()
    if (!range) return
    const now = new Date()
    const bars: Bar[] = []

    // Ventas del rango elegido por el usuario
    const current = await fetchOrders(range.from, range.to)
    const currentTotal = current.reduce((acc, o) => acc + o.total, 0)
    bars.push({ label: 'Rango elegido', value: currentTotal, color: 'var(--primary)' })

    // Contraste: 4 semanas anteriores y 3 meses anteriores.
    // Así el owner ve de inmediato si el rango elegido va mejor o peor
    // que el resto de la semana/mes histórico.
    for (let i = 1; i <= 4; i++) {
      const from = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const to = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const orders = await fetchOrders(from, to)
      bars.push({
        label: `Semana ${format(from, 'dd/MM')}`,
        value: orders.reduce((acc, o) => acc + o.total, 0),
        color: 'var(--info)',
      })
    }
    for (let i = 1; i <= 3; i++) {
      const from = startOfMonth(subMonths(now, i))
      const to = endOfMonth(subMonths(now, i))
      const orders = await fetchOrders(from, to)
      bars.push({
        label: `Mes ${format(from, 'MM/yyyy')}`,
        value: orders.reduce((acc, o) => acc + o.total, 0),
        color: 'var(--success)',
      })
    }
    setSalesBars(bars)
  }, [getRange])

  /** ── Apartado 2: PIZZAS (más/menos vendidas y rentabilidad) ── */
  const loadPizzas = useCallback(async () => {
    const range = getRange()
    if (!range) return
    const supabase = createClient()
    const orders = await fetchOrders(range.from, range.to)

    // Contamos unidades vendidas SOLO de categorías de pizza
    const count: Record<string, { name: string; qty: number }> = {}
    for (const order of orders) {
      for (const item of (order.items as any[])) {
        const product = item.product
        if (!product || !PIZZA_CATEGORIES.includes(product.category)) continue
        if (!count[product.id]) count[product.id] = { name: product.name, qty: 0 }
        count[product.id].qty += item.quantity
      }
    }
    const sorted = Object.values(count).sort((a, b) => b.qty - a.qty)
    // Pizzas más vendidas (top 8) y menos vendidas (bottom 8)
    setTopPizzas(sorted.slice(0, 8).map((p) => ({ label: p.name, value: p.qty, color: 'var(--success)' })))
    setBottomPizzas(sorted.slice(-8).reverse().map((p) => ({ label: p.name, value: p.qty, color: 'var(--danger)' })))

    // ── Rentabilidad: precio de venta − costo de producción ──
    // El costo de producción se calcula con la receta del producto
    // (recipes.quantity_base) por el último costo por unidad de cada
    // insumo (ingredient_costs.cost_per_unit).
    const { data: pizzas } = await supabase
      .from('products')
      .select('id, name, price, category, recipes:recipes(quantity_base, ingredient_id)')
      .in('category', PIZZA_CATEGORIES)

    const { data: costs } = await supabase
      .from('ingredient_costs')
      .select('ingredient_id, cost_per_unit, purchase_date')
      .order('purchase_date', { ascending: false })

    // Nos quedamos con el costo MÁS RECIENTE de cada insumo
    const latestCost: Record<string, number> = {}
    for (const c of costs ?? []) {
      if (latestCost[c.ingredient_id] === undefined) latestCost[c.ingredient_id] = c.cost_per_unit
    }

    const profit: Bar[] = (pizzas ?? [])
      .map((p: any) => {
        const cost = (p.recipes ?? []).reduce(
          (acc: number, r: any) => acc + r.quantity_base * (latestCost[r.ingredient_id] ?? 0), 0
        )
        // Margen por unidad = precio de venta − costo de insumos
        return { label: p.name, value: p.price - cost, color: 'var(--accent)' }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
    setProfitPizzas(profit)
  }, [getRange])

  /** ── Apartado 3: PROYECCIONES (insumos a comprar según ventas) ── */
  const loadProjections = useCallback(async () => {
    const range = getRange()
    if (!range) return
    const supabase = createClient()
    const orders = await fetchOrders(range.from, range.to)

    // Unidades vendidas por producto en el rango
    const soldByProduct: Record<string, number> = {}
    for (const order of orders) {
      for (const item of (order.items as any[])) {
        if (!item.product_id) continue
        soldByProduct[item.product_id] = (soldByProduct[item.product_id] ?? 0) + item.quantity
      }
    }

    // Recetas: cuánto insumo consume cada producto vendido
    const { data: recipes } = await supabase
      .from('recipes')
      .select('product_id, ingredient_id, quantity_base, ingredient:ingredients(name, unit)')

    // Consumo total de cada insumo = Σ (ventas del producto × cantidad en receta)
    const consumption: Record<string, { name: string; unit: string; qty: number }> = {}
    for (const r of (recipes ?? []) as any[]) {
      const sold = soldByProduct[r.product_id] ?? 0
      if (sold === 0 || !r.ingredient) continue
      const key = r.ingredient_id
      if (!consumption[key]) consumption[key] = { name: r.ingredient.name, unit: r.ingredient.unit, qty: 0 }
      consumption[key].qty += sold * r.quantity_base
    }

    // Los insumos más consumidos son los que más conviene comprar
    setProjectionBars(
      Object.values(consumption)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 12)
        .map((c) => ({ label: `${c.name}`, value: c.qty, color: 'var(--warning)' }))
    )
  }, [getRange])

  // Recargar datos cuando cambia el apartado, el modo o las fechas
  useEffect(() => {
    if (!open) return
    const range = getRange()
    if (!range) return          // En modo custom espera a que ambas fechas estén puestas
    setLoading(true)
    const loader = tab === 'sales' ? loadSales : tab === 'pizzas' ? loadPizzas : loadProjections
    loader().finally(() => setLoading(false))
  }, [open, tab, rangeMode, customFrom, customTo, getRange, loadSales, loadPizzas, loadProjections])

  // ── Estilos de botones tipo "píldora" (mismos del SalesDashboard) ──
  const pill = (active: boolean) => ({
    padding: '6px 16px',
    borderRadius: 20,
    border: '1px solid',
    borderColor: active ? 'var(--primary)' : 'var(--border)',
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-2)',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  } as const)

  const dateInput = {
    padding: '7px 10px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-1)',
    fontFamily: 'inherit',
    fontSize: 12,
    outline: 'none',
  } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Botón que muestra/oculta las opciones de gráficas */}
      <div>
        <button
          onClick={() => setOpen(!open)}
          style={{
            padding: '9px 18px',
            background: open ? 'var(--surface-2)' : 'var(--primary)',
            border: open ? '1px solid var(--border)' : 'none',
            borderRadius: 8,
            color: open ? 'var(--text-2)' : '#fff',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {open ? 'Ocultar gráficas' : 'Gráficas'}
        </button>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Selector de apartado: Ventas / Pizzas / Proyecciones */}
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { key: 'sales' as Tab,       label: 'Ventas' },
              { key: 'pizzas' as Tab,      label: 'Pizzas' },
              { key: 'projections' as Tab, label: 'Proyecciones' },
            ]).map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={pill(tab === t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Selector de rango: fechas específicas / semana / mes */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {([
              { key: 'custom' as RangeMode, label: 'Fechas específicas' },
              { key: 'week' as RangeMode,   label: 'Semana' },
              { key: 'month' as RangeMode,  label: 'Mes' },
            ]).map((r) => (
              <button key={r.key} onClick={() => setRangeMode(r.key)} style={pill(rangeMode === r.key)}>
                {r.label}
              </button>
            ))}
            {/* Inputs de fecha solo en modo específico */}
            {rangeMode === 'custom' && (
              <>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={dateInput} />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>a</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={dateInput} />
              </>
            )}
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Calculando…</div>
          ) : (
            <>
              {/* ── Apartado VENTAS ── */}
              {tab === 'sales' && (
                <Card title="Total vendido · rango elegido vs semanas y meses anteriores">
                  <BarChart bars={salesBars} unit="Q" />
                </Card>
              )}

              {/* ── Apartado PIZZAS ── */}
              {tab === 'pizzas' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Card title="Pizzas más rentables (venta − costo de producción, Q por unidad)">
                    <BarChart bars={profitPizzas} unit="Q" />
                  </Card>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Card title="Pizzas más vendidas (unidades)">
                      <BarChart bars={topPizzas} unit="int" />
                    </Card>
                    <Card title="Pizzas menos vendidas (unidades)">
                      <BarChart bars={bottomPizzas} unit="int" />
                    </Card>
                  </div>
                </div>
              )}

              {/* ── Apartado PROYECCIONES ── */}
              {tab === 'projections' && (
                <Card title="Insumos consumidos por las ventas del rango (los primeros son los que más conviene comprar)">
                  <BarChart bars={projectionBars} unit="" />
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
