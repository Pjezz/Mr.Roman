'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, ProductCategory, CATEGORY_LABELS } from '@/types'

interface Props {
  onProductSelected: (product: Product) => void
  filterCategory?: ProductCategory[]
  excludeCategories?: string[]
}

export default function ProductSelector({
  onProductSelected,
  filterCategory,
  excludeCategories = [],
}: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProducts() {
      const supabase = createClient()
      let query = supabase
        .from('products')
        .select('*')
        .eq('available', true)

      if (filterCategory && filterCategory.length > 0) {
        query = query.in('category', filterCategory)
      }

      const { data } = await query.order('category').order('name')
      setProducts(
        (data ?? []).filter((p) => !excludeCategories.includes(p.category))
      )
      setLoading(false)
    }
    fetchProducts()
  }, [])

  const categories = [...new Set(products.map((p) => p.category))]
  const filtered = selectedCategory
    ? products.filter((p) => p.category === selectedCategory)
    : []

  if (loading) return (
    <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Cargando productos...</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
        Catálogo
      </div>

      {/* Categorías */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              border: '1px solid',
              borderColor: selectedCategory === cat ? 'var(--primary)' : 'var(--border)',
              background: selectedCategory === cat ? 'var(--primary)' : 'transparent',
              color: selectedCategory === cat ? '#fff' : 'var(--text-2)',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {CATEGORY_LABELS[cat as ProductCategory] ?? cat}
          </button>
        ))}
      </div>

      {/* Grid de productos */}
      {selectedCategory && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 10,
        }}>
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => onProductSelected(product)}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 14,
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              {/* Placeholder imagen */}
              <div style={{
                height: 56,
                borderRadius: 6,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: 'var(--text-3)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
                  />
                ) : (
                  'Sin foto'
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2 }}>
                {product.name}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {CATEGORY_LABELS[product.category as ProductCategory]?.split(' ')[0]}
                </span>
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  Q{product.price.toFixed(2)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}