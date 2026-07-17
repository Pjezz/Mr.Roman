import { create } from 'zustand'
import {
  Client, ClientAddress, Product, Ingredient, Offer,
  OrderType, PaymentMethod, DeliveryPlatform,
} from '@/types'

export interface OrderExtra {
  ingredient: Ingredient
  multiplier: number
  extra_price: number
}

export interface OrderItemDraft {
  product: Product
  quantity: number
  unit_price: number          // Precio ORIGINAL por unidad (sin descuento)
  extras: OrderExtra[]
  extras_total: number
  // ── Oferta aplicada a este item (por unidad, no por orden) ──
  offer: Offer | null         // Oferta habilitada que aplicó (si existe)
  discount_per_unit: number   // Q descontados por unidad (0 = sin oferta)
}

export interface OrderDraft {
  client: Client | null
  address: ClientAddress | null
  order_type: OrderType | null
  // Plataforma de delivery escogida (solo cuando order_type === 'platform')
  platform: DeliveryPlatform | null
  // Venta rápida: no se busca ni registra cliente
  is_quick_sale: boolean
  zone_id: string | null
  delivery_fee: number
  items: OrderItemDraft[]
  payment_method: PaymentMethod | null
  // Montos del pago compuesto (solo cuando payment_method === 'mixed')
  payment_cash_amount: number
  payment_card_amount: number
  scheduled_for: string | null
  subtotal: number
  total: number
}

interface OrderStore {
  draft: OrderDraft
  step: 1 | 2 | 3
  setStep: (step: 1 | 2 | 3) => void
  setClient: (client: Client) => void
  setAddress: (address: ClientAddress | null) => void
  setOrderType: (type: OrderType) => void
  setPlatform: (platform: DeliveryPlatform | null) => void
  setQuickSale: (isQuick: boolean) => void
  setDeliveryFee: (fee: number) => void
  addItem: (item: OrderItemDraft) => void
  removeItem: (index: number) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setMixedAmounts: (cash: number, card: number) => void
  setScheduledFor: (date: string | null) => void
  resetDraft: () => void
}

const emptyDraft: OrderDraft = {
  client: null,
  address: null,
  order_type: null,
  platform: null,
  is_quick_sale: false,
  zone_id: null,
  delivery_fee: 0,
  items: [],
  payment_method: null,
  payment_cash_amount: 0,
  payment_card_amount: 0,
  scheduled_for: null,
  subtotal: 0,
  total: 0,
}

/**
 * Calcula el subtotal de la orden respetando los descuentos por item:
 * (precio - descuento_por_unidad) * cantidad + extras.
 * El descuento SIEMPRE es a nivel de item individual, nunca de la orden.
 */
function calcSubtotal(items: OrderItemDraft[]): number {
  return items.reduce(
    (acc, i) =>
      acc + (i.unit_price - i.discount_per_unit) * i.quantity + i.extras_total,
    0
  )
}

export const useOrderStore = create<OrderStore>((set) => ({
  draft: emptyDraft,
  step: 1,

  setStep: (step) => set({ step }),

  setClient: (client) =>
    set((state) => ({ draft: { ...state.draft, client } })),

  setAddress: (address) =>
    set((state) => ({
      draft: {
        ...state.draft,
        address,
        zone_id: address?.zone_id ?? null,
      },
    })),

  setOrderType: (order_type) =>
    set((state) => ({
      draft: {
        ...state.draft,
        order_type,
        // pickup / platform no llevan dirección ni costo de envío interno
        address: order_type === 'delivery' ? state.draft.address : null,
        delivery_fee: order_type === 'delivery' ? state.draft.delivery_fee : 0,
        // Si se cambia de modalidad, la plataforma solo aplica en 'platform'
        platform: order_type === 'platform' ? state.draft.platform : null,
      },
    })),

  // Guarda qué app de delivery externa (PedidosYa, etc.) originó el pedido
  setPlatform: (platform) =>
    set((state) => ({ draft: { ...state.draft, platform } })),

  // Marca la orden como venta rápida (sin cliente)
  setQuickSale: (is_quick_sale) =>
    set((state) => ({
      draft: { ...state.draft, is_quick_sale, client: is_quick_sale ? null : state.draft.client },
    })),

  setDeliveryFee: (delivery_fee) =>
    set((state) => ({
      draft: {
        ...state.draft,
        delivery_fee,
        total: state.draft.subtotal + delivery_fee,
      },
    })),

  addItem: (item) =>
    set((state) => {
      const items = [...state.draft.items, item]
      const subtotal = calcSubtotal(items)
      return {
        draft: {
          ...state.draft,
          items,
          subtotal,
          total: subtotal + state.draft.delivery_fee,
        },
      }
    }),

  removeItem: (index) =>
    set((state) => {
      const items = state.draft.items.filter((_, i) => i !== index)
      const subtotal = calcSubtotal(items)
      return {
        draft: {
          ...state.draft,
          items,
          subtotal,
          total: subtotal + state.draft.delivery_fee,
        },
      }
    }),

  setPaymentMethod: (payment_method) =>
    set((state) => ({
      draft: {
        ...state.draft,
        payment_method,
        // Al salir de 'mixed' se limpian los montos parciales
        payment_cash_amount: payment_method === 'mixed' ? state.draft.payment_cash_amount : 0,
        payment_card_amount: payment_method === 'mixed' ? state.draft.payment_card_amount : 0,
      },
    })),

  // Registra cuánto pagará el cliente en efectivo y cuánto con tarjeta
  setMixedAmounts: (payment_cash_amount, payment_card_amount) =>
    set((state) => ({
      draft: { ...state.draft, payment_cash_amount, payment_card_amount },
    })),

  setScheduledFor: (scheduled_for) =>
    set((state) => ({ draft: { ...state.draft, scheduled_for } })),

  resetDraft: () => set({ draft: emptyDraft, step: 1 }),
}))
