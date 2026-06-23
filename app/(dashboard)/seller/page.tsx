import Topbar from '@/components/shared/Topbar'
import OrderWizard from '@/components/seller/OrderWizard'
import { createClient } from '@/lib/supabase/server'

export default async function SellerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <Topbar title="Punto de venta" hint="Vendedor · nueva orden" />
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
      }}>
        <OrderWizard sellerId={user!.id} />
      </div>
    </>
  )
}