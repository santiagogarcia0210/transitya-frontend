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

/* ── Módulos ─────────────────────────────────────────────────────────── */

type LinkItem = { href: string; label: string };

/** Presentes en todos los tipos de empresa. */
const UNIVERSAL: LinkItem[] = [
  { href: '/dashboard',               label: '🏠 Inicio' },
  { href: '/dashboard/registro',      label: '👤 Registro' },
  { href: '/dashboard/asistencia',    label: '📋 Asistencia' },
  { href: '/dashboard/egresos',       label: '💸 Egresos' },
  { href: '/dashboard/ingresos',      label: '💰 Ingresos' },
  { href: '/dashboard/remitos',       label: '🧾 Remitos' },
  { href: '/dashboard/reportes-km',   label: '📊 Reportes KM' },
  { href: '/dashboard/vencimientos',  label: '📅 Vencimientos' },
  { href: '/dashboard/administrador', label: '⚙️ Administrador' },
];

/** Extras exclusivos por tipo — se insertan después de Inicio. */

const ESCOLAR_EXTRAS: LinkItem[] = [
  { href: '/dashboard/planilla-incluir',  label: '📝 Planilla Incluir' },
  { href: '/dashboard/dj-esc107',         label: '📄 DJ — ESC 107' },
  { href: '/dashboard/cambio-transporte', label: '🔄 Cambio Transporte' },
  { href: '/dashboard/presentacion-docs', label: '📁 Presentación Docs' },
  { href: '/dashboard/facturacion',       label: '💳 Facturación' },
];

/** Módulos visibles solo para choferes (cualquier tipo de empresa). */
const CHOFER_LINKS: LinkItem[] = [
  { href: '/dashboard',             label: '🏠 Inicio' },
  { href: '/dashboard/asistencia',  label: '📋 Asistencia' },
  { href: '/dashboard/mi-ruta',     label: '🗺️ Mi ruta' },
  { href: '/dashboard/egresos',     label: '💸 Egresos' },
  { href: '/dashboard/remitos',     label: '🧾 Remitos' },
  { href: '/dashboard/reportes-km', label: '📊 Reportes KM' },
  { href: '/dashboard/vencimientos',label: '📅 Vencimientos' },
];

const TYPE_EXTRAS: Record<string, LinkItem[]> = {
  transporte_escolar:  ESCOLAR_EXTRAS,
  transporte_especial: ESCOLAR_EXTRAS, // alias — ambas claves muestran lo mismo
  paqueteria: [
    { href: '/dashboard/envios',                 label: '📦 Envíos' },
    { href: '/dashboard/clientes',               label: '👤 Clientes Pkg.' },
    { href: '/dashboard/repartidores',           label: '🚴 Repartidores' },
    { href: '/dashboard/rutas',                  label: '🗺️ Rutas' },
    { href: '/dashboard/seguimiento',            label: '🔍 Seguimiento' },
    { href: '/dashboard/facturacion-paqueteria', label: '💰 Facturación Pkg.' },
  ],
  traslado: [
    { href: '/dashboard/viajes',               label: '🚕 Viajes' },
    { href: '/dashboard/pasajeros',            label: '👤 Pasajeros' },
    { href: '/dashboard/choferes-traslado',    label: '🚗 Choferes' },
    { href: '/dashboard/reservas',             label: '📅 Reservas' },
    { href: '/dashboard/facturacion-traslado', label: '💰 Facturación Tras.' },
    { href: '/dashboard/seguimiento-traslado', label: '🔍 Seguimiento' },
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

  /**
   * Choferes: lista fija reducida.
   * Admins: Inicio + extras del tipo + resto de universales.
   */
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
      {/* Logo — horizontal en desktop, ícono en mobile */}
      <style>{`
        .sidebar-logo-h { display: block; }
        .sidebar-logo-i { display: none;  }
        @media (max-width: 768px) {
          .sidebar-logo-h { display: none;  }
          .sidebar-logo-i { display: block; }
        }
      `}</style>
      <div style={{ padding: '1rem 1rem .85rem', borderBottom: '1px solid var(--border)' }}>
        <span className="sidebar-logo-h">
          <Image src="/assets/logo-horizontal.png" alt="Transit·Ya" width={150} height={44} style={{ objectFit: 'contain' }} priority />
        </span>
        <span className="sidebar-logo-i">
          <Image src="/assets/logo-icon.png" alt="Transit·Ya" width={32} height={32} style={{ objectFit: 'contain' }} priority />
        </span>
        {/* Badge del tipo (visible una vez cargado) */}
        {!tipoLoading && tipo && (
          <span style={{
            display: 'inline-block', marginTop: '.35rem',
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
          /* Skeleton mientras carga */
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

            // Separador visual entre extras y universales
            const prevIsExtra = idx > 0 && TYPE_EXTRAS[tipo || '']?.some(e => e.href === links[idx - 1].href);
            const thisIsUniversal = UNIVERSAL.some(u => u.href === link.href);
            const showSep = prevIsExtra && thisIsUniversal && (TYPE_EXTRAS[tipo || '']?.length ?? 0) > 0;

            return (
              <div key={link.href}>
                {showSep && (
                  <div style={{
                    height: '1px', background: 'var(--border)',
                    margin: '.4rem 1rem',
                  }} />
                )}
                <Link
                  href={link.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '.6rem',
                    padding: '10px 16px',
                    fontSize: '.9rem', fontWeight: active ? 600 : 400,
                    color: active ? 'var(--text)' : 'var(--text3)',
                    background: active ? 'var(--blue-dim)' : 'transparent',
                    borderLeft: active ? '3px solid var(--blue)' : '3px solid transparent',
                    textDecoration: 'none',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text2)';
                      (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg4)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text3)';
                      (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                    }
                  }}
                >
                  {link.label}
                </Link>
              </div>
            );
          })
        )}
      </nav>

      {/* Mi empresa + Logout */}
      <div style={{ padding: '.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
        {!esChofer && <button
          onClick={() => setShowEmpresa(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '.6rem',
            padding: '.45rem .75rem', borderRadius: 'var(--radius)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '.82rem', color: 'var(--text3)', textAlign: 'left',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)';
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
          }}
        >
          <span>🏢</span> Mi empresa
        </button>}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '.6rem',
            padding: '.45rem .75rem', borderRadius: 'var(--radius)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '.82rem', color: 'var(--text3)', textAlign: 'left',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)';
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-dim)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)';
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
          }}
        >
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </aside>

    {showEmpresa && <MiEmpresaModal onClose={() => setShowEmpresa(false)} />}
  </>
  );
}
