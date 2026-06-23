'use client'

import { useState } from 'react'
import { useOrderStore } from '@/lib/store/orderStore'
import WizardStep1 from './WizardStep1'
import WizardStep2 from './WizardStep2'
import WizardStep3 from './WizardStep3'

interface Props {
  sellerId: string
}

const STEPS = ['Cliente', 'Productos', 'Confirmación']

export default function OrderWizard({ sellerId }: Props) {
  const { step, resetDraft } = useOrderStore()
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null)

  if (completedOrderId) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--success-bg)',
          border: '1px solid var(--success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}>
          ✓
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>
          ¡Pedido confirmado!
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
          El pedido ya está en la cola de cocina
        </div>
        <button
          onClick={() => { setCompletedOrderId(null); resetDraft() }}
          style={{
            marginTop: 8,
            padding: '12px 28px',
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
          Nuevo pedido
        </button>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* Steps indicator */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--surface)',
      }}>
        {STEPS.map((label, index) => {
          const stepNum = (index + 1) as 1 | 2 | 3
          const isActive = step === stepNum
          const isDone = step > stepNum

          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  background: isDone
                    ? 'var(--success)' : isActive
                    ? 'var(--primary)' : 'var(--surface-2)',
                  color: isDone || isActive ? '#fff' : 'var(--text-3)',
                  border: `1px solid ${isDone ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--border)'}`,
                }}>
                  {isDone ? '✓' : stepNum}
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? 'var(--primary)' : isDone
                    ? 'var(--success)' : 'var(--text-3)',
                }}>
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div style={{
                  flex: 1,
                  height: 1,
                  background: isDone ? 'var(--success)' : 'var(--border)',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {step === 1 && <WizardStep1 />}
        {step === 2 && <WizardStep2 />}
        {step === 3 && (
          <WizardStep3
            sellerId={sellerId}
            onOrderCreated={setCompletedOrderId}
          />
        )}
      </div>
    </div>
  )
}