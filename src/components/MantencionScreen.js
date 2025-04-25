import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Importar NavigationManager
import NavigationHelper, { withNavigationProtection, useNavigation } from '../NavigationManager';

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const MantencionScreen = ({ navigation, route }) => {
  // Inicializar NavigationHelper
  useEffect(() => {
    NavigationHelper.initialize(navigation);
  }, [navigation]);

  // Usar el hook de contexto de navegación
  const { isNavigating, navigateSafe } = useNavigation();
  
  // Ref para controlar si el componente está montado
  const isMounted = useRef(true);

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
  const [mantenimientoSeleccionado, setMantenimientoSeleccionado] = useState(null);

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

  // Controlar el montaje/desmontaje del componente
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      
      // Cerrar modales al desmontar
      setModalVisible(false);
      setModalRepuestosVisible(false);
    };
  }, []);

  // Función segura para actualizar estado
  const safeSetState = useCallback((setter, value) => {
    if (isMounted.current && !isNavigating) {
      try {
        setter(value);
      } catch (error) {
        console.error("Error en safeSetState:", error);
      }
    }
  }, [isNavigating]);

  // Check if accessing from EquiposScreen
  useEffect(() => {
    if (route?.params?.equipoId && route?.params?.equipoNumero) {
      const equipoSeleccionado = {
        id: route.params.equipoId,
        numero: route.params.equipoNumero,
        kilometraje: route.params.kilometraje || '0'
      };
      
      safeSetState(setFormData, prev => ({
        ...prev,
        equipo: `Camión #${equipoSeleccionado.numero}`,
        equipoId: equipoSeleccionado.id,
        kilometraje: equipoSeleccionado.kilometraje.toString()
      }));
      
      // Automatically open new maintenance modal
      safeSetState(setModalVisible, true);
    }

    // Check if coming back from InventarioScreen with a repuesto selection
    if (route?.params?.repuestoActualizado && route?.params?.mantenimientoId) {
      console.log("Repuesto actualizado para mantenimiento:", route.params.mantenimientoId);
      // Recargar datos
      cargarDatos();
      
      // Resaltar el mantenimiento actualizado
      safeSetState(setMantenimientoSeleccionado, route.params.mantenimientoId);
      
      // Reset the highlight after 2 seconds
      setTimeout(() => {
        if (isMounted.current && !isNavigating) {
          safeSetState(setMantenimientoSeleccionado, null);
        }
      }, 2000);
    }

    // Check if we need to update or view a specific mantenimiento
    if (route?.params?.mantenimientoId && !route?.params?.equipoId) {
      console.log("Cargando mantenimiento específico:", route.params.mantenimientoId);
      cargarMantenimientoEspecifico(route.params.mantenimientoId);
    }
  }, [route?.params, safeSetState]);

  // Cargar un mantenimiento específico cuando viene desde otra pantalla
  const cargarMantenimientoEspecifico = useCallback(async (mantenimientoId) => {
    if (!isMounted.current || isNavigating) return;
    
    try {
      safeSetState(setIsLoading, true);
      
      const mantenimientoRef = doc(firestore, 'mantenimientos', mantenimientoId);
      const mantenimientoDoc = await getDoc(mantenimientoRef);
      
      if (!isMounted.current || isNavigating) return;
      
      if (mantenimientoDoc.exists()) {
        const mantenimientoData = mantenimientoDoc.data();
        console.log("Mantenimiento encontrado:", mantenimientoData);
        
        // Resaltar este mantenimiento en la lista
        safeSetState(setMantenimientoSeleccionado, mantenimientoId);
        
        // Reset the highlight after 2 seconds
        setTimeout(() => {
          if (isMounted.current && !isNavigating) {
            safeSetState(setMantenimientoSeleccionado, null);
          }
        }, 2000);
      } else {
        console.log("No se encontró el mantenimiento con ID:", mantenimientoId);
      }
      
      safeSetState(setIsLoading, false);
    } catch (error) {
      if (!isMounted.current || isNavigating) return;
      
      console.error("Error al cargar mantenimiento específico:", error);
      safeSetState(setIsLoading, false);
    }
  }, [safeSetState, isNavigating]);

  // Manejar la adición de un repuesto desde la pantalla de inventario
  const handleAddRepuestoFromInventario = useCallback(async (repuestoData) => {
    if (!isMounted.current || isNavigating) return;
    
    try {
      console.log("Recibiendo repuesto desde inventario:", repuestoData);
      
      // Verificar si ya existe este repuesto en la lista
      const existente = repuestosSeleccionados.find(r => r.id === repuestoData.id);
      
      if (existente) {
        console.log("El repuesto ya existe en la lista, actualizando cantidad", existente);
        // Si ya existe, actualizar cantidad
        const nuevosRepuestos = repuestosSeleccionados.map(r => 
          r.id === repuestoData.id 
            ? { ...r, cantidad: r.cantidad + repuestoData.cantidad } 
            : r
        );
        safeSetState(setRepuestosSeleccionados, nuevosRepuestos);
      } else {
        console.log("Agregando nuevo repuesto a la lista");
        // Si no existe, agregar a la lista
        safeSetState(setRepuestosSeleccionados, [
          ...repuestosSeleccionados,
          repuestoData
        ]);
      }
      
      // Si ya existe un mantenimiento, actualizar directamente en Firestore
      if (route?.params?.mantenimientoId) {
        await actualizarRepuestosMantenimiento(
          route.params.mantenimientoId, 
          repuestoData
        );
        
        // Actualizar la lista local de mantenimientos
        const mantenimientosActualizados = mantenimientos.map(m => {
          if (m.id === route.params.mantenimientoId) {
            const repuestosActuales = m.repuestos || [];
            const repuestoExistente = repuestosActuales.find(r => r.id === repuestoData.id);
            
            let nuevosRepuestos;
            if (repuestoExistente) {
              nuevosRepuestos = repuestosActuales.map(r => 
                r.id === repuestoData.id 
                ? { ...r, cantidad: r.cantidad + repuestoData.cantidad } 
                : r
              );
            } else {
              nuevosRepuestos = [...repuestosActuales, repuestoData];
            }
            
            return { ...m, repuestos: nuevosRepuestos };
          }
          return m;
        });
        
        safeSetState(setMantenimientos, mantenimientosActualizados);
      }
    } catch (error) {
      if (!isMounted.current || isNavigating) return;
      
      console.error("Error al agregar repuesto desde inventario:", error);
      alert("Error al agregar repuesto: " + error.message);
    }
  }, [repuestosSeleccionados, mantenimientos, route?.params, safeSetState, isNavigating]);

  // Actualizar repuestos de un mantenimiento existente
  const actualizarRepuestosMantenimiento = useCallback(async (mantenimientoId, nuevoRepuesto) => {
    if (!isMounted.current || isNavigating) return;
    
    try {
      safeSetState(setIsLoading, true);
      
      console.log("Actualizando repuestos del mantenimiento", mantenimientoId);
      console.log("Nuevo repuesto a agregar:", nuevoRepuesto);
      
      // Obtener mantenimiento actual
      const mantenimientoRef = doc(firestore, 'mantenimientos', mantenimientoId);
      const mantenimientoDoc = await getDoc(mantenimientoRef);
      
      if (!isMounted.current || isNavigating) return;
      
      if (!mantenimientoDoc.exists()) {
        throw new Error("El mantenimiento no existe");
      }
      
      const mantenimientoData = mantenimientoDoc.data();
      const repuestosActuales = mantenimientoData.repuestos || [];
      
      console.log("Repuestos actuales:", repuestosActuales);
      
      // Verificar si el repuesto ya está en la lista
      const repuestoExistente = repuestosActuales.find(r => r.id === nuevoRepuesto.id);
      
      let nuevosRepuestos = [];
      
      if (repuestoExistente) {
        console.log("El repuesto ya existe, incrementando cantidad:", repuestoExistente);
        // Si ya existe, incrementar cantidad
        nuevosRepuestos = repuestosActuales.map(r => 
          r.id === nuevoRepuesto.id 
            ? { ...r, cantidad: r.cantidad + nuevoRepuesto.cantidad } 
            : r
        );
      } else {
        console.log("Agregando nuevo repuesto a la lista");
        // Si no existe, agregarlo
        nuevosRepuestos = [
          ...repuestosActuales,
          nuevoRepuesto
        ];
      }
      
      console.log("Lista de repuestos actualizada:", nuevosRepuestos);
      
      // Actualizar el mantenimiento con los nuevos repuestos
      await updateDoc(mantenimientoRef, {
        repuestos: nuevosRepuestos,
        fechaActualizacion: serverTimestamp()
      });
      
      if (!isMounted.current || isNavigating) return;
      
      // Actualizar el estado local de mantenimientos
      const mantenimientosActualizados = mantenimientos.map(m => 
        m.id === mantenimientoId 
          ? { ...m, repuestos: nuevosRepuestos } 
          : m
      );
      
      safeSetState(setMantenimientos, mantenimientosActualizados);
      
      // Actualizar el stock del repuesto en Firebase
      const repuestoRef = doc(firestore, 'repuestos', nuevoRepuesto.id);
      const repuestoDoc = await getDoc(repuestoRef);
      
      if (!isMounted.current || isNavigating) return;
      
      if (repuestoDoc.exists()) {
        const repuestoData = repuestoDoc.data();
        const stockActual = repuestoData.stock || repuestoData.cantidad || 0;
        const nuevoStock = Math.max(0, stockActual - nuevoRepuesto.cantidad);
        
        console.log(`Actualizando stock del repuesto ${nuevoRepuesto.nombre}: ${stockActual} -> ${nuevoStock}`);
        
        await updateDoc(repuestoRef, {
          stock: nuevoStock,
          cantidad: nuevoStock,
          fechaActualizacion: serverTimestamp()
        });
      }
      
      safeSetState(setIsLoading, false);
    } catch (error) {
      if (!isMounted.current || isNavigating) return;
      
      console.error("Error al actualizar repuestos:", error);
      safeSetState(setIsLoading, false);
      alert("Error al actualizar repuestos: " + error.message);
    }
  }, [mantenimientos, safeSetState, isNavigating]);

  // Load data from Firebase
  const cargarDatos = useCallback(async () => {
    if (!isMounted.current || isNavigating) return;
    
    try {
      safeSetState(setIsLoading, true);
      safeSetState(setErrorMsg, null);
      
      // Get current user to use as default mechanic
      const currentUser = auth.currentUser;
      let nombreMecanico = 'Usuario sin identificar';
      
      if (currentUser) {
        try {
          const docRef = doc(firestore, `usuarios/${currentUser.uid}`);
          const docSnap = await getDoc(docRef);
          
          if (!isMounted.current || isNavigating) return;
          
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
      
      if (!isMounted.current || isNavigating) return;
      
      // Update form with current mechanic
      safeSetState(setFormData, prev => ({
        ...prev,
        mecanico: nombreMecanico
      }));
      
      // 1. Load maintenance records
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const q = query(mantenimientosRef, orderBy('fecha', 'desc'));
      const mantenimientosSnap = await getDocs(q);
      
      if (!isMounted.current || isNavigating) return;
      
      const mantenimientosData = [];
      mantenimientosSnap.forEach((docSnap) => {
        const data = docSnap.data();
        mantenimientosData.push({
          id: docSnap.id,
          ...data,
          fecha: data.fecha ? data.fecha : new Date().toISOString().split('T')[0]
        });
      });
      
      safeSetState(setMantenimientos, mantenimientosData);
      
      // 2. Load equipment
      const equiposRef = collection(firestore, 'equipos');
      const equiposSnap = await getDocs(equiposRef);
      
      if (!isMounted.current || isNavigating) return;
      
      const equiposData = [];
      equiposSnap.forEach((docSnap) => {
        equiposData.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      
      safeSetState(setEquipos, equiposData);
      
      // 3. Load spare parts
      const repuestosRef = collection(firestore, 'repuestos');
      const repuestosSnap = await getDocs(repuestosRef);
      
      if (!isMounted.current || isNavigating) return;
      
      const repuestosData = [];
      repuestosSnap.forEach((docSnap) => {
        repuestosData.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      
      safeSetState(setRepuestos, repuestosData);
      safeSetState(setIsLoading, false);
    } catch (error) {
      if (!isMounted.current || isNavigating) return;
      
      console.error("Error al cargar datos:", error);
      safeSetState(setErrorMsg, "Error al cargar datos. Intente nuevamente.");
      safeSetState(setIsLoading, false);
    }
  }, [safeSetState, isNavigating]);

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Filter maintenance records based on selected type
  const mantenimientosFiltrados = filtroTipo === 'todos' 
    ? mantenimientos 
    : mantenimientos.filter(m => m.tipo === filtroTipo);

  // Function to add a new maintenance record
  const handleAddMantenimiento = useCallback(async () => {
    if (!isMounted.current || isNavigating) return;
    
    // Validate fields
    if (!formData.equipo || !formData.descripcion) {
      alert('Error: Por favor complete los campos obligatorios');
      return;
    }

    try {
      safeSetState(setIsLoading, true);
      
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

      if (!isMounted.current || isNavigating) return;
      
      // Update local state
      safeSetState(setMantenimientos, [{
        id: docRef.id,
        ...nuevoMantenimiento,
        fecha: nuevoMantenimiento.fecha
      }, ...mantenimientos]);

      // If spare parts were selected, update their stock
      if (repuestosSeleccionados.length > 0) {
        for (const repuesto of repuestosSeleccionados) {
          if (!isMounted.current || isNavigating) return;
          
          const repuestoRef = doc(firestore, 'repuestos', repuesto.id);
          const repuestoDoc = await getDoc(repuestoRef);
          
          if (repuestoDoc.exists()) {
            const repuestoData = repuestoDoc.data();
            const nuevoStock = Math.max(0, (repuestoData.stock || 0) - repuesto.cantidad);
            
            await updateDoc(repuestoRef, {
              stock: nuevoStock,
              cantidad: nuevoStock,
              fechaActualizacion: serverTimestamp()
            });
          }
        }
        
        if (!isMounted.current || isNavigating) return;
        
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
        
        safeSetState(setRepuestos, repuestosData);
      }
      
      // Update equipment mileage if needed
      if (formData.equipoId) {
        const equipoRef = doc(firestore, 'equipos', formData.equipoId);
        const equipoDoc = await getDoc(equipoRef);
        
        if (!isMounted.current || isNavigating) return;
        
        if (equipoDoc.exists()) {
          await updateDoc(equipoRef, {
            kilometraje: parseInt(formData.kilometraje) || 0,
            ultimoMantenimiento: nuevoMantenimiento.fecha,
            fechaActualizacion: serverTimestamp()
          });
        }
      }
      
      if (!isMounted.current || isNavigating) return;
      
      safeSetState(setModalVisible, false);
      
      // Reset the form
      safeSetState(setFormData, {
        equipo: '',
        tipo: 'preventivo',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
        estado: 'pendiente',
        kilometraje: '',
        mecanico: formData.mecanico, // Keep current mechanic
        repuestos: []
      });
      
      safeSetState(setRepuestosSeleccionados, []);
      safeSetState(setIsLoading, false);
      
      alert('Éxito: Mantenimiento registrado correctamente');
    } catch (error) {
      if (!isMounted.current || isNavigating) return;
      
      console.error("Error al registrar mantenimiento:", error);
      safeSetState(setIsLoading, false);
      alert('Error: No se pudo registrar el mantenimiento. Intente nuevamente.');
    }
  }, [formData, repuestosSeleccionados, mantenimientos, safeSetState, isNavigating]);

  // Function to add spare parts to maintenance
  const handleAddRepuesto = useCallback((id, nombre, stockActual) => {
    if (!isMounted.current || isNavigating) return;
    
    console.log("========= INICIO AGREGAR REPUESTO =========");
    console.log("ID:", id, "- Nombre:", nombre, "- Stock:", stockActual);
    console.log("Lista actual:", repuestosSeleccionados);
    
    // Buscar si ya existe en la lista
    const existente = repuestosSeleccionados.find(r => r.id === id);
    console.log("¿Repuesto existente?", existente ? "SÍ" : "NO");
    
    if (existente) {
      console.log("Cantidad actual:", existente.cantidad);
      
      // Si ya existe, verificar stock disponible
      if (existente.cantidad >= stockActual) {
        alert(`¡Atención! No hay suficiente stock de ${nombre}.\nDisponible: ${stockActual} unidades`);
        console.log("Error: Stock insuficiente");
        return;
      }
      
      // Incrementamos directamente usando el contador
      const nuevaCantidad = existente.cantidad + 1;
      console.log("Nueva cantidad:", nuevaCantidad);
      
      // Crear una copia completamente nueva del array
      const nuevoArray = repuestosSeleccionados.map(r => {
        if (r.id === id) {
          return { ...r, cantidad: nuevaCantidad };
        }
        return { ...r }; // Crear copias nuevas de todos los objetos
      });
      
      console.log("Nuevo array:", nuevoArray);
      safeSetState(setRepuestosSeleccionados, nuevoArray);
      
      // Si estamos en un mantenimiento existente, actualizar en Firestore
      if (route?.params?.mantenimientoId) {
        const repuestoActualizado = { id, nombre, cantidad: 1 };
        actualizarRepuestosMantenimiento(
          route.params.mantenimientoId, 
          repuestoActualizado
        );
      }
    } else {
      // Si no existe, verificar stock
      if (stockActual <= 0) {
        alert(`¡Atención! No hay stock disponible de ${nombre}`);
        console.log("Error: Sin stock");
        return;
      }
      
      // Agregar nuevo con cantidad 1
      const nuevoRepuesto = { id, nombre, cantidad: 1 };
      console.log("Agregando nuevo repuesto:", nuevoRepuesto);
      
      // Crear una copia completamente nueva del array
      const nuevoArray = [...repuestosSeleccionados.map(r => ({ ...r })), nuevoRepuesto];
      console.log("Nuevo array:", nuevoArray);
      
      safeSetState(setRepuestosSeleccionados, nuevoArray);
      
      // Si estamos en un mantenimiento existente, actualizar en Firestore
      if (route?.params?.mantenimientoId) {
        actualizarRepuestosMantenimiento(
          route.params.mantenimientoId, 
          nuevoRepuesto
        );
      }
    }
    
    console.log("========= FIN AGREGAR REPUESTO =========");
  }, [repuestosSeleccionados, route?.params, safeSetState, isNavigating, actualizarRepuestosMantenimiento]);

  // Function to remove a spare part
  const handleRemoveRepuesto = useCallback((id) => {
    if (!isMounted.current || isNavigating) return;
    
    const actualizados = repuestosSeleccionados.filter(r => r.id !== id);
    safeSetState(setRepuestosSeleccionados, actualizados);
  }, [repuestosSeleccionados, safeSetState, isNavigating]);

  // Function to change maintenance status
  const handleCambiarEstado = useCallback(async (id, nuevoEstado) => {
    if (!isMounted.current || isNavigating) return;
    
    try {
      safeSetState(setIsLoading, true);
      
      // Update in Firestore
      const mantenimientoRef = doc(firestore, 'mantenimientos', id);
      const mantenimientoDoc = await getDoc(mantenimientoRef);
      
      if (!isMounted.current || isNavigating) return;
      
      if (!mantenimientoDoc.exists()) {
        throw new Error("El mantenimiento no existe");
      }
      
      const mantenimientoData = mantenimientoDoc.data();
      
      await updateDoc(mantenimientoRef, {
        estado: nuevoEstado,
        fechaActualizacion: serverTimestamp(),
        fechaCompletado: nuevoEstado === 'completado' ? new Date().toISOString().split('T')[0] : null
      });
      
      if (!isMounted.current || isNavigating) return;
      
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
      
      if (!isMounted.current || isNavigating) return;
      
      // Update local state
      const mantenimientosActualizados = mantenimientos.map(m => 
        m.id === id ? { 
          ...m, 
          estado: nuevoEstado,
          fechaCompletado: nuevoEstado === 'completado' ? new Date().toISOString().split('T')[0] : null
        } : m
      );
      
      safeSetState(setMantenimientos, mantenimientosActualizados);
      safeSetState(setIsLoading, false);
      
      alert(`Éxito: Estado actualizado a ${nuevoEstado === 'pendiente' ? 'Pendiente' : nuevoEstado === 'en_proceso' ? 'En Proceso' : 'Completado'}`);
    } catch (error) {
      if (!isMounted.current || isNavigating) return;
      
      console.error("Error al cambiar estado:", error);
      safeSetState(setIsLoading, false);
      alert('Error: No se pudo actualizar el estado. Intente nuevamente.');
    }
  }, [mantenimientos, safeSetState, isNavigating]);
  
  // Function to calculate next maintenance date
  const calcularProximoMantenimiento = useCallback((fechaActual, tipoMantenimiento) => {
    const fecha = new Date(fechaActual);
    // If preventive, schedule for 3 months later
    // If corrective, schedule for 1 month later (review)
    const mesesAdicionales = tipoMantenimiento === 'preventivo' ? 3 : 1;
    fecha.setMonth(fecha.getMonth() + mesesAdicionales);
    return fecha.toISOString().split('T')[0];
  }, []);

  // Function to view maintenance history for a piece of equipment - Usando NavigationHelper
  const verHistorialEquipo = useCallback((equipoId) => {
    if (!isMounted.current || isNavigating) return;
    
    if (!equipoId) {
      alert('Error: No se pudo identificar el equipo');
      return;
    }
    
    // Primero busca el equipo para obtener información adicional
    const equipo = equipos.find(eq => eq.id === equipoId);
    
    if (!equipo) {
      alert('Error: Equipo no encontrado');
      return;
    }
    
    try {
      console.log("Navigating to HistorialMantenimiento with equipoId:", equipoId);
      
      // Filtrar los mantenimientos de este equipo para pasarlos como parámetro
      const historialEquipo = mantenimientos.filter(m => m.equipoId === equipoId);
      
      // Usar NavigationHelper para navegar de forma segura
      NavigationHelper.navigate('HistorialMantenimiento', { 
        equipoId: equipoId,
        equipoNumero: equipo.numero,
        equipoModelo: equipo.modelo || '',
        equipoKilometraje: equipo.kilometraje || 0,
        historial: historialEquipo, // Pasar los mantenimientos directamente
        timestamp: new Date().getTime() // Para forzar refresh
      });
    } catch (error) {
      console.error("Error al navegar:", error);
      alert('Error: No se pudo navegar al historial. Detalles: ' + error.message);
    }
  }, [equipos, mantenimientos, isNavigating]);

  // Function to navigate to the inventory screen to select parts - Usando NavigationHelper
  const navegarASeleccionarRepuestos = useCallback((mantenimientoId) => {
    if (!isMounted.current || isNavigating) return;
    
    try {
      console.log("Intentando navegar a InventarioScreen para selección de repuestos");
      console.log("ID de mantenimiento:", mantenimientoId);
      
      // Usar NavigationHelper para navegar de forma segura
      NavigationHelper.navigate('InventarioScreen', {
        seleccionarRepuestos: true,
        mantenimientoId: mantenimientoId,
        timestamp: new Date().getTime() // Para forzar refresh
      });
    } catch (error) {
      console.error("Error al navegar a inventario:", error);
      alert("Error: No se pudo navegar a la pantalla de inventario. Detalles: " + error.message);
    }
  }, [isNavigating]);

  // Manejar el cierre seguro de modales
  const cerrarModalSeguro = useCallback((setterFn) => {
    if (!isMounted.current) return;
    
    try {
      // Usar un pequeño retraso para evitar problemas de DOM
      setTimeout(() => {
        if (isMounted.current && !isNavigating) {
          setterFn(false);
        }
      }, 50);
    } catch (error) {
      console.error("Error al cerrar modal:", error);
    }
  }, [isNavigating]);

  // Render a maintenance item
  const renderMantenimientoItem = useCallback((item) => (
    <div 
      className={`mantenimiento-item ${mantenimientoSeleccionado === item.id ? 'mantenimiento-item-seleccionado' : ''}`} 
      key={item.id}
    >
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
      
      {item.estado !== 'completado' && !isNavigating && (
        <div className="acciones-container">
          {item.estado === 'pendiente' && (
            <button 
              className="accion-btn iniciar-btn"
              onClick={() => handleCambiarEstado(item.id, 'en_proceso')}
              disabled={isNavigating}
            >
              Iniciar
            </button>
          )}
          
          {item.estado === 'en_proceso' && (
            <button 
              className="accion-btn completar-btn"
              onClick={() => handleCambiarEstado(item.id, 'completado')}
              disabled={isNavigating}
            >
              Completar
            </button>
          )}
          
          {(item.equipoId && (item.estado === 'en_proceso' || item.estado === 'pendiente')) && (
            <button 
              className="accion-btn repuestos-btn"
              onClick={() => navegarASeleccionarRepuestos(item.id)}
              disabled={isNavigating}
            >
              Añadir Repuestos
            </button>
          )}
        </div>
      )}
      
      
    </div>
  ), [mantenimientoSeleccionado, handleCambiarEstado, navegarASeleccionarRepuestos, verHistorialEquipo, isNavigating]);

  // Renderizar el componente SOLO si no estamos navegando
  if (isNavigating) {
    return (
      <div 
        className="navigation-transition" 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(255,255,255,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}
      >
        <div 
          className="loading-spinner" 
          style={{
            width: '50px',
            height: '50px',
            border: '5px solid #f3f3f3',
            borderTop: '5px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
        <p 
          style={{ 
            marginLeft: '15px', 
            fontSize: '18px', 
            fontWeight: 'bold' 
          }}
        >
          Navegando...
        </p>
      </div>
    );
  }

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
            onClick={() => !isNavigating && safeSetState(setFiltroTipo, 'todos')}
            disabled={isNavigating}
          >
            <span className={filtroTipo === 'todos' ? 'filtro-text-activo' : ''}>
              Todos
            </span>
          </button>
          
          <button 
            className={`filtro-btn ${filtroTipo === 'preventivo' ? 'filtro-btn-activo' : ''}`}
            onClick={() => !isNavigating && safeSetState(setFiltroTipo, 'preventivo')}
            disabled={isNavigating}
          >
            <span className={filtroTipo === 'preventivo' ? 'filtro-text-activo' : ''}>
              Preventivos
            </span>
          </button>
          
          <button 
            className={`filtro-btn ${filtroTipo === 'correctivo' ? 'filtro-btn-activo' : ''}`}
            onClick={() => !isNavigating && safeSetState(setFiltroTipo, 'correctivo')}
            disabled={isNavigating}
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
            onClick={() => !isNavigating && window.location.reload()}
            disabled={isNavigating}
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
        onClick={() => !isNavigating && safeSetState(setModalVisible, true)}
        disabled={isLoading || isNavigating}
      >
        <IoAdd size={30} color="white" />
      </button>
      
      {/* Modal for adding maintenance - Renderizado condicional */}
      {modalVisible && !isNavigating && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Nuevo Mantenimiento</h3>
                <button 
                  className="close-button" 
                  onClick={() => !isNavigating && cerrarModalSeguro(setModalVisible)}
                  disabled={isNavigating}
                >
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
                      if (isNavigating) return;
                      
                      const equipoSeleccionado = equipos.find(eq => 
                        eq.id === e.target.value || `Camión #${eq.numero}` === e.target.value
                      );
                      safeSetState(setFormData, {
                        ...formData, 
                        equipo: e.target.value,
                        equipoId: equipoSeleccionado ? equipoSeleccionado.id : null,
                        kilometraje: equipoSeleccionado ? equipoSeleccionado.kilometraje.toString() : ''
                      });
                    }}
                    disabled={!!route?.params?.equipoId || isNavigating} // Disable if pre-selected
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
                    onChange={(e) => !isNavigating && safeSetState(setFormData, {...formData, tipo: e.target.value})}
                    disabled={isNavigating}
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
                    onChange={(e) => !isNavigating && safeSetState(setFormData, {...formData, kilometraje: e.target.value})}
                    placeholder="Kilometraje actual del equipo"
                    disabled={isNavigating}
                  />
                </label>
                
                <label className="input-label">
                  Descripción *
                  <textarea
                    className="text-area"
                    value={formData.descripcion}
                    onChange={(e) => !isNavigating && safeSetState(setFormData, {...formData, descripcion: e.target.value})}
                    placeholder="Describa el mantenimiento a realizar"
                    rows={4}
                    disabled={isNavigating}
                  />
                </label>
                
                <div className="input-label">
                  Repuestos e Insumos
                  <div className="repuestos-container">
                    {repuestosSeleccionados.map((repuesto) => (
                      <div key={repuesto.id} className="repuesto-seleccionado">
                        <span className="repuesto-nombre">
                          <strong>{repuesto.nombre}</strong> x{repuesto.cantidad}
                        </span>
                        <button 
                          className="remove-repuesto-btn"
                          onClick={() => !isNavigating && handleRemoveRepuesto(repuesto.id)}
                          disabled={isNavigating}
                        >
                          <IoCloseCircle size={20} color="#FF4D4F" />
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      className="agregar-repuesto-btn"
                      onClick={() => !isNavigating && safeSetState(setModalRepuestosVisible, true)}
                      disabled={isNavigating}
                    >
                      <IoAddCircleOutline size={18} color="#1890FF" />
                      <span>Agregar Repuestos</span>
                    </button>
                  </div>
                </div>
                
                <button 
                  className="submit-button"
                  onClick={() => !isNavigating && handleAddMantenimiento()}
                  disabled={isLoading || isNavigating}
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
      
      {/* Modal for selecting spare parts - Renderizado condicional */}
      {modalRepuestosVisible && !isNavigating && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Seleccionar Repuestos</h3>
                <button 
                  className="close-button" 
                  onClick={() => !isNavigating && cerrarModalSeguro(setModalRepuestosVisible)}
                  disabled={isNavigating}
                >
                  <IoClose size={24} />
                </button>
              </div>
              
              <div className="repuestos-list">
                {repuestos.length > 0 ? (
                  repuestos.map(item => {
                    // Para cada repuesto, calculamos si ya está en la lista
                    const repuestoExistente = repuestosSeleccionados.find(r => r.id === item.id);
                    const cantidadActual = repuestoExistente ? repuestoExistente.cantidad : 0;
                    const stockDisponible = item.stock || item.cantidad || 0;
                    
                    return (
                      <div 
                        key={item.id}
                        className="repuesto-list-item"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid #e8e8e8',
                          borderRadius: '4px',
                          padding: '12px',
                          marginBottom: '10px',
                          backgroundColor: stockDisponible <= 0 ? '#f5f5f5' : 'white'
                        }}
                      >
                        <div className="repuesto-info">
                          <p style={{ fontWeight: 'bold', fontSize: '16px', margin: '0 0 8px 0' }}>
                            {item.nombre}
                          </p>
                          <p style={{ 
                            margin: '0 0 5px 0', 
                            color: stockDisponible <= 0 ? '#ff4d4f' : 'inherit' 
                          }}>
                            Stock: {stockDisponible} unidades
                          </p>
                        </div>
                        
                        {/* Control de cantidad estilo inventario */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          border: '1px solid #e8e8e8',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          {cantidadActual > 0 ? (
                            <>
                              <button 
                                onClick={() => {
                                  if (isNavigating) return;
                                  
                                  // Eliminar una unidad o el repuesto completo
                                  if (cantidadActual === 1) {
                                    // Si solo queda 1, eliminamos el repuesto
                                    const nuevosRepuestos = repuestosSeleccionados.filter(r => r.id !== item.id);
                                    safeSetState(setRepuestosSeleccionados, nuevosRepuestos);
                                  } else {
                                    // Disminuir la cantidad
                                    const nuevosRepuestos = repuestosSeleccionados.map(r => 
                                      r.id === item.id ? { ...r, cantidad: r.cantidad - 1 } : r
                                    );
                                    safeSetState(setRepuestosSeleccionados, nuevosRepuestos);
                                  }
                                }}
                                style={{
                                  backgroundColor: '#f5f5f5',
                                  borderRadius: '0',
                                  border: 'none',
                                  width: '40px',
                                  height: '40px',
                                  fontSize: '20px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                disabled={isNavigating}
                              >
                                -
                              </button>
                              
                              <div style={{
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                                fontWeight: 'bold'
                              }}>
                                {cantidadActual}
                              </div>
                            </>
                          ) : (
                            <div style={{ width: '80px' }}></div>
                          )}
                          
                          <button 
                            onClick={() => {
                              if (isNavigating) return;
                              
                              if (stockDisponible <= 0) {
                                alert('No hay stock disponible');
                                return;
                              }
                              
                              if (cantidadActual >= stockDisponible) {
                                alert(`No hay suficiente stock. Disponible: ${stockDisponible}`);
                                return;
                              }
                              
                              // Lógica para agregar/actualizar repuesto
                              if (cantidadActual === 0) {
                                // Primer clic: agregar nuevo repuesto
                                safeSetState(setRepuestosSeleccionados, [
                                  ...repuestosSeleccionados,
                                  { id: item.id, nombre: item.nombre, cantidad: 1 }
                                ]);
                              } else {
                                // Incrementar cantidad del existente
                                safeSetState(setRepuestosSeleccionados, repuestosSeleccionados.map(r => 
                                  r.id === item.id ? { ...r, cantidad: r.cantidad + 1 } : r
                                ));
                              }
                            }}
                            style={{
                              backgroundColor: stockDisponible <= 0 ? '#f5f5f5' : '#1890FF',
                              color: 'white',
                              borderRadius: '0',
                              border: 'none',
                              width: '40px',
                              height: '40px',
                              fontSize: '20px',
                              cursor: stockDisponible <= 0 || isNavigating ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            disabled={stockDisponible <= 0 || cantidadActual >= stockDisponible || isNavigating}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-list">
                    <p className="empty-text">No hay repuestos disponibles</p>
                  </div>
                )}
              </div>
              
              <button 
                className="submit-button"
                onClick={() => {
                  if (isNavigating) return;
                  
                  if (repuestosSeleccionados.length > 0) {
                    // Mostrar resumen de lo que se utilizará
                    const resumen = repuestosSeleccionados.map(r => 
                      `${r.nombre} x${r.cantidad}`
                    ).join('\n');
                    
                    alert(`Repuestos a utilizar:\n${resumen}`);
                  }
                  cerrarModalSeguro(setModalRepuestosVisible);
                }}
                disabled={isNavigating}
              >
                Confirmar Selección
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Estilos CSS adicionales para el componente seleccionado */}
      <style>{`
        .mantenimiento-item-seleccionado {
          border: 2px solid #1890FF !important;
          box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3) !important;
          transition: all 0.3s ease-in-out;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Exportar el componente envuelto con el HOC de protección de navegación
export default withNavigationProtection(MantencionScreen);