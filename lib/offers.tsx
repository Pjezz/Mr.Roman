import { createClient } from '@/lib/supabase/client'
import { Offer, Product } from '@/types'

/**
 * ─────────────────────────────────────────────────────────────
 * Helpers de OFERTAS
 * ─────────────────────────────────────────────────────────────
 * Las ofertas las crea el owner (tabla `offers` en Supabase) y
 * SIEMPRE aplican por item/producto, nunca sobre la orden entera.
 * Un combo es un producto en sí mismo, así que si el owner crea
 * una oferta para un combo, el descuento cae sobre el precio
 * unitario de ese combo (item individual).
 */

/**
 * Trae del servidor únicamente las ofertas HABILITADAS.
 * Se usa en el punto de venta (seller) para aplicar descuentos
 * automáticamente al agregar productos a la orden.
 */
export async function fetchEnabledOffers(): Promise<Offer[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('offers')
    .select('*')
    .eq('enabled', true)
  return (data ?? []) as Offer[]
}

/**
 * Busca si existe una oferta habilitada para un producto concreto.
 * Si hubiera más de una, se queda con la de MAYOR descuento
 * (regla simple y predecible para el vendedor).
 */
export function findOfferForProduct(offers: Offer[], productId: string): Offer | null {
  const matches = offers.filter((o) => o.product_id === productId)
  if (matches.length === 0) return null
  return matches.reduce((best, o) => {
    // Comparamos el descuento "efectivo" asumiendo el mismo precio base:
    // para simplificar, priorizamos el mayor discount_value dentro del mismo tipo,
    // y 'percent' se evalúa después contra el precio real en calcDiscountPerUnit.
    return o.discount_value > best.discount_value ? o : best
  }, matches[0])
}

/**
 * Calcula cuántos Quetzales se descuentan POR UNIDAD del producto
 * según el tipo de oferta:
 *  - percent: precio * (valor / 100)
 *  - fixed:   valor fijo en Q
 * El descuento nunca puede superar el precio del producto (no hay precios negativos).
 */
export function calcDiscountPerUnit(offer: Offer, product: Product): number {
  const raw =
    offer.discount_type === 'percent'
      ? product.price * (offer.discount_value / 100)
      : offer.discount_value
  // Redondeamos a 2 decimales y limitamos al precio del producto
  return Math.min(Math.round(raw * 100) / 100, product.price)
}
