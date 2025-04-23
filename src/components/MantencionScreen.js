import React, { useState, useEffect } from 'react';
import firebaseApp from "../firebase/credenciales";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  where
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import './MantencionScreen.css';
// Using react-icons for consistent UI elements
import { 
  IoAdd, 
  IoClose, 
  IoCloseCircle, 
  IoAddCircleOutline, 
  IoAddCircle, 
  IoChevronForward 
} from "react-icons/io5";

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const MantencionScreen = ({ navigation, route }) => {
  // States for maintenance management
  const [mantenimientos, setMantenimientos] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalRepuestosVisible, setModalRepuestosVisible] = useState(false);
  const [equipos, setEquipos] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [repuestosSeleccionados, setRepuestosSeleccionados] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Form state
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

  // Check if accessing from EquiposScreen
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
      
      // Automatically open new maintenance modal
      setModalVisible(true);
    }
  }, [route?.params]);

  // Load data from Firebase
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        
        // Get current user to use as default mechanic
        const currentUser = auth.currentUser;
        let nombreMecanico = 'Usuario sin identificar';
        
        if (currentUser) {
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
        
        // Update form with current mechanic
        setFormData(prev => ({
          ...prev,
          mecanico: nombreMecanico
        }));
        
        // 1. Load maintenance records
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
        
        // 2. Load equipment
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
        
        // 3. Load spare parts
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

  // Filter maintenance records based on selected type
  const mantenimientosFiltrados = filtroTipo === 'todos' 
    ? mantenimientos 
    : mantenimientos.filter(m => m.tipo === filtroTipo);

  // Function to add a new maintenance record
  const handleAddMantenimiento = async () => {
    // Validate fields
    if (!formData.equipo || !formData.descripcion) {
      alert('Error: Por favor complete los campos obligatorios');
      return;
    }

    try {
      setIsLoading(true);
      
      // Create new maintenance record
      const nuevoMantenimiento = {
        ...formData,
        kilometraje: parseInt(formData.kilometraje) || 0,
        repuestos: repuestosSeleccionados,
        equipoId: formData.equipoId,
        fechaCreacion: serverTimestamp(),
        fechaActualizacion: serverTimestamp()
      };  

      // Add to Firestore
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const docRef = await addDoc(mantenimientosRef, nuevoMantenimiento);

      // Update local state
      setMantenimientos([{
        id: docRef.id,
        ...nuevoMantenimiento,
        fecha: nuevoMantenimiento.fecha
      }, ...mantenimientos]);

      // If spare parts were selected, update their stock
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
        
        // Update local spare parts list
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
      
      // Update equipment mileage if needed
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
      
      // Reset the form
      setFormData({
        equipo: '',
        tipo: 'preventivo',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
        estado: 'pendiente',
        kilometraje: '',
        mecanico: formData.mecanico, // Keep current mechanic
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

  // Function to add spare parts to maintenance
  const handleAddRepuesto = (id, nombre, stockActual) => {
    // Check if already in the list
    const existente = repuestosSeleccionados.find(r => r.id === id);
    
    if (existente) {
      // Check stock before increasing quantity
      if (existente.cantidad >= stockActual) {
        alert(`Error: No hay suficiente stock de ${nombre}. Disponible: ${stockActual}`);
        return;
      }
      
      // Update quantity
      const actualizados = repuestosSeleccionados.map(r => 
        r.id === id ? { ...r, cantidad: r.cantidad + 1 } : r
      );
      setRepuestosSeleccionados(actualizados);
    } else {
      // Check that there is stock
      if (stockActual <= 0) {
        alert(`Error: No hay stock disponible de ${nombre}`);
        return;
      }
      
      // Add new
      setRepuestosSeleccionados([
        ...repuestosSeleccionados,
        { id, nombre, cantidad: 1 }
      ]);
    }
  };

  // Function to remove a spare part
  const handleRemoveRepuesto = (id) => {
    const actualizados = repuestosSeleccionados.filter(r => r.id !== id);
    setRepuestosSeleccionados(actualizados);
  };

  // Function to change maintenance status
  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      setIsLoading(true);
      
      // Update in Firestore
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
      
      // If maintenance is completed, update the equipment
      if (nuevoEstado === 'completado' && mantenimientoData.equipoId) {
        const equipoRef = doc(firestore, 'equipos', mantenimientoData.equipoId);
        await updateDoc(equipoRef, {
          ultimoMantenimiento: new Date().toISOString().split('T')[0],
          proximoMantenimiento: calcularProximoMantenimiento(new Date(), mantenimientoData.tipo),
          estadoMantenimiento: 'bueno',
          fechaActualizacion: serverTimestamp()
        });
      }
      
      // Update local state
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
  
  // Function to calculate next maintenance date
  const calcularProximoMantenimiento = (fechaActual, tipoMantenimiento) => {
    const fecha = new Date(fechaActual);
    // If preventive, schedule for 3 months later
    // If corrective, schedule for 1 month later (review)
    const mesesAdicionales = tipoMantenimiento === 'preventivo' ? 3 : 1;
    fecha.setMonth(fecha.getMonth() + mesesAdicionales);
    return fecha.toISOString().split('T')[0];
  };

  // Function to view maintenance history for a piece of equipment
  const verHistorialEquipo = (equipoId) => {
    if (navigation && navigation.navigate) {
      navigation.navigate('HistorialMantenimiento', { equipoId });
    }
  };

  // Render a maintenance item
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

  // Render loading spinner if initial data load
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
      {/* Loading overlay for operations */}
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
      
      {/* Error message display */}
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
      
      {/* Maintenance list */}
      <div className="lista-container">
        {mantenimientosFiltrados.length > 0 ? (
          mantenimientosFiltrados.map(item => renderMantenimientoItem(item))
        ) : (
          <div className="empty-list">
            <p className="empty-text">No hay mantenimientos registrados</p>
          </div>
        )}
      </div>
      
      {/* Add maintenance button */}
      <button 
        className="add-button"
        onClick={() => setModalVisible(true)}
        disabled={isLoading}
      >
        <IoAdd size={30} color="white" />
      </button>
      
      {/* Modal for adding maintenance */}
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
                    disabled={!!route?.params?.equipoId} // Disable if pre-selected
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
      
      {/* Modal for selecting spare parts */}
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
      
      {/* Styles are defined in a separate CSS file imported at the top */}
    </div>
  );
};

export default MantencionScreen;