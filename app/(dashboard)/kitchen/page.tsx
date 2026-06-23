import Topbar from '@/components/shared/Topbar'
import KitchenQueue from '@/components/kitchen/KitchenQueue'

export default function KitchenPage() {
  return (
    <>
      <Topbar title="Cola de cocina" hint="Cocina · pantalla táctil · tablet" />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <KitchenQueue />
      </div>
    </>
  )
}