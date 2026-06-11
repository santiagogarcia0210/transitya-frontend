# Transit·Ya — Gestión de Transporte Escolar/Empresarial

**Multi-tenant SaaS para gestionar choferes, rutas, asistencia, km, remitos y más.**

---

## 🏗️ Stack (NO sugerir cambios)

- **Frontend:** Google Apps Script (GAS) web app — HTML/CSS/JS servido como web app
- **Backend:** Google Apps Script (.gs files) — stateless, sin estado entre requests
- **Auth:** Firebase Authentication (email/contraseña + custom claims)
- **Database:** Cloud Firestore (multi-tenant por `tenantId`)
- **Deploy:** GAS Web App URL
- **Landing:** Next.js (transitya.com) — **siendo migrado progresivamente**

---

## 🔑 Firebase

```
Project ID: gestion-transporte-ef756
App ID: 1:894144256196:web:86185acf9b5d1ae7cd5191
Auth Domain: gestion-transporte-ef756.firebaseapp.com
```

---

## 🧪 Credenciales de prueba

| Rol | Email | Contraseña | Empresa |
|-----|-------|-----------|---------|
| Admin | `santiagogarcianyg07@gmail.com` | `Transit1205` | Transporte Flores |
| Chofer | `facundo@transporteflores.com` | `Transit1234` | Flores |
| Chofer | `dario@transporteflores.com` | `Transit1234` | Flores |
| Chofer | `angel@transporteflores.com` | `Transit1234` | Flores |
| Chofer | `bautista@transporteflores.com` | `Transit1234` | Flores |
| Admin prueba | `prueba@empresaprueba.com` | `Prueba123` | Empresa Prueba |

---

## 📊 Estructura Firestore

```
/empresas/{tenantId}/
  ├── usuarios/{uid}              ← perfiles de usuarios
  ├── registro/{id}               ← beneficiarios/alumnos
  ├── egresos/{id}                ← gastos (combustible, mantenimiento, etc.)
  ├── ingresos/{id}               ← ingresos
  ├── reportes/{id}               ← KM diarios
  ├── remitos/{id}                ← remitos/comprobantes
  ├── asistencia/{id}             ← asistencia de choferes
  ├── ubicaciones/{usuario}       ← GPS tiempo real
  ├── ubicaciones_hist/{id}       ← historial de ubicaciones
  ├── vencimientos/{id}           ← vencimientos (licencias, seguros, etc.)
  ├── horarios/{id}               ← horarios de ruta
  └── ...otras colecciones
```

---

## 📁 Archivos GAS principales

| Archivo | Función |
|---------|---------|
| `codigo.gs` | Funciones principales (login, contexto, campos) |
| `FIRESTORE.gs` | Capa de datos: `fsList`, `fsGet`, `fsSet`, `fsAdd`, `fsDelete` |
| `MIGRACION.gs` | Reemplaza funciones Sheets por Firestore |
| `USUARIOS_FIREBASE.gs` | Crear/actualizar usuarios en Firebase Auth |
| `MIGRACION_SHEETS.gs` | Migración de Sheets → Firestore |
| `index.html` | HTML principal |
| `JS.html` | JavaScript del frontend (7000+ líneas) |
| `CSS.html` | Estilos |
| `FIREBASE_CONFIG.html` | SDK Firebase (CDN compat) |
| `FIREBASE_AUTH.html` | Módulo auth Firebase |

---

## 🔐 Custom Claims Firebase

Cada usuario tiene en su token JWT:

```javascript
{
  tenantId: "Transporte Flores",  // nombre de la empresa
  rol: "admin" | "chofer" | "operador" | "superadmin"
}
```

---

## 🔄 Auth Flow

```
1. Frontend: fbAuth.signInWithEmailAndPassword(email, pass)
   ↓
2. Obtiene tokenResult.claims.tenantId y rol
   ↓
3. Lee perfil desde /empresas/{tenantId}/usuarios/{uid}
   ↓
4. Llama cargarContextoInicial() → GAS con APP_SESSION_TOKEN = uid
   ↓
5. GAS valida con obtenerSesionUsuario_(uid) → query group por UID
   ↓
6. GAS setea _setCurrentTenant_(auth.tenantId)
```

---

## 🔧 Problema crítico & Solución

### **Problema:** `_currentTenantId_` se pierde entre requests

GAS es **stateless**: cada request crea una instancia nueva, `_currentTenantId_` vuelve a `null`.

### **Solución acordada:**

En `obtenerSesionUsuario_()`, después de construir `auth`:

```javascript
if (auth.tenantId) _setCurrentTenant_(auth.tenantId);
return auth;
```

Esto garantiza que el tenant se setee automáticamente en todas las funciones sin modificar cada una individualmente.

---

## 📋 Script Properties GAS

```
FIREBASE_PROJECT_ID = gestion-transporte-ef756
FIREBASE_EMPRESA_ID = Transporte Flores          ← fallback, no usar en multiempresa
FIREBASE_SA = {...JSON cuenta de servicio...}
SISTEMA_INICIALIZADO = 1
FOLDER_ID_COMPROBANTES = {...}
FOLDER_ID_ODOMETRO = {...}
FOLDER_ID_REMITOS = {...}
```

---

## ✅ Estado actual

### Completado
- ✅ Login/logout Firebase Auth
- ✅ Multi-tenant: custom claims `tenantId` + `rol`
- ✅ Registro nueva empresa (VIEW_REGISTRO)
- ✅ Onboarding empresas nuevas
- ✅ Dashboard Transporte Flores completo
- ✅ ~1100 documentos migrados Sheets → Firestore
- ✅ Semáforo choferes con nombres correctos
- ✅ Ubicaciones tiempo real en el mapa
- ✅ Reglas de seguridad Firestore publicadas
- ✅ Índice Firestore para query `uid` en grupo de colecciones

### En progreso / Pendiente
- ❌ Multiempresa real: funciones `MIGRACION.gs` leen siempre "Transporte Flores"
- ❌ Integración MercadoPago para registro nuevas empresas
- ❌ Usuarios choferes automáticos para empresas nuevas
- ❌ CRUD completo (create/edit/delete) para todos los módulos

---

## 🎯 Patrones clave

### Multi-tenant obligatorio
Todas las funciones CRUD deben aceptar `_tenant` explícito:
```javascript
function fsGet(path, _tenant = _getCurrentTenant()) {
  const fullPath = `/empresas/${_tenant}${path}`;
  // ...
}
```

### Field casing fallback
Firestore tiene mixed-case: siempre usar fallback:
```javascript
const monto = (e.monto || e.MONTO || 0);
const fecha = (e.fecha || e.FECHA || null);
```

### Type-guard redirect pattern
En módulos print/documento, evitar loops:
```javascript
if (useEmpresaTipo && useEmpresaTipo !== "transporte_especial") {
  return <FallbackUI />;  // no redirigir si no está listo
}
```

### Superadmin separado
`superadmin: true` en claims → sin `tenantId` → llama `irASuperadminPuro()`.
No debe conflictuar con admin regular.

---

## 🚀 Preferencias de trabajo

1. **No sugerir migrar a otro stack** — GAS es intencional
2. **Cambios mínimos e incrementales**
3. **Verificar impacto en multiempresa** al tocar FIRESTORE.gs o codigo.gs
4. **Código debe funcionar con Firebase SDK compat** (no modular)
5. **Vercel autodeploys on `git push`** — sin deploy manual
6. **Firebase auth token attachment** vía axios interceptor + `onAuthStateChanged`

---

## 🛡️ Seguridad

> ⚠️ **NUNCA compartir en chat:**
> - Credenciales Firebase reales
> - Service Account keys
> - Tokens de API
> - Emails/datos de usuarios reales

> **Keys revocadas (NO usar):**
> - `72d0509c`, `ef4e138f`, `d497b13d` ← revoked

---

## 🔌 Herramientas & Recursos

- **Nominatim** — geocoding de direcciones
- **Anthropic Claude API** — análisis de fotos (egresos/remitos)
- **MercadoPago** — subscripciones (por integrar)
- **Capacitor** — Android APK (en `/transitya/`)
- **clasp** — Google Apps Script CLI
  - `.clasp.json` debe tener `"skipSubdirectories": true`

---

## 📖 Cómo trabajar en este proyecto

### Si estás en Claude Code (Codespaces):

1. **Lee este README (TRANSITYA.md)** como contexto general
2. **Especifica tu tarea** (qué querés diseñar/arreglar)
3. **Yo sugiero dirección** (arquitectura, UI, lógica)
4. **Validás** → aprobás o ajustas
5. **Codificamos** juntos

### Formato de request recomendado:

```
Necesito [característica/fix]:
- Contexto: [qué está pasando ahora]
- Problema: [qué no funciona]
- Goal: [qué querés lograr]
- Prioridad: [alta/media/baja]
```

---

## 🎨 UI/UX

Usa `ui-ux-pro-max` + `percepcion-visual-ui` para:
- Diseñar nuevas vistas (inspiradas en Mobbin)
- Refactor de UI existente
- Análisis de jerarquía visual
- Paletas de color, tipografía, spacing

---

## 📚 Referencias externas

- **Firebase Docs:** https://firebase.google.com/docs
- **GAS Docs:** https://developers.google.com/apps-script
- **Firestore Queries:** https://firebase.google.com/docs/firestore/query-data/queries
- **Firebase Auth:** https://firebase.google.com/docs/auth

---

## 🤝 Repositorios

- **GAS Legacy:** `C:\Users\Majo_\transit-ya` (GitHub: `santiagogarcia0210/transit-ya`)
- **Frontend Next.js:** `C:\Users\Majo_\transitya-frontend` (GitHub: `santiagogarcia0210/transitya-frontend`)
- **Backend Node.js:** `C:\Users\Majo_\transitya-backend` (GitHub: `santiagogarcia0210/transitya-backend`)

---

**Last updated:** Junio 2026  
**Status:** 🔄 Migrando GAS → Next.js + Node.js (gradual)  
**Developer:** Garza
