import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  api,
  ApiError,
  clearTokens,
  readTokens,
  saveTokens
} from './api';
import type { Perfil, Reporte, Reserva, Sala, Tokens } from './api';

type Vista = 'reservar' | 'mis-reservas';

const ZONA_HORARIA = 'America/Argentina/Cordoba';
const REPORTE_KEY = 'coworking.latest-report';
const HORARIOS = Array.from({ length: 12 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);

const partesHoraLocal = (): Record<string, string> =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_HORARIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  );

const valoresInicialesTurno = (): { fecha: string; hora: string } => {
  const ahora = partesHoraLocal();
  const calendario = new Date(Date.UTC(Number(ahora.year), Number(ahora.month) - 1, Number(ahora.day)));
  let hora = Number(ahora.hour) + 1;
  if (hora < 8) hora = 8;
  if (hora >= 20) {
    calendario.setUTCDate(calendario.getUTCDate() + 1);
    hora = 8;
  }
  const fecha = `${calendario.getUTCFullYear()}-${String(calendario.getUTCMonth() + 1).padStart(2, '0')}-${String(calendario.getUTCDate()).padStart(2, '0')}`;
  return { fecha, hora: `${String(hora).padStart(2, '0')}:00` };
};

const mensajeError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocurrió un error inesperado. Intentá nuevamente.';

const mostrarFecha = (fechaHora: string): string => {
  const [fecha, hora] = fechaHora.split('T');
  return `${fecha} · ${hora}`;
};

const obtenerTiempoRestante = (fechaHora: string): { totalHoras: number; horas: number; minutos: number } => {
  const [fecha, hora] = fechaHora.split('T');
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [horas, minutos] = hora.split(':').map(Number);
  const objetivo = Date.UTC(anio, mes - 1, dia, horas, minutos);
  
  const ahora = partesHoraLocal();
  const actual = Date.UTC(
    Number(ahora.year),
    Number(ahora.month) - 1,
    Number(ahora.day),
    Number(ahora.hour),
    Number(ahora.minute)
  );
  
  const diferenciaMs = objetivo - actual;
  const totalMinutos = Math.max(0, Math.floor(diferenciaMs / (1000 * 60)));
  
  return {
    totalHoras: diferenciaMs / (1000 * 60 * 60), // Usado para validar si es > 24
    horas: Math.floor(totalMinutos / 60),
    minutos: totalMinutos % 60
  };
};

function App() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [vista, setVista] = useState<Vista>('reservar');
  const [salas, setSalas] = useState<Sala[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [disponibles, setDisponibles] = useState<Sala[]>([]);
  const [fecha, setFecha] = useState(() => valoresInicialesTurno().fecha);
  const [hora, setHora] = useState(() => valoresInicialesTurno().hora);
  const [capacidad, setCapacidad] = useState('1');
  const [modoRegistro, setModoRegistro] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoSalas, setCargandoSalas] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [nombreSala, setNombreSala] = useState('');
  const [descripcionSala, setDescripcionSala] = useState('');
  const [capacidadSala, setCapacidadSala] = useState('4');
  const [salaEnEdicion, setSalaEnEdicion] = useState<string | null>(null);
  const [fechaReporteDesde, setFechaReporteDesde] = useState(() => new Date().toISOString().slice(0, 10));
  const [fechaReporteHasta, setFechaReporteHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [solicitandoReporte, setSolicitandoReporte] = useState(false);
    const [reservaACancelar, setReservaACancelar] = useState<Reserva | null>(null);

  const esGestor = perfil?.tuRol === 'EDITOR' || perfil?.tuRol === 'ADMIN';
  const salasPorId = useMemo(() => new Map(salas.map((sala) => [sala.id, sala])), [salas]);

  const cargarPanel = useCallback(async () => {
    const [nuevaListaSalas, misReservas, nuevoPerfil] = await Promise.all([
      api<Sala[]>('/salas'),
      api<Reserva[]>('/reservas'),
      api<Perfil>('/perfil')
    ]);
    setSalas(nuevaListaSalas);
    setReservas(misReservas);
    setPerfil(nuevoPerfil);
  }, []);

  useEffect(() => {
    if (!readTokens()) return;
    setCargando(true);
    cargarPanel()
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 401) clearTokens();
        setError(mensajeError(reason));
      })
      .finally(() => setCargando(false));
  }, [cargarPanel]);

  useEffect(() => {
    if (perfil?.tuRol !== 'ADMIN') {
      setReporte(null);
      setReportes([]);
      return;
    }
    api<Reporte[]>('/reportes')
      .then((reportes) => {
        setReportes(reportes);
        const idGuardado = localStorage.getItem(REPORTE_KEY);
        const reportePreferido = reportes.find((item) => item.id === idGuardado) ?? reportes[0] ?? null;
        setReporte(reportePreferido);
        if (reportePreferido) localStorage.setItem(REPORTE_KEY, reportePreferido.id);
      })
      .catch((reason: unknown) => setError(mensajeError(reason)));
  }, [perfil?.tuRol]);

  useEffect(() => {
    if (
      perfil?.tuRol !== 'ADMIN' ||
      !reporte ||
      (reporte.estado !== 'queued' && reporte.estado !== 'running')
    ) return;

    const timer = window.setInterval(() => {
      api<Reporte>(`/reportes/${encodeURIComponent(reporte.id)}`)
        .then((actualizado) => {
          setReporte(actualizado);
          setReportes((actuales) => actuales.map((item) => item.id === actualizado.id ? actualizado : item));
        })
        .catch((reason: unknown) => setError(mensajeError(reason)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [perfil?.tuRol, reporte]);

  useEffect(() => {
    if (!perfil) return;
    let vigente = true;
    const query = new URLSearchParams({ fecha, hora, capacidad });
    setCargandoSalas(true);
    api<Sala[]>(`/salas/disponibles?${query}`)
      .then((resultado) => {
        if (vigente) setDisponibles(resultado);
      })
      .catch((reason: unknown) => {
        if (vigente) setError(mensajeError(reason));
      })
      .finally(() => {
        if (vigente) setCargandoSalas(false);
      });
    return () => {
      vigente = false;
    };
  }, [perfil, fecha, hora, capacidad]);

  useEffect(() => {
    if (!aviso) return;
    const timer = window.setTimeout(() => setAviso(''), 5000);
    return () => window.clearTimeout(timer);
  }, [aviso]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(''), 7000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const actualizarPanel = async (): Promise<void> => {
    await cargarPanel();
    const query = new URLSearchParams({ fecha, hora, capacidad });
    setDisponibles(await api<Sala[]>(`/salas/disponibles?${query}`));
  };

  const entrar = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    setAviso('');
    setCargando(true);
    try {
      if (modoRegistro) {
        await api<{ mensaje: string }>('/registro', {
          method: 'POST',
          body: JSON.stringify({ nombre, email, password })
        });
      }
      const tokens = await api<Tokens>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      saveTokens(tokens);
      await cargarPanel();
      setAviso(modoRegistro ? 'Tu cuenta está lista. ¡Elegí tu primer espacio!' : 'Qué bueno verte de nuevo.');
    } catch (reason: unknown) {
      clearTokens();
      setError(mensajeError(reason));
    } finally {
      setCargando(false);
    }
  };

  const cerrarSesion = (): void => {
    clearTokens();
    setPerfil(null);
    setReservas([]);
    setDisponibles([]);
    setError('');
    setAviso('');
  };

  const reservarSala = async (sala: Sala): Promise<void> => {
    setError('');
    setAviso('');
    setCargando(true);
    try {
      await api<Reserva>('/reservas', {
        method: 'POST',
        body: JSON.stringify({ salaId: sala.id, fecha, hora })
      });
      await actualizarPanel();
      setVista('mis-reservas');
      setAviso(`Listo: reservaste ${sala.nombre} para el ${fecha} a las ${hora}.`);
    } catch (reason: unknown) {
      setError(mensajeError(reason));
    } finally {
      setCargando(false);
    }
  };

    const cancelarReserva = (reserva: Reserva): void => {
    setReservaACancelar(reserva);
  };

  const confirmarCancelacion = async (): Promise<void> => {
    if (!reservaACancelar) return;
    
    const reserva = reservaACancelar;
    setReservaACancelar(null);
    setError('');
    setAviso('');
    setCargando(true);

    try {
      const resultado = await api<{ reserva: Reserva; reembolsado: boolean }>(
        `/reservas/${encodeURIComponent(reserva.id)}`,
        { method: 'DELETE' }
      );
      await cargarPanel();
      setAviso(
        resultado.reembolsado
          ? `Cancelaste la reserva y recuperaste ${reserva.costoCreditos} créditos.`
          : 'Cancelaste la reserva. Como faltaban menos de 24 horas, no corresponde reembolso.'
      );
    } catch (reason: unknown) {
      setError(mensajeError(reason));
    } finally {
      setCargando(false);
    }
  };

  const guardarSala = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    setAviso('');
    setCargando(true);
    try {
      await api<Sala>(salaEnEdicion ? `/salas/${encodeURIComponent(salaEnEdicion)}` : '/salas', {
        method: salaEnEdicion ? 'PUT' : 'POST',
        body: JSON.stringify({
          nombre: nombreSala,
          descripcion: descripcionSala,
          capacidad: Number(capacidadSala)
        })
      });
      setNombreSala('');
      setDescripcionSala('');
      setCapacidadSala('4');
      setSalaEnEdicion(null);
      await actualizarPanel();
      setAviso(salaEnEdicion ? 'Los cambios del espacio se guardaron.' : 'El nuevo espacio ya está disponible para reservar.');
    } catch (reason: unknown) {
      setError(mensajeError(reason));
    } finally {
      setCargando(false);
    }
  };

  const editarSala = (sala: Sala): void => {
    setSalaEnEdicion(sala.id);
    setNombreSala(sala.nombre);
    setDescripcionSala(sala.descripcion);
    setCapacidadSala(String(sala.capacidad));
    setError('');
    setAviso('');
  };

  const cancelarEdicionSala = (): void => {
    setSalaEnEdicion(null);
    setNombreSala('');
    setDescripcionSala('');
    setCapacidadSala('4');
  };

  const generarReporte = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    setAviso('');
    setSolicitandoReporte(true);
    try {
      const nuevoReporte = await api<Reporte>('/reportes', {
        method: 'POST',
        body: JSON.stringify({
          fechaDesde: fechaReporteDesde,
          fechaHasta: fechaReporteHasta
        })
      });
      localStorage.setItem(REPORTE_KEY, nuevoReporte.id);
      setReporte(nuevoReporte);
      setReportes((actuales) => [nuevoReporte, ...actuales.filter((item) => item.id !== nuevoReporte.id)].slice(0, 20));
      setAviso('El reporte se está generando en segundo plano.');
    } catch (reason: unknown) {
      setError(mensajeError(reason));
    } finally {
      setSolicitandoReporte(false);
    }
  };

  if (!perfil) {
    return (
      <main className="auth-layout">
        <section className="auth-aside">
          <a className="brand brand-light" href="/" aria-label="Sur Cowork, inicio">
            <span className="brand-mark">S</span>
            <span>sur<span className="brand-weight">cowork</span></span>
          </a>
          <div className="aside-copy">
            <span className="eyebrow eyebrow-light">TRABAJO, ENCUENTROS, IDEAS</span>
            <h1>Tu lugar para hacer que las cosas pasen.</h1>
            <p>Encontrá un espacio que te acompañe. El resto, lo ponés vos.</p>
          </div>
          <div className="aside-note"><span className="status-dot" /> Espacios pensados para trabajar mejor</div>
        </section>

        <section className="auth-main">
          <div className="auth-form-wrap">
            <span className="eyebrow">TU PRÓXIMA JORNADA EMPIEZA ACÁ</span>
            <h2>{modoRegistro ? 'Creá tu cuenta' : 'Hola de nuevo'}</h2>
            <p className="muted auth-description">
              {modoRegistro ? 'Sumate a la comunidad y encontrá tu próximo espacio.' : 'Ingresá a tu espacio de trabajo.'}
            </p>
            {error && <p className="feedback feedback-error" role="alert">{error}</p>}
            <form className="stack-form" onSubmit={entrar}>
              {modoRegistro && (
                <label>
                  Nombre
                  <input required autoComplete="name" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Tu nombre" />
                </label>
              )}
              <label>
                Email
                <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@correo.com" />
              </label>
              <label>
                Contraseña
                <input required type="password" minLength={modoRegistro ? 6 : undefined} autoComplete={modoRegistro ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
              </label>
              <button className="button button-primary button-wide" disabled={cargando}>
                {cargando ? 'Un momento…' : modoRegistro ? 'Crear cuenta' : 'Ingresar'}
                {!cargando && <span aria-hidden="true">↗</span>}
              </button>
            </form>
            <p className="auth-switch">
              {modoRegistro ? '¿Ya tenés una cuenta?' : '¿Todavía no tenés cuenta?'}{' '}
              <button className="text-button" onClick={() => { setModoRegistro(!modoRegistro); setError(''); }}>
                {modoRegistro ? 'Ingresá' : 'Registrate'}
              </button>
            </p>
            {cargando && <span className="sr-only" role="status">Cargando tu cuenta</span>}
          </div>
          <span className="auth-footer">SUR COWORK · CÓRDOBA</span>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Sur Cowork, inicio">
          <span className="brand-mark">S</span>
          <span>sur<span className="brand-weight">cowork</span></span>
        </a>
        <nav className="main-nav" aria-label="Navegación principal">
          <button className={vista === 'reservar' ? 'nav-link active' : 'nav-link'} onClick={() => setVista('reservar')}>Encontrar un espacio</button>
          <button className={vista === 'mis-reservas' ? 'nav-link active' : 'nav-link'} onClick={() => setVista('mis-reservas')}>Mis reservas <span className="nav-count">{reservas.filter((reserva) => reserva.estado === 'Confirmada').length}</span></button>
        </nav>
        <div className="account-menu">
          <div className="credit-pill" title="Créditos disponibles">
            <span className="credit-icon">✳</span>
            <strong>{perfil.saldoCreditos}</strong>
            <span>créditos</span>
          </div>
          <div className="avatar" aria-hidden="true">{perfil.tuRol === 'ADMIN' ? 'A' : (email || 'U').slice(0, 1).toUpperCase()}</div>
          <button className="sign-out" onClick={cerrarSesion}>Salir</button>
        </div>
      </header>

      <main className="page-content">
        <section className="welcome-row">
          <div>
            <span className="eyebrow">{vista === 'reservar' ? 'UN BUEN DÍA PARA CAMBIAR DE AIRE' : 'TU AGENDA, EN UN SOLO LUGAR'}</span>
            <h1>{vista === 'reservar' ? 'Encontrá tu próximo espacio.' : 'Tus reservas.'}</h1>
            <p className="muted">{vista === 'reservar' ? 'Elegí cuándo y con cuántas personas. Nosotros encontramos el lugar.' : 'Revisá tus próximos encuentros y organizá tu semana.'}</p>
          </div>
          <div className="date-stamp"><span className="date-stamp-icon">◷</span> TURNOS DE 1 HORA</div>
        </section>

        {error && <p className="feedback feedback-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Cerrar mensaje">×</button></p>}
        {aviso && <p className="feedback feedback-success" role="status">{aviso}<button onClick={() => setAviso('')} aria-label="Cerrar mensaje">×</button></p>}

        {vista === 'reservar' ? (
          <>
            <section className="search-panel" aria-label="Filtros de disponibilidad">
              <label className="filter-field">
                <span className="filter-label">¿QUÉ DÍA?</span>
                <span className="input-with-icon"><span aria-hidden="true">▦</span><input type="date" required value={fecha} onChange={(event) => setFecha(event.target.value)} /></span>
              </label>
              <label className="filter-field">
                <span className="filter-label">¿A QUÉ HORA?</span>
                <span className="input-with-icon"><span aria-hidden="true">◷</span><select value={hora} onChange={(event) => setHora(event.target.value)}>{HORARIOS.map((turno) => <option key={turno} value={turno}>{turno}</option>)}</select></span>
              </label>
              <label className="filter-field filter-capacity">
                <span className="filter-label">¿CUÁNTAS PERSONAS?</span>
                <span className="input-with-icon"><span aria-hidden="true">♙</span><select value={capacidad} onChange={(event) => setCapacidad(event.target.value)}>{[1, 2, 3, 4, 6, 8, 10, 12].map((people) => <option key={people} value={people}>{people} {people === 1 ? 'persona' : 'personas'}</option>)}</select></span>
              </label>
              <div className="filter-price"><span>POR TURNO</span><strong>50 <small>cr</small></strong></div>
            </section>

            {esGestor && (
              <details className="manager-panel">
                <summary><span>+</span> Administrar espacios</summary>
                <form className="room-form" onSubmit={guardarSala}>
                  <label>Nombre del espacio<input required value={nombreSala} onChange={(event) => setNombreSala(event.target.value)} placeholder="Sala de reuniones" /></label>
                  <label>Descripción<input required value={descripcionSala} onChange={(event) => setDescripcionSala(event.target.value)} placeholder="Luz natural, pantalla, café…" /></label>
                  <label>Capacidad<select value={capacidadSala} onChange={(event) => setCapacidadSala(event.target.value)}>{[2, 4, 6, 8, 10, 12].map((value) => <option key={value} value={value}>{value} personas</option>)}</select></label>
                  <div className="room-form-actions">
                    <button className="button button-dark" disabled={cargando}>{salaEnEdicion ? 'Guardar cambios' : 'Agregar espacio'}</button>
                    {salaEnEdicion && <button type="button" className="button button-outline" disabled={cargando} onClick={cancelarEdicionSala}>Cancelar edición</button>}
                  </div>
                </form>
                <div className="managed-rooms">
                  <h3>Espacios registrados <span>{salas.length}</span></h3>
                  {salas.length ? (
                    <ul>
                      {salas.map((sala) => (
                        <li key={sala.id}>
                          <div><strong>{sala.nombre}</strong><span>{sala.capacidad} personas · {sala.descripcion}</span></div>
                          <button type="button" className="button button-outline" disabled={cargando} onClick={() => editarSala(sala)}>Editar</button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="managed-rooms-empty">Todavía no hay espacios registrados.</p>}
                </div>
              </details>
            )}

            {perfil.tuRol === 'ADMIN' && (
              <section className="report-panel" aria-labelledby="report-heading">
                <div className="report-heading">
                  <div>
                    <span className="eyebrow">ANÁLISIS DE DEMANDA</span>
                    <h2 id="report-heading">Reporte de utilización</h2>
                    <p className="muted">Generalo sin interrumpir las reservas.</p>
                  </div>
                </div>
                <form className="report-form" onSubmit={generarReporte}>
                  <label>Desde<input type="date" required value={fechaReporteDesde} onChange={(event) => setFechaReporteDesde(event.target.value)} /></label>
                  <label>Hasta<input type="date" required min={fechaReporteDesde} value={fechaReporteHasta} onChange={(event) => setFechaReporteHasta(event.target.value)} /></label>
                  <button className="button button-dark" disabled={solicitandoReporte || reporte?.estado === 'queued' || reporte?.estado === 'running'}>
                    {solicitandoReporte ? 'Solicitando…' : reporte?.estado === 'queued' || reporte?.estado === 'running' ? 'Generando…' : 'Generar reporte'}
                  </button>
                </form>
                {reportes.length > 0 && (
                  <label className="report-history">
                    Reportes guardados
                    <select
                      value={reporte?.id ?? ''}
                      onChange={(event) => {
                        const seleccionado = reportes.find((item) => item.id === event.target.value) ?? null;
                        setReporte(seleccionado);
                        if (seleccionado) localStorage.setItem(REPORTE_KEY, seleccionado.id);
                      }}
                    >
                      {reportes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.fechaDesde} a {item.fechaHasta} · {item.estado}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {reporte && (
                  <div className="report-result" aria-live="polite">
                    <p className="report-status">
                      Estado: <strong>{reporte.estado === 'queued' ? 'En espera' : reporte.estado === 'running' ? 'Procesando' : reporte.estado === 'completed' ? 'Completado' : 'Error'}</strong>
                      <span> · Período {reporte.fechaDesde} al {reporte.fechaHasta}</span>
                    </p>
                    {reporte.estado === 'failed' && <p className="report-error" role="alert">{reporte.error ?? 'No se pudo generar el reporte.'}</p>}
                    {reporte.resultado && (
                      <>
                        <div className="report-totals">
                          <div><strong>{reporte.resultado.reservas}</strong><span>Reservas creadas</span></div>
                          <div><strong>{reporte.resultado.cancelaciones}</strong><span>Cancelaciones</span></div>
                        </div>
                        {reporte.resultado.porSala.length > 0 && (
                          <ul className="report-room-list">
                            {reporte.resultado.porSala.map((item) => (
                              <li key={item.salaId}>
                                <span>{salasPorId.get(item.salaId)?.nombre ?? item.salaId}</span>
                                <span>{item.reservas} reservas · {item.cancelaciones} cancelaciones</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>
            )}

            <div className="section-heading">
              <div><h2>Espacios disponibles</h2><span className="result-count">{cargandoSalas ? 'Buscando…' : `${disponibles.length} ${disponibles.length === 1 ? 'espacio' : 'espacios'}`}</span></div>
              <span className="availability-note"><span className="status-dot status-dot-green" /> DISPONIBLES EL {fecha} · {hora}</span>
            </div>

            {cargandoSalas ? (
              <div className="empty-state"><span className="loader" /><p>Buscando espacios para vos…</p></div>
            ) : disponibles.length ? (
              <section className="room-grid" aria-label="Espacios disponibles">
                {disponibles.map((sala, index) => (
                  <article className="room-card" key={sala.id}>
                    <div className={`room-visual room-visual-${index % 3}`}>
                      <span className="room-visual-tag">SUR COWORK · {String(index + 1).padStart(2, '0')}</span>
                      <span className="room-illustration" aria-hidden="true">{index % 3 === 0 ? '▱' : index % 3 === 1 ? '◫' : '⌂'}</span>
                      <span className="room-visual-caption">{index % 3 === 0 ? 'UN ESPACIO PARA ENFOCARTE' : index % 3 === 1 ? 'IDEAS QUE SE ENCUENTRAN' : 'TRABAJO A TU MANERA'}</span>
                    </div>
                    <div className="room-info">
                      <div className="room-title-row"><div><h3>{sala.nombre}</h3><p>{sala.descripcion}</p></div><span className="room-capacity">♙ {sala.capacidad}</span></div>
                      <div className="room-card-footer"><span className="room-duration">◷ &nbsp;1 hora · {hora}</span><button className="button button-primary" disabled={cargando || perfil.saldoCreditos < 50} onClick={() => void reservarSala(sala)}>{perfil.saldoCreditos < 50 ? 'Créditos insuficientes' : 'Reservar'} <span aria-hidden="true">↗</span></button></div>
                    </div>
                  </article>
                ))}
              </section>
            ) : (
              <div className="empty-state empty-state-card">
                <span className="empty-icon">⌕</span>
                <h3>No encontramos espacios para ese horario.</h3>
                <p>Probá con otro día o turno. Los espacios abren de 08:00 a 20:00.</p>
                {!salas.length && <p className="empty-hint">{esGestor ? 'Podés agregar el primer espacio desde “Agregar un espacio”.' : 'Pronto vas a encontrar nuevos espacios acá.'}</p>}
              </div>
            )}
            <p className="fine-print">Los turnos duran una hora y cuestan 50 créditos. Cancelá con al menos 24 horas de anticipación para recibir un reembolso completo.</p>
          </>
        ) : (
          <section className="reservation-list" aria-label="Mis reservas">
            {reservas.length ? reservas.map((reserva) => {
              const sala = salasPorId.get(reserva.sala);
              return (
                <article className={`reservation-card ${reserva.estado === 'Cancelada' ? 'reservation-cancelled' : ''}`} key={reserva.id}>
                  <div className="reservation-date-block"><span>{reserva.fecha.slice(8, 10)}</span><small>{reserva.fecha.slice(5, 7)} · {reserva.fecha.slice(0, 4)}</small></div>
                  <div className="reservation-main"><span className={reserva.estado === 'Confirmada' ? 'reservation-status' : 'reservation-status cancelled'}><span className="status-dot" /> {reserva.estado}</span><h3>{sala?.nombre ?? 'Espacio'}</h3><p>{mostrarFecha(reserva.fecha)} · 1 hora · {reserva.costoCreditos} créditos</p></div>
                  {reserva.estado === 'Confirmada' && <button className="button button-outline" disabled={cargando} onClick={() => void cancelarReserva(reserva)}>Cancelar reserva</button>}
                  {reserva.estado === 'Cancelada' && <span className="cancelled-label">CANCELADA</span>}
                </article>
              );
            }) : (
              <div className="empty-state empty-state-card"><span className="empty-icon">▧</span><h3>Todavía no tenés reservas.</h3><p>Encontrá un espacio que te guste y guardalo para tu próximo día de trabajo.</p><button className="button button-primary" onClick={() => setVista('reservar')}>Explorar espacios <span aria-hidden="true">↗</span></button></div>
            )}
          </section>
        )}
              {reservaACancelar && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h3>Cancelar reserva</h3>
            <p>
              ¿Estás seguro que querés cancelar la reserva de <strong>{salasPorId.get(reservaACancelar.sala)?.nombre ?? 'la sala'}</strong> para el <strong>{mostrarFecha(reservaACancelar.fecha)}</strong>?
            </p>
            
                        <div className="modal-warning">
              {(() => {
                const { totalHoras, horas, minutos } = obtenerTiempoRestante(reservaACancelar.fecha);
                
                if (totalHoras > 24) {
                  return `Se te reintegrarán ${reservaACancelar.costoCreditos} créditos.`;
                }

                let tiempoTexto = '';
                if (totalHoras <= 0) {
                  tiempoTexto = 'El turno ya pasó o está por comenzar';
                } else if (horas === 0) {
                  tiempoTexto = `Faltan ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
                } else {
                  tiempoTexto = `Faltan ${horas} ${horas === 1 ? 'hora' : 'horas'} y ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
                }

                return `${tiempoTexto} para el turno: no se reintegrarán créditos.`;
              })()}
            </div>

            <div className="modal-actions">
              <button className="button button-outline" onClick={() => setReservaACancelar(null)}>
                Volver
              </button>
              <button className="button button-dark" onClick={() => void confirmarCancelacion()}>
                Sí, cancelar reserva
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
      <footer className="site-footer"><span>sur<span className="brand-weight">cowork</span></span><span>Un espacio para cada idea.</span><span>CÓRDOBA · AR</span></footer>
      {cargando && <div className="busy-indicator" role="status"><span className="loader" /><span className="sr-only">Procesando solicitud</span></div>}
    </div>
  );
}

export default App;
