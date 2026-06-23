import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/shared/Topbar'
import SalesDashboard from '@/components/owner/SalesDashboard'
import InventoryAlerts from '@/components/owner/InventoryAlerts'

export default async function OwnerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <Topbar title="Dashboard" hint="Owner · resumen operativo" />
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: 20,
          alignItems: 'start',
        }}>
          <SalesDashboard />
          <InventoryAlerts />
        </div>
      </div>
    </>
  )
}