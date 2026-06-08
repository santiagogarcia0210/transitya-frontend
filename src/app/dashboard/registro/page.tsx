'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { serializarFirestore, toArray } from '@/lib/utils';

type Tab = 'alta' | 'baja' | 'ver' | 'fs';
const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const PER_PAGE = 20;
const DIA_ABREV: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
};

interface Beneficiario {
  id: string;
  apellidoYNombre: string;
  dni: string;
  nroAfiliado: string;
  domicilio: string;
  localidad: string;
  nroContacto: string;
  obraSocial: string;
  prestador: string;
  codigoPrestador: string;
  kmIdaVuelta: number;
  viajesMensuales: number;
  kmMensuales: number;
  dependencia: string;
  diasAtencion: string[];
  horarioTurno: string;
  horaIngreso: string;
  horaEgreso: string;
  tieneHorariosEspeciales: boolean;
  observaciones: string;
  lat: string;
  lng: string;
  activo: boolean;
}

interface FormState {
  id: string;
  apellidoYNombre: string;
  dni: string;
  nroAfiliado: string;
  domicilio: string;
  localidad: string;
  nroContacto: string;
  obraSocial: string;
  prestador: string;
  codigoPrestador: string;
  kmIdaVuelta: string;
  viajesMensuales: string;
  kmMensuales: string;
  dependencia: string;
  diasAtencion: string[];
  horarioTurno: string;
  observaciones: string;
}

function resolverNombre(b: Record<string, unknown>): string {
  // Campos combinados (formato nuevo y variantes)
  const full = String(
    b.apellidoYNombre  || b['APELLIDO Y NOMBRE'] ||
    b.apellidoNombre   || b['apellido_nombre']   ||
    b.nombreCompleto   || b['NOMBRE COMPLETO']   || ''
  ).trim();
  if (full) return full;

  // Formato antiguo BENEFICIARIOS.gs: apellido y nombre guardados por separado
  const apellido = String(b.apellido || b.APELLIDO || '').trim();
  const nombre   = String(b.nombre   || b.NOMBRE   || '').trim();
  const combinado = [apellido, nombre].filter(Boolean).join(' ');
  if (combinado) return combinado;

  console.warn('[registro] beneficiario sin nombre detectado — keys:', Object.keys(b).filter(k => k !== 'id').join(', '));
  return '';
}

function normalizar(b: Record<string, unknown>): Beneficiario {
  // horarios es un objeto anidado cargado por scripts/cargar-horarios.js
  const h = (b.horarios && typeof b.horarios === 'object' ? b.horarios : {}) as Record<string, unknown>;
  const diasRaw = b.diasAtencion ?? b.DIAS_ATENCION ?? b['DIAS ATENCION'] ?? h.dias ?? [];
  const especiales = Array.isArray(h.horariosEspeciales) ? h.horariosEspeciales : [];
  return {
    id:              String(b.id              || b['ID']                       || ''),
    apellidoYNombre: resolverNombre(b),
    dni:             String(b.dni             || b.DNI             || b.DOCUMENTO                    || ''),
    nroAfiliado:     String(b.nroAfiliado     || b['N° AFILIADO']  || b.NRO_AFILIADO                || ''),
    domicilio:       String(b.domicilio       || b.DOMICILIO       || b.direccion                   || ''),
    localidad:       String(b.localidad       || b.LOCALIDAD                                        || ''),
    nroContacto:     String(b.nroContacto     || b.NROCONTACTO     || b.telefono || b.TELEFONO      || ''),
    obraSocial:      String(b.obraSocial      || b['OBRA SOCIAL']  || b.OBRASOCIAL                  || ''),
    prestador:       String(b.prestador       || b.PRESTADOR                                        || ''),
    codigoPrestador: String(b.codigoPrestador || b['CODIGO PRESTADOR'] || b.CODIGOPRESTADOR         || ''),
    kmIdaVuelta:     Number(b.kmIdaVuelta     || b.KMIDAVUELTA     || b['KM IDA VUELTA']            || 0),
    viajesMensuales: Number(b.viajesMensuales || b.VIAJESMENSUALES || b['VIAJES MENSUALES']         || 0),
    kmMensuales:     Number(b.kmMensuales     || b.KMMENSUALES     || b['KM MENSUALES']             || 0),
    dependencia:     String(b.dependencia     || b.DEPENDENCIA                                      || ''),
    diasAtencion:    Array.isArray(diasRaw) ? (diasRaw as string[]) : String(diasRaw).split(',').map(s=>s.trim()).filter(Boolean),
    horarioTurno:    String(b.horarioTurno    || b.HORARIO_TURNO   || b['HORARIO TURNO']            || ''),
    horaIngreso:     String(h.horaIngreso     || b.horaIngreso                                      || ''),
    horaEgreso:      String(h.horaEgreso      || b.horaEgreso                                       || ''),
    tieneHorariosEspeciales: (especiales as unknown[]).length > 0,
    observaciones:   String(b.observaciones   || b.OBSERVACIONES                                    || ''),
    lat:             String(b.lat             || b.LAT             || b.LATITUD                     || ''),
    lng:             String(b.lng             || b.LNG             || b.lon || b.LON || b.LONGITUD  || ''),
    activo:          b.activo !== false && b.ACTIVO !== false && b['ACTIVO'] !== 'NO',
  };
}

const EMPTY: FormState = {
  id: '', apellidoYNombre: '', dni: '', nroAfiliado: '',
  domicilio: '', localidad: '', nroContacto: '',
  obraSocial: '', prestador: '', codigoPrestador: '',
  kmIdaVuelta: '', viajesMensuales: '', kmMensuales: '',
  dependencia: '', diasAtencion: [], horarioTurno: '', observaciones: '',
};

const L: React.CSSProperties = {
  display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500,
};

export default function RegistroPage() {
  const [tab,     setTab]     = useState<Tab>('alta');
  const [lista,   setLista]   = useState<Beneficiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [errLoad, setErrLoad] = useState<string | null>(null);

  /* ── Tab Alta ── */
  const [form,     setForm]     = useState<FormState>(EMPTY);
  const [editando, setEditando] = useState<Beneficiario | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [msgAlta,  setMsgAlta]  = useState<{ text: string; ok: boolean } | null>(null);

  /* ── Tab Baja ── */
  const [bajaBusq,    setBajaBusq]    = useState('');
  const [bajaResult,  setBajaResult]  = useState<Beneficiario[]>([]);
  const [confirmBaja, setConfirmBaja] = useState<Beneficiario | null>(null);
  const [bajaNota,    setBajaNota]    = useState('');
  const [msgBaja,     setMsgBaja]     = useState<{ text: string; ok: boolean } | null>(null);
  const [savingBaja,  setSavingBaja]  = useState(false);

  /* ── Tab Ver ── */
  const [busqueda,       setBusqueda]       = useState('');
  const [filtroLocalidad,setFiltroLocalidad]= useState('');
  const [pagina,         setPagina]         = useState(1);

  /* ── GPS ── */
  const [ubicando, setUbicando] = useState<string | null>(null);

  const ubicarBeneficiario = (id: string) => {
    if (!navigator.geolocation) { alert('Tu navegador no soporta geolocalización.'); return; }
    setUbicando(id);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.put(`/api/beneficiarios/${id}/gps`, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          await cargar();
        } catch { alert('Error al guardar la ubicación.'); }
        setUbicando(null);
      },
      () => { alert('No se pudo obtener la ubicación. Verificá los permisos del navegador.'); setUbicando(null); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const cargar = useCallback(async () => {
    setLoading(true); setErrLoad(null);
    try {
      const r = await api.get('/api/beneficiarios');
      setLista(
        toArray(r.data)
          .map(serializarFirestore)
          .map(normalizar)
          .sort((a, b) => {
            if (!a.apellidoYNombre && b.apellidoYNombre) return 1;
            if (a.apellidoYNombre && !b.apellidoYNombre) return -1;
            return a.apellidoYNombre.localeCompare(b.apellidoYNombre, 'es');
          })
      );
    } catch (err: unknown) {
      console.error('[registro] cargar:', err);
      setErrLoad('No se pudieron cargar los datos. Verificá tu sesión o contactá soporte.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /* ── Filtros Ver ── */
  const activos    = lista.filter(b => b.activo);
  const localidades= [...new Set(activos.map(b => b.localidad).filter(Boolean))].sort();
  const filtrados  = activos.filter(b => {
    const q = busqueda.toLowerCase();
    if (q && !b.apellidoYNombre.toLowerCase().includes(q) && !b.dni.includes(q) && !b.nroAfiliado.toLowerCase().includes(q)) return false;
    if (filtroLocalidad && b.localidad !== filtroLocalidad) return false;
    return true;
  });
  const totalPags = Math.max(1, Math.ceil(filtrados.length / PER_PAGE));
  const paginados = filtrados.slice((pagina - 1) * PER_PAGE, pagina * PER_PAGE);
  useEffect(() => { setPagina(1); }, [busqueda, filtroLocalidad]);

  /* ── Helpers form ── */
  type FKey = keyof Omit<FormState, 'id' | 'diasAtencion'>;
  const setF = (k: FKey) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: ev.target.value }));

  const toggleDia = (dia: string) =>
    setForm(f => ({
      ...f,
      diasAtencion: f.diasAtencion.includes(dia)
        ? f.diasAtencion.filter(d => d !== dia)
        : [...f.diasAtencion, dia],
    }));

  const abrirEdicion = (b: Beneficiario) => {
    setForm({
      id: b.id, apellidoYNombre: b.apellidoYNombre, dni: b.dni,
      nroAfiliado: b.nroAfiliado, domicilio: b.domicilio, localidad: b.localidad,
      nroContacto: b.nroContacto, obraSocial: b.obraSocial,
      prestador: b.prestador, codigoPrestador: b.codigoPrestador,
      kmIdaVuelta: String(b.kmIdaVuelta || ''), viajesMensuales: String(b.viajesMensuales || ''),
      kmMensuales: String(b.kmMensuales || ''), dependencia: b.dependencia,
      diasAtencion: [...b.diasAtencion], horarioTurno: b.horarioTurno,
      observaciones: b.observaciones,
    });
    setEditando(b); setMsgAlta(null); setTab('alta');
  };

  const guardarAlta = async () => {
    if (!form.apellidoYNombre.trim()) {
      setMsgAlta({ text: 'El apellido y nombre es obligatorio.', ok: false }); return;
    }
    setSaving(true); setMsgAlta(null);
    try {
      const payload = {
        ...form,
        'APELLIDO Y NOMBRE': form.apellidoYNombre.trim(),
        NOMBRE: form.apellidoYNombre.trim(),
        DNI: form.dni.trim(),
        DOMICILIO: form.domicilio.trim(),
        LOCALIDAD: form.localidad.trim(),
        NROCONTACTO: form.nroContacto.trim(),
        'OBRA SOCIAL': form.obraSocial.trim(),
        PRESTADOR: form.prestador.trim(),
        CODIGOPRESTADOR: form.codigoPrestador.trim(),
        KMIDAVUELTA: Number(form.kmIdaVuelta) || 0,
        VIAJESMENSUALES: Number(form.viajesMensuales) || 0,
        KMMENSUALES: Number(form.kmMensuales) || 0,
        DEPENDENCIA: form.dependencia.trim(),
        DIAS_ATENCION: form.diasAtencion,
        HORARIO_TURNO: form.horarioTurno.trim(),
        OBSERVACIONES: form.observaciones.trim(),
        activo: true,
      };
      if (form.id) {
        await api.put(`/api/beneficiarios/${form.id}`, payload);
        setMsgAlta({ text: '✅ Beneficiario actualizado.', ok: true });
        setEditando(null);
      } else {
        await api.post('/api/beneficiarios', payload);
        setMsgAlta({ text: '✅ Alta guardada.', ok: true });
        setForm(EMPTY);
      }
      cargar();
    } catch { setMsgAlta({ text: 'Error al guardar. Intentá de nuevo.', ok: false }); }
    setSaving(false);
  };

  const buscarParaBaja = () => {
    const q = bajaBusq.toLowerCase().trim();
    if (!q) { setBajaResult(activos); return; }
    setBajaResult(activos.filter(b =>
      b.apellidoYNombre.toLowerCase().includes(q) || b.dni.includes(q) || b.nroAfiliado.toLowerCase().includes(q)
    ));
  };

  const darDeBaja = async () => {
    if (!confirmBaja) return;
    setSavingBaja(true); setMsgBaja(null);
    try {
      await api.post('/api/beneficiarios/baja', {
        id: confirmBaja.id,
        nombre: confirmBaja.apellidoYNombre,
        observaciones: bajaNota || 'Baja manual desde sistema',
      });
      setMsgBaja({ text: `✅ ${confirmBaja.apellidoYNombre} dado/a de baja.`, ok: true });
      setConfirmBaja(null); setBajaNota('');
      setBajaResult(r => r.filter(b => b.id !== confirmBaja.id));
      cargar();
    } catch { setMsgBaja({ text: 'Error al dar de baja.', ok: false }); }
    setSavingBaja(false);
  };

  /* ── Inline form ── */
  const InlineForm = ({ isEdit }: { isEdit?: boolean }) => (
    <div className="card">
      <div className="card-title">{isEdit ? `✏️ Editando: ${editando!.apellidoYNombre}` : 'Datos del beneficiario'}</div>
      <div className="form-grid">
        <div>
          <label style={L}>Apellido y Nombre *</label>
          <input className="input" placeholder="García, Juan Carlos" value={form.apellidoYNombre} onChange={setF('apellidoYNombre')} />
        </div>
        <div className="form-grid form-grid-2">
          <div><label style={L}>DNI *</label><input className="input" placeholder="30123456" value={form.dni} onChange={setF('dni')} /></div>
          <div><label style={L}>N° Afiliado</label><input className="input" value={form.nroAfiliado} onChange={setF('nroAfiliado')} /></div>
        </div>
        <div className="form-grid form-grid-2">
          <div><label style={L}>Domicilio</label><input className="input" value={form.domicilio} onChange={setF('domicilio')} /></div>
          <div><label style={L}>Localidad</label><input className="input" value={form.localidad} onChange={setF('localidad')} /></div>
        </div>
        <div className="form-grid form-grid-2">
          <div><label style={L}>Obra Social</label><input className="input" value={form.obraSocial} onChange={setF('obraSocial')} /></div>
          <div><label style={L}>N° Contacto</label><input className="input" value={form.nroContacto} onChange={setF('nroContacto')} /></div>
        </div>
        <div className="form-grid form-grid-2">
          <div><label style={L}>Prestador</label><input className="input" value={form.prestador} onChange={setF('prestador')} /></div>
          <div><label style={L}>Código Prestador</label><input className="input" value={form.codigoPrestador} onChange={setF('codigoPrestador')} /></div>
        </div>
        <div className="form-grid form-grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' } as React.CSSProperties}>
          <div><label style={L}>KM ida+vuelta</label><input type="number" className="input" placeholder="0" value={form.kmIdaVuelta} onChange={setF('kmIdaVuelta')} /></div>
          <div><label style={L}>Viajes / mes</label><input type="number" className="input" placeholder="0" value={form.viajesMensuales} onChange={setF('viajesMensuales')} /></div>
          <div><label style={L}>KM mensuales</label><input type="number" className="input" placeholder="0" value={form.kmMensuales} onChange={setF('kmMensuales')} /></div>
        </div>
        <div><label style={L}>Dependencia</label><input className="input" value={form.dependencia} onChange={setF('dependencia')} /></div>

        {/* Días de atención */}
        <div>
          <label style={L}>Días de atención</label>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            {DIAS_SEM.map(dia => (
              <label key={dia} style={{ display: 'flex', alignItems: 'center', gap: '.3rem',
                cursor: 'pointer', fontSize: '.84rem', color: 'var(--text)', userSelect: 'none' }}>
                <input type="checkbox" checked={form.diasAtencion.includes(dia)}
                  onChange={() => toggleDia(dia)} style={{ cursor: 'pointer' }} />
                {dia}
              </label>
            ))}
          </div>
        </div>

        {/* Horario de turno */}
        <div>
          <label style={L}>Horario de turno</label>
          <input type="time" className="input" style={{ maxWidth: 140 }}
            value={form.horarioTurno} onChange={setF('horarioTurno')} />
        </div>

        <div>
          <label style={L}>Observaciones</label>
          <textarea className="input" style={{ minHeight: 60, resize: 'vertical' }}
            value={form.observaciones} onChange={setF('observaciones')} />
        </div>
      </div>

      {msgAlta && (
        <p style={{ fontSize: '.82rem', marginTop: '.75rem',
          color: msgAlta.ok ? 'var(--green)' : 'var(--red)' }}>
          {msgAlta.text}
        </p>
      )}

      <div className="btn-row" style={{ marginTop: '1.25rem' }}>
        {isEdit && (
          <button className="btn btn-secondary"
            onClick={() => { setEditando(null); setForm(EMPTY); setMsgAlta(null); }}>
            Cancelar
          </button>
        )}
        <button className="btn btn-primary" onClick={guardarAlta} disabled={saving}>
          {saving
            ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Guardando…</>
            : isEdit ? 'Actualizar' : '✓ Guardar alta'}
        </button>
        {!isEdit && (
          <button className="btn btn-secondary" onClick={() => setForm(EMPTY)}>Limpiar</button>
        )}
      </div>
    </div>
  );

  /* ── Render ── */
  return (
    <div>
      <div className="section-header">
        <div style={{ flex: 1 }}>
          <div className="section-title">📋 Registro</div>
          <div className="section-sub">Alta, baja y consulta de beneficiarios</div>
        </div>
      </div>

      {errLoad && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,.3)',
          borderRadius: 'var(--radius)', padding: '.65rem .85rem', fontSize: '.82rem',
          color: 'var(--red)', marginBottom: '1rem' }}>
          ⚠️ {errLoad}
        </div>
      )}

      <div className="tabs-inner" style={{ marginBottom: '1rem' }}>
        <button className={`tab-inner${tab === 'alta' ? ' active' : ''}`}
          onClick={() => { setTab('alta'); if (!editando) setForm(EMPTY); setMsgAlta(null); }}>
          Nueva alta
        </button>
        <button className={`tab-inner${tab === 'baja' ? ' active' : ''}`}
          onClick={() => { setTab('baja'); setBajaResult([]); setBajaBusq(''); setMsgBaja(null); }}>
          Baja
        </button>
        <button className={`tab-inner${tab === 'ver' ? ' active' : ''}`}
          onClick={() => setTab('ver')}>
          Ver beneficiarios
        </button>
        <button className={`tab-inner${tab === 'fs' ? ' active' : ''}`}
          onClick={() => setTab('fs')}>
          📋 Base de datos
        </button>
      </div>

      {/* ═══ TAB ALTA ═══ */}
      {tab === 'alta' && (editando ? <InlineForm isEdit /> : <InlineForm />)}

      {/* ═══ TAB BAJA ═══ */}
      {tab === 'baja' && (
        <div>
          <div className="card">
            <div className="card-title">Buscar beneficiario</div>
            <div className="search-row">
              <input className="input" placeholder="Nombre, DNI o N° afiliado…"
                value={bajaBusq} onChange={e => setBajaBusq(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarParaBaja()} />
              <button className="btn btn-secondary" onClick={buscarParaBaja}>Buscar</button>
            </div>
            <div style={{ marginTop: '.75rem' }}>
              <label style={L}>Observaciones de baja</label>
              <textarea className="input" style={{ minHeight: 60, resize: 'vertical' }}
                placeholder="Motivo (opcional)"
                value={bajaNota} onChange={e => setBajaNota(e.target.value)} />
            </div>
          </div>

          {msgBaja && (
            <div style={{ background: msgBaja.ok ? 'var(--green-dim)' : 'var(--red-dim)',
              border: `1px solid ${msgBaja.ok ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
              borderRadius: 'var(--radius)', padding: '.65rem .85rem', fontSize: '.82rem',
              color: msgBaja.ok ? 'var(--green)' : 'var(--red)', margin: '.75rem 0' }}>
              {msgBaja.text}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', marginTop: '.5rem' }}>
            {bajaResult.map(b => (
              <div key={b.id} className="result-item">
                <div className="result-body">
                  <div className="result-name">{b.apellidoYNombre}</div>
                  <div className="result-meta">
                    <span>DNI: <b>{b.dni || '—'}</b></span>
                    {b.nroAfiliado && <span>Afil: <b>{b.nroAfiliado}</b></span>}
                    {b.obraSocial  && <span>{b.obraSocial}</span>}
                    {b.localidad   && <span>📍 {b.localidad}</span>}
                  </div>
                </div>
                <div className="result-actions">
                  {confirmBaja?.id === b.id ? (
                    <div style={{ display: 'flex', gap: '.4rem' }}>
                      <button className="btn btn-danger btn-sm" onClick={darDeBaja} disabled={savingBaja}>
                        {savingBaja ? <span className="spinner" style={{ width: 10, height: 10 }} /> : 'Confirmar baja'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setConfirmBaja(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary btn-sm" onClick={() => setConfirmBaja(b)}>
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
            <input className="input" style={{ minWidth: 180 }}
              placeholder="Buscar por nombre, DNI o N° afiliado…"
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            {localidades.length > 0 && (
              <select className="select" style={{ minWidth: 140 }}
                value={filtroLocalidad} onChange={e => setFiltroLocalidad(e.target.value)}>
                <option value="">Todas las localidades</option>
                {localidades.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            {(busqueda || filtroLocalidad) && (
              <button className="btn btn-secondary btn-sm"
                onClick={() => { setBusqueda(''); setFiltroLocalidad(''); }}>✕ Limpiar</button>
            )}
          </div>

          <p style={{ fontSize: '.8rem', color: 'var(--text3)', margin: '.5rem 0' }}>
            {filtrados.length} de {activos.length} beneficiarios activos
          </p>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem 0' }}>
              <span className="spinner" /> Cargando…
            </div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <p>{busqueda || filtroLocalidad ? 'Sin resultados' : 'Sin beneficiarios activos'}</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                {paginados.map(b => (
                  <div key={b.id} className="result-item">
                    <div className="result-body">
                      <div className="result-name">{b.apellidoYNombre}</div>
                      <div className="result-meta">
                        {b.dni        && <span>DNI: <b>{b.dni}</b></span>}
                        {b.nroAfiliado&& <span>Afil: <b>{b.nroAfiliado}</b></span>}
                        {b.obraSocial && <span>{b.obraSocial}</span>}
                        {b.localidad  && <span>📍 {b.localidad}</span>}
                        {b.diasAtencion.length > 0 && (
                          <span>📅 {b.diasAtencion.map(d => DIA_ABREV[d.toLowerCase()] || d.slice(0,3)).join(' ')}</span>
                        )}
                        {(b.horaIngreso && b.horaEgreso) ? (
                          <span>🕐 {b.tieneHorariosEspeciales ? 'Variable' : `${b.horaIngreso} - ${b.horaEgreso}`}</span>
                        ) : b.tieneHorariosEspeciales ? (
                          <span>🕐 Variable</span>
                        ) : b.horarioTurno ? (
                          <span>🕐 {b.horarioTurno}</span>
                        ) : null}
                        {b.lat && b.lng ? (
                          <span className="badge badge-green" title={`${b.lat}, ${b.lng}`}>📍 GPS</span>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '.72rem', padding: '2px 8px' }}
                            disabled={ubicando === b.id}
                            onClick={ev => { ev.stopPropagation(); ubicarBeneficiario(b.id); }}>
                            {ubicando === b.id ? '…' : '📍 Ubicar'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="result-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirEdicion(b)}>✏ Editar</button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPags > 1 && (
                <div className="pagination">
                  <button disabled={pagina === 1} onClick={() => setPagina(1)}>«</button>
                  <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>‹</button>
                  {Array.from({ length: totalPags }, (_, i) => i + 1)
                    .filter(p => Math.abs(p - pagina) <= 2)
                    .map(p => (
                      <button key={p} className={p === pagina ? 'active' : ''} onClick={() => setPagina(p)}>{p}</button>
                    ))}
                  <button disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)}>›</button>
                  <button disabled={pagina === totalPags} onClick={() => setPagina(totalPags)}>»</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ TAB BASE DE DATOS ═══ */}
      {tab === 'fs' && (
        <div>
          <div className="card" style={{ marginBottom: '.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input className="input" placeholder="Buscar…" style={{ flex: 1, minWidth: 200 }}
                value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              <button className="btn btn-primary btn-sm"
                onClick={() => { setTab('alta'); setForm(EMPTY); setMsgAlta(null); }}>
                + Nuevo beneficiario
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '2rem 0' }}>
              <span className="spinner" /> Cargando…
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>
                    {['Apellido y Nombre', 'DNI', 'N° Afil.', 'Localidad', 'Obra Social', 'Días', 'Horario', 'GPS', 'Estado', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.filter(b => {
                    const q = busqueda.toLowerCase();
                    if (!q) return true;
                    return b.apellidoYNombre.toLowerCase().includes(q) || b.dni.includes(q) || b.nroAfiliado.toLowerCase().includes(q);
                  }).slice(0, 100).map(b => (
                    <tr key={b.id}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: b.activo ? 1 : 0.5 }}
                      onClick={() => abrirEdicion(b)}>
                      <td style={{ padding: '7px 10px', fontWeight: 500 }}>{b.apellidoYNombre}</td>
                      <td style={{ padding: '7px 10px' }}>{b.dni}</td>
                      <td style={{ padding: '7px 10px' }}>{b.nroAfiliado}</td>
                      <td style={{ padding: '7px 10px' }}>{b.localidad}</td>
                      <td style={{ padding: '7px 10px' }}>{b.obraSocial}</td>
                      <td style={{ padding: '7px 10px' }}>
                        {b.diasAtencion.length > 0
                          ? b.diasAtencion.map(d => DIA_ABREV[d.toLowerCase()] || d.slice(0,3)).join(' ')
                          : '—'}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        {b.tieneHorariosEspeciales
                          ? 'Variable'
                          : b.horaIngreso && b.horaEgreso
                            ? `${b.horaIngreso} - ${b.horaEgreso}`
                            : b.horarioTurno || '—'}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        {b.lat && b.lng ? (
                          <span title={`${b.lat}, ${b.lng}`}>📍</span>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '.72rem', padding: '2px 6px' }}
                            disabled={ubicando === b.id}
                            onClick={ev => { ev.stopPropagation(); ubicarBeneficiario(b.id); }}>
                            {ubicando === b.id ? '…' : '📍'}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        {!b.activo && <span className="badge badge-red">BAJA</span>}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <button className="btn btn-secondary btn-sm"
                          onClick={ev => { ev.stopPropagation(); abrirEdicion(b); }}>✏</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lista.filter(b => {
                const q = busqueda.toLowerCase();
                if (!q) return true;
                return b.apellidoYNombre.toLowerCase().includes(q) || b.dni.includes(q);
              }).length > 100 && (
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', padding: '.5rem', textAlign: 'center' }}>
                  Mostrando 100 primeros. Usá el buscador para filtrar.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
