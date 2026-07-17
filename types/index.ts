export type Role = 'owner' | 'seller' | 'kitchen' | 'delivery'

export type OrderStatus =
  | 'preparing'
  | 'in_oven'
  | 'ready'
  | 'in_delivery'
  | 'delivered'

// 'platform' = pedidos que entran por apps de delivery externas (PedidosYa, etc.)
export type OrderType = 'delivery' | 'pickup' | 'platform'

// 'mixed' = pago compuesto (una parte en efectivo y otra con tarjeta)
export type PaymentMethod = 'cash' | 'card' | 'mixed'

// Tipo de descuento de una oferta:
// 'percent' = porcentaje sobre el precio unitario del producto
// 'fixed'   = cantidad fija en Quetzales descontada por unidad
export type OfferDiscountType = 'percent' | 'fixed'

export type InventoryLogType =
  | 'physical_count'
  | 'restock'
  | 'consumption_estimated'

export type ZoneLabel = 'A' | 'B' | 'C'

export type ProductCategory =
  | 'pizza_40'
  | 'pizza_specialty'
  | 'pizza_premium'
  | 'combo_roman'
  | 'combo_brothers'
  | 'desserts_snacks'
  | 'wings_ribs'
  | 'drinks'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  created_at: string
}

export interface Client {
  id: string
  name: string
  phone: string
  nit: string | null
  email: string | null
  created_at: string
  phones?: ClientPhone[]
  addresses?: ClientAddress[]
}

export interface ClientPhone {
  id: string
  client_id: string
  phone: string
  is_primary: boolean
}

export interface ClientAddress {
  id: string
  client_id: string
  address: string
  sector: string
  zone_id: string | null
  is_default: boolean
  zone?: Zone
}

export interface Zone {
  id: string
  name: string
  label: ZoneLabel
  min_pizzas_40: number
  min_wings_ribs: number
  free_delivery_pizzas: number
  free_delivery_items: number
  delivery_fee: number
}

export interface ZoneSector {
  id: string
  zone_id: string
  sector_name: string
}

export interface Product {
  id: string
  name: string
  category: ProductCategory
  price: number
  available: boolean
  is_combo: boolean
  image_url: string | null
  created_at: string
}

export interface ComboItem {
  id: string
  combo_id: string
  product_id: string | null
  allowed_category: ProductCategory | null
  quantity: number
  slot_label: string | null
}

export interface Ingredient {
  id: string
  name: string
  unit: string
  optimal_weekly: number
  alert_low_pct: number
  alert_critical_pct: number
  active: boolean
  created_at: string
}

export interface Recipe {
  id: string
  product_id: string
  ingredient_id: string
  quantity_base: number
  is_extra_eligible: boolean
  ingredient?: Ingredient
}

export interface IngredientCost {
  id: string
  ingredient_id: string
  registered_by: string
  quantity_purchased: number
  total_cost: number
  cost_per_unit: number
  purchase_date: string
  notes: string | null
  created_at: string
  ingredient?: Ingredient
}

export interface InventoryLog {
  id: string
  ingredient_id: string
  registered_by: string
  quantity: number
  type: InventoryLogType
  notes: string | null
  log_date: string
  created_at: string
}

/**
 * Oferta creada por el owner. Se aplica SIEMPRE a nivel de item (producto),
 * nunca a la orden completa. Si un combo tiene la oferta, el descuento se
 * aplica sobre el precio unitario de ese combo (que es un solo item).
 */
export interface Offer {
  id: string
  name: string                       // Nombre visible de la oferta (ej. "2x1 Martes")
  product_id: string                 // Producto al que aplica el descuento
  discount_type: OfferDiscountType   // 'percent' | 'fixed'
  discount_value: number             // % (0-100) o monto fijo en Q por unidad
  enabled: boolean                   // Habilitada / deshabilitada por el owner
  created_by: string | null          // id del usuario owner que la creó
  created_at: string
  product?: Product                  // Relación embebida (join con products)
}

/**
 * Servicio de delivery externo (PedidosYa, UberEats, etc.).
 * El owner puede agregar y borrar servicios desde su dashboard.
 */
export interface DeliveryPlatform {
  id: string
  name: string        // Nombre del servicio (ej. "PedidosYa")
  active: boolean     // Permite ocultarlo sin borrarlo
  created_at: string
}

export interface Order {
  id: string
  // client_id ahora puede ser null: las órdenes de "venta rápida" no llevan cliente
  client_id: string | null
  seller_id: string
  address_id: string | null
  type: OrderType
  status: OrderStatus
  subtotal: number
  delivery_fee: number
  total: number
  payment_method: PaymentMethod
  // ── Pago compuesto ──
  // Cuando payment_method === 'mixed', estos campos indican cuánto se pagó
  // con cada método. Para 'cash' o 'card' puros pueden venir con el total
  // o quedar en null (compatibilidad con órdenes antiguas).
  payment_cash_amount: number | null
  payment_card_amount: number | null
  // ── Plataformas de delivery ──
  // Solo se llena cuando type === 'platform'
  platform_id: string | null
  platform?: DeliveryPlatform
  // ── Venta rápida ──
  is_quick_sale: boolean
  // NIT usado para facturar esta orden (se pregunta al finalizar, excepto plataformas)
  nit: string | null
  pizzas_completed: number
  order_number: number | null
  confirmed_at: string
  in_oven_at: string | null
  edit_deadline: string
  scheduled_for: string | null
  created_at: string
  client?: Client
  address?: ClientAddress
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number       // Precio ORIGINAL por unidad (sin descuento)
  extras_total: number
  // ── Oferta aplicada a ESTE item (descuento por unidad, no por orden) ──
  offer_id: string | null
  discount_amount: number  // Q descontados POR UNIDAD (0 si no hubo oferta)
  product?: Product
  extras?: OrderItemExtra[]
}

export interface OrderItemExtra {
  id: string
  order_item_id: string
  ingredient_id: string
  multiplier: number
  extra_price: number
  ingredient?: Ingredient
}

export interface CashSession {
  id: string
  opened_by: string
  closed_by: string | null
  estimated_total: number
  payment_summary: {
    cash: number
    card: number
    physical_cash?: number
    physical_card?: number
    diff_cash?: number
    diff_card?: number
    notes?: string
    orders_count?: number
  }
  opened_at: string
  closed_at: string | null
}

// Precios reales de extras según menú
export const EXTRA_PRICES: Record<string, number> = {
  'Queso Mozzarella':   10,
  'Pepperoni':          15,
  'Jamón':              15,
  'Bolitas de Carne':   15,
  'Salchicha Italiana': 15,
  'Tocino':             20,
  'Cebolla':             8,
  'Aceitunas Negras':    8,
  'Champiñones':        15,
  'Pimientos':          10,
  'Piña':               19,
  'Jalapeños':          10,
  'Jalapeños Mitad':     5,
  'Salsa Tomate':        5,
  'Salsa Alfredo':      10,
  'Salsa Cheddar':       5,
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  pizza_40:        'Pizzas de 1 Ingrediente',
  pizza_specialty: 'Pizzas Especialidad',
  pizza_premium:   'Pizzas Premium',
  combo_roman:     'Mr. Roman Combos',
  combo_brothers:  'Mr. Roman Brother Combos',
  desserts_snacks: 'Postres y Snacks',
  wings_ribs:      'Alitas y Costillas',
  drinks:          'Bebidas',
}

export const PIZZA_CATEGORIES: ProductCategory[] = [
  'pizza_40',
  'pizza_specialty',
  'pizza_premium',
]