'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useEmpresaTipo } from '@/hooks/useEmpresaTipo';

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
  { href: '/dashboard/altas-pres',        label: '📋 Altas (PRES IS)' },
  { href: '/dashboard/cambio-transporte', label: '🔄 Cambio Transporte' },
  { href: '/dashboard/presentacion-docs', label: '📁 Presentación Docs' },
  { href: '/dashboard/facturacion',       label: '💳 Facturación' },
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

  /**
   * Armamos la lista de links:
   * [Inicio] + extras del tipo + resto de universales
   * Si el tipo no existe o hubo error, se muestran solo universales (fallback seguro).
   */
  const links = useMemo<LinkItem[]>(() => {
    const extras: LinkItem[] = (tipo ? TYPE_EXTRAS[tipo] : undefined) ?? [];
    // Inicio + extras del tipo + resto de universales
    return [UNIVERSAL[0], ...extras, ...UNIVERSAL.slice(1)];
  }, [tipo]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <aside style={{
      width: '220px', minHeight: '100vh', flexShrink: 0,
      background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{ padding: '1rem 1rem .85rem', borderBottom: '1px solid var(--border)' }}>
        <img
          src="/logo.svg"
          alt="Transit·Ya"
          style={{ display: 'block', height: 32, width: 'auto' }}
        />
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

      {/* Logout */}
      <div style={{ padding: '.75rem 1rem', borderTop: '1px solid var(--border)' }}>
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
  );
}
