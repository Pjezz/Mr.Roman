import Topbar from '@/components/shared/Topbar'
import MenuManager from '@/components/owner/MenuManager'
import OffersManager from '@/components/owner/OffersManager'

/**
 * Página de Menú del OWNER.
 * Además de la gestión de productos (MenuManager), incluye el
 * apartado de OFERTAS (OffersManager), exclusivo de este rol:
 * un botón "Ofertas" abre el display para crear, habilitar,
 * deshabilitar y borrar ofertas por producto.
 */
export default function OwnerMenuPage() {
  return (
    <>
      <Topbar title="Menú" hint="Owner · gestión de productos" />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Barra superior del apartado con el acceso a Ofertas */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <OffersManager />
        </div>
        <MenuManager />
      </div>
    </>
  )
}
