import Topbar from '@/components/shared/Topbar'
import PlatformsManager from '@/components/owner/PlatformsManager'

/**
 * Página EXCLUSIVA del owner para administrar los servicios de
 * delivery externos (PedidosYa, etc.). Los servicios que se
 * agreguen aquí aparecen en el punto de venta del seller cuando
 * escoge la modalidad "Plataformas".
 */
export default function OwnerPlatformsPage() {
  return (
    <>
      <Topbar title="Plataformas" hint="Owner · servicios de delivery externos" />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <PlatformsManager />
      </div>
    </>
  )
}