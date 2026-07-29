# Notas — Planillas Incluir Salud

Fecha diagnóstico: 2026-07-23 (actualizado en sesión de seguimiento, mismo día)

## Verificación — "no veo los cambios al imprimir" (rama `fix/dj-esc107-layout`)

Pediste confirmar 3 cosas puntuales antes de seguir tocando código, porque
sospechabas que los fixes de layout podían haber ido a un archivo/componente
que la ruta `/dashboard/dj-esc107` no renderiza. Resultado: **las tres
verificaciones dieron bien, no encontré ningún desvío.**

1. **Commits en la rama y pusheados**: `git status` limpio, y
   `git diff fix/dj-esc107-layout origin/fix/dj-esc107-layout --stat` no
   devuelve ninguna diferencia — el local y el remoto son idénticos. Los 2
   commits de los fixes de layout (`3dfce22` restaura flex/overflow,
   `43e7e4f` corrige desborde a 2da hoja + líneas de firma + fecha numérica)
   están ahí y están pusheados.

2. **Los cambios están en el archivo que se ve en pantalla**: confirmado con
   `git show origin/fix/dj-esc107-layout:src/app/dashboard/dj-esc107/page.tsx`
   (leyendo directo el contenido del commit en origin, no un working-copy que
   pudiera estar desactualizado):
   - `mesStr` (fecha numérica `DD/MM/YYYY`) aparece en las líneas 34, 110 y 141.
   - El bloque de "Firma Titular/Familiar/Responsable/Tutor" (línea 119) es
     sólo el label — ya no tiene el `<span>` con `borderBottom` al lado que
     tenía antes.
   - La clase `dje107-page` está tanto en el elemento (línea 50) como en la
     regla CSS que la restaura (línea 271).
   - Único archivo: `src/app/dashboard/dj-esc107/page.tsx`.

3. **No hay componente duplicado ni desvío de ruteo**: `src/app/dashboard/dj-esc107/`
   sólo contiene `page.tsx` (no hay `layout.tsx` propio ni otro archivo). Un
   grep por `DjPage`, `PLANILLA CONFORMIDAD EFECTIVA PRESTACIÓN DE TRANSPORTE`
   y `dj107` en todo `src/` sólo encuentra el componente real en
   `dj-esc107/page.tsx` — el resto de las coincidencias
   (`planilla-incluir/page.tsx`, `Sidebar.tsx`, `BottomNav.tsx`,
   `dashboard/page.tsx`) son enlaces de navegación al link `/dashboard/dj-esc107`,
   no otra implementación del componente de impresión. `DjPage` está definida
   dentro del mismo archivo (no se importa desde otro lado), así que no existe
   ningún "componente viejo" o copia separada compitiendo por esa ruta.

**No se tocó código en esta verificación** (según lo que pediste en el punto 5,
al no encontrar ningún desvío).

**Explicación más probable de por qué no viste los cambios**: esta rama
(`fix/dj-esc107-layout`) **no está mergeada a `main`**. Si probaste imprimiendo
desde una build/deploy de producción (que sólo tiene lo que hay en `main`) en
vez de correr esta rama localmente (`git checkout fix/dj-esc107-layout` +
`npm run dev`/`npm run build` sobre ese checkout), verías la versión vieja del
componente aunque los fixes estén perfectamente commiteados y pusheados acá.
También revisá que el `npm run dev` que estés mirando no haya quedado corriendo
sobre otra rama desde antes (el hot-reload de Next no cambia de rama solo) y
que el navegador no esté sirviendo una vista impresa desde caché/vista previa
vieja de una pestaña abierta de antes del fix.

## Iteración — desborde a 2da hoja + líneas de firma de más + fecha con nombre de mes

Después del fix de layout anterior (`display:flex` restaurado), al imprimir de
verdad apareció un desborde real: logo cortado arriba y footer cayendo a una
segunda hoja. Causa más probable: `@page { margin: 0 }` depende de que el
navegador/driver de impresión respete margen cero — en Windows, "Microsoft
Print to PDF" y muchos drivers de impresora imponen un margen mínimo propio sin
importar el CSS, así que el contenido (calculado para ocupar los 297mm
completos) terminaba compitiendo con un margen "gratis" que el driver agregaba
por su cuenta, empujando el final del contenido a una hoja extra.

**Fix**: se declaró `@page { margin: 10mm }` explícito (en vez de 0) y la caja
`.dje107-page` en impresión se dimensiona al área imprimible resultante
(190mm × 277mm) en lugar de a la hoja A4 completa — así el margen lo maneja el
propio motor de impresión de forma predecible, sin pelear con un valor que
varios drivers no respetan igual.

**Cálculo de presupuesto de altura** (verificable por lectura del CSS, no por
render real — ver limitación de la sesión anterior, sigue aplicando):
área de contenido tras padding ≈ 255mm de alto. Sumando todos los elementos de
altura fija (logo achicado a 68pt, bandas, filas de datos, textos, firmas,
footer) da ≈159mm — deja ≈96mm de margen repartido entre los spacers flexibles
(11 unidades de peso en total, ≈8.7mm por unidad), bastante colchón incluso si
la estimación de métricas de fuente del navegador difiere un poco de la mía.
Antes de este ajuste el mismo cálculo con logo a 85pt y márgenes más generosos
ya cerraba en el papel (~269mm de área vs ~170mm de contenido fijo), lo que
refuerza que el desborde real venía del margen del driver de impresión, no de
la matemática del CSS en sí.

Además, para tener más margen de seguridad igual (no depender sólo de la
teoría del margen del driver): logo `85pt→68pt`, separación entre
Firma/Aclaración `18pt→12pt`, spacer previo al footer `flex:2→flex:1`.

**Líneas de firma removidas** (el PDF original sólo tiene el label, sin línea
— el espacio en blanco arriba del label es donde se firma a mano):
"Firma Titular/Familiar/Responsable/Tutor" perdió su línea a la derecha.
"Firma y Sello Responsable Institución" / "Sello Institución" ya no tenían
línea (estaban bien desde el fix anterior). Aclaración y DNI mantienen su
línea, como en el original.

**Formato de fecha**: "31 / Julio / 2026" → "31 / 07 / 2026" (mes numérico con
cero a la izquierda, `mesStr` en vez de `mesNombre`) en ambas secciones
(Tutor e Institución), consistente con el label "(DD/MM/YYYY)".

Sigue sin poder confirmarse imprimiendo de verdad en este entorno (sin
navegador headless) — falta que lo confirmes vos.

## Sesión de seguimiento — layout DJ ESC 07 (rama `fix/dj-esc107-layout`, sobre `main`)

La rama `fix/planillas-asistencia-dj07` ya está mergeada a `main` (ver más abajo,
sección original). Esta rama nueva parte de `main` y sólo toca
`src/app/dashboard/dj-esc107/page.tsx`.

### Causa raíz encontrada — bug de layout en impresión

`src/app/globals.css` tiene una regla `@media print` (líneas ~1020-1044) pensada
para varias plantillas de impresión a la vez (`.dj-page`, `.carta-page`,
`.carta-cambio`, `.print-area`):

```css
.dj-page, .carta-page, .carta-cambio, .print-area {
  display: block !important;
  ...
  overflow: visible !important;
  padding: 12mm 16mm !important;
  ...
}
```

`DjPage` (dj-esc107) está armada con `display:flex; flexDirection:column` y una
cadena de `<div style={{flex:'1 1 auto'}}/>` (algunos con peso 3) que reparten el
espacio vertical sobrante entre las secciones — así es como el footer de logos
queda anclado abajo y hay "aire" antes de cada firma. Esta regla global, al tener
`!important`, **pisa el `display:flex` inline y lo fuerza a `block`** en el
momento de imprimir (que es justo cuando se activa `@media print`). Con
`display:block`, los divs `flex:1 1 auto` dejan de tener efecto (la propiedad
`flex` no hace nada fuera de un contenedor flex) y colapsan a altura 0: todo el
contenido cae apilado en el ~60% superior de la hoja (que es exactamente lo
reportado), con el resto de los 297mm de la caja (la altura inline no se pisa)
vacío abajo.

Esto también explica por qué en pantalla (vista previa, sin imprimir) el layout
se ve bien: la regla rota sólo vive dentro de `@media print`, así que el bug es
invisible hasta que se imprime o exporta a PDF — coincide exactamente con lo que
reportaste ("Comparé la vista de impresión real... contra el PDF").

`overflow: visible !important` en la misma regla también reemplaza el
`overflow:hidden` inline. Si algún beneficiario en particular generara contenido
apenas más alto que 297mm (ej. un nombre muy largo que fuerza un salto de línea
en su recuadro), con `overflow:visible` ese excedente se desborda visualmente en
vez de recortarse — la hipótesis más plausible para las 2 hojas extra
(28 para 26 beneficiarios), aunque no pude confirmarlo imprimiendo de verdad (ver
limitación abajo).

### Fix aplicado — aislado, sin tocar el CSS global compartido

`globals.css` es compartido por `planilla-incluir` (misma clase `.dj-page`),
`cambio-transporte` y `presentacion-docs` (`.carta-page`/`.carta-cambio`/
`.print-area`). Modificar la regla global ahí arriesgaba romper esas otras
plantillas, así que en vez de tocar `globals.css` se agregó una clase propia
`dje107-page` sólo en este componente, con una regla de mayor especificidad
(`.dj-page.dje107-page`) dentro del `<style>` local de la página, que restaura
`display:flex`, `overflow:hidden` y el padding propio de la plantilla, sólo para
esta plantilla:

```css
.dj-page.dje107-page {
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  padding: 16mm 18mm 12mm 20mm !important;
}
```

Al usar dos clases (mayor especificidad que la regla global de una sola clase),
gana sin depender del orden de los `<style>` en el DOM. `planilla-incluir` y el
resto de las plantillas que usan `.dj-page`/`.carta-page`/`.print-area` **no se
tocaron y siguen exactamente igual**.

### Otros ajustes de diseño (para acercar al PDF de referencia)

- Logo header: `65pt` → `85pt` de alto (el PDF lo muestra notoriamente más
  grande que el resto del contenido).
- Recuadros MES/AÑO y APELLIDO Y NOMBRE/BENEFICIO Nro: más padding vertical
  (recuadros más altos) y un indent de `10pt` respecto del margen para esos
  campos (no para los títulos de sección/bandas, que quedan flush igual que en
  el PDF).
- Más aire entre Firma/Aclaración/DNI dentro de CONFORMIDAD TUTOR (`8pt` →
  `18pt` de separación) — el espaciado grande entre banda/fecha y firma ya lo
  daban los `flex:3` existentes, una vez restaurado el `display:flex`.
- Spacer previo al footer de logos con más peso (`flex:1`→`flex:2`) para que
  quede más pegado al pie de página, como en el PDF.
- Padding general de la hoja: `14mm 15mm 10mm 20mm` → `16mm 18mm 12mm 20mm`
  (un poco más generoso y simétrico, más parecido al PDF).

### Limitación — no pude verificar imprimiendo de verdad

No hay navegador headless (Chrome/Edge/Playwright/Puppeteer) disponible en este
entorno para renderizar la página, imprimir a PDF y contar hojas realmente. La
corrección de `display:flex`/`overflow:hidden` está verificada por lectura
exacta de la cascada CSS (confirmé qué regla gana y con qué especificidad,
no es una suposición visual), y el build de producción corre limpio, pero **no
pude confirmar de forma empírica que ahora salen exactamente 26 hojas para 26
beneficiarios, ni comparar pixel a pixel contra el PDF**. Te pido que lo
verifiques vos imprimiendo/exportando a PDF una vez desplegado, antes de
confiar en que quedó 100% resuelto. Si después de este fix siguen apareciendo
páginas de más, lo más probable es que sea por overflow real de contenido en
1-2 registros puntuales (nombres largos) más que por el bug de CSS — en ese
caso habría que revisar esos registros específicos.

---

## Estado de merge a main (chequeado con `git fetch` + `git log origin/main..origin/fix/...`)

**La rama NO está mergeada a `main`.** `git merge-base --is-ancestor` confirma que
`origin/fix/planillas-asistencia-dj07` no es ancestro de `origin/main`. Contiene 3
commits que main no tiene: `e1cc62d`, `6b67762`, `8d6dd09` (más los de esta sesión de
seguimiento). Si el deploy de Vercel está configurado para promocionar a producción
sólo la rama `main`, **esto explica por qué estos cambios no llegaron a producción**:
quedan como preview deploys de la rama hasta que alguien la mergee. No se mergeó
automáticamente — queda a la espera de tu revisión.

## Bug de nombres faltantes en DJ ESC 07 — ENCONTRADO Y CORREGIDO

Causa raíz confirmada comparando el flujo de datos de Planilla A/Asistencia vs DJ
ESC 07:

- `toArray()` (`src/lib/utils.ts`) prioriza la clave `filas` sobre `planillas` y
  `beneficiarios`. Ambos endpoints primarios (`/api/planillas/incluir` y
  `/api/planillas/dj107`) devuelven la data bajo `filas`, así que `toArray(d)` sí
  la extrae — mi diagnóstico previo de que "ambos caían siempre al fallback" era
  incorrecto para DJ ESC 07.
- **Planilla A / grilla** (`planilla-incluir/page.tsx`): su filtro
  `b.nroAfiliado || b['N° AFILIADO'] || b.nro_afiliado` no matchea el campo real
  que devuelve `/api/planillas/incluir` (que usa `afiliado`, sin ese casing), así
  que el filtro deja el array vacío y **sí** cae al fallback `/api/beneficiarios`.
  Ese fallback usa el campo real de Firestore `APELLIDO Y NOMBRE`, que el `normB`
  de esa página sí reconoce → por eso ahí el nombre siempre se vio bien.
- **DJ ESC 07** (`dj-esc107/page.tsx`): su filtro es `b.nroAfiliado || ...`, y el
  backend (`transitya-backend/routes/planillas.js:102`, endpoint `/dj107`) sí
  devuelve el campo `nroAfiliado` (camelCase) — el filtro matchea y el fetch
  primario **tiene éxito**, sin caer al fallback. Pero ese mismo endpoint devuelve
  el nombre bajo la clave `apellidoNombre` (línea 103 de `planillas.js`), y el
  `normB` de `dj-esc107/page.tsx` sólo buscaba `b.nombre`, `b['APELLIDO Y NOMBRE']`
  o `b.NOMBRE` — ninguno matchea `apellidoNombre`. Resultado: `nroAfiliado` se
  resuelve bien (por eso el número siempre apareció), pero `nombre` queda como
  `''` para todos los beneficiarios.

**Fix aplicado** (sólo en el lado de la plantilla, sin tocar el backend ni
renombrar ningún campo de Firestore): se agregó `b.apellidoNombre` a la cadena de
fallback de `normB` en `dj-esc107/page.tsx`:

```ts
nombre: String(b.nombre || b.apellidoNombre || b['APELLIDO Y NOMBRE'] || b.NOMBRE || ''),
```

Nota relacionada (no corregida, ver "Otro hallazgo" más abajo): el mismo tipo de
desajuste de nombres de campo existe en `/api/planillas/incluir` (usa `afiliado`
en vez de `nroAfiliado`/`N° AFILIADO`), pero ahí no rompe nada visible porque el
filtro falla y cae de forma transparente al fallback correcto. Se deja anotado
por si en el futuro se quiere que Planilla A también use los datos enriquecidos
(monto, obra social, estado) del endpoint `/incluir` en vez de depender siempre
del fallback — eso sí implicaría decidir si se ajusta el filtro/mapeo del
frontend o los nombres de campo del backend, por eso lo dejo para tu revisión en
vez de tocarlo ahora.

## Resumen ejecutivo

Ambas plantillas del pedido **ya existían en el código** al momento de este
diagnóstico. No se creó ninguna desde cero:

- **PLANILLA A** (grilla calendario, "Planilla Conformidad Efectiva Prestación
  Transporte") = [`src/app/dashboard/planilla-incluir/page.tsx`](src/app/dashboard/planilla-incluir/page.tsx),
  componente `PlanillaIncluir`. Ya actualizada en el commit `e1cc62d` ("nuevo
  template Planilla Asistencia Incluir — formato Control Diario 2026"), previo
  a esta sesión.
- **PLANILLA B** (formato simple sin grilla, "Planilla Conformidad Efectiva
  Prestación de Transporte") = [`src/app/dashboard/dj-esc107/page.tsx`](src/app/dashboard/dj-esc107/page.tsx),
  componente `DjPage`. **Esto es el commit pendiente "DJ ESC 07"** mencionado
  en el pedido original — el archivo tenía cambios sin commitear al empezar
  esta sesión (ver commit de esta rama para el detalle).

Se compararon ambos componentes contra los PDFs de referencia
(`docs/planillas-referencia/`) y coinciden en estructura, campos, textos fijos
y logos de footer. No fue necesario reescribir ninguna plantilla desde cero ni
tocar el motor de generación (sigue siendo HTML+CSS con `window.print()`, sin
librería de PDF).

## Qué se hizo en esta sesión

1. Se corrigió el nombre de la carpeta de referencia: se creó como
   `docsplanillas-referencia/` (sin barra) en vez de `docs/planillas-referencia/`
   — se movió a la ruta correcta.
2. Se commiteó el cambio pendiente de `dj-esc107/page.tsx` (Planilla B): quita
   el prefijo redundante "Beneficio Nro.: " en el valor (el label de la fila ya
   dice "BENEFICIO Nro") y pone el valor en negrita, más un `:` faltante en la
   segunda etiqueta "Fecha (DD/MM/YYYY)" para consistencia con la primera. Es
   un ajuste menor de terminado, no un cambio estructural.
3. No se tocó `planilla-incluir/page.tsx` (Planilla A) — ya coincide con el
   PDF de referencia (`Control_Diario_Asistencia_2026_-_FINAL.pdf`) en:
   header/logo, título, subtítulo, campos de datos, grilla de 7 columnas con
   sábados/domingos sombreados, bloque Referencias, bloque Presenta
   Anexo/Cantidad de Hojas, 3 firmas, footer de logos.

## Bug confirmado y NO corregido (queda pendiente, según instrucción explícita)

**Bug de 28 días — bloque Referencias/Anexo desaparece.**

En `planilla-incluir/page.tsx`, función `PlanillaIncluir`, el armado de filas
de la grilla es:

```ts
const rows: typeof dias[] = [];
let row: typeof dias = [];
dias.forEach(d => { row.push(d); if (row.length === 7) { rows.push(row); row = []; } });
if (row.length) rows.push(row);
```

Y luego el bloque de Referencias/Anexo sólo se renderiza si la última fila
quedó incompleta:

```ts
const remaining = 7 - row.length;
...
{isLast && remaining > 0 && ( /* Referencias + Anexo */ )}
```

Para meses de exactamente 28 días (febrero no bisiesto), 28 = 4 × 7: los días
llenan exactamente 4 filas completas de 7 columnas, `row` termina vacío tras el
último `push`, no se agrega ninguna fila incompleta, y `remaining` en la última
fila (que sí es una fila completa) es `0`. Como consecuencia, **la condición
`remaining > 0` nunca se cumple y todo el bloque de Referencias + Presenta
Anexo/Cantidad de Hojas desaparece de la planilla impresa** para ese mes.

Confirmado por cálculo (no se corrigió, según instrucción explícita del
pedido de dejarlo anotado para una sesión aparte). Una corrección futura
razonable: si `remaining === 0`, agregar una fila extra de 7 columnas sólo con
el bloque Referencias/Anexo (spans repartidos igual que el caso general), en
vez de depender de que la última fila de días quede incompleta.

## Otro hallazgo — NO corregido (fuera de alcance, contrato API front/back)

Los dos endpoints que consumen ambas páginas (`/api/planillas/incluir` y
`/api/planillas/dj107`, en `transitya-backend/routes/planillas.js`) **no
tienen relación con las planillas Incluir Salud que renderiza el frontend**:

- Devuelven la data bajo la clave `filas` (no `planillas` ni `beneficiarios`),
  por lo que el frontend (`toArray(d?.planillas ?? d?.beneficiarios ?? d)`)
  nunca matchea esa forma y siempre cae al fallback `/api/beneficiarios`.
- Conceptualmente son otra cosa: `/dj107` en el backend es la "declaración
  jurada DJ-107 estándar OSECAC/Obra Social" (agrupada por obra social), NO la
  planilla "DJ ESC 07" de transporte escolar de Incluir Salud que renderiza
  `dj-esc107/page.tsx`. Es una colisión de nombres, no el mismo feature.

Esto es un contrato de API entre frontend y backend — cae directamente en la
condición "PARÁ SI" del pedido original, así que **no se tocó**. En la
práctica no rompe nada visible porque ambas páginas ya tienen fallback
silencioso a `/api/beneficiarios` y funcionan con esos datos; sólo significa
que el enriquecimiento pensado (`monto`, `estado`, `obraSocial`, etc.) nunca
llega a usarse en estas dos pantallas. Si se quiere resolver, hay que decidir
si se renombra/ajusta el backend o el frontend — cambio de contrato, requiere
tu ok.

## Estado final

- Commit de Planilla B (DJ ESC 07) hecho y pusheado en esta rama.
- Carpeta de referencia reorganizada en `docs/planillas-referencia/`.
- Bug de 28 días: documentado arriba, pendiente para sesión aparte.
- Mismatch de contrato API planillas: documentado arriba, pendiente de tu
  decisión (PARÁ SI).
