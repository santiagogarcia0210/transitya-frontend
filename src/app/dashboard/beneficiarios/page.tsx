'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

type TabReg = 'alta' | 'baja' | 'ver' | 'fs';

interface Beneficiario {
  id: string;
  nombre: string; apellido: string; dni: string;
  domicilio: string; localidad: string; barrio: string; zona: string;
  telefono: string; telefonoEmerg: string; contactoEmerg: string;
  obraSocial: string; nroAfiliado: string;
  horarioTurno: string; condicion: string; observaciones: string;
  chofer: string;
  activo?: boolean;
}

interface FormState {
  id: string;
  nombre: string; apellido: string; dni: string;
  domicilio: string; localidad: string; barrio: string; zona: string;
  telefono: string; telefonoEmerg: string; contactoEmerg: string;
  obraSocial: string; nroAfiliado: string;
  horarioTurno: string; condicion: string; observaciones: string;
  chofer: string;
}

function normB(b: Record<string, unknown>): Beneficiario {
  return {
    id:           String(b.id          || b['ID'] || ''),
    nombre:       String(b.nombre      || b['APELLIDO Y NOMBRE'] || b.NOMBRE || ''),
    apellido:     String(b.apellido    || ''),
    dni:          String(b.dni         || b.DNI   || ''),
    domicilio:    String(b.domicilio   || b.DOMICILIO || ''),
    localidad:    String(b.localidad   || b.LOCALIDAD || ''),
    barrio:       String(b.barrio      || b.BARRIO || ''),
    zona:         String(b.zona        || b.ZONA  || ''),
    telefono:     String(b.telefono    || b.TELEFONO || b.TEL || ''),
    telefonoEmerg:String(b.telefonoEmerg || b.TEL_EMERG || b.TEL_EMERGENCIA || ''),
    contactoEmerg:String(b.contactoEmerg || b.CONTACTO_EMERG || b.CONTACTO_EMERGENCIA || ''),
    obraSocial:   String(b.obraSocial  || b['OBRA SOCIAL'] || b.OBRASOCIAL || ''),
    nroAfiliado:  String(b.nroAfiliado || b['N° AFILIADO'] || b.NRO_AFILIADO || ''),
    horarioTurno: String(b.horarioTurno || b.HORARIO_TURNO || b['HORARIO TURNO'] || ''),
    condicion:    String(b.condicion   || b.CONDICION || b.CONDICION_ESPECIAL || ''),
    observaciones:String(b.observaciones || b.OBSERVACIONES || ''),
    chofer:       String(b.chofer      || b.CHOFER || ''),
    activo:       b.activo !== false,
  };
}

function fullName(b: Beneficiario): string {
  if (b.apellido) return `${b.apellido}, ${b.nombre}`.trim();
  return b.nombre;
}

const L: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};
const PER_PAGE = 20;

const EMPTY_FORM: FormState = {
  id:'', nombre:'', apellido:'', dni:'',
  domicilio:'', localidad:'', barrio:'', zona:'',
  telefono:'', telefonoEmerg:'', contactoEmerg:'',
  obraSocial:'', nroAfiliado:'',
  horarioTurno:'', condicion:'', observaciones:'',
  chofer:'',
};

export default function BeneficiariosPage() {
  const [tab,            setTab]            = useState<TabReg>('alta');
  const [lista,          setLista]          = useState<Beneficiario[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [choferes,       setChoferes]       = useState<string[]>([]);

  /* ── Tab Alta ── */
  const [form,           setForm]           = useState<FormState>(EMPTY_FORM);
  const [saving,         setSaving]         = useState(false);
  const [msgAlta,        setMsgAlta]        = useState<{text:string;ok:boolean}|null>(null);

  /* ── Tab Baja ── */
  const [bajaBusq,       setBajaBusq]       = useState('');
  const [bajaResult,     setBajaResult]     = useState<Beneficiario[]>([]);
  const [buscandoBaja,   setBuscandoBaja]   = useState(false);
  const [confirmBaja,    setConfirmBaja]    = useState<Beneficiario|null>(null);
  const [bajaNota,       setBajaNota]       = useState('');
  const [msgBaja,        setMsgBaja]        = useState<{text:string;ok:boolean}|null>(null);
  const [savingBaja,     setSavingBaja]     = useState(false);

  /* ── Tab Ver ── */
  const [busqueda,       setBusqueda]       = useState('');
  const [filtroBarrio,   setFiltroBarrio]   = useState('');
  const [pagina,         setPagina]         = useState(1);
  const [editando,       setEditando]       = useState<Beneficiario|null>(null);
  const [msgEdit,        setMsgEdit]        = useState<{text:string;ok:boolean}|null>(null);
  const [savingEdit,     setSavingEdit]     = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rBen, rChof] = await Promise.all([
        api.get('/api/beneficiarios'),
        api.get('/api/usuarios'),
      ]);
      const raw = toArray(rBen.data)
        .map(serializarFirestore)
        .map(normB)
        .filter(b => b.activo !== false)
        .sort((a, b) => fullName(a).localeCompare(fullName(b), 'es'));
      setLista(raw);
      const nombresChof = toArray(rChof.data)
        .map((u: Record<string,unknown>) => String(u.nombre || u.NOMBRE || ''))
        .filter(Boolean).sort();
      setChoferes(nombresChof);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const barrios = [...new Set(lista.map(b => b.barrio).filter(Boolean))].sort();

  /* ─── Tab Alta: guardar ─── */
  type FKey = keyof Omit<FormState,'id'>;
  const setF = (k: FKey) =>
    (ev: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const guardarAlta = async () => {
    if (!form.nombre && !form.apellido) {
      setMsgAlta({ text: 'Apellido y Nombre son obligatorios.', ok: false }); return;
    }
    if (!form.dni) { setMsgAlta({ text: 'DNI es obligatorio.', ok: false }); return; }
    setSaving(true); setMsgAlta(null);
    try {
      const payload = {
        ...form,
        'APELLIDO Y NOMBRE': `${form.apellido} ${form.nombre}`.trim(),
        NOMBRE: form.nombre.trim(),
        DNI: form.dni.trim(),
        LOCALIDAD: form.localidad.trim(),
        DOMICILIO: form.domicilio.trim(),
        BARRIO: form.barrio.trim(),
        ZONA: form.zona.trim(),
        TELEFONO: form.telefono.trim(),
        TEL_EMERGENCIA: form.telefonoEmerg.trim(),
        CONTACTO_EMERGENCIA: form.contactoEmerg.trim(),
        'OBRA SOCIAL': form.obraSocial.trim(),
        'N° AFILIADO': form.nroAfiliado.trim(),
        HORARIO_TURNO: form.horarioTurno.trim(),
        CONDICION_ESPECIAL: form.condicion.trim(),
        OBSERVACIONES: form.observaciones.trim(),
        CHOFER: form.chofer.trim(),
        activo: true,
      };
      if (form.id) {
        await api.put(`/api/beneficiarios/${form.id}`, payload);
        setMsgAlta({ text: '✅ Beneficiario actualizado.', ok: true });
      } else {
        await api.post('/api/beneficiarios', payload);
        setMsgAlta({ text: '✅ Alta guardada.', ok: true });
        setForm(EMPTY_FORM);
      }
      cargar();
    } catch { setMsgAlta({ text: 'Error al guardar. Intentá de nuevo.', ok: false }); }
    setSaving(false);
  };

  /* ─── Tab Baja: buscar ─── */
  const buscarParaBaja = () => {
    if (!bajaBusq.trim()) { setBajaResult(lista); return; }
    const q = bajaBusq.toLowerCase();
    setBajaResult(lista.filter(b =>
      fullName(b).toLowerCase().includes(q) ||
      b.dni.includes(q) ||
      b.nroAfiliado.includes(q)
    ));
    setBuscandoBaja(false);
  };

  const darDeBaja = async () => {
    if (!confirmBaja) return;
    setSavingBaja(true); setMsgBaja(null);
    try {
      await api.post('/api/beneficiarios/baja', {
        id: confirmBaja.id,
        nombre: fullName(confirmBaja),
        observaciones: bajaNota || 'Baja manual desde sistema',
      });
      setMsgBaja({ text: `✅ ${fullName(confirmBaja)} dado de baja correctamente.`, ok: true });
      setConfirmBaja(null); setBajaNota('');
      setBajaResult(r => r.filter(b => b.id !== confirmBaja.id));
      cargar();
    } catch { setMsgBaja({ text: 'Error al dar de baja.', ok: false }); }
    setSavingBaja(false);
  };

  /* ─── Tab Ver: filtros + paginación ─── */
  const filtrados = lista.filter(b => {
    const q = busqueda.toLowerCase();
    if (q && !fullName(b).toLowerCase().includes(q) &&
             !b.dni.includes(q) && !b.barrio.toLowerCase().includes(q) &&
             !b.zona.toLowerCase().includes(q) && !b.localidad.toLowerCase().includes(q)) return false;
    if (filtroBarrio && b.barrio !== filtroBarrio) return false;
    return true;
  });
  const totalPags = Math.max(1, Math.ceil(filtrados.length / PER_PAGE));
  const paginados = filtrados.slice((pagina - 1) * PER_PAGE, pagina * PER_PAGE);
  useEffect(() => { setPagina(1); }, [busqueda, filtroBarrio]);

  /* ─── Tab Ver: edición inline ─── */
  const abrirEdicion = (b: Beneficiario) => {
    setForm({
      id: b.id, nombre: b.nombre, apellido: b.apellido, dni: b.dni,
      domicilio: b.domicilio, localidad: b.localidad, barrio: b.barrio, zona: b.zona,
      telefono: b.telefono, telefonoEmerg: b.telefonoEmerg, contactoEmerg: b.contactoEmerg,
      obraSocial: b.obraSocial, nroAfiliado: b.nroAfiliado,
      horarioTurno: b.horarioTurno, condicion: b.condicion, observaciones: b.observaciones,
      chofer: b.chofer,
    });
    setEditando(b); setMsgEdit(null);
    setTab('alta');
  };

  const guardarEdit = async () => {
    if (!editando) return;
    setSavingEdit(true); setMsgEdit(null);
    try {
      const payload = {
        ...form,
        'APELLIDO Y NOMBRE': `${form.apellido} ${form.nombre}`.trim(),
        NOMBRE: form.nombre.trim(),
        DNI: form.dni.trim(),
        LOCALIDAD: form.localidad.trim(),
        DOMICILIO: form.domicilio.trim(),
        CHOFER: form.chofer.trim(),
        activo: true,
      };
      await api.put(`/api/beneficiarios/${editando.id}`, payload);
      setMsgEdit({ text: '✅ Actualizado.', ok: true });
      setEditando(null); setForm(EMPTY_FORM); cargar();
    } catch { setMsgEdit({ text: 'Error al actualizar.', ok: false }); }
    setSavingEdit(false);
  };

  /* ─── Shared: inline form ─── */
  const InlineForm = ({ isEdit }: { isEdit?: boolean }) => (
    <div className="card">
      <div className="card-title">{isEdit ? `✏️ Editando: ${fullName(editando!)}` : 'Datos del beneficiario'}</div>
      <div className="form-grid">
        <div className="form-grid form-grid-2">
          <div><label style={L}>Apellido *</label>
            <input className="input" placeholder="García" value={form.apellido} onChange={setF('apellido')} /></div>
          <div><label style={L}>Nombre *</label>
            <input className="input" placeholder="Juan" value={form.nombre} onChange={setF('nombre')} /></div>
        </div>
        <div className="form-grid form-grid-2">
          <div><label style={L}>DNI *</label>
            <input className="input" placeholder="30123456" value={form.dni} onChange={setF('dni')} /></div>
          <div><label style={L}>N° Afiliado</label>
            <input className="input" placeholder="00000000" value={form.nroAfiliado} onChange={setF('nroAfiliado')} /></div>
        </div>
        <div><label style={L}>Domicilio</label>
          <input className="input" placeholder="Calle 123, Dpto 4" value={form.domicilio} onChange={setF('domicilio')} /></div>
        <div className="form-grid form-grid-2">
          <div><label style={L}>Localidad</label>
            <input className="input" placeholder="Tucumán Capital" value={form.localidad} onChange={setF('localidad')} /></div>
          <div><label style={L}>Barrio / Zona</label>
            <input className="input" placeholder="Bella Vista" value={form.barrio} onChange={setF('barrio')} /></div>
        </div>
        <div className="form-grid form-grid-2">
          <div><label style={L}>Obra social</label>
            <input className="input" placeholder="IOMA, OSDE…" value={form.obraSocial} onChange={setF('obraSocial')} /></div>
          <div><label style={L}>Horario de turno médico</label>
            <input className="input" placeholder="08:00" value={form.horarioTurno} onChange={setF('horarioTurno')} /></div>
        </div>
        <div className="form-grid form-grid-2">
          <div><label style={L}>Teléfono</label>
            <input className="input" placeholder="3812345678" value={form.telefono} onChange={setF('telefono')} /></div>
          <div><label style={L}>Chofer asignado</label>
            {choferes.length > 0
              ? <select className="select" value={form.chofer} onChange={setF('chofer')}>
                  <option value="">Sin asignar</option>
                  {choferes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              : <input className="input" placeholder="Nombre chofer" value={form.chofer} onChange={setF('chofer')} />
            }
          </div>
        </div>

        {/* Datos de emergencia */}
        <div style={{ borderTop:'1px solid var(--border)', margin:'4px 0 4px', paddingTop:12 }}>
          <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--text2)', marginBottom:8,
            textTransform:'uppercase', letterSpacing:'.06em' }}>🆘 Datos de emergencia</div>
          <div className="form-grid form-grid-2">
            <div><label style={L}>Condición especial</label>
              <input className="input" placeholder="Silla de ruedas, epilepsia…" value={form.condicion} onChange={setF('condicion')} /></div>
            <div><label style={L}>Contacto emergencia</label>
              <input className="input" placeholder="Mamá, Papá…" value={form.contactoEmerg} onChange={setF('contactoEmerg')} /></div>
          </div>
          <div style={{ marginTop:8 }}>
            <label style={L}>Tel. emergencia</label>
            <input className="input" placeholder="381-555-1234" value={form.telefonoEmerg} onChange={setF('telefonoEmerg')} />
          </div>
        </div>

        <div><label style={L}>Observaciones</label>
          <textarea className="input" style={{ minHeight:60, resize:'vertical' }}
            placeholder="Notas, indicaciones especiales…"
            value={form.observaciones} onChange={setF('observaciones')} /></div>
      </div>

      {(isEdit ? msgEdit : msgAlta) && (
        <p style={{ fontSize:'.82rem', marginTop:'.75rem',
          color: (isEdit ? msgEdit : msgAlta)?.ok ? 'var(--green)' : 'var(--red)' }}>
          {(isEdit ? msgEdit : msgAlta)?.text}
        </p>
      )}

      <div className="btn-row" style={{ marginTop:'1.25rem' }}>
        {isEdit && (
          <button className="btn btn-secondary"
            onClick={() => { setEditando(null); setForm(EMPTY_FORM); setMsgEdit(null); }}>
            Cancelar
          </button>
        )}
        <button className="btn btn-primary"
          onClick={isEdit ? guardarEdit : guardarAlta}
          disabled={isEdit ? savingEdit : saving}>
          {(isEdit ? savingEdit : saving)
            ? <><span className="spinner" style={{width:12,height:12}}/> Guardando…</>
            : isEdit ? 'Actualizar' : '✓ Guardar alta'}
        </button>
        {!isEdit && (
          <button className="btn btn-secondary" onClick={() => setForm(EMPTY_FORM)}>Limpiar</button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-icon blue">👤</div>
        </div>
        <div style={{ flex:1 }}>
          <div className="section-title">Beneficiarios</div>
          <div className="section-sub">Alta, baja y consulta</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-inner" style={{ marginBottom:'1rem' }}>
        <button className={`tab-inner${tab==='alta'?' active':''}`}
          onClick={() => { setTab('alta'); if (!editando) setForm(EMPTY_FORM); setMsgAlta(null); }}>
          Nueva alta
        </button>
        <button className={`tab-inner${tab==='baja'?' active':''}`}
          onClick={() => { setTab('baja'); setBajaResult([]); setBajaBusq(''); setMsgBaja(null); }}>
          Baja
        </button>
        <button className={`tab-inner${tab==='ver'?' active':''}`}
          onClick={() => { setTab('ver'); }}>
          Ver beneficiarios
        </button>
        <button className={`tab-inner${tab==='fs'?' active':''}`}
          onClick={() => setTab('fs')}>
          📋 Base de datos
        </button>
      </div>

      {/* ═══ TAB ALTA ═══ */}
      {tab === 'alta' && (
        editando
          ? <InlineForm isEdit />
          : <InlineForm />
      )}

      {/* ═══ TAB BAJA ═══ */}
      {tab === 'baja' && (
        <div>
          <div className="card">
            <div className="card-title">Buscar beneficiario</div>
            <div className="search-row">
              <input className="input" placeholder="Nombre, DNI, N° afiliado…"
                value={bajaBusq} onChange={e => setBajaBusq(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarParaBaja()} />
              <button className="btn btn-secondary" onClick={buscarParaBaja} disabled={buscandoBaja}>
                {buscandoBaja ? <span className="spinner" style={{width:12,height:12}}/> : 'Buscar'}
              </button>
            </div>
            <div style={{ marginTop:'.75rem' }}>
              <label style={L}>Observaciones de baja</label>
              <textarea className="input" style={{ minHeight:60, resize:'vertical' }}
                placeholder="Motivo u observaciones (opcional)"
                value={bajaNota} onChange={e => setBajaNota(e.target.value)} />
            </div>
          </div>

          {msgBaja && (
            <div style={{ background: msgBaja.ok ? 'var(--green-dim)' : 'var(--red-dim)',
              border: `1px solid ${msgBaja.ok ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
              borderRadius:'var(--radius)', padding:'.65rem .85rem', fontSize:'.82rem',
              color: msgBaja.ok ? 'var(--green)' : 'var(--red)', margin:'.75rem 0' }}>
              {msgBaja.text}
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'.35rem', marginTop:'.5rem' }}>
            {bajaResult.map(b => (
              <div key={b.id} className="result-item">
                <div className="result-body">
                  <div className="result-name">{fullName(b)}</div>
                  <div className="result-meta">
                    <span>DNI: <b>{b.dni || '—'}</b></span>
                    {b.nroAfiliado && <span>Afil: <b>{b.nroAfiliado}</b></span>}
                    {b.obraSocial  && <span>{b.obraSocial}</span>}
                  </div>
                </div>
                <div className="result-actions">
                  {confirmBaja?.id === b.id ? (
                    <div style={{ display:'flex', gap:'.4rem' }}>
                      <button className="btn btn-danger btn-sm" onClick={darDeBaja} disabled={savingBaja}>
                        {savingBaja ? <span className="spinner" style={{width:10,height:10}}/> : 'Confirmar baja'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setConfirmBaja(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => setConfirmBaja(b)}>
                      ⬇ Dar de baja
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TAB VER ═══ */}
      {tab === 'ver' && (
        <div>
          <div className="filter-bar">
            <input className="input" style={{ minWidth:180 }}
              placeholder="Buscar por nombre, DNI, barrio, localidad…"
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            {barrios.length > 0 && (
              <select className="select" style={{ minWidth:140 }}
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

          <p style={{ fontSize:'.8rem', color:'var(--text3)', margin:'.5rem 0' }}>
            {filtrados.length} de {lista.length} registros
          </p>

          {loading ? (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem 0' }}>
              <span className="spinner"/> Cargando…
            </div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <p>{busqueda || filtroBarrio ? 'Sin resultados para esa búsqueda' : 'Sin beneficiarios'}</p>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
                {paginados.map(b => (
                  <div key={b.id} className="result-item">
                    <div className="result-body">
                      <div className="result-name">{fullName(b)}</div>
                      <div className="result-meta">
                        {b.dni        && <span>DNI: <b>{b.dni}</b></span>}
                        {b.nroAfiliado&& <span>Afil: <b>{b.nroAfiliado}</b></span>}
                        {b.obraSocial && <span>{b.obraSocial}</span>}
                        {b.localidad  && <span>📍 {b.localidad}</span>}
                        {b.barrio     && <span>{b.barrio}{b.zona ? ` · ${b.zona}` : ''}</span>}
                        {b.horarioTurno && <span>🕐 {b.horarioTurno}</span>}
                        {b.condicion  && <span className="badge badge-blue" style={{ fontSize:'.68rem' }}>{b.condicion}</span>}
                        {b.chofer     && <span>🚗 {b.chofer}</span>}
                      </div>
                    </div>
                    <div className="result-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirEdicion(b)}>
                        ✏ Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

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
        </div>
      )}

      {/* ═══ TAB BASE DE DATOS ═══ */}
      {tab === 'fs' && (
        <div>
          <div className="card" style={{ marginBottom:'.75rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <input className="input" placeholder="Buscar por nombre, apellido o DNI…"
                style={{ flex:1, minWidth:200 }}
                value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              <button className="btn btn-primary btn-sm"
                onClick={() => { setTab('alta'); setForm(EMPTY_FORM); setMsgAlta(null); }}>
                + Nuevo beneficiario
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', color:'var(--text3)', padding:'2rem 0' }}>
              <span className="spinner"/> Cargando…
            </div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📋</div><p>Sin registros</p></div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--text3)' }}>
                    {['Apellido y Nombre','DNI','N° Afil.','Localidad','Barrio','Obra Social','Horario','Chofer',''].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0, 100).map(b => (
                    <tr key={b.id} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                      onClick={() => abrirEdicion(b)}>
                      <td style={{ padding:'7px 10px' }}>{fullName(b)}</td>
                      <td style={{ padding:'7px 10px' }}>{b.dni}</td>
                      <td style={{ padding:'7px 10px' }}>{b.nroAfiliado}</td>
                      <td style={{ padding:'7px 10px' }}>{b.localidad}</td>
                      <td style={{ padding:'7px 10px' }}>{b.barrio}</td>
                      <td style={{ padding:'7px 10px' }}>{b.obraSocial}</td>
                      <td style={{ padding:'7px 10px' }}>{b.horarioTurno}</td>
                      <td style={{ padding:'7px 10px' }}>{b.chofer}</td>
                      <td style={{ padding:'7px 10px' }}>
                        <button className="btn btn-secondary btn-sm"
                          onClick={ev => { ev.stopPropagation(); abrirEdicion(b); }}>✏</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtrados.length > 100 && (
                <p style={{ fontSize:'.78rem', color:'var(--text3)', padding:'.5rem', textAlign:'center' }}>
                  Mostrando 100 de {filtrados.length}. Usá el buscador para filtrar.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
