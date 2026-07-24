# Notas — Planillas Incluir Salud (rama `fix/planillas-asistencia-dj07`)

Fecha diagnóstico: 2026-07-23 (actualizado en sesión de seguimiento, mismo día)

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
