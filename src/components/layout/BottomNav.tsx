'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  IconHome,
  IconClipboardList,
  IconFileDescription,
  IconArrowsTransferUp,
  IconFolderOpen,
  IconCreditCard,
  IconUsers,
  IconChecks,
  IconTrendingDown,
  IconTrendingUp,
  IconReceipt,
  IconChartBar,
  IconCalendarStats,
  IconSettings,
  IconMapPin,
} from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';
import { CHOFER_HREFS } from '@/lib/navAccess';
import { useUserRol } from '@/hooks/useUserRol';

type NavItem = { href: string; label: string; Icon: Icon };

// Lista completa de ítems del nav (admin ve todos; chofer ve solo los de CHOFER_HREFS).
// mi-ruta está aquí aunque no aparezca para admin — CHOFER_HREFS lo incluye.
const ITEMS: NavItem[] = [
  { href: '/dashboard',                    label: 'Inicio',          Icon: IconHome },
  { href: '/dashboard/planilla-incluir',   label: 'Planilla',        Icon: IconClipboardList },
  { href: '/dashboard/dj-esc107',          label: 'DJ ESC 107',      Icon: IconFileDescription },
  { href: '/dashboard/cambio-transporte',  label: 'Cambio Transp.',  Icon: IconArrowsTransferUp },
  { href: '/dashboard/presentacion-docs',  label: 'Pres. Docs',      Icon: IconFolderOpen },
  { href: '/dashboard/facturacion',        label: 'Facturación',     Icon: IconCreditCard },
  { href: '/dashboard/registro',           label: 'Registro',        Icon: IconUsers },
  { href: '/dashboard/asistencia',         label: 'Asistencia',      Icon: IconChecks },
  { href: '/dashboard/egresos',            label: 'Egresos',         Icon: IconTrendingDown },
  { href: '/dashboard/ingresos',           label: 'Ingresos',        Icon: IconTrendingUp },
  { href: '/dashboard/remitos',            label: 'Remitos',         Icon: IconReceipt },
  { href: '/dashboard/reportes-km',        label: 'Reportes KM',     Icon: IconChartBar },
  { href: '/dashboard/vencimientos',       label: 'Vencimientos',    Icon: IconCalendarStats },
  { href: '/dashboard/administrador',      label: 'Administrador',   Icon: IconSettings },
  { href: '/dashboard/mi-ruta',            label: 'Mi ruta',         Icon: IconMapPin },
];

const SLIDE_SIZE = 3;

export default function BottomNav() {
  const pathname  = usePathname();
  const router    = useRouter();
  const trackRef  = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const { rol } = useUserRol();

  // Filtrar por rol: chofer ve solo sus rutas (CHOFER_HREFS), admin ve todo excepto mi-ruta
  const itemsVisibles = useMemo(() =>
    rol === 'chofer'
      ? ITEMS.filter(i => CHOFER_HREFS.has(i.href))
      : ITEMS.filter(i => i.href !== '/dashboard/mi-ruta'),
  [rol]);

  // SLIDES se computa dentro del componente porque depende del rol
  const slides = useMemo(() =>
    Array.from(
      { length: Math.ceil(itemsVisibles.length / SLIDE_SIZE) },
      (_, i) => itemsVisibles.slice(i * SLIDE_SIZE, (i + 1) * SLIDE_SIZE)
    ),
  [itemsVisibles]);

  /* Scroll to the slide that contains the active item on mount / route change */
  useEffect(() => {
    const activeIdx = itemsVisibles.findIndex(item => pathname === item.href);
    const slide = activeIdx >= 0 ? Math.floor(activeIdx / SLIDE_SIZE) : 0;
    setCurrent(slide);
    const track = trackRef.current;
    if (!track) return;
    requestAnimationFrame(() => {
      track.scrollLeft = slide * track.clientWidth;
    });
  }, [pathname, itemsVisibles]);

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const slide = Math.round(track.scrollLeft / track.clientWidth);
    setCurrent(slide);
  }, []);

  const goToSlide = (idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' });
    setCurrent(idx);
  };

  return (
    <nav className="bnav" aria-label="Navegación principal">
      {/* Scrollable carousel track */}
      <div
        ref={trackRef}
        className="bnav-track"
        onScroll={handleScroll}
      >
        {slides.map((slide, si) => (
          <div key={si} className="bnav-slide">
            {slide.map(item => {
              const active = pathname === item.href;
              return (
                <button
                  key={item.href}
                  className={`bnav-btn${active ? ' bnav-active' : ''}`}
                  onClick={() => router.push(item.href)}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <item.Icon size={24} stroke={1.5} aria-hidden="true" />
                  <span className="bnav-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="bnav-dots" role="tablist" aria-label="Diapositivas">
        {slides.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === current}
            aria-label={`Slide ${i + 1} de ${slides.length}`}
            className={`bnav-dot${i === current ? ' bnav-dot-active' : ''}`}
            onClick={() => goToSlide(i)}
          />
        ))}
      </div>
    </nav>
  );
}
