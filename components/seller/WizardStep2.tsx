'use client'

import { useState } from 'react'
import { Product } from '@/types'
import { useOrderStore, OrderItemDraft, OrderExtra } from '@/lib/store/orderStore'
import { calculateDeliveryFee, meetsZoneMinimum } from '@/lib/utils/delivery'
import ProductSelector from './ProductSelector'
import ExtrasSelector from './ExtrasSelector'

export default function WizardStep2() {
  const { draft, addItem, removeItem, setDeliveryFee, setStep } = useOrderStore()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [currentExtras, setCurrentExtras] = useState<OrderExtra[]>([])
  const [quantity, setQuantity] = useState(1)

  function handleProductSelected(product: Product) {
    setSelectedProduct(product)
    setCurrentExtras([])
    setQuantity(1)
  }

  function handleAddItem() {
    if (!selectedProduct) return

    const extrasTotal = currentExtras.reduce((acc, e) => acc + e.extra_price, 0) * quantity

    const item: OrderItemDraft = {
      product: selectedProduct,
      quantity,
      unit_price: selectedProduct.price,
      extras: currentExtras,
      extras_total: extrasTotal,
    }

    addItem(item)

    const updatedItems = [...draft.items, item]
    if (draft.order_type === 'delivery' && draft.address?.zone) {
      const fee = calculateDeliveryFee(updatedItems, (draft.address as any).zone.delivery_fee)
      setDeliveryFee(fee)
    }

    setSelectedProduct(null)
    setCurrentExtras([])
    setQuantity(1)
  }

  function handleRemoveItem(index: number) {
    const updatedItems = draft.items.filter((_, i) => i !== index)
    if (draft.order_type === 'delivery' && draft.address?.zone) {
      const fee = calculateDeliveryFee(updatedItems, (draft.address as any).zone.delivery_fee)
      setDeliveryFee(fee)
    }
    removeItem(index)
  }

  function handleContinue() {
    if (draft.order_type === 'delivery' && draft.address?.zone) {
      const { meets, reason } = meetsZoneMinimum(draft.items, (draft.address as any).zone.label)
      if (!meets) { alert(reason); return }
    }
    setStep(3)
  }

  const isPizza = (category: string) =>
    ['pizza_40', 'pizza_specialty', 'pizza_premium'].includes(category)

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* Catálogo */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {!selectedProduct ? (
          <ProductSelector
            onProductSelected={handleProductSelected}
            excludeCategories={['drinks']}
          />
        ) : (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--primary)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
                  {selectedProduct.name}
                </div>
                <div style={{
                  fontSize: 13,
                  color: 'var(--accent)',
                  fontFamily: "'JetBrains Mono', monospace",
                  marginTop: 2,
                }}>
                  Q{selectedProduct.price.toFixed(2)}
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  fontSize: 12,
                  color: 'var(--text-3)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cambiar
              </button>
            </div>

            {/* Cantidad */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Cantidad</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid var(--border)',
                borderRadius: 7,
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{
                    width: 30,
                    height: 30,
                    border: 'none',
                    background: 'var(--surface-2)',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    fontSize: 16,
                    fontFamily: 'inherit',
                  }}
                >
                  −
                </button>
                <span style={{
                  minWidth: 28,
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-1)',
                }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  style={{
                    width: 30,
                    height: 30,
                    border: 'none',
                    background: 'var(--surface-2)',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    fontSize: 16,
                    fontFamily: 'inherit',
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Extras */}
            {isPizza(selectedProduct.category) && (
              <ExtrasSelector
                productId={selectedProduct.id}
                currentExtras={currentExtras}
                onExtrasChange={setCurrentExtras}
              />
            )}

            <button
              onClick={handleAddItem}
              style={{
                width: '100%',
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
              + Agregar a la orden
            </button>
          </div>
        )}
      </div>

      {/* Ticket lateral */}
      <div style={{
        width: 320,
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
            Ticket actual
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {draft.items.length} item{draft.items.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 20px' }}>
          {draft.items.map((item, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                  {item.quantity}× {item.product.name}
                </div>
                {item.extras.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    + {item.extras.map((e) => e.ingredient.name).join(', ')}
                  </div>
                )}
                <div style={{
                  fontSize: 12,
                  color: 'var(--accent)',
                  fontFamily: "'JetBrains Mono', monospace",
                  marginTop: 3,
                }}>
                  Q{(item.unit_price * item.quantity + item.extras_total).toFixed(2)}
                </div>
              </div>
              <button
                onClick={() => handleRemoveItem(index)}
                style={{
                  fontSize: 11,
                  color: 'var(--danger)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)' }}>
            <span>Subtotal</span>
            <span>Q{draft.subtotal.toFixed(2)}</span>
          </div>
          {draft.order_type === 'delivery' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)' }}>
              <span>Envío</span>
              <span style={{ color: draft.delivery_fee === 0 ? 'var(--success)' : 'var(--text-2)' }}>
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

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                flex: 1,
                padding: '10px',
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
            {draft.items.length > 0 && (
              <button
                onClick={handleContinue}
                style={{
                  flex: 2,
                  padding: '10px',
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
                Confirmar →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}