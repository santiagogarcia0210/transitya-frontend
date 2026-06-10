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
import MiEmpresaModal from '@/components/MiEmpresaModal';
import {
  Home, Users, ClipboardList, TrendingDown, TrendingUp, FileText,
  BarChart2, Calendar, Settings, ClipboardCheck, FileSpreadsheet,
  RefreshCw, FolderOpen, CreditCard, Package, Bike, Map, Search,
  Car, Building2, LogOut, User, Receipt,
  type LucideIcon,
} from 'lucide-react';

/* ── Módulos ─────────────────────────────────────────────────────────── */

type LinkItem = { href: string; label: string; icon: LucideIcon };

const UNIVERSAL: LinkItem[] = [
  { href: '/dashboard',               label: 'Inicio',        icon: Home },
  { href: '/dashboard/registro',      label: 'Registro',      icon: Users },
  { href: '/dashboard/asistencia',    label: 'Asistencia',    icon: ClipboardList },
  { href: '/dashboard/egresos',       label: 'Egresos',       icon: TrendingDown },
  { href: '/dashboard/ingresos',      label: 'Ingresos',      icon: TrendingUp },
  { href: '/dashboard/remitos',       label: 'Remitos',       icon: FileText },
  { href: '/dashboard/reportes-km',   label: 'Reportes KM',   icon: BarChart2 },
  { href: '/dashboard/vencimientos',  label: 'Vencimientos',  icon: Calendar },
  { href: '/dashboard/administrador', label: 'Administrador', icon: Settings },
];

const ESCOLAR_EXTRAS: LinkItem[] = [
  { href: '/dashboard/planilla-incluir',  label: 'Planilla Incluir',  icon: ClipboardCheck },
  { href: '/dashboard/dj-esc107',         label: 'DJ — ESC 107',      icon: FileSpreadsheet },
  { href: '/dashboard/cambio-transporte', label: 'Cambio Transporte', icon: RefreshCw },
  { href: '/dashboard/presentacion-docs', label: 'Presentación Docs', icon: FolderOpen },
  { href: '/dashboard/facturacion',       label: 'Facturación',       icon: CreditCard },
];

const CHOFER_LINKS: LinkItem[] = [
  { href: '/dashboard',             label: 'Inicio',      icon: Home },
  { href: '/dashboard/asistencia',  label: 'Asistencia',  icon: ClipboardList },
  { href: '/dashboard/mi-ruta',     label: 'Mi ruta',     icon: Map },
  { href: '/dashboard/egresos',     label: 'Egresos',     icon: TrendingDown },
  { href: '/dashboard/remitos',     label: 'Remitos',     icon: FileText },
  { href: '/dashboard/reportes-km', label: 'Reportes KM', icon: BarChart2 },
  { href: '/dashboard/vencimientos',label: 'Vencimientos',icon: Calendar },
];

const TYPE_EXTRAS: Record<string, LinkItem[]> = {
  transporte_escolar:  ESCOLAR_EXTRAS,
  transporte_especial: ESCOLAR_EXTRAS,
  paqueteria: [
    { href: '/dashboard/envios',                 label: 'Envíos',        icon: Package },
    { href: '/dashboard/clientes',               label: 'Clientes',      icon: User },
    { href: '/dashboard/repartidores',           label: 'Repartidores',  icon: Bike },
    { href: '/dashboard/rutas',                  label: 'Rutas',         icon: Map },
    { href: '/dashboard/seguimiento',            label: 'Seguimiento',   icon: Search },
    { href: '/dashboard/facturacion-paqueteria', label: 'Facturación',   icon: Receipt },
  ],
  traslado: [
    { href: '/dashboard/viajes',               label: 'Viajes',       icon: Car },
    { href: '/dashboard/pasajeros',            label: 'Pasajeros',    icon: Users },
    { href: '/dashboard/choferes-traslado',    label: 'Choferes',     icon: User },
    { href: '/dashboard/reservas',             label: 'Reservas',     icon: Calendar },
    { href: '/dashboard/facturacion-traslado', label: 'Facturación',  icon: Receipt },
    { href: '/dashboard/seguimiento-traslado', label: 'Seguimiento',  icon: Search },
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
    if (esChofer) return CHOFER_LINKS;
    const extras: LinkItem[] = (tipo ? TYPE_EXTRAS[tipo] : undefined) ?? [];
    return [UNIVERSAL[0], ...extras, ...UNIVERSAL.slice(1)];
  }, [tipo, esChofer]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <>
    <aside style={{
      width: '220px', minHeight: '100vh', flexShrink: 0,
      background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        .sidebar-logo-h { display: block; }
        .sidebar-logo-i { display: none;  }
        @media (max-width: 768px) {
          .sidebar-logo-h { display: none;  }
          .sidebar-logo-i { display: block; }
        }
      `}</style>

      {/* Logo */}
      <div style={{ padding: '1rem 1rem .85rem', borderBottom: '1px solid var(--border)' }}>
        <span className="sidebar-logo-h">
          <div className="logo-beam" style={{ borderRadius: '8px' }}>
            <Image src="/assets/logo-horizontal.png" alt="Transit·Ya" width={150} height={44} style={{ objectFit: 'contain', display: 'block' }} priority />
          </div>
        </span>
        <span className="sidebar-logo-i">
          <div className="logo-beam" style={{ borderRadius: '8px' }}>
            <Image src="/assets/logo-icon.png" alt="Transit·Ya" width={32} height={32} style={{ objectFit: 'contain', display: 'block' }} priority />
          </div>
        </span>
        {!tipoLoading && tipo && (
          <span style={{
            display: 'inline-block', marginTop: '.45rem',
            fontSize: '.62rem', fontWeight: 600, letterSpacing: '.05em',
            color: 'var(--blue-bright)', background: 'var(--blue-dim)',
            padding: '.15rem .5rem', borderRadius: 99,
            textTransform: 'uppercase',
          }}>
            {tipo.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '.5rem 0' }}>
        {tipoLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              margin: '.3rem 1rem', height: '1.75rem', borderRadius: 'var(--radius)',
              background: 'var(--bg4)',
              opacity: Math.max(0.08, 1 - i * 0.12),
              animation: 'pulse 1.4s ease-in-out infinite',
            }} />
          ))
        ) : (
          links.map((link, idx) => {
            const active = pathname === link.href;
            const Icon = link.icon;

            const prevIsExtra    = idx > 0 && TYPE_EXTRAS[tipo || '']?.some(e => e.href === links[idx - 1].href);
            const thisIsUniversal = UNIVERSAL.some(u => u.href === link.href);
            const showSep        = prevIsExtra && thisIsUniversal && (TYPE_EXTRAS[tipo || '']?.length ?? 0) > 0;

            return (
              <div key={link.href}>
                {showSep && (
                  <>
                    <div style={{ height: '1px', background: 'var(--border)', margin: '.5rem .75rem .25rem' }} />
                    <div className="sidebar-section-label">General</div>
                  </>
                )}
                <Link
                  href={link.href}
                  className="sidebar-nav-link"
                  style={{
                    padding: '9px 16px 9px 13px',
                    fontSize: '.88rem',
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--blue-bright)' : 'var(--text3)',
                    background: active ? 'rgba(59,130,246,.08)' : 'transparent',
                    borderLeft: active ? '3px solid var(--blue)' : '3px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.color = 'var(--text)';
                      el.style.background = 'rgba(255,255,255,.04)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.color = 'var(--text3)';
                      el.style.background = 'transparent';
                    }
                  }}
                >
                  <Icon size={16} className="sidebar-nav-icon" />
                  <span>{link.label}</span>
                </Link>
              </div>
            );
          })
        )}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '.6rem .75rem',
        borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: '.2rem',
      }}>
        {!esChofer && (
          <button
            className="sidebar-nav-link"
            onClick={() => setShowEmpresa(true)}
            style={{
              width: '100%', padding: '8px 12px 8px 13px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '.82rem', color: 'var(--text3)', textAlign: 'left',
              borderRadius: 'var(--radius)', borderLeft: '3px solid transparent',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = 'var(--text)';
              el.style.background = 'rgba(255,255,255,.04)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = 'var(--text3)';
              el.style.background = 'none';
            }}
          >
            <Building2 size={15} className="sidebar-nav-icon" />
            <span>Mi empresa</span>
          </button>
        )}
        <button
          className="sidebar-nav-link"
          onClick={handleLogout}
          style={{
            width: '100%', padding: '8px 12px 8px 13px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '.82rem', color: 'var(--text3)', textAlign: 'left',
            borderRadius: 'var(--radius)', borderLeft: '3px solid transparent',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.color = 'var(--red)';
            el.style.background = 'rgba(239,68,68,.06)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.color = 'var(--text3)';
            el.style.background = 'none';
          }}
        >
          <LogOut size={15} className="sidebar-nav-icon" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>

    {showEmpresa && <MiEmpresaModal onClose={() => setShowEmpresa(false)} />}
  </>
  );
}
