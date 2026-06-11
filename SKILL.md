---
name: transitya-design
description: Guía de diseño para Transit·Ya. Usar siempre que se cree o modifique UI — landing (transitya.com), app Next.js (transitya-frontend), demos animados, maquetas o piezas de marketing. Define la dirección estética, qué evitar, y cómo aprovechar componentes de 21st.dev como contexto de diseño.
---

# Diseño Transit·Ya

Guía para producir interfaces con criterio propio, evitando estética genérica de IA.
Aplica a: landing, app Next.js, demos animados, maquetas, emails y piezas visuales.

## 1. Contexto antes que invención

Nunca diseñar desde cero si existe contexto. En orden de prioridad:

1. **App existente** — antes de tocar la app Next.js, leer los componentes ya
   creados en `src/app/dashboard/` y `src/components/`. Replicar su vocabulario
   visual: paleta, espaciados, estados hover, badges, cards. No introducir
   estilos nuevos en módulos existentes.
2. **Landing** — tema oscuro `#080c18`, navbar sticky, logos en `/assets/`
   (`logo-horizontal.png`, `logo-circular.png`, `logo-text.png`). Referencia
   estética: infracommerce.lat.
3. **21st.dev** — cuando se necesite un componente nuevo (hero, pricing,
   testimonials, etc.), buscar primero en 21st.dev variantes de calidad y
   adaptarlas a la paleta de Transit·Ya. Adaptar = cambiar tokens de color,
   tipografía y copy; no pegar tal cual.
4. **GAS original** — para módulos migrados con fidelidad estricta (planillas,
   documentos impresos), el HTML/CSS de `gas-original/` es la única referencia
   válida. Fidelidad pixel-perfect, no aproximación.

Si no hay contexto suficiente, preguntar al usuario antes de inventar.

## 2. Sistema primero, píxeles después

Antes de escribir código de UI nueva, declarar en 2-3 líneas el sistema:
paleta (máx 2 colores de fondo), tipografía (títulos/cuerpo), radio de
bordes, y el elemento memorable de la pieza. Luego ejecutarlo con
consistencia total.

## 3. Qué evitar (tropos de IA)

- Gradientes agresivos de fondo, sobre todo morados sobre blanco
- Emojis en UI (salvo que el contenido los pida explícitamente)
- Cards con borde redondeado + barra de acento a la izquierda
- Imaginería dibujada en SVG cuando un placeholder honesto queda mejor
- Fuentes sobreusadas: Inter, Roboto, Arial, fuentes de sistema
- "Data slop": números, stats o íconos decorativos que no aportan
- Relleno: ninguna sección existe para ocupar espacio; si queda vacía,
  es un problema de composición, no de contenido faltante
- Tres cards idénticas en grid como solución por defecto

## 4. Escalas mínimas

- Slides/demos 1920×1080: texto nunca menor a 24px
- Web desktop: cuerpo 16px mínimo
- Mobile: hit targets de 44px mínimo
- Documentos imprimibles: 12pt mínimo

## 5. Datos en piezas públicas

Landing, demos y maquetas usan SIEMPRE datos ficticios (empresa
"Transporte San Martín", choferes y beneficiarios inventados, montos
redondos verosímiles). Jamás datos reales de tenants, emails reales,
ni credenciales.

## 6. Demos animados (estilo video en HTML)

- Loop automático con transiciones fade+slide por CSS
- Barra de progreso con segmentos clickeables para saltar de escena
- Cursor simulado (div circular semitransparente) animado por CSS
- Todo vanilla HTML/CSS/JS, sin librerías, sin imágenes externas
- Contenedor 16:9 con frame de browser (circulitos + URL falsa)
- Persistir la escena actual en localStorage para sobrevivir refresh
- Sin pantalla de título: el demo arranca directo en contenido

## 7. Variaciones

Cuando el usuario pide explorar diseño (no un fix puntual), ofrecer 2-3
variantes con direcciones distintas — no la misma idea con otro color.
Etiquetar cada una con qué prioriza. Empezar conservador y escalar en
audacia. Para retoques puntuales ("cambiá el color del botón"), NO
reabrir el debate estético: hacer el cambio y nada más.

## 8. CSS moderno

text-wrap: pretty, CSS grid, clamp() para tipografía fluida,
aspect-ratio, y container queries están disponibles y son bienvenidos.
Animar solo transform y opacity. Respetar prefers-reduced-motion.
