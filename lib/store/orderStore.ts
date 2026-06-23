import { create } from 'zustand'
import { Client, ClientAddress, Product, Ingredient, OrderType, PaymentMethod } from '@/types'

export interface OrderExtra {
  ingredient: Ingredient
  multiplier: number
  extra_price: number
}

export interface OrderItemDraft {
  product: Product
  quantity: number
  unit_price: number
  extras: OrderExtra[]
  extras_total: number
}

export interface OrderDraft {
  client: Client | null
  address: ClientAddress | null
  order_type: OrderType | null
  zone_id: string | null
  delivery_fee: number
  items: OrderItemDraft[]
  payment_method: PaymentMethod | null
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
  setDeliveryFee: (fee: number) => void
  addItem: (item: OrderItemDraft) => void
  removeItem: (index: number) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setScheduledFor: (date: string | null) => void
  resetDraft: () => void
}

const emptyDraft: OrderDraft = {
  client: null,
  address: null,
  order_type: null,
  zone_id: null,
  delivery_fee: 0,
  items: [],
  payment_method: null,
  scheduled_for: null,
  subtotal: 0,
  total: 0,
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
        address: order_type === 'pickup' ? null : state.draft.address,
        delivery_fee: order_type === 'pickup' ? 0 : state.draft.delivery_fee,
      },
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
      const subtotal = items.reduce(
        (acc, i) => acc + i.unit_price * i.quantity + i.extras_total, 0
      )
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
      const subtotal = items.reduce(
        (acc, i) => acc + i.unit_price * i.quantity + i.extras_total, 0
      )
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
    set((state) => ({ draft: { ...state.draft, payment_method } })),

  setScheduledFor: (scheduled_for) =>
    set((state) => ({ draft: { ...state.draft, scheduled_for } })),

  resetDraft: () => set({ draft: emptyDraft, step: 1 }),
}))