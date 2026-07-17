/**
 * ─────────────────────────────────────────────────────────────
 * Helpers de PAGOS (efectivo / tarjeta / pago compuesto)
 * ─────────────────────────────────────────────────────────────
 * Con la llegada del pago compuesto ('mixed') ya no basta con
 * mirar `payment_method` para saber cuánto entró en efectivo y
 * cuánto en tarjeta. Estos helpers centralizan esa lógica para
 * que la caja (CashRegister) y el dashboard de ventas sigan
 * cuadrando correctamente, manteniendo compatibilidad con las
 * órdenes antiguas que no tienen los montos desglosados.
 */

/** Forma mínima de una orden para calcular su desglose de pago */
export interface PayableOrder {
  total: number
  payment_method: 'cash' | 'card' | 'mixed'
  payment_cash_amount?: number | null
  payment_card_amount?: number | null
}

/** Porción de la orden que se pagó en EFECTIVO */
export function cashPortion(order: PayableOrder): number {
  // Si la orden tiene el monto desglosado (órdenes nuevas), lo usamos.
  if (order.payment_cash_amount != null) return order.payment_cash_amount
  // Compatibilidad: órdenes antiguas solo tienen payment_method
  return order.payment_method === 'cash' ? order.total : 0
}

/** Porción de la orden que se pagó con TARJETA */
export function cardPortion(order: PayableOrder): number {
  if (order.payment_card_amount != null) return order.payment_card_amount
  return order.payment_method === 'card' ? order.total : 0
}

/** Etiqueta legible del método de pago para mostrar en la UI */
export function paymentLabel(method: 'cash' | 'card' | 'mixed'): string {
  if (method === 'cash') return 'Efectivo'
  if (method === 'card') return 'Tarjeta'
  return 'Compuesto'
}
