import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheckCircle, 
  faExclamationTriangle, 
  faTimesCircle, 
  faQuestionCircle, 
  faPen, 
  faRotate,
  faXmark
} from '@fortawesome/free-solid-svg-icons';
import './DisponibilidadScreen.css';
// Firebase imports
import firebaseApp from "../firebase/credenciales";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Función auxiliar para convertir timestamps de Firebase a string
const formatFirebaseTimestamp = (timestamp) => {
  if (!timestamp) return '';
  
  // Si es un objeto Firebase Timestamp
  if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
    return timestamp.toDate().toISOString().split('T')[0];
  }
  
  // Si ya es string
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  
  // Si es date
  if (timestamp instanceof Date) {
    return timestamp.toISOString().split('T')[0];
  }
  
  return '';
};

const DisponibilidadScreen = ({ route }) => {
  // Refs para detectar tamaño de ventana
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  // Determinar tamaños de pantalla
  const isSmallScreen = windowDimensions.width < 576;
  const isMediumScreen = windowDimensions.width >= 576 && windowDimensions.width < 992;
  const isLargeScreen = windowDimensions.width >= 992;
  
  // Estado para los datos del usuario
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  
  // Estado para la lista de camiones
  const [camiones, setCamiones] = useState([]);
  
  // Estado para el modal de edición
  const [modalVisible, setModalVisible] = useState(false);
  const [camionSeleccionado, setCamionSeleccionado] = useState(null);
  
  // Estado de carga
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  
  // Estado para manejo de errores
  const [error, setError] = useState(null);
  
  // Estado para el formulario del modal
  const [formData, setFormData] = useState({
    estadoDisponibilidad: 'disponible',
    motivo: '',
    limitaciones: '',
    estimacionFinalizacion: ''
  });

  // Estado para filtros
  const [filtroActual, setFiltroActual] = useState('todos');

  // Referencias para limpieza
  const unsubscribeRef = useRef(null);
  const isMountedRef = useRef(true);

  // Actualizar dimensiones de la ventana cuando cambia el tamaño
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Control de montaje del componente
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Obtener información del usuario 
  useEffect(() => {
    const getUserInfo = async () => {
      try {
        // Intentar obtener el rol del usuario desde los parámetros de la ruta
        if (route?.params?.userData?.rol) {
          setUserRole(route.params.userData.rol);
          setUserName(route.params.userData.nombre || route.params.userData.email || 'Usuario');
        } else {
          // Intentar obtener del usuario autenticado
          const currentUser = auth.currentUser;
          if (currentUser) {
            // Intentar obtener el perfil completo desde Firestore
            try {
              const userDoc = await getDoc(doc(firestore, 'usuarios', currentUser.uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                setUserRole(userData.rol || 'conductor');
                setUserName(userData.nombre || userData.email || currentUser.email || 'Usuario');
              } else {
                setUserRole('conductor'); // Rol por defecto
                setUserName(currentUser.email || 'Usuario');
              }
            } catch (err) {
              console.error('Error al obtener datos de usuario de Firestore:', err);
              setUserRole('conductor');
              setUserName(currentUser.email || 'Usuario');
            }
          } else {
            setUserRole('conductor'); // Rol por defecto
            setUserName('Usuario');
          }
        }
      } catch (err) {
        console.error('Error al obtener información del usuario:', err);
        setUserRole('conductor'); // Rol por defecto en caso de error
        setUserName('Usuario');
      }
    };

    getUserInfo();
  }, [route]);

  // Cargar datos desde Firebase
  useEffect(() => {
    const loadEquipos = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Configurar el listener para actualizaciones en tiempo real
        const equiposRef = collection(firestore, 'equipos');
        const q = query(equiposRef, orderBy('numero', 'asc'));
        
        // Suscribirse a cambios
        unsubscribeRef.current = onSnapshot(q, 
          (snapshot) => {
            if (isMountedRef.current) {
              const equiposData = [];
              snapshot.forEach((doc) => {
                const data = doc.data();
                
                // Mapear datos del equipo y convertir los timestamps a string
                equiposData.push({
                  id: doc.id,
                  numero: data.numero || '',
                  modelo: data.modelo || '',
                  estadoDisponibilidad: data.estadoDisponibilidad || 'disponible',
                  ultimaActualizacion: formatFirebaseTimestamp(data.fechaActualizacionDisponibilidad) ||
                                       formatFirebaseTimestamp(data.fechaActualizacion) || '',
                  actualizadoPor: data.actualizadoPor || '',
                  motivo: data.motivo || '',
                  limitaciones: data.limitaciones || '',
                  estimacionFinalizacion: data.estimacionFinalizacion || '',
                  estado: data.estado || 'Operativo' // Estado general del equipo
                });
              });
              
              setCamiones(equiposData);
              setLoading(false);
            }
          },
          (error) => {
            console.error("Error al escuchar cambios en equipos:", error);
            setError("Error al cargar datos en tiempo real. Intente nuevamente.");
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('Error al cargar equipos:', err);
        setError('No se pudieron cargar los datos. Intente nuevamente.');
        setLoading(false);
      }
    };

    loadEquipos();
  }, []);

  // Verificar si el usuario puede editar (solo mecánico o administrador)
  const canEdit = userRole === 'mecanico' || userRole === 'admin';

  // Función para filtrar camiones por estado de disponibilidad
  const filtrarCamionesPorEstado = (estado) => {
    return camiones.filter(camion => camion.estadoDisponibilidad === estado);
  };
  
  // Datos filtrados para mostrar
  const datosFiltrados = filtroActual === 'todos' 
    ? camiones 
    : filtrarCamionesPorEstado(filtroActual);

  // Función para abrir el modal de edición
  const handleEdit = (camion) => {
    setCamionSeleccionado(camion);
    setFormData({
      estadoDisponibilidad: camion.estadoDisponibilidad || 'disponible',
      motivo: camion.motivo || '',
      limitaciones: camion.limitaciones || '',
      estimacionFinalizacion: camion.estimacionFinalizacion || ''
    });
    setModalVisible(true);
  };

  // Función para guardar los cambios de disponibilidad del camión
  const handleSave = async () => {
    // Validaciones
    if (formData.estadoDisponibilidad === 'no_disponible' && !formData.motivo) {
      alert('Error: Debe ingresar un motivo cuando el camión no está disponible');
      return;
    }

    if (formData.estadoDisponibilidad === 'parcial' && (!formData.motivo || !formData.limitaciones)) {
      alert('Error: Debe ingresar un motivo y las limitaciones cuando el camión está parcialmente disponible');
      return;
    }

    try {
      setLoadingAction(true);
      
      // Fecha actual formateada para guardar como string
      const fechaActual = new Date().toISOString().split('T')[0];
      
      // Datos a actualizar
      const actualizacion = {
        estadoDisponibilidad: formData.estadoDisponibilidad,
        motivo: formData.estadoDisponibilidad === 'disponible' ? '' : formData.motivo,
        limitaciones: formData.estadoDisponibilidad === 'parcial' ? formData.limitaciones : '',
        estimacionFinalizacion: formData.estadoDisponibilidad === 'disponible' ? '' : formData.estimacionFinalizacion,
        fechaActualizacionDisponibilidad: fechaActual, // Guardar como string
        actualizadoPor: userName,
        fechaActualizacion: serverTimestamp() // Este valor no se muestra directamente en la UI
      };
      
      // Actualizar el estado del equipo según la disponibilidad
      if (formData.estadoDisponibilidad === 'no_disponible') {
        actualizacion.estado = 'Fuera de Servicio';
      } else if (formData.estadoDisponibilidad === 'parcial') {
        actualizacion.estado = 'En Mantenimiento';
      } else {
        actualizacion.estado = 'Operativo';
      }
      
      // Actualizar en Firestore
      const equipoRef = doc(firestore, 'equipos', camionSeleccionado.id);
      await updateDoc(equipoRef, actualizacion);
      
      // Los datos se actualizarán automáticamente debido al listener onSnapshot
      setLoadingAction(false);
      setModalVisible(false);
      
      alert('Éxito: Disponibilidad del camión actualizada correctamente');
    } catch (err) {
      console.error('Error al guardar cambios:', err);
      setLoadingAction(false);
      alert('Error: No se pudo actualizar la disponibilidad. Intente nuevamente.');
    }
  };

  // Obtener color y texto según estado de disponibilidad
  const getEstadoInfo = (estado) => {
    switch (estado) {
      case 'disponible':
        return { color: '#52C41A', text: 'Disponible', icon: faCheckCircle };
      case 'parcial':
        return { color: '#FAAD14', text: isSmallScreen ? 'Parcial' : 'Parcialmente Disponible', icon: faExclamationTriangle };
      case 'no_disponible':
        return { color: '#FF4D4F', text: 'No Disponible', icon: faTimesCircle };
      default:
        return { color: '#999', text: 'Desconocido', icon: faQuestionCircle };
    }
  };

  // Función para forzar recarga de datos
  const handleRefresh = async () => {
    setLoading(true);
    
    // Desuscribirse y volver a suscribirse para forzar recarga
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    
    try {
      const equiposRef = collection(firestore, 'equipos');
      const q = query(equiposRef, orderBy('numero', 'asc'));
      
      // Obtener datos frescos
      const snapshot = await getDocs(q);
      const equiposData = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        equiposData.push({
          id: doc.id,
          numero: data.numero || '',
          modelo: data.modelo || '',
          estadoDisponibilidad: data.estadoDisponibilidad || 'disponible',
          ultimaActualizacion: formatFirebaseTimestamp(data.fechaActualizacionDisponibilidad) ||
                              formatFirebaseTimestamp(data.fechaActualizacion) || '',
          actualizadoPor: data.actualizadoPor || '',
          motivo: data.motivo || '',
          limitaciones: data.limitaciones || '',
          estimacionFinalizacion: data.estimacionFinalizacion || '',
          estado: data.estado || 'Operativo'
        });
      });
      
      setCamiones(equiposData);
      
      // Volver a configurar el listener
      unsubscribeRef.current = onSnapshot(q, 
        (snapshot) => {
          if (isMountedRef.current) {
            const newEquiposData = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              newEquiposData.push({
                id: doc.id,
                numero: data.numero || '',
                modelo: data.modelo || '',
                estadoDisponibilidad: data.estadoDisponibilidad || 'disponible',
                ultimaActualizacion: formatFirebaseTimestamp(data.fechaActualizacionDisponibilidad) ||
                                    formatFirebaseTimestamp(data.fechaActualizacion) || '',
                actualizadoPor: data.actualizadoPor || '',
                motivo: data.motivo || '',
                limitaciones: data.limitaciones || '',
                estimacionFinalizacion: data.estimacionFinalizacion || '',
                estado: data.estado || 'Operativo'
              });
            });
            
            setCamiones(newEquiposData);
          }
        },
        (error) => {
          console.error("Error al escuchar cambios en equipos:", error);
          setError("Error al cargar datos en tiempo real. Intente nuevamente.");
        }
      );
      
      setError(null);
    } catch (err) {
      console.error('Error al recargar equipos:', err);
      setError('No se pudieron recargar los datos. Intente nuevamente.');
    }
    
    setLoading(false);
  };

  // Renderizado de un ítem de la lista (Camión)
  const CamionItem = ({ item }) => {
    const estadoInfo = getEstadoInfo(item.estadoDisponibilidad);
    
    return (
      <div className="camion-item">
        <div className="camion-header">
          <h3 className="camion-numero">Camión #{item.numero}</h3>
          <div 
            className="disponibilidad-badge" 
            style={{ backgroundColor: estadoInfo.color }}
          >
            <FontAwesomeIcon icon={estadoInfo.icon} className="estado-icon" />
            <span className="disponibilidad-text">{estadoInfo.text}</span>
          </div>
        </div>
        
        <p className="camion-modelo">{item.modelo}</p>
        
        {/* Mostrar información adicional si no está totalmente disponible */}
        {item.estadoDisponibilidad !== 'disponible' && (
          <div 
            className="info-no-disponible"
            style={{ 
              borderLeftColor: item.estadoDisponibilidad === 'parcial' ? '#FAAD14' : '#FF4D4F' 
            }}
          >
            <p className="motivo-text">
              <strong>Motivo: </strong>
              {item.motivo || 'No especificado'}
            </p>
            
            {item.estadoDisponibilidad === 'parcial' && item.limitaciones && (
              <p className="limitaciones-text">
                <strong>Limitaciones: </strong>
                {item.limitaciones}
              </p>
            )}
            
            {item.estimacionFinalizacion && (
              <p className="estimacion-text">
                <strong>Reparación estimada: </strong>
                {item.estimacionFinalizacion}
              </p>
            )}
          </div>
        )}
        
        <div className={`camion-footer ${isSmallScreen ? 'mobile' : ''}`}>
          <p className="actualizacion-text">
            <strong>Actualizado: </strong>
            {item.ultimaActualizacion ? item.ultimaActualizacion : 'No registrado'} 
            {item.actualizadoPor ? ` por ${item.actualizadoPor}` : ''}
          </p>
          
          {/* Botón de edición (solo visible para mecánicos y administradores) */}
          {canEdit && (
            <button 
              className="editar-button"
              onClick={() => handleEdit(item)}
            >
              <FontAwesomeIcon icon={faPen} />
              <span>Editar</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  // Si aún está cargando, mostrar indicador
  if (loading && camiones.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="loading-text">Cargando equipos...</p>
      </div>
    );
  }

  return (
    <div className="disponibilidad-container">
      {loading && (
        <div className="overlay-loading">
          <div className="spinner"></div>
        </div>
      )}
      
      <div className="header">
        <div className="header-top">
          <h1 className={`title ${isSmallScreen ? 'small' : ''}`}>
            Disponibilidad de Camiones
          </h1>
          
          <button 
            className="refresh-button"
            onClick={handleRefresh}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faRotate} />
          </button>
        </div>
        
        {/* Filtros - Adaptados para diferentes tamaños de pantalla */}
        <div className={`filtros-container ${isSmallScreen ? 'scrollable' : ''}`}>
          <button 
            className={`filtro-button ${filtroActual === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroActual('todos')}
          >
            Todos
          </button>
          
          <button 
            className={`filtro-button ${filtroActual === 'disponible' ? 'active disponible' : ''}`}
            onClick={() => setFiltroActual('disponible')}
          >
            Disponibles
          </button>
          
          <button 
            className={`filtro-button ${filtroActual === 'parcial' ? 'active parcial' : ''}`}
            onClick={() => setFiltroActual('parcial')}
          >
            {isSmallScreen ? 'Parcial' : 'Parcialmente'}
          </button>
          
          <button 
            className={`filtro-button ${filtroActual === 'no_disponible' ? 'active no-disponible' : ''}`}
            onClick={() => setFiltroActual('no_disponible')}
          >
            No Disponibles
          </button>
        </div>
      </div>
      
      {/* Mostrar mensaje de error si existe */}
      {error && (
        <div className="error-container">
          <p className="error-text">{error}</p>
          <button 
            className="reload-button"
            onClick={handleRefresh}
          >
            Reintentar
          </button>
        </div>
      )}
      
      {/* Lista de camiones */}
      <div className={`lista-container ${isLargeScreen ? 'grid-view' : ''}`}>
        {datosFiltrados.length > 0 ? (
          datosFiltrados.map(item => (
            <CamionItem key={item.id} item={item} />
          ))
        ) : (
          <div className="empty-list">
            <p className="empty-text">No hay camiones que coincidan con el filtro</p>
          </div>
        )}
      </div>
      
      {/* Modal para editar disponibilidad (optimizado para diferentes pantallas) */}
      {canEdit && modalVisible && (
        <div className="modal-backdrop">
          <div className={`modal-content ${isLargeScreen ? 'large' : ''}`}>
            <div className="modal-header">
              <h2 className="modal-title">
                Editar Disponibilidad - Camión #{camionSeleccionado?.numero}
              </h2>
              <button 
                className="close-button"
                onClick={() => setModalVisible(false)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            
            <div className="form-container">
              <h3 className="section-title">Estado del camión</h3>
              
              <div className={`estado-options ${isSmallScreen ? 'vertical' : ''}`}>
                <div 
                  className={`estado-option ${formData.estadoDisponibilidad === 'disponible' ? 'selected' : ''}`}
                  style={{ borderColor: '#52C41A' }}
                  onClick={() => setFormData({
                    ...formData, 
                    estadoDisponibilidad: 'disponible',
                    motivo: '',
                    limitaciones: '',
                    estimacionFinalizacion: ''
                  })}
                >
                  <div className="estado-circle" style={{ backgroundColor: '#52C41A' }}>
                    <FontAwesomeIcon icon={faCheckCircle} />
                  </div>
                  <div className="estado-text-container">
                    <strong className="estado-text">Disponible</strong>
                    <span className="estado-desc">100% operativo</span>
                  </div>
                </div>
                
                <div 
                  className={`estado-option ${formData.estadoDisponibilidad === 'parcial' ? 'selected' : ''}`}
                  style={{ borderColor: '#FAAD14' }}
                  onClick={() => setFormData({...formData, estadoDisponibilidad: 'parcial'})}
                >
                  <div className="estado-circle" style={{ backgroundColor: '#FAAD14' }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                  </div>
                  <div className="estado-text-container">
                    <strong className="estado-text">Parcial</strong>
                    <span className="estado-desc">Con limitaciones</span>
                  </div>
                </div>
                
                <div 
                  className={`estado-option ${formData.estadoDisponibilidad === 'no_disponible' ? 'selected' : ''}`}
                  style={{ borderColor: '#FF4D4F' }}
                  onClick={() => setFormData({...formData, estadoDisponibilidad: 'no_disponible'})}
                >
                  <div className="estado-circle" style={{ backgroundColor: '#FF4D4F' }}>
                    <FontAwesomeIcon icon={faTimesCircle} />
                  </div>
                  <div className="estado-text-container">
                    <strong className="estado-text">No Disponible</strong>
                    <span className="estado-desc">Fuera de servicio</span>
                  </div>
                </div>
              </div>
              
              {formData.estadoDisponibilidad !== 'disponible' && (
                <>
                  <div className="form-group">
                    <label className="input-label">Motivo</label>
                    <textarea
                      className="input textarea"
                      value={formData.motivo}
                      onChange={(e) => setFormData({...formData, motivo: e.target.value})}
                      placeholder={formData.estadoDisponibilidad === 'parcial' ? 
                        "Describa el problema" : 
                        "Ingrese el motivo por el cual no está disponible"}
                      rows={isSmallScreen ? 3 : 2}
                    />
                  </div>
                  
                  {formData.estadoDisponibilidad === 'parcial' && (
                    <div className="form-group">
                      <label className="input-label">Limitaciones</label>
                      <textarea
                        className="input textarea"
                        value={formData.limitaciones}
                        onChange={(e) => setFormData({...formData, limitaciones: e.target.value})}
                        placeholder="Especifique las limitaciones de operación"
                        rows={isSmallScreen ? 3 : 2}
                      />
                    </div>
                  )}
                  
                  <div className="form-group">
                    <label className="input-label">Fecha estimada de reparación</label>
                    <input
                      type="date"
                      className="input"
                      value={formData.estimacionFinalizacion}
                      onChange={(e) => setFormData({...formData, estimacionFinalizacion: e.target.value})}
                    />
                  </div>
                </>
              )}
              
              <button 
                className="submit-button"
                onClick={handleSave}
                disabled={loadingAction}
              >
                {loadingAction ? (
                  <div className="spinner small"></div>
                ) : (
                  "Guardar Cambios"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisponibilidadScreen;