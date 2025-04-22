import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

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
      // Colección para controlar los contadores
      const contadoresRef = doc(firestore, 'contadores', 'tickets');
      const contadorDoc = await getDoc(contadoresRef);
      
      if (contadorDoc.exists()) {
        return contadorDoc.data().ultimoTicket || 0;
      } else {
        // Si no existe el documento, crearlo
        await addDoc(collection(firestore, 'contadores'), {
          id: 'tickets',
          ultimoTicket: 0
        });
        return 0;
      }
    } catch (error) {
      console.error('Error al obtener último ticket:', error);
      // Si hay error al leer el documento, intentar crearlo
      try {
        const contadoresCollection = collection(firestore, 'contadores');
        await addDoc(contadoresCollection, { 
          id: 'tickets', 
          ultimoTicket: 0 
        });
        return 0;
      } catch (createError) {
        console.error('Error al crear contador de tickets:', createError);
        return 0;
      }
    }
  };

  // Actualizar el contador de tickets
  const actualizarContadorTickets = async (nuevoValor) => {
    try {
      const contadoresRef = doc(firestore, 'contadores', 'tickets');
      await updateDoc(contadoresRef, { ultimoTicket: nuevoValor });
    } catch (error) {
      console.error('Error al actualizar contador:', error);
      // Si falla, intentar crear el documento
      try {
        const contadoresCollection = collection(firestore, 'contadores');
        await addDoc(contadoresCollection, { id: 'tickets', ultimoTicket: nuevoValor });
      } catch (createError) {
        console.error('Error al crear contador de tickets:', createError);
      }
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
      
      // Actualizar el contador de tickets
      await actualizarContadorTickets(nuevoNumeroTicket);

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
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {userRole === 'conductor' ? 'Reportar Falla' : 'Gestión de Fallas Reportadas'}
        </h1>
      </div>

      {/* Formulario para reportar falla (solo visible para conductores) */}
      {userRole === 'conductor' && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Título:</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="text"
              placeholder="Ej: Falla en frenos"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Equipo:</label>
            <div className="relative">
              {loadingEquipos ? (
                <div className="flex justify-center py-3">
                  <div className="loader"></div>
                </div>
              ) : (
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Prioridad:</label>
            <div className="relative">
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Descripción:</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describa detalladamente la falla observada"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows="4"
            ></textarea>
          </div>

          <button
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md flex items-center justify-center disabled:opacity-50"
            onClick={reportarFalla}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="loader-sm mr-2"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            Reportar Falla
          </button>
        </div>
      )}

      {/* Lista de fallas reportadas */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Fallas Reportadas</h2>
        
        {loadingFallas ? (
          <div className="bg-white shadow-md rounded-lg p-8 flex flex-col items-center">
            <div className="loader mb-4"></div>
            <p className="text-gray-600">Cargando fallas...</p>
          </div>
        ) : fallasReportadas.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg p-8 flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-600">No hay fallas reportadas</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {fallasReportadas.map((falla) => (
              <div key={falla.id} className="bg-white shadow-md rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    {/* Mostrar número de ticket */}
                    {(userRole === 'admin' || userRole === 'mecanico') && (
                      <div className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-md mb-2">
                        Ticket #{falla.numeroTicket || '?'}
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-gray-800">{falla.titulo}</h3>
                    <p className="text-gray-600">{falla.equipoNombre}</p>
                    
                    {/* Mostrar quién reportó (solo para admin/mecánico) */}
                    {(userRole === 'admin' || userRole === 'mecanico') && (
                      <p className="text-sm text-gray-500 italic mt-1">
                        Reportado por: {falla.usuarioNombre || falla.usuarioEmail || 'Usuario desconocido'}
                      </p>
                    )}
                  </div>
                  <div 
                    className="px-3 py-1 rounded-md text-white text-xs font-bold"
                    style={{ backgroundColor: getPrioridadColor(falla.prioridad) }}
                  >
                    {falla.prioridad.charAt(0).toUpperCase() + falla.prioridad.slice(1)}
                  </div>
                </div>
                
                <p className="text-gray-700 mb-4">{falla.descripcion}</p>
                
                <div className="flex justify-between items-center">
                  <div 
                    className="px-3 py-1 rounded-md text-white text-xs font-bold"
                    style={{ backgroundColor: getEstadoColor(falla.estado) }}
                  >
                    {falla.estado === 'pendiente' ? 'Pendiente' : 
                     falla.estado === 'en_proceso' ? 'En proceso' :
                     falla.estado === 'completado' ? 'Completado' : 'Cancelado'}
                  </div>
                  <p className="text-xs text-gray-500">
                    {falla.fechaCreacion ? formatearFecha(falla.fechaCreacion) : 'Fecha no disponible'}
                  </p>
                </div>
                
                {falla.tecnicoAsignado && falla.estado !== 'pendiente' && (
                  <p className="text-sm text-gray-500 italic mt-3">
                    Atendido por: {falla.tecnicoNombre || falla.tecnicoAsignado}
                  </p>
                )}
                
                {(userRole === 'admin' || userRole === 'mecanico') && falla.estado !== 'cancelado' && (
                  <button 
                    className="flex items-center mt-4 px-4 py-2 rounded-md text-white text-sm ml-auto"
                    style={{ backgroundColor: getEstadoColor(falla.estado) }}
                    onClick={() => handleAtender(falla)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {falla.estado === 'pendiente' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />}
                      {falla.estado === 'en_proceso' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                      {falla.estado === 'completado' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}</svg>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold">
                {nuevoEstado === 'en_proceso' ? 'Atender Falla' : 'Completar Falla'}
              </h2>
              <button 
                className="text-gray-500 hover:text-gray-700" 
                onClick={() => setModalVisible(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {fallaSeleccionada && (
              <div className="p-4">
                <div className="bg-gray-100 p-4 rounded-lg mb-4">
                  {/* Mostrar número de ticket en el modal */}
                  <div className="inline-block bg-blue-100 text-blue-800 text-sm font-semibold px-2 py-1 rounded-md mb-2">
                    Ticket #{fallaSeleccionada.numeroTicket || '?'}
                  </div>
                  <h3 className="text-lg font-semibold">{fallaSeleccionada.titulo}</h3>
                  <p className="text-gray-600">{fallaSeleccionada.equipoNombre}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Reportado por: {fallaSeleccionada.usuarioNombre || fallaSeleccionada.usuarioEmail || 'Usuario desconocido'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Fecha de reporte: {fallaSeleccionada.fechaCreacion ? formatearFecha(fallaSeleccionada.fechaCreacion) : 'Fecha no disponible'}
                  </p>
                  <div 
                    className="inline-block px-3 py-1 rounded-md text-white text-xs font-bold mt-2"
                    style={{ backgroundColor: getEstadoColor(fallaSeleccionada.estado) }}
                  >
                    Estado actual: {fallaSeleccionada.estado === 'pendiente' ? 'Pendiente' : 
                                   fallaSeleccionada.estado === 'en_proceso' ? 'En proceso' : 'Completado'}
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">Actualizar estado a:</label>
                  <div className="relative">
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">Comentario:</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Agregue un comentario sobre la atención realizada"
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows="4"
                    disabled={fallaSeleccionada.estado === 'completado'}
                  ></textarea>
                </div>
                
                {fallaSeleccionada.historial && fallaSeleccionada.historial.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-3">Historial de la falla:</h4>
                    <div className="space-y-3">
                      {fallaSeleccionada.historial.map((item, index) => (
                        <div key={index} className="bg-gray-100 p-3 rounded-md border-l-4" style={{ borderColor: getEstadoColor(item.estado) }}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-600">
                              {new Date(item.fecha).toLocaleString()}
                            </span>
                            <span 
                              className="px-2 py-1 text-xs rounded-md text-white"
                              style={{ backgroundColor: getEstadoColor(item.estado) }}
                            >
                              {item.estado === 'pendiente' ? 'Pendiente' : 
                               item.estado === 'en_proceso' ? 'En proceso' : 
                               item.estado === 'completado' ? 'Completado' : 'Cancelado'}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-700">Por: {item.usuario}</p>
                          <p className="text-sm text-gray-700 mt-1">{item.comentario}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {fallaSeleccionada.estado !== 'completado' && (
                  <button
                    className="w-full mt-6 py-2 px-4 rounded-md text-white font-medium flex items-center justify-center"
                    style={{ backgroundColor: getEstadoColor(nuevoEstado) }}
                    onClick={procesarAtencion}
                    disabled={loadingAtencion}
                  >
                    {loadingAtencion ? (
                      <div className="loader-sm mr-2"></div>
                    ) : (
                      <>
                        {nuevoEstado === 'en_proceso' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          </svg>
                        )}
                        {nuevoEstado === 'completado' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {nuevoEstado === 'cancelado' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {nuevoEstado === 'en_proceso' ? 'Iniciar atención' : 
                        nuevoEstado === 'completado' ? 'Marcar como completado' : 'Cancelar falla'}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estilos CSS para loaders */}
      <style jsx>{`
        .loader {
          border: 4px solid #f3f3f3;
          border-radius: 50%;
          border-top: 4px solid #3498db;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
        }
        
        .loader-sm {
          border: 3px solid #f3f3f3;
          border-radius: 50%;
          border-top: 3px solid #ffffff;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Función para reconectar a Firebase
const reconnectFirebase = () => {
  console.log("Intentando reconectar con Firebase...");
  window.location.reload();
};

export default ReporteFallasScreen;