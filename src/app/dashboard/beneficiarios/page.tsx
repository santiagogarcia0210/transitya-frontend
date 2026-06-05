'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

/* ── Tipo idéntico al GAS ben_guardarBeneficiario ───────────────────────── */
interface Beneficiario {
  id: string;
  nombre: string; apellido: string; dni: string;
  domicilio: string; barrio: string; zona: string;
  telefono: string; telefonoEmerg: string; contactoEmerg: string;
  obraSocial: string; nroAfiliado: string;
  horarioTurno: string; condicion: string; observaciones: string;
  lat?: string; lng?: string; activo?: boolean;
}

interface FormState {
  id: string;
  nombre: string; apellido: string; dni: string;
  domicilio: string; barrio: string; zona: string;
  telefono: string; telefonoEmerg: string; contactoEmerg: string;
  obraSocial: string; nroAfiliado: string;
  horarioTurno: string; condicion: string; observaciones: string;
}

/* Normaliza los datos del backend (mayúsculas GAS legacy + camelCase nuevo) */
function normB(b: Record<string, unknown>): Beneficiario {
  const nombre = String(b.nombre || b['APELLIDO Y NOMBRE'] || b.NOMBRE || '');
  // Si el campo nombre trae "Apellido Nombre" completo (legacy) no duplicar apellido
  return {
    id:           String(b.id          || b['ID'] || ''),
    nombre:       nombre,
    apellido:     String(b.apellido    || ''),
    dni:          String(b.dni         || b.DNI  || ''),
    domicilio:    String(b.domicilio   || b.DOMICILIO || ''),
    barrio:       String(b.barrio      || b.BARRIO || ''),
    zona:         String(b.zona        || b.ZONA  || ''),
    telefono:     String(b.telefono    || b.TELEFONO || b.TEL || ''),
    telefonoEmerg:String(b.telefonoEmerg || b.TEL_EMERG || ''),
    contactoEmerg:String(b.contactoEmerg || b.CONTACTO_EMERG || ''),
    obraSocial:   String(b.obraSocial  || b['OBRA SOCIAL'] || b.OBRASOCIAL || ''),
    nroAfiliado:  String(b.nroAfiliado || b['N° AFILIADO'] || b.NRO_AFILIADO || ''),
    horarioTurno: String(b.horarioTurno || b.HORARIO_TURNO || b['HORARIO TURNO'] || ''),
    condicion:    String(b.condicion   || b.CONDICION || ''),
    observaciones:String(b.observaciones || b.OBSERVACIONES || ''),
    lat:          b.lat   ? String(b.lat)   : b.LAT   ? String(b.LAT)   : '',
    lng:          b.lng   ? String(b.lng)   : b.LNG   ? String(b.LNG)   : '',
    activo:       b.activo !== false,
  };
}

/* Nombre visible en la lista: preferir apellido+nombre o solo nombre */
function fullName(b: Beneficiario): string {
  if (b.apellido) return `${b.apellido}, ${b.nombre}`.trim();
  return b.nombre;
}

/* ── Constantes UI ──────────────────────────────────────────────────────── */
const L: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};
const PER_PAGE = 20;

const EMPTY_FORM: Omit<FormState, 'id'> = {
  nombre:'', apellido:'', dni:'',
  domicilio:'', barrio:'', zona:'',
  telefono:'', telefonoEmerg:'', contactoEmerg:'',
  obraSocial:'', nroAfiliado:'',
  horarioTurno:'', condicion:'', observaciones:'',
};

/* ═══════════════════════════════════════════════════════════════════════ */

export default function BeneficiariosPage() {
  const [lista,          setLista]          = useState<Beneficiario[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [busqueda,       setBusqueda]       = useState('');
  const [filtroBarrio,   setFiltroBarrio]   = useState('');
  const [pagina,         setPagina]         = useState(1);
  const [showModal,      setShowModal]      = useState(false);
  const [form,           setForm]           = useState<FormState>({ id:'', ...EMPTY_FORM });
  const [saving,         setSaving]         = useState(false);
  const [confirmBaja,    setConfirmBaja]    = useState<Beneficiario|null>(null);
  const [bajaNota,       setBajaNota]       = useState('');
  const [msg,            setMsg]            = useState<{text:string;ok:boolean}|null>(null);
  const [msgBaja,        setMsgBaja]        = useState<{text:string;ok:boolean}|null>(null);

  /* ── Carga ─────────────────────────────────────────────────────────── */
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/beneficiarios');
      const raw = toArray(r.data)
        .map(serializarFirestore)
        .map(normB)
        .filter(b => b.activo !== false)
        .sort((a, b) => fullName(a).localeCompare(fullName(b), 'es'));
      setLista(raw);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /* ── Filtrado y paginación ─────────────────────────────────────────── */
  const barrios = [...new Set(lista.map(b => b.barrio).filter(Boolean))].sort();

  const filtrados = lista.filter(b => {
    const q = busqueda.toLowerCase();
    if (q && !fullName(b).toLowerCase().includes(q) &&
             !b.dni.includes(q) &&
             !b.barrio.toLowerCase().includes(q) &&
             !b.zona.toLowerCase().includes(q)) return false;
    if (filtroBarrio && b.barrio !== filtroBarrio) return false;
    return true;
  });

  const totalPags  = Math.max(1, Math.ceil(filtrados.length / PER_PAGE));
  const paginados  = filtrados.slice((pagina - 1) * PER_PAGE, pagina * PER_PAGE);

  useEffect(() => { setPagina(1); }, [busqueda, filtroBarrio]);

  /* ── Helpers form ──────────────────────────────────────────────────── */
  type FKey = keyof Omit<FormState, 'id'>;
  const setF = (k: FKey) =>
    (ev: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const abrirNuevo = () => {
    setForm({ id: '', ...EMPTY_FORM });
    setMsg(null); setShowModal(true);
  };

  const abrirEdicion = (b: Beneficiario) => {
    setForm({
      id: b.id,
      nombre: b.nombre, apellido: b.apellido, dni: b.dni,
      domicilio: b.domicilio, barrio: b.barrio, zona: b.zona,
      telefono: b.telefono, telefonoEmerg: b.telefonoEmerg, contactoEmerg: b.contactoEmerg,
      obraSocial: b.obraSocial, nroAfiliado: b.nroAfiliado,
      horarioTurno: b.horarioTurno, condicion: b.condicion, observaciones: b.observaciones,
    });
    setMsg(null); setShowModal(true);
  };

  const cerrar = () => { setShowModal(false); setMsg(null); };

  /* ── Guardar (idéntico al GAS ben_guardarBeneficiario) ─────────────── */
  const guardar = async () => {
    if (!form.nombre && !form.apellido) {
      setMsg({ text: 'Nombre o apellido son obligatorios.', ok: false }); return;
    }
    setSaving(true); setMsg(null);
    try {
      // Enviar con los mismos campos del GAS + compat uppercase para backend legacy
      const payload = {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni: form.dni.trim(),
        domicilio: form.domicilio.trim(),
        barrio: form.barrio.trim(),
        zona: form.zona.trim(),
        telefono: form.telefono.trim(),
        telefonoEmerg: form.telefonoEmerg.trim(),
        contactoEmerg: form.contactoEmerg.trim(),
        obraSocial: form.obraSocial.trim(),
        nroAfiliado: form.nroAfiliado.trim(),
        horarioTurno: form.horarioTurno.trim(),
        condicion: form.condicion.trim(),
        observaciones: form.observaciones.trim(),
        // Alias uppercase para compat con backend que lee 'APELLIDO Y NOMBRE'
        'APELLIDO Y NOMBRE': `${form.apellido} ${form.nombre}`.trim(),
        NOMBRE: form.nombre.trim(),
        DNI: form.dni.trim(),
        activo: true,
      };

      if (form.id) {
        await api.put(`/api/beneficiarios/${form.id}`, payload);
      } else {
        await api.post('/api/beneficiarios', payload);
      }
      cerrar(); cargar();
    } catch { setMsg({ text: 'Error al guardar. Intentá de nuevo.', ok: false }); }
    setSaving(false);
  };

  /* ── Baja (soft delete, idéntico al GAS ben_eliminarBeneficiario) ──── */
  const darDeBaja = async () => {
    if (!confirmBaja) return;
    setSaving(true); setMsgBaja(null);
    try {
      await api.post('/api/beneficiarios/baja', {
        id: confirmBaja.id,
        nombre: fullName(confirmBaja),
        observaciones: bajaNota || 'Baja manual desde sistema',
      });
      setConfirmBaja(null); setBajaNota('');
      cargar();
    } catch { setMsgBaja({ text: 'Error al dar de baja.', ok: false }); }
    setSaving(false);
  };

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">👤 Beneficiarios</h2>
          <p style={{ fontSize:'.82rem', color:'var(--text3)', marginTop:'.2rem' }}>
            {filtrados.length} de {lista.length} registros
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo</button>
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        <input className="input" style={{ minWidth:180 }}
          placeholder="Buscar por nombre, DNI, barrio…"
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        {barrios.length > 0 && (
          <select className="select" style={{ minWidth:140, maxWidth:200 }}
            value={filtroBarrio} onChange={e => setFiltroBarrio(e.target.value)}>
            <option value="">Todos los barrios</option>
            {barrios.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        {(busqueda || filtroBarrio) && (
          <button className="btn btn-secondary btn-sm"
            onClick={() => { setBusqueda(''); setFiltroBarrio(''); }}>✕ Limpiar</button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem 0' }}>
          <span className="spinner"/> Cargando beneficiarios…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <p>{busqueda || filtroBarrio ? 'Sin resultados para esa búsqueda' : 'Sin beneficiarios registrados'}</p>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
            {paginados.map(b => (
              <div key={b.id} className="result-item"
                style={{ cursor:'pointer' }}
                onClick={() => abrirEdicion(b)}>
                <div className="result-body">
                  <div className="result-name">{fullName(b)}</div>
                  <div className="result-meta">
                    {b.dni        && <span>DNI: <b>{b.dni}</b></span>}
                    {b.nroAfiliado&& <span>Afil: <b>{b.nroAfiliado}</b></span>}
                    {b.obraSocial && <span>{b.obraSocial}</span>}
                    {b.barrio     && <span>📍 {b.barrio}{b.zona ? ` · ${b.zona}` : ''}</span>}
                    {b.horarioTurno && <span>🕐 {b.horarioTurno}</span>}
                    {b.condicion  && <span className="badge badge-blue" style={{ fontSize:'.68rem' }}>{b.condicion}</span>}
                  </div>
                </div>
                <div className="result-actions">
                  {confirmBaja?.id === b.id ? (
                    <div style={{ display:'flex', gap:'.4rem' }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-danger btn-sm" onClick={darDeBaja} disabled={saving}>Dar de baja</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setConfirmBaja(null); setBajaNota(''); }}>Cancelar</button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary btn-sm"
                      onClick={e => { e.stopPropagation(); setConfirmBaja(b); setBajaNota(''); }}>
                      Dar de baja
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {totalPags > 1 && (
            <div className="pagination">
              <button disabled={pagina===1} onClick={() => setPagina(1)}>«</button>
              <button disabled={pagina===1} onClick={() => setPagina(p=>p-1)}>‹</button>
              {Array.from({ length: totalPags }, (_,i) => i+1)
                .filter(p => Math.abs(p - pagina) <= 2)
                .map(p => (
                  <button key={p} className={p===pagina?'active':''} onClick={() => setPagina(p)}>{p}</button>
                ))}
              <button disabled={pagina===totalPags} onClick={() => setPagina(p=>p+1)}>›</button>
              <button disabled={pagina===totalPags} onClick={() => setPagina(totalPags)}>»</button>
            </div>
          )}
        </>
      )}

      {/* Modal dar de baja — confirmación con nota */}
      {confirmBaja && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:60, padding:'1rem' }}
          onClick={e => { if (e.target === e.currentTarget) { setConfirmBaja(null); setBajaNota(''); } }}>
          <div className="card" style={{ width:'100%', maxWidth:420, padding:'1.5rem' }}>
            <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)', marginBottom:'1rem' }}>
              🗑 Dar de baja: {fullName(confirmBaja)}
            </h3>
            <p style={{ fontSize:'.85rem', color:'var(--text3)', marginBottom:'1rem' }}>
              El beneficiario pasará a la lista de bajas (soft delete). No se elimina permanentemente.
            </p>
            <div style={{ marginBottom:'.85rem' }}>
              <label style={L}>Motivo / observaciones (opcional)</label>
              <textarea className="input" style={{ minHeight:64, resize:'vertical' }}
                placeholder="Ej: Alta propia, fallecimiento, cambio de prestador…"
                value={bajaNota} onChange={e => setBajaNota(e.target.value)} />
            </div>
            {msgBaja && <p style={{ fontSize:'.82rem', color:'var(--red)', marginBottom:'.5rem' }}>{msgBaja.text}</p>}
            <div style={{ display:'flex', gap:'.75rem' }}>
              <button className="btn btn-secondary" style={{ flex:1 }}
                onClick={() => { setConfirmBaja(null); setBajaNota(''); }}>Cancelar</button>
              <button className="btn btn-danger" style={{ flex:1 }}
                onClick={darDeBaja} disabled={saving}>
                {saving ? <><span className="spinner" style={{width:12,height:12}}/> Procesando…</> : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal alta / edición */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:50, padding:'1rem' }}
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}>
          <div className="card" style={{ width:'100%', maxWidth:560, maxHeight:'92vh', overflowY:'auto', padding:'1.5rem' }}>
            <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)', marginBottom:'1.25rem' }}>
              {form.id ? '✏️ Editar beneficiario' : '+ Nuevo beneficiario'}
            </h3>

            <div className="form-grid">
              {/* Nombre / Apellido */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>Apellido</label>
                  <input className="input" placeholder="Apellido" value={form.apellido} onChange={setF('apellido')} />
                </div>
                <div>
                  <label style={L}>Nombre *</label>
                  <input className="input" placeholder="Nombre" value={form.nombre} onChange={setF('nombre')} />
                </div>
              </div>

              {/* DNI / N° Afiliado */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>DNI</label>
                  <input className="input" placeholder="12345678" value={form.dni} onChange={setF('dni')} />
                </div>
                <div>
                  <label style={L}>N° Afiliado</label>
                  <input className="input" placeholder="00000000" value={form.nroAfiliado} onChange={setF('nroAfiliado')} />
                </div>
              </div>

              {/* Domicilio */}
              <div>
                <label style={L}>Domicilio</label>
                <input className="input" placeholder="Calle 123, Dpto 4" value={form.domicilio} onChange={setF('domicilio')} />
              </div>

              {/* Barrio / Zona */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>Barrio</label>
                  <input className="input" placeholder="Barrio Sur" value={form.barrio} onChange={setF('barrio')} />
                </div>
                <div>
                  <label style={L}>Zona</label>
                  <input className="input" placeholder="Zona norte" value={form.zona} onChange={setF('zona')} />
                </div>
              </div>

              {/* Teléfonos */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>Teléfono</label>
                  <input className="input" placeholder="3812345678" value={form.telefono} onChange={setF('telefono')} />
                </div>
                <div>
                  <label style={L}>Tel. emergencia</label>
                  <input className="input" placeholder="3819876543" value={form.telefonoEmerg} onChange={setF('telefonoEmerg')} />
                </div>
              </div>

              {/* Contacto emergencia */}
              <div>
                <label style={L}>Contacto de emergencia</label>
                <input className="input" placeholder="Ej: Madre - María 381…" value={form.contactoEmerg} onChange={setF('contactoEmerg')} />
              </div>

              {/* Obra Social */}
              <div className="form-grid form-grid-2">
                <div>
                  <label style={L}>Obra social</label>
                  <input className="input" placeholder="Ej: IOMA" value={form.obraSocial} onChange={setF('obraSocial')} />
                </div>
                <div>
                  <label style={L}>Horario de turno</label>
                  <input className="input" placeholder="08:00 – 10:00" value={form.horarioTurno} onChange={setF('horarioTurno')} />
                </div>
              </div>

              {/* Condición / Observaciones */}
              <div>
                <label style={L}>Condición especial</label>
                <input className="input" placeholder="Ej: Silla de ruedas, silla de traslado…" value={form.condicion} onChange={setF('condicion')} />
              </div>
              <div>
                <label style={L}>Observaciones</label>
                <textarea className="input" style={{ minHeight:60, resize:'vertical' }}
                  placeholder="Notas, indicaciones especiales…"
                  value={form.observaciones}
                  onChange={setF('observaciones')} />
              </div>
            </div>

            {msg && <p style={{ fontSize:'.82rem', color:msg.ok?'var(--green)':'var(--red)', marginTop:'.75rem' }}>{msg.text}</p>}

            <div style={{ display:'flex', gap:'.75rem', marginTop:'1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={guardar} disabled={saving}>
                {saving ? <><span className="spinner" style={{width:12,height:12}}/> Guardando…</> : form.id ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
