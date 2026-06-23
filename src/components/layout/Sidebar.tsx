'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';
import { useUserRol } from '@/hooks/useUserRol';
import { CHOFER_HREFS } from '@/lib/navAccess';
import MiEmpresaModal from '@/components/MiEmpresaModal';
import {
  IconHome, IconUsers, IconUser, IconClipboardList, IconClipboardCheck,
  IconTrendingDown, IconTrendingUp, IconReceipt, IconChartBar,
  IconCalendarStats, IconSettings, IconFileDescription,
  IconArrowsTransferUp, IconFolderOpen, IconCreditCard,
  IconPackage, IconBike, IconMap, IconSearch, IconCar,
  IconMapPin, IconBuilding, IconLogout,
  type Icon,
} from '@tabler/icons-react';

/* ── Tipos ───────────────────────────────────────────────────────────── */

type LinkItem = { href: string; label: string; icon: Icon };

/* ── Módulos ─────────────────────────────────────────────────────────── */

const UNIVERSAL: LinkItem[] = [
  { href: '/dashboard',               label: 'Inicio',        icon: IconHome },
  { href: '/dashboard/registro',      label: 'Registro',      icon: IconUsers },
  { href: '/dashboard/asistencia',    label: 'Asistencia',    icon: IconClipboardList },
  { href: '/dashboard/egresos',       label: 'Egresos',       icon: IconTrendingDown },
  { href: '/dashboard/ingresos',      label: 'Ingresos',      icon: IconTrendingUp },
  { href: '/dashboard/remitos',       label: 'Remitos',       icon: IconReceipt },
  { href: '/dashboard/reportes-km',   label: 'Reportes KM',   icon: IconChartBar },
  { href: '/dashboard/vencimientos',  label: 'Vencimientos',  icon: IconCalendarStats },
  { href: '/dashboard/administrador', label: 'Administrador', icon: IconSettings },
];

const ESCOLAR_EXTRAS: LinkItem[] = [
  { href: '/dashboard/planilla-incluir',   label: 'Planilla Incluir',   icon: IconClipboardCheck },
  { href: '/dashboard/dj-esc107',          label: 'DJ — ESC 107',       icon: IconFileDescription },
  { href: '/dashboard/cambio-transporte',  label: 'Cambio Transporte',  icon: IconArrowsTransferUp },
  { href: '/dashboard/presentacion-docs',  label: 'Presentación Docs',  icon: IconFolderOpen },
  { href: '/dashboard/facturacion',        label: 'Facturación',        icon: IconCreditCard },
];

// Pool completo para el chofer: UNIVERSAL + mi-ruta (no está en ninguna lista admin).
// Filtrado por CHOFER_HREFS (navAccess.ts) — no editar la lista de acceso aquí.
const ALL_SIDEBAR_ITEMS: LinkItem[] = [
  ...UNIVERSAL,
  { href: '/dashboard/mi-ruta', label: 'Mi ruta', icon: IconMapPin },
];

const TYPE_EXTRAS: Record<string, LinkItem[]> = {
  transporte_escolar:  ESCOLAR_EXTRAS,
  transporte_especial: ESCOLAR_EXTRAS,
  paqueteria: [
    { href: '/dashboard/envios',                 label: 'Envíos',       icon: IconPackage },
    { href: '/dashboard/clientes',               label: 'Clientes',     icon: IconUser },
    { href: '/dashboard/repartidores',           label: 'Repartidores', icon: IconBike },
    { href: '/dashboard/rutas',                  label: 'Rutas',        icon: IconMap },
    { href: '/dashboard/seguimiento',            label: 'Seguimiento',  icon: IconSearch },
    { href: '/dashboard/facturacion-paqueteria', label: 'Facturación',  icon: IconCreditCard },
  ],
  traslado: [
    { href: '/dashboard/viajes',               label: 'Viajes',      icon: IconCar },
    { href: '/dashboard/pasajeros',            label: 'Pasajeros',   icon: IconUsers },
    { href: '/dashboard/choferes-traslado',    label: 'Choferes',    icon: IconUser },
    { href: '/dashboard/reservas',             label: 'Reservas',    icon: IconCalendarStats },
    { href: '/dashboard/facturacion-traslado', label: 'Facturación', icon: IconCreditCard },
    { href: '/dashboard/seguimiento-traslado', label: 'Seguimiento', icon: IconSearch },
  ],
};

/* ── Componente ─────────────────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { tipo, loading: tipoLoading } = useEmpresaTipo();
  const { rol }                         = useUserRol();
  const [showEmpresa, setShowEmpresa]   = useState(false);

  const esChofer = rol === 'chofer';

  const links = useMemo<LinkItem[]>(() => {
    if (esChofer) return ALL_SIDEBAR_ITEMS.filter(l => CHOFER_HREFS.has(l.href));
    const extras: LinkItem[] = (tipo ? TYPE_EXTRAS[tipo] : undefined) ?? [];
    return [UNIVERSAL[0], ...extras, ...UNIVERSAL.slice(1)];
  }, [tipo, esChofer]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <>
      <aside className="dashboard-sidebar">

        {/* Logo */}
        <div className="sidebar-logo-area">
          <div className="logo-beam" style={{ borderRadius: 8, flexShrink: 0 }}>
            <Image
              src="/assets/logo-icon.png"
              alt="Transit·Ya"
              width={32}
              height={32}
              style={{ objectFit: 'contain', display: 'block' }}
              priority
            />
          </div>
          <span className="sidebar-logo-text">
            Transit<span style={{ color: 'var(--cyan)' }}>·Ya</span>
          </span>
        </div>

        {/* Tipo badge */}
        {!tipoLoading && tipo && (
          <div className="sidebar-tipo-row">
            <span className="sidebar-tipo-badge">
              {tipo.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav">
          {tipoLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="sidebar-skeleton" style={{ opacity: Math.max(0.08, 1 - i * 0.12) }} />
            ))
          ) : (
            links.map((link, idx) => {
              const active = pathname === link.href;
              const Icon   = link.icon;

              const prevIsExtra    = idx > 0 && TYPE_EXTRAS[tipo || '']?.some(e => e.href === links[idx - 1].href);
              const thisIsUniversal = UNIVERSAL.some(u => u.href === link.href);
              const showSep        = prevIsExtra && thisIsUniversal && (TYPE_EXTRAS[tipo || '']?.length ?? 0) > 0;

              return (
                <div key={link.href}>
                  {showSep && (
                    <>
                      <div className="sidebar-divider" />
                      <span className="sidebar-section-label">General</span>
                    </>
                  )}
                  <Link
                    href={link.href}
                    title={link.label}
                    className={`sidebar-nav-link${active ? ' sidebar-nav-active' : ''}`}
                  >
                    <Icon size={22} stroke={1.5} className="sidebar-nav-icon" aria-hidden />
                    <span className="sidebar-nav-label">{link.label}</span>
                  </Link>
                </div>
              );
            })
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {!esChofer && (
            <button
              title="Mi empresa"
              className="sidebar-nav-link sidebar-nav-btn"
              onClick={() => setShowEmpresa(true)}
            >
              <IconBuilding size={22} stroke={1.5} className="sidebar-nav-icon" aria-hidden />
              <span className="sidebar-nav-label">Mi empresa</span>
            </button>
          )}
          <button
            title="Cerrar sesión"
            className="sidebar-nav-link sidebar-nav-btn sidebar-logout"
            onClick={handleLogout}
          >
            <IconLogout size={22} stroke={1.5} className="sidebar-nav-icon" aria-hidden />
            <span className="sidebar-nav-label">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {showEmpresa && <MiEmpresaModal onClose={() => setShowEmpresa(false)} />}
    </>
  );
}
