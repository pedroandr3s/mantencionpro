import React, { useState, useEffect } from 'react';
// Imports de Firebase se mantienen igual
import firebaseApp from "../firebase/credenciales";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  where
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
// Importamos íconos de una biblioteca compatible con React
import { IoAdd, IoClose, IoCloseCircle, IoAddCircleOutline, IoAddCircle, IoChevronForward } from "react-icons/io5";

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const MantencionScreen = ({ navigation, route }) => {
  // Estados para la gestión de mantenimientos
  const [mantenimientos, setMantenimientos] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalRepuestosVisible, setModalRepuestosVisible] = useState(false);
  const [equipos, setEquipos] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [repuestosSeleccionados, setRepuestosSeleccionados] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Estado para el formulario
  const [formData, setFormData] = useState({
    equipo: '',
    tipo: 'preventivo',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    estado: 'pendiente',
    kilometraje: '',
    mecanico: '',
    repuestos: []
  });

  // Verificar si se está accediendo desde EquiposScreen
  useEffect(() => {
    if (route?.params?.equipoId && route?.params?.equipoNumero) {
      const equipoSeleccionado = {
        id: route.params.equipoId,
        numero: route.params.equipoNumero,
        kilometraje: route.params.kilometraje || '0'
      };
      
      setFormData(prev => ({
        ...prev,
        equipo: `Camión #${equipoSeleccionado.numero}`,
        equipoId: equipoSeleccionado.id,
        kilometraje: equipoSeleccionado.kilometraje.toString()
      }));
      
      // Abrir automáticamente el modal de nuevo mantenimiento
      setModalVisible(true);
    }
  }, [route?.params]);

  // Cargar datos desde Firebase
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        
        // Obtener el usuario actual para usar como mecánico por defecto
        const currentUser = auth.currentUser;
        let nombreMecanico = 'Usuario sin identificar';
        
        if (currentUser) {
          // Intentar obtener el nombre del usuario desde Firestore
          try {
            const docRef = doc(firestore, `usuarios/${currentUser.uid}`);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              const userData = docSnap.data();
              nombreMecanico = userData.nombre || currentUser.email;
            } else {
              nombreMecanico = currentUser.email;
            }
          } catch (error) {
            console.error("Error al obtener datos del usuario:", error);
            nombreMecanico = currentUser.email;
          }
        }
        
        // Actualizar el formulario con el mecánico actual
        setFormData(prev => ({
          ...prev,
          mecanico: nombreMecanico
        }));
        
        // 1. Cargar mantenimientos
        const mantenimientosRef = collection(firestore, 'mantenimientos');
        const q = query(mantenimientosRef, orderBy('fecha', 'desc'));
        const mantenimientosSnap = await getDocs(q);
        
        const mantenimientosData = [];
        mantenimientosSnap.forEach((docSnap) => {
          const data = docSnap.data();
          mantenimientosData.push({
            id: docSnap.id,
            ...data,
            fecha: data.fecha ? data.fecha : new Date().toISOString().split('T')[0]
          });
        });
        
        setMantenimientos(mantenimientosData);
        
        // 2. Cargar equipos
        const equiposRef = collection(firestore, 'equipos');
        const equiposSnap = await getDocs(equiposRef);
        
        const equiposData = [];
        equiposSnap.forEach((docSnap) => {
          equiposData.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        
        setEquipos(equiposData);
        
        // 3. Cargar repuestos
        const repuestosRef = collection(firestore, 'repuestos');
        const repuestosSnap = await getDocs(repuestosRef);
        
        const repuestosData = [];
        repuestosSnap.forEach((docSnap) => {
          repuestosData.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        
        setRepuestos(repuestosData);
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error al cargar datos:", error);
        setErrorMsg("Error al cargar datos. Intente nuevamente.");
        setIsLoading(false);
      }
    };

    cargarDatos();
  }, []);

  // Filtrar mantenimientos según el tipo seleccionado
  const mantenimientosFiltrados = filtroTipo === 'todos' 
    ? mantenimientos 
    : mantenimientos.filter(m => m.tipo === filtroTipo);

  // Función para agregar un nuevo mantenimiento
  const handleAddMantenimiento = async () => {
    // Validar campos
    if (!formData.equipo || !formData.descripcion) {
      alert('Error: Por favor complete los campos obligatorios');
      return;
    }

    try {
      setIsLoading(true);
      
      // Crear nuevo mantenimiento
      const nuevoMantenimiento = {
        ...formData,
        kilometraje: parseInt(formData.kilometraje) || 0,
        repuestos: repuestosSeleccionados,
        equipoId: formData.equipoId, // Asegúrate de que este campo exista
        fechaCreacion: serverTimestamp(),
        fechaActualizacion: serverTimestamp()
      };  

      // Agregar a Firestore
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const docRef = await addDoc(mantenimientosRef, nuevoMantenimiento);

      // Actualizar estado local
      setMantenimientos([{
        id: docRef.id,
        ...nuevoMantenimiento,
        fecha: nuevoMantenimiento.fecha
      }, ...mantenimientos]);

      // Si hay repuestos seleccionados, actualizar su stock
      if (repuestosSeleccionados.length > 0) {
        for (const repuesto of repuestosSeleccionados) {
          const repuestoRef = doc(firestore, 'repuestos', repuesto.id);
          const repuestoDoc = await getDoc(repuestoRef);
          
          if (repuestoDoc.exists()) {
            const repuestoData = repuestoDoc.data();
            const nuevoStock = Math.max(0, (repuestoData.stock || 0) - repuesto.cantidad);
            
            await updateDoc(repuestoRef, {
              stock: nuevoStock,
              fechaActualizacion: serverTimestamp()
            });
          }
        }
        
        // Actualizar la lista de repuestos local
        const repuestosRef = collection(firestore, 'repuestos');
        const repuestosSnap = await getDocs(repuestosRef);
        
        const repuestosData = [];
        repuestosSnap.forEach((docSnap) => {
          repuestosData.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        
        setRepuestos(repuestosData);
      }
      
      // Actualizar el kilometraje del equipo si es necesario
      if (formData.equipoId) {
        const equipoRef = doc(firestore, 'equipos', formData.equipoId);
        const equipoDoc = await getDoc(equipoRef);
        
        if (equipoDoc.exists()) {
          await updateDoc(equipoRef, {
            kilometraje: parseInt(formData.kilometraje) || 0,
            ultimoMantenimiento: nuevoMantenimiento.fecha,
            fechaActualizacion: serverTimestamp()
          });
        }
      }
      
      setModalVisible(false);
      
      // Reiniciar el formulario
      setFormData({
        equipo: '',
        tipo: 'preventivo',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
        estado: 'pendiente',
        kilometraje: '',
        mecanico: formData.mecanico, // Mantener el mecánico actual
        repuestos: []
      });
      
      setRepuestosSeleccionados([]);
      setIsLoading(false);
      
      alert('Éxito: Mantenimiento registrado correctamente');
    } catch (error) {
      console.error("Error al registrar mantenimiento:", error);
      setIsLoading(false);
      alert('Error: No se pudo registrar el mantenimiento. Intente nuevamente.');
    }
  };

  // Función para agregar repuestos al mantenimiento
  const handleAddRepuesto = (id, nombre, stockActual) => {
    // Verificar si ya está en la lista
    const existente = repuestosSeleccionados.find(r => r.id === id);
    
    if (existente) {
      // Verificar stock antes de aumentar la cantidad
      if (existente.cantidad >= stockActual) {
        alert(`Error: No hay suficiente stock de ${nombre}. Disponible: ${stockActual}`);
        return;
      }
      
      // Actualizar cantidad
      const actualizados = repuestosSeleccionados.map(r => 
        r.id === id ? { ...r, cantidad: r.cantidad + 1 } : r
      );
      setRepuestosSeleccionados(actualizados);
    } else {
      // Verificar que haya stock
      if (stockActual <= 0) {
        alert(`Error: No hay stock disponible de ${nombre}`);
        return;
      }
      
      // Agregar nuevo
      setRepuestosSeleccionados([
        ...repuestosSeleccionados,
        { id, nombre, cantidad: 1 }
      ]);
    }
  };

  // Función para eliminar un repuesto
  const handleRemoveRepuesto = (id) => {
    const actualizados = repuestosSeleccionados.filter(r => r.id !== id);
    setRepuestosSeleccionados(actualizados);
  };

  // Función para cambiar el estado de un mantenimiento
  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      setIsLoading(true);
      
      // Actualizar en Firestore
      const mantenimientoRef = doc(firestore, 'mantenimientos', id);
      const mantenimientoDoc = await getDoc(mantenimientoRef);
      
      if (!mantenimientoDoc.exists()) {
        throw new Error("El mantenimiento no existe");
      }
      
      const mantenimientoData = mantenimientoDoc.data();
      
      await updateDoc(mantenimientoRef, {
        estado: nuevoEstado,
        fechaActualizacion: serverTimestamp(),
        fechaCompletado: nuevoEstado === 'completado' ? new Date().toISOString().split('T')[0] : null
      });
      
      // Si se completó el mantenimiento, actualizar el equipo
      if (nuevoEstado === 'completado' && mantenimientoData.equipoId) {
        const equipoRef = doc(firestore, 'equipos', mantenimientoData.equipoId);
        await updateDoc(equipoRef, {
          ultimoMantenimiento: new Date().toISOString().split('T')[0],
          proximoMantenimiento: calcularProximoMantenimiento(new Date(), mantenimientoData.tipo),
          estadoMantenimiento: 'bueno',
          fechaActualizacion: serverTimestamp()
        });
      }
      
      // Actualizar estado local
      const mantenimientosActualizados = mantenimientos.map(m => 
        m.id === id ? { 
          ...m, 
          estado: nuevoEstado,
          fechaCompletado: nuevoEstado === 'completado' ? new Date().toISOString().split('T')[0] : null
        } : m
      );
      
      setMantenimientos(mantenimientosActualizados);
      setIsLoading(false);
      
      alert(`Éxito: Estado actualizado a ${nuevoEstado === 'pendiente' ? 'Pendiente' : nuevoEstado === 'en_proceso' ? 'En Proceso' : 'Completado'}`);
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      setIsLoading(false);
      alert('Error: No se pudo actualizar el estado. Intente nuevamente.');
    }
  };
  
  // Función para calcular la fecha del próximo mantenimiento
  const calcularProximoMantenimiento = (fechaActual, tipoMantenimiento) => {
    const fecha = new Date(fechaActual);
    // Si es preventivo, programar para 3 meses después
    // Si es correctivo, programar para 1 mes después (revisión)
    const mesesAdicionales = tipoMantenimiento === 'preventivo' ? 3 : 1;
    fecha.setMonth(fecha.getMonth() + mesesAdicionales);
    return fecha.toISOString().split('T')[0];
  };

  // Función para ver el historial de mantenimientos de un equipo
  const verHistorialEquipo = (equipoId) => {
    if (navigation && navigation.navigate) {
      navigation.navigate('HistorialMantenimiento', { equipoId });
    }
  };

  // Renderizado de un ítem de mantenimiento
  const renderMantenimientoItem = (item) => (
    <div className="mantenimiento-item" key={item.id}>
      <div className="mantenimiento-header">
        <h3 className="mantenimiento-equipo">{item.equipo}</h3>
        <div 
          className="estado-badge"
          style={{ 
            backgroundColor: 
              item.estado === 'pendiente' ? '#FFA940' :
              item.estado === 'en_proceso' ? '#1890FF' : '#52C41A'
          }}
        >
          <span>
            {item.estado === 'pendiente' ? 'Pendiente' :
             item.estado === 'en_proceso' ? 'En Proceso' : 'Completado'}
          </span>
        </div>
      </div>
      
      <div className="mantenimiento-info">
        <div className="info-row">
          <div className="info-item">
            <span className="info-label">Tipo:</span>
            <span 
              className="tipo-text"
              style={{ color: item.tipo === 'preventivo' ? '#52C41A' : '#1890FF' }}
            >
              {item.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'}
            </span>
          </div>
          
          <div className="info-item">
            <span className="info-label">Fecha:</span>
            <span>{item.fecha}</span>
          </div>
        </div>
        
        <div className="info-row">
          <div className="info-item">
            <span className="info-label">Kilometraje:</span>
            <span>{item.kilometraje ? item.kilometraje.toLocaleString() : '0'} km</span>
          </div>
          
          <div className="info-item">
            <span className="info-label">Mecánico:</span>
            <span>{item.mecanico}</span>
          </div>
        </div>
        
        <span className="info-label">Descripción:</span>
        <p className="descripcion-text">{item.descripcion}</p>
        
        <span className="info-label">Repuestos utilizados:</span>
        {item.repuestos && item.repuestos.length > 0 ? (
          item.repuestos.map((repuesto, index) => (
            <p key={index} className="repuesto-item">
              • {repuesto.nombre} (x{repuesto.cantidad})
            </p>
          ))
        ) : (
          <p className="no-repuestos">No se utilizaron repuestos</p>
        )}
      </div>
      
      {item.estado !== 'completado' && (
        <div className="acciones-container">
          {item.estado === 'pendiente' && (
            <button 
              className="accion-btn iniciar-btn"
              onClick={() => handleCambiarEstado(item.id, 'en_proceso')}
            >
              Iniciar
            </button>
          )}
          
          {item.estado === 'en_proceso' && (
            <button 
              className="accion-btn completar-btn"
              onClick={() => handleCambiarEstado(item.id, 'completado')}
            >
              Completar
            </button>
          )}
          
          {(item.equipoId && (item.estado === 'en_proceso' || item.estado === 'pendiente')) && (
            <button 
              className="accion-btn repuestos-btn"
              onClick={() => {
                if (navigation && navigation.navigate) {
                  navigation.navigate('InventarioScreen', {
                    seleccionarRepuestos: true,
                    mantenimientoId: item.id
                  });
                }
              }}
            >
              Añadir Repuestos
            </button>
          )}
        </div>
      )}
      
      {item.equipoId && (
        <button 
          className="ver-historial-btn"
          onClick={() => verHistorialEquipo(item.equipoId)}
        >
          <span>Ver historial de este equipo</span>
          <IoChevronForward />
        </button>
      )}
    </div>
  );

  if (isLoading && mantenimientos.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="container">
      {isLoading && (
        <div className="overlay-loading">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      <div className="header">
        <h2 className="title">Mantenimientos</h2>
        
        <div className="filtro-container">
          <button 
            className={`filtro-btn ${filtroTipo === 'todos' ? 'filtro-btn-activo' : ''}`}
            onClick={() => setFiltroTipo('todos')}
          >
            <span className={filtroTipo === 'todos' ? 'filtro-text-activo' : ''}>
              Todos
            </span>
          </button>
          
          <button 
            className={`filtro-btn ${filtroTipo === 'preventivo' ? 'filtro-btn-activo' : ''}`}
            onClick={() => setFiltroTipo('preventivo')}
          >
            <span className={filtroTipo === 'preventivo' ? 'filtro-text-activo' : ''}>
              Preventivos
            </span>
          </button>
          
          <button 
            className={`filtro-btn ${filtroTipo === 'correctivo' ? 'filtro-btn-activo' : ''}`}
            onClick={() => setFiltroTipo('correctivo')}
          >
            <span className={filtroTipo === 'correctivo' ? 'filtro-text-activo' : ''}>
              Correctivos
            </span>
          </button>
        </div>
      </div>
      
      {errorMsg && (
        <div className="error-container">
          <p className="error-text">{errorMsg}</p>
          <button 
            className="reload-button"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      )}
      
      <div className="lista-container">
        {mantenimientosFiltrados.length > 0 ? (
          mantenimientosFiltrados.map(item => renderMantenimientoItem(item))
        ) : (
          <div className="empty-list">
            <p className="empty-text">No hay mantenimientos registrados</p>
          </div>
        )}
      </div>
      
      <button 
        className="add-button"
        onClick={() => setModalVisible(true)}
        disabled={isLoading}
      >
        <IoAdd size={30} color="white" />
      </button>
      
      {/* Modal para agregar mantenimiento */}
      {modalVisible && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Nuevo Mantenimiento</h3>
                <button className="close-button" onClick={() => setModalVisible(false)}>
                  <IoClose size={24} />
                </button>
              </div>
              
              <div className="form-container">
                <label className="input-label">
                  Equipo *
                  <select
                    className="select-input"
                    value={formData.equipo}
                    onChange={(e) => {
                      const equipoSeleccionado = equipos.find(eq => 
                        eq.id === e.target.value || `Camión #${eq.numero}` === e.target.value
                      );
                      setFormData({
                        ...formData, 
                        equipo: e.target.value,
                        equipoId: equipoSeleccionado ? equipoSeleccionado.id : null,
                        kilometraje: equipoSeleccionado ? equipoSeleccionado.kilometraje.toString() : ''
                      });
                    }}
                    disabled={!!route?.params?.equipoId} // Desactivar si viene preseleccionado
                  >
                    <option value="">Seleccione un equipo</option>
                    {equipos.map(equipo => (
                      <option 
                        key={equipo.id} 
                        value={`Camión #${equipo.numero}`}
                      >
                        {`Camión #${equipo.numero} - ${equipo.modelo}`}
                      </option>
                    ))}
                  </select>
                </label>
                
                <label className="input-label">
                  Tipo de mantenimiento *
                  <select
                    className="select-input"
                    value={formData.tipo}
                    onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                  >
                    <option value="preventivo">Preventivo</option>
                    <option value="correctivo">Correctivo</option>
                  </select>
                </label>
                
                <label className="input-label">
                  Kilometraje actual
                  <input
                    type="number"
                    className="text-input"
                    value={formData.kilometraje}
                    onChange={(e) => setFormData({...formData, kilometraje: e.target.value})}
                    placeholder="Kilometraje actual del equipo"
                  />
                </label>
                
                <label className="input-label">
                  Descripción *
                  <textarea
                    className="text-area"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    placeholder="Describa el mantenimiento a realizar"
                    rows={4}
                  />
                </label>
                
                <div className="input-label">
                  Repuestos e Insumos
                  <div className="repuestos-container">
                    {repuestosSeleccionados.map((repuesto) => (
                      <div key={repuesto.id} className="repuesto-seleccionado">
                        <span className="repuesto-nombre">
                          {repuesto.nombre} (x{repuesto.cantidad})
                        </span>
                        <button 
                          className="remove-repuesto-btn"
                          onClick={() => handleRemoveRepuesto(repuesto.id)}
                        >
                          <IoCloseCircle size={20} color="#FF4D4F" />
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      className="agregar-repuesto-btn"
                      onClick={() => setModalRepuestosVisible(true)}
                    >
                      <IoAddCircleOutline size={18} color="#1890FF" />
                      <span>Agregar Repuestos</span>
                    </button>
                  </div>
                </div>
                
                <button 
                  className="submit-button"
                  onClick={handleAddMantenimiento}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="button-spinner"></div>
                  ) : (
                    "Registrar Mantenimiento"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal para seleccionar repuestos */}
      {modalRepuestosVisible && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Seleccionar Repuestos</h3>
                <button className="close-button" onClick={() => setModalRepuestosVisible(false)}>
                  <IoClose size={24} />
                </button>
              </div>
              
              <div className="repuestos-list">
                {repuestos.length > 0 ? (
                  repuestos.map(item => (
                    <button 
                      key={item.id}
                      className="repuesto-list-item"
                      onClick={() => handleAddRepuesto(item.id, item.nombre, item.stock)}
                      disabled={item.stock <= 0}
                    >
                      <div>
                        <p className="repuesto-list-nombre">{item.nombre}</p>
                        <p className={`repuesto-list-stock ${item.stock <= 0 ? 'stock-agotado' : ''}`}>
                          Stock: {item.stock} unidades
                        </p>
                      </div>
                      {item.stock > 0 ? (
                        <IoAddCircle size={24} color="#1890FF" />
                      ) : (
                        <span className="agotado-text">Agotado</span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="empty-list">
                    <p className="empty-text">No hay repuestos disponibles</p>
                  </div>
                )}
              </div>
              
              <button 
                className="submit-button"
                onClick={() => setModalRepuestosVisible(false)}
              >
                Confirmar Selección
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .container {
          position: relative;
          min-height: 100vh;
          background-color: #F5F5F5;
          font-family: sans-serif;
        }
        
        .header {
          padding: 16px;
          background-color: #FFF;
          border-bottom: 1px solid #E0E0E0;
        }
        
        .title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 12px;
        }
        
        .filtro-container {
          display: flex;
          margin-top: 8px;
        }
        
        .filtro-btn {
          padding: 6px 12px;
          border-radius: 20px;
          margin-right: 8px;
          background-color: #F5F5F5;
          border: none;
          cursor: pointer;
        }
        
        .filtro-btn-activo {
          background-color: #1890FF;
          color: white;
        }
        
        .filtro-text-activo {
          font-weight: bold;
        }
        
        .lista-container {
          padding: 16px;
        }
        
        .mantenimiento-item {
          background-color: #FFF;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .mantenimiento-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .mantenimiento-equipo {
          font-size: 18px;
          font-weight: bold;
          margin: 0;
        }
        
        .estado-badge {
          padding: 4px 8px;
          border-radius: 4px;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }
        
        .mantenimiento-info {
          background-color: #F9F9F9;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 12px;
        }
        
        .info-row {
          display: flex;
          margin-bottom: 8display: flex;
          margin-bottom: 8px;
          justify-content: space-between;
        }
        
        .info-item {
          flex: 1;
        }
        
        .info-label {
          font-size: 12px;
          color: #767676;
          display: block;
          margin-bottom: 2px;
        }
        
        .tipo-text {
          font-weight: bold;
        }
        
        .descripcion-text {
          margin-top: 4px;
          margin-bottom: 12px;
        }
        
        .repuesto-item {
          margin: 4px 0;
          font-size: 14px;
        }
        
        .no-repuestos {
          color: #767676;
          font-style: italic;
          margin-top: 4px;
        }
        
        .acciones-container {
          display: flex;
          margin-top: 16px;
          gap: 8px;
        }
        
        .accion-btn {
          flex: 1;
          padding: 8px 0;
          border-radius: 4px;
          border: none;
          font-weight: bold;
          cursor: pointer;
        }
        
        .iniciar-btn {
          background-color: #1890FF;
          color: white;
        }
        
        .completar-btn {
          background-color: #52C41A;
          color: white;
        }
        
        .repuestos-btn {
          background-color: #F5F5F5;
          color: #1890FF;
          border: 1px solid #1890FF;
        }
        
        .ver-historial-btn {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-top: 12px;
          background-color: #F5F5F5;
          border: none;
          border-radius: 4px;
          color: #1890FF;
          font-size: 14px;
          cursor: pointer;
        }
        
        .add-button {
          position: fixed;
          bottom: 64px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 28px;
          background-color: #1890FF;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          border: none;
          cursor: pointer;
        }
        
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .modal-container {
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          background-color: #FFF;
          border-radius: 8px;
          overflow-y: auto;
        }
        
        .modal-content {
          padding: 16px;
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .modal-title {
          font-size: 18px;
          font-weight: bold;
          margin: 0;
        }
        
        .close-button {
          background: none;
          border: none;
          cursor: pointer;
        }
        
        .form-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .input-label {
          display: block;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        
        .text-input, .select-input, .text-area {
          width: 100%;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #E0E0E0;
          font-size: 16px;
          margin-top: 4px;
        }
        
        .repuestos-container {
          margin-top: 8px;
        }
        
        .repuesto-seleccionado {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #F5F5F5;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 8px;
        }
        
        .repuesto-nombre {
          font-size: 14px;
        }
        
        .remove-repuesto-btn {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        
        .agregar-repuesto-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: 1px dashed #1890FF;
          border-radius: 4px;
          padding: 8px;
          color: #1890FF;
          width: 100%;
          justify-content: center;
          cursor: pointer;
        }
        
        .repuestos-list {
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 16px;
        }
        
        .repuesto-list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid #F0F0F0;
          width: 100%;
          text-align: left;
          background: none;
          border-left: none;
          border-right: none;
          border-top: none;
          cursor: pointer;
        }
        
        .repuesto-list-nombre {
          font-size: 16px;
          margin: 0 0 4px 0;
        }
        
        .repuesto-list-stock {
          margin: 0;
          font-size: 14px;
          color: #767676;
        }
        
        .stock-agotado {
          color: #FF4D4F;
        }
        
        .agotado-text {
          font-size: 12px;
          color: #FF4D4F;
          font-weight: bold;
        }
        
        .submit-button {
          background-color: #1890FF;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 12px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .empty-list {
          text-align: center;
          padding: 32px 0;
          color: #767676;
        }
        
        .loading-container, .overlay-loading {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100%;
        }
        
        .overlay-loading {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255,255,255,0.8);
          z-index: 100;
        }
        
        .loading-spinner, .button-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #F0F0F0;
          border-top: 3px solid #1890FF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .button-spinner {
          width: 20px;
          height: 20px;
          border-width: 2px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-text {
          margin-top: 16px;
          color: #767676;
        }
        
        .error-container {
          background-color: #FFF1F0;
          border: 1px solid #FFA39E;
          padding: 16px;
          border-radius: 4px;
          margin: 16px;
          text-align: center;
        }
        
        .error-text {
          color: #FF4D4F;
          margin-bottom: 8px;
        }
        
        .reload-button {
          background-color: #FF4D4F;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          font-weight: bold;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default MantencionScreen;