import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExclamationTriangle,
  faCheckCircle,
  faInfoCircle,
  faCog,
  faTimes,
  faTools,
  faCarCrash,
  faSpinner,
  faArrowDown,
  faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import './ReporteFallasScreen.css';

// Firebase imports
import firebaseApp from "../firebase/credenciales";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const ReporteFallasScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Estados principales
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [equipo, setEquipo] = useState('');
  const [prioridad, setPrioridad] = useState('media');
  const [isLoading, setIsLoading] = useState(false);
  const [fallasReportadas, setFallasReportadas] = useState([]);
  const [loadingFallas, setLoadingFallas] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [equiposDisponibles, setEquiposDisponibles] = useState([]);
  const [loadingEquipos, setLoadingEquipos] = useState(true);
  
  // Estados para el modal de atención
  const [modalVisible, setModalVisible] = useState(false);
  const [fallaSeleccionada, setFallaSeleccionada] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState('en_proceso');
  const [comentario, setComentario] = useState('');
  const [loadingAtencion, setLoadingAtencion] = useState(false);

  // Obtener el rol del usuario
  useEffect(() => {
    const getUserData = async () => {
      try {
        const userData = location.state?.userData;
        
        if (userData && userData.rol) {
          setUserRole(userData.rol);
          setUserInfo(userData);
        } else {
          // Si no hay datos en location.state, intentar obtener de localStorage
          const storedUserData = localStorage.getItem('userData');
          
          if (storedUserData) {
            const parsedUserData = JSON.parse(storedUserData);
            setUserRole(parsedUserData.rol);
            setUserInfo(parsedUserData);
          }
        }
      } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
      }
    };

    getUserData();
  }, [location.state]);

  // Cargar los equipos desde Firebase
  const cargarEquipos = async () => {
    try {
      setLoadingEquipos(true);
      
      // Consultar la colección de equipos
      const equiposRef = collection(firestore, 'equipos');
      
      // Primero intentamos con una consulta específica
      try {
        const qEquipos = query(equiposRef, where('estado', '==', 'Operativo'));
        const querySnapshot = await getDocs(qEquipos);
        
        const equipos = [];
        querySnapshot.forEach((doc) => {
          const equipoData = doc.data();
          equipos.push({
            id: doc.id,
            nombre: `Camión #${equipoData.numero || 'S/N'} - ${equipoData.modelo || ''}`,
            numero: equipoData.numero || 'S/N',
            modelo: equipoData.modelo || '',
            placa: equipoData.placa || '',
            estado: equipoData.estado || 'Operativo',
            kilometraje: equipoData.kilometraje || 0
          });
        });
        
        setEquiposDisponibles(equipos);
      } catch (queryError) {
        console.error('Error en la consulta específica:', queryError);
        
        // Si falla la consulta específica, intentar traer todos los equipos
        const snapshotAll = await getDocs(equiposRef);
        
        const equipos = [];
        snapshotAll.forEach((doc) => {
          const equipoData = doc.data();
          // Solo incluir los operativos
          if (equipoData.estado === 'Operativo') {
            equipos.push({
              id: doc.id,
              nombre: `Camión #${equipoData.numero || 'S/N'} - ${equipoData.modelo || ''}`,
              numero: equipoData.numero || 'S/N',
              modelo: equipoData.modelo || '',
              placa: equipoData.placa || '',
              estado: 'Operativo',
              kilometraje: equipoData.kilometraje || 0
            });
          }
        });
        
        setEquiposDisponibles(equipos);
      }
    } catch (error) {
      console.error('Error general al cargar equipos:', error);
      alert('Error de conexión. No se pudieron cargar los equipos. ¿Deseas reintentar?');
      setEquiposDisponibles([]);
    } finally {
      setLoadingEquipos(false);
    }
  };

  // Función para reconectar con Firebase
  const reconnectFirebase = () => {
    cargarEquipos();
    cargarFallas();
  };

  // Cargar las fallas reportadas
  const cargarFallas = async () => {
    try {
      setLoadingFallas(true);
      const fallasRef = collection(firestore, 'fallas');
      let fallasQuery;
      
      // Si es conductor, mostrar solo sus fallas
      if (userRole === 'conductor' && userInfo) {
        try {
          // Intentar con la consulta indexada
          fallasQuery = query(
            fallasRef, 
            where('usuarioId', '==', userInfo.uid),
            orderBy('fechaCreacion', 'desc')
          );
          
          const querySnapshot = await getDocs(fallasQuery);
          const fallas = [];
          
          querySnapshot.forEach((doc) => {
            fallas.push({
              id: doc.id,
              ...doc.data()
            });
          });
          
          setFallasReportadas(fallas);
        } catch (indexError) {
          console.error('Error de índice, usando consulta alternativa:', indexError);
          
          // Si falla por error de índice, usar consulta sin ordenamiento
          fallasQuery = query(
            fallasRef, 
            where('usuarioId', '==', userInfo.uid)
          );
          
          const querySnapshot = await getDocs(fallasQuery);
          const fallas = [];
          
          querySnapshot.forEach((doc) => {
            fallas.push({
              id: doc.id,
              ...doc.data()
            });
          });
          
          // Ordenar manualmente los resultados
          fallas.sort((a, b) => {
            // Si no hay fechaCreacion, colocar al final
            if (!a.fechaCreacion) return 1;
            if (!b.fechaCreacion) return -1;
            
            // Convertir a Date si es necesario
            const fechaA = a.fechaCreacion.toDate ? a.fechaCreacion.toDate() : new Date(a.fechaCreacion);
            const fechaB = b.fechaCreacion.toDate ? b.fechaCreacion.toDate() : new Date(b.fechaCreacion);
            
            // Ordenar de más reciente a más antiguo
            return fechaB - fechaA;
          });
          
          setFallasReportadas(fallas);
          
          // Mostrar alerta para crear el índice solo la primera vez
          const indexAlertShown = localStorage.getItem('indexAlertShown');
          if (!indexAlertShown) {
            alert('Para mejorar el rendimiento, se recomienda crear un índice en Firestore. Por favor, siga el enlace en la consola de desarrollo.');
            localStorage.setItem('indexAlertShown', 'true');
          }
        }
      } else {
        // Si es admin o mecánico, mostrar todas las fallas
        fallasQuery = query(
          fallasRef,
          orderBy('fechaCreacion', 'desc')
        );
        
        const querySnapshot = await getDocs(fallasQuery);
        const fallas = [];
        
        querySnapshot.forEach((doc) => {
          fallas.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        setFallasReportadas(fallas);
      }
    } catch (error) {
      console.error('Error al cargar fallas:', error);
      alert('Error: No se pudieron cargar las fallas reportadas');
    } finally {
      setLoadingFallas(false);
    }
  };

  // Obtener el último número de ticket
  const obtenerUltimoTicket = async () => {
    try {
      // Consultar directamente la colección de fallas para obtener el ticket más alto
      const fallasRef = collection(firestore, 'fallas');
      const querySnapshot = await getDocs(fallasRef);
      
      let maxTicket = 0;
      
      // Revisar cada documento para encontrar el número de ticket más alto
      querySnapshot.forEach((doc) => {
        const fallaData = doc.data();
        if (fallaData.numeroTicket && typeof fallaData.numeroTicket === 'number') {
          if (fallaData.numeroTicket > maxTicket) {
            maxTicket = fallaData.numeroTicket;
          }
        }
      });
      
      console.log('Número de ticket más alto encontrado:', maxTicket);
      return maxTicket;
    } catch (error) {
      console.error('Error al obtener último ticket:', error);
      return 0; // Si hay error, comenzar desde 0
    }
  };

  useEffect(() => {
    if (userRole) {
      cargarFallas();
      cargarEquipos();
    }
  }, [userRole, userInfo]);

  // Función para reportar una falla
  const reportarFalla = async () => {
    if (!titulo || !descripcion || !equipo) {
      alert('Error: Por favor complete todos los campos');
      return;
    }

    setIsLoading(true);

    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        alert('Error: Debe iniciar sesión para reportar una falla');
        setIsLoading(false);
        return;
      }

      // Obtener datos del equipo seleccionado
      const equipoSeleccionado = equiposDisponibles.find(e => e.id === equipo);
      if (!equipoSeleccionado) {
        alert('Error: Equipo no encontrado');
        setIsLoading(false);
        return;
      }

      // Obtener el último número de ticket y generar uno nuevo
      const ultimoTicket = await obtenerUltimoTicket();
      const nuevoNumeroTicket = ultimoTicket + 1;

      // Crear documento en la colección "fallas"
      const fallaData = {
        numeroTicket: nuevoNumeroTicket,
        titulo,
        descripcion,
        equipoId: equipo,
        equipoNombre: equipoSeleccionado.nombre,
        equipoNumero: equipoSeleccionado.numero,
        prioridad,
        estado: 'pendiente',
        usuarioId: currentUser.uid,
        usuarioEmail: currentUser.email,
        usuarioNombre: userInfo?.nombre || currentUser.email,
        fechaCreacion: serverTimestamp(),
        fechaActualizacion: serverTimestamp(),
        historial: [
          {
            estado: 'pendiente',
            fecha: new Date().toISOString(),
            usuario: currentUser.email,
            comentario: 'Falla reportada'
          }
        ]
      };

      await addDoc(collection(firestore, 'fallas'), fallaData);

      alert(`Éxito: Falla reportada correctamente. Ticket #${nuevoNumeroTicket}`);
      
      // Limpiar el formulario
      setTitulo('');
      setDescripcion('');
      setEquipo('');
      setPrioridad('media');
      
      // Recargar las fallas
      cargarFallas();
    } catch (error) {
      console.error('Error al reportar falla:', error);
      alert('Error: No se pudo reportar la falla');
    } finally {
      setIsLoading(false);
    }
  };

  // Función para abrir el modal de atención
  const handleAtender = (falla) => {
    setFallaSeleccionada(falla);
    setNuevoEstado(falla.estado === 'pendiente' ? 'en_proceso' : 'completado');
    setComentario('');
    setModalVisible(true);
  };

  // Función para procesar la atención de la falla
  const procesarAtencion = async () => {
    if (!comentario) {
      alert('Error: Por favor ingrese un comentario');
      return;
    }

    setLoadingAtencion(true);

    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        alert('Error: Debe iniciar sesión para atender la falla');
        setLoadingAtencion(false);
        return;
      }

      // Preparar historial
      const nuevoHistorial = [
        ...(fallaSeleccionada.historial || []),
        {
          estado: nuevoEstado,
          fecha: new Date().toISOString(),
          usuario: currentUser.email,
          comentario: comentario
        }
      ];

      // Actualizar documento en la colección "fallas"
      const fallaRef = doc(firestore, 'fallas', fallaSeleccionada.id);
      
      await updateDoc(fallaRef, {
        estado: nuevoEstado,
        fechaActualizacion: serverTimestamp(),
        historial: nuevoHistorial,
        tecnicoAsignado: currentUser.email,
        tecnicoNombre: userInfo?.nombre || currentUser.email
      });

      // Si se completa la falla y hay un equipo asociado, actualizar su estado
      if (nuevoEstado === 'completado' && fallaSeleccionada.equipoId) {
        const equipoRef = doc(firestore, 'equipos', fallaSeleccionada.equipoId);
        // Solo cambiar el estado si está en mantenimiento
        const equipoDoc = await getDoc(equipoRef);
        if (equipoDoc.exists() && equipoDoc.data().estado === 'En Mantenimiento') {
          await updateDoc(equipoRef, {
            estado: 'Operativo',
            fechaActualizacion: serverTimestamp()
          });
        }
      }

      alert(`Éxito: Falla ${nuevoEstado === 'en_proceso' ? 'en proceso' : 'completada'} correctamente`);
      
      // Cerrar modal
      setModalVisible(false);
      
      // Recargar las fallas
      cargarFallas();
    } catch (error) {
      console.error('Error al atender falla:', error);
      alert('Error: No se pudo actualizar el estado de la falla');
    } finally {
      setLoadingAtencion(false);
    }
  };

  // Función para obtener color según prioridad
  const getPrioridadColor = (prioridad) => {
    switch (prioridad) {
      case 'alta':
        return '#F44336';
      case 'media':
        return '#FF9800';
      case 'baja':
        return '#4CAF50';
      default:
        return '#FF9800';
    }
  };

  // Función para obtener color según estado
  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente':
        return '#FF9800';
      case 'en_proceso':
        return '#2196F3';
      case 'completado':
        return '#4CAF50';
      case 'cancelado':
        return '#9E9E9E';
      default:
        return '#FF9800';
    }
  };

  // Función para formatear la fecha
  const formatearFecha = (timestamp) => {
    if (!timestamp) return 'Fecha no disponible';
    
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return fecha.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para obtener texto del botón según estado
  const getTextoBoton = (estado) => {
    switch (estado) {
      case 'pendiente':
        return 'Atender';
      case 'en_proceso':
        return 'Completar';
      case 'completado':
        return 'Ver Detalles';
      default:
        return 'Atender';
    }
  };

  return (
    <div className="reporte-fallas-container">
      <div className="reporte-fallas-header">
        <h1 className="reporte-fallas-title">
          {userRole === 'conductor' ? 'Reportar Falla' : 'Gestión de Fallas Reportadas'}
        </h1>
      </div>

      {/* Formulario para reportar falla (solo visible para conductores) */}
      {userRole === 'conductor' && (
        <div className="reporte-form-card">
          <div className="form-group">
            <label className="form-label">Título:</label>
            <input
              className="form-input"
              type="text"
              placeholder="Ej: Falla en frenos"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Equipo:</label>
            <div className="select-container">
              {loadingEquipos ? (
                <div className="loading-indicator">
                  <FontAwesomeIcon icon={faSpinner} spin />
                </div>
              ) : (
                <select
                  className="form-select"
                  value={equipo}
                  onChange={(e) => setEquipo(e.target.value)}
                >
                  <option value="">Seleccione un equipo</option>
                  {equiposDisponibles.map((equipoItem) => (
                    <option key={equipoItem.id} value={equipoItem.id}>
                      {equipoItem.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Prioridad:</label>
            <div className="select-container">
              <select
                className="form-select"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción:</label>
            <textarea
              className="form-textarea"
              placeholder="Describa detalladamente la falla observada"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows="4"
            ></textarea>
          </div>

          <button
            className="submit-button"
            onClick={reportarFalla}
            disabled={isLoading}
          >
            {isLoading ? (
              <FontAwesomeIcon icon={faSpinner} spin className="icon-left" />
            ) : (
              <FontAwesomeIcon icon={faExclamationTriangle} className="icon-left" />
            )}
            Reportar Falla
          </button>
        </div>
      )}

      {/* Lista de fallas reportadas */}
      <div className="fallas-list-section">
        <h2 className="section-title">Fallas Reportadas</h2>
        
        {loadingFallas ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Cargando fallas...</p>
          </div>
        ) : fallasReportadas.length === 0 ? (
          <div className="empty-state">
            <FontAwesomeIcon icon={faInfoCircle} className="empty-icon" />
            <p className="empty-text">No hay fallas reportadas</p>
          </div>
        ) : (
          <div className="fallas-grid">
            {fallasReportadas.map((falla) => (
              <div key={falla.id} className="falla-card">
                <div className="falla-header">
                  <div className="falla-info">
                    {/* Mostrar número de ticket */}
                    {(userRole === 'admin' || userRole === 'mecanico') && (
                      <div className="ticket-badge">
                        Ticket #{falla.numeroTicket || '?'}
                      </div>
                    )}
                    <h3 className="falla-titulo">{falla.titulo}</h3>
                    <p className="falla-equipo">{falla.equipoNombre}</p>
                    
                    {/* Mostrar quién reportó (solo para admin/mecánico) */}
                    {(userRole === 'admin' || userRole === 'mecanico') && (
                      <p className="falla-reporter">
                        Reportado por: {falla.usuarioNombre || falla.usuarioEmail || 'Usuario desconocido'}
                      </p>
                    )}
                  </div>
                  <div 
                    className="prioridad-badge"
                    style={{ backgroundColor: getPrioridadColor(falla.prioridad) }}
                  >
                    {falla.prioridad.charAt(0).toUpperCase() + falla.prioridad.slice(1)}
                  </div>
                </div>
                
                <p className="falla-descripcion">{falla.descripcion}</p>
                
                <div className="falla-footer">
                  <div 
                    className="estado-badge"
                    style={{ backgroundColor: getEstadoColor(falla.estado) }}
                  >
                    {falla.estado === 'pendiente' ? 'Pendiente' : 
                     falla.estado === 'en_proceso' ? 'En proceso' :
                     falla.estado === 'completado' ? 'Completado' : 'Cancelado'}
                  </div>
                  <p className="falla-fecha">
                    {falla.fechaCreacion ? formatearFecha(falla.fechaCreacion) : 'Fecha no disponible'}
                  </p>
                </div>
                
                {falla.tecnicoAsignado && falla.estado !== 'pendiente' && (
                  <p className="falla-tecnico">
                    Atendido por: {falla.tecnicoNombre || falla.tecnicoAsignado}
                  </p>
                )}
                
                {(userRole === 'admin' || userRole === 'mecanico') && falla.estado !== 'cancelado' && (
                  <button 
                    className="atender-button"
                    style={{ backgroundColor: getEstadoColor(falla.estado) }}
                    onClick={() => handleAtender(falla)}
                  >
                    {falla.estado === 'pendiente' && <FontAwesomeIcon icon={faCog} className="icon-left" />}
                    {falla.estado === 'en_proceso' && <FontAwesomeIcon icon={faCheckCircle} className="icon-left" />}
                    {falla.estado === 'completado' && <FontAwesomeIcon icon={faInfoCircle} className="icon-left" />}
                    {getTextoBoton(falla.estado)}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para atender falla */}
      {modalVisible && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">
                {nuevoEstado === 'en_proceso' ? 'Atender Falla' : 'Completar Falla'}
              </h2>
              <button 
                className="close-button" 
                onClick={() => setModalVisible(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            {fallaSeleccionada && (
              <div className="modal-body">
                <div className="falla-details">
                  {/* Mostrar número de ticket en el modal */}
                  <div className="ticket-badge modal-ticket">
                    Ticket #{fallaSeleccionada.numeroTicket || '?'}
                  </div>
                  <h3 className="falla-titulo-modal">{fallaSeleccionada.titulo}</h3>
                  <p className="falla-equipo-modal">{fallaSeleccionada.equipoNombre}</p>
                  <p className="falla-reporter-modal">
                    Reportado por: {fallaSeleccionada.usuarioNombre || fallaSeleccionada.usuarioEmail || 'Usuario desconocido'}
                  </p>
                  <p className="falla-fecha-modal">
                    Fecha de reporte: {fallaSeleccionada.fechaCreacion ? formatearFecha(fallaSeleccionada.fechaCreacion) : 'Fecha no disponible'}
                  </p>
                  <div 
                    className="estado-badge modal-estado"
                    style={{ backgroundColor: getEstadoColor(fallaSeleccionada.estado) }}
                  >
                    Estado actual: {fallaSeleccionada.estado === 'pendiente' ? 'Pendiente' : 
                                  fallaSeleccionada.estado === 'en_proceso' ? 'En proceso' : 'Completado'}
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Actualizar estado a:</label>
                  <div className="select-container">
                    <select
                      className="form-select"
                      value={nuevoEstado}
                      onChange={(e) => setNuevoEstado(e.target.value)}
                      disabled={fallaSeleccionada.estado === 'completado'}
                    >
                      {fallaSeleccionada.estado === 'pendiente' && (
                        <option value="en_proceso">En proceso</option>
                      )}
                      {(fallaSeleccionada.estado === 'pendiente' || fallaSeleccionada.estado === 'en_proceso') && (
                        <option value="completado">Completado</option>
                      )}
                      {fallaSeleccionada.estado === 'en_proceso' && (
                        <option value="cancelado">Cancelado</option>
                      )}
                      {fallaSeleccionada.estado === 'completado' && (
                        <option value="completado">Completado</option>
                      )}
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Comentario:</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Agregue un comentario sobre la atención realizada"
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows="4"
                    disabled={fallaSeleccionada.estado === 'completado'}
                  ></textarea>
                </div>
                
                {fallaSeleccionada.historial && fallaSeleccionada.historial.length > 0 && (
                  <div className="historial-section">
                    <h4 className="historial-title">Historial de la falla:</h4>
                    <div className="historial-items">
                      {fallaSeleccionada.historial.map((item, index) => (
                        <div 
                          key={index} 
                          className="historial-item"
                          style={{ borderLeftColor: getEstadoColor(item.estado) }}
                        >
                          <div className="historial-header">
                            <span className="historial-fecha">
                              {new Date(item.fecha).toLocaleString()}
                            </span>
                          </div>
                          <p className="historial-usuario">Por: {item.usuario}</p>
                          <p className="historial-comentario">{item.comentario}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {fallaSeleccionada.estado !== 'completado' && (
                  <button
                    className="proceso-button"
                    style={{ backgroundColor: getEstadoColor(nuevoEstado) }}
                    onClick={procesarAtencion}
                    disabled={loadingAtencion}
                  >
                    {loadingAtencion ? (
                      <FontAwesomeIcon icon={faSpinner} spin className="icon-left" />
                    ) : (
                      <>
                        {nuevoEstado === 'en_proceso' && <FontAwesomeIcon icon={faCog} className="icon-left" />}
                        {nuevoEstado === 'completado' && <FontAwesomeIcon icon={faCheckCircle} className="icon-left" />}
                        {nuevoEstado === 'cancelado' && <FontAwesomeIcon icon={faTimes} className="icon-left" />}
                        {nuevoEstado === 'en_proceso' ? 'Iniciar atención' : 
                        nuevoEstado === 'completado' ? 'Marcar como completado' : 'Cancelar falla'}
                      </>
                    )}
                  </button>
                
            )}</div>
          )}
        </div>
      </div>
    )}
  </div>
);
};

export default ReporteFallasScreen;