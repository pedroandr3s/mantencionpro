import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
  Collapse,
  InputAdornment,
  Paper,
  Fab,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  AddCircle as AddCircleIcon,
  ChevronRight as ChevronRightIcon,
  FilterAlt as FilterAltIcon
} from '@mui/icons-material';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc,
  addDoc,
  getDoc,
  getDocs, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import firebaseApp from '../firebase/credenciales';
import NavigationHelper, { withNavigationProtection } from '../NavigationManager';

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Categorías predefinidas para el Combo Box
const CATEGORIAS_PREDEFINIDAS = ['Todas', 'Lubricantes', 'Neumáticos', 'Repuestos'];

const InventarioScreen = ({ navigation, route }) => {
  // Inicializar NavigationHelper
  useEffect(() => {
    NavigationHelper.initialize(navigation);
  }, [navigation]);

  // Control de montaje del componente
  const isMounted = useRef(true);
  const isNavigatingRef = useRef(false);
  const unsubscribeRef = useRef(null);
  
  // Estado para los repuestos e insumos
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('Todas');
  const [modalVisible, setModalVisible] = useState(false);
  const [historialModalVisible, setHistorialModalVisible] = useState(false);
  const [itemSeleccionado, setItemSeleccionado] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    nombre: '',
    codigo: '',
    cantidad: '',
    minimo: '',
    categoria: '',
    ubicacion: '',
    proveedor: '',
    unidad: ''
  });
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Estados para historial de mantenimientos
  const [historialMantenimientos, setHistorialMantenimientos] = useState([]);
  const [camiones, setCamiones] = useState([]);
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false);
  
  // Controlar el montaje/desmontaje del componente - usar useLayoutEffect para asegurar ejecución antes de renderizado
  useLayoutEffect(() => {
    isMounted.current = true;
    isNavigatingRef.current = false;
    
    return () => {
      isMounted.current = false;
      
      // Cancelar cualquier suscripción pendiente
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
        } catch (error) {
          console.error("Error al cancelar suscripción:", error);
        }
        unsubscribeRef.current = null;
      }
      
      // Cerrar modales al desmontar
      setModalVisible(false);
      setHistorialModalVisible(false);
    };
  }, []);

  // Función segura para actualizar estado
  const safeSetState = (setter, value) => {
    if (isMounted.current && !isNavigatingRef.current) {
      try {
        setter(value);
      } catch (error) {
        console.error("Error en safeSetState:", error);
      }
    }
  };
  
  // Verificar si se está accediendo desde MantencionScreen
  useEffect(() => {
    if (route?.params?.seleccionarRepuestos && route?.params?.mantenimientoId) {
      console.log("Seleccionando repuestos para mantenimiento:", route.params.mantenimientoId);
    }
    
    // Verificar si venimos de navegar desde otra pantalla con un repuesto actualizado
    if (route?.params?.repuestoActualizado) {
      // Refrescar los datos
      cargarInventario();
    }
  }, [route?.params]);

  // Cargar inventario de forma segura
  const cargarInventario = () => {
    if (!isMounted.current || isNavigatingRef.current) return;
    
    safeSetState(setIsLoading, true);
    safeSetState(setErrorMsg, null);
    
    // Limpiar suscripción previa si existe
    if (unsubscribeRef.current) {
      try {
        unsubscribeRef.current();
      } catch (error) {
        console.error("Error al limpiar suscripción previa:", error);
      }
      unsubscribeRef.current = null;
    }
    
    try {
      const inventarioRef = collection(firestore, 'repuestos');
      const q = query(inventarioRef, orderBy('nombre', 'asc'));
      
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          if (!isMounted.current || isNavigatingRef.current) return;
          
          const inventarioData = [];
          snapshot.forEach((doc) => {
            inventarioData.push({
              id: doc.id,
              ...doc.data()
            });
          });
          
          safeSetState(setInventario, inventarioData);
          safeSetState(setIsLoading, false);
        },
        (error) => {
          if (!isMounted.current || isNavigatingRef.current) return;
          
          console.error("Error al escuchar cambios en inventario:", error);
          safeSetState(setErrorMsg, "Error al obtener datos en tiempo real. Intente nuevamente.");
          safeSetState(setIsLoading, false);
        }
      );
      
      // Guardar referencia para limpieza
      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error("Error al configurar listener:", error);
      safeSetState(setErrorMsg, "Error al configurar escucha de datos.");
      safeSetState(setIsLoading, false);
    }
  };

  // Configurar listener para actualizaciones en tiempo real del inventario
  useEffect(() => {
    cargarInventario();
    
    return () => {
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
        } catch (error) {
          console.error("Error al limpiar suscripción:", error);
        }
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Función para manejar el cambio de categoría seleccionada
  const handleCategoriaChange = (event) => {
    if (!isMounted.current || isNavigatingRef.current) return;
    safeSetState(setCategoriaSeleccionada, event.target.value);
  };

  // Filtrar inventario según término de búsqueda y categoría seleccionada
  const inventarioFiltrado = inventario.filter(item => {
    // Filtrar por término de búsqueda
    const cumpleBusqueda = 
      item.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.categoria?.toLowerCase().includes(busqueda.toLowerCase());
    
    // Filtrar por categoría seleccionada
    const cumpleCategoria = categoriaSeleccionada === 'Todas' || 
      (item.categoria && item.categoria.toLowerCase() === categoriaSeleccionada.toLowerCase());
    
    return cumpleBusqueda && cumpleCategoria;
  });

  // Función para abrir el formulario para agregar un nuevo ítem
  const handleAddItem = () => {
    if (!isMounted.current || isNavigatingRef.current) return;
    
    safeSetState(setEditMode, false);
    safeSetState(setFormData, {
      id: '',
      nombre: '',
      codigo: '',
      cantidad: '',
      minimo: '',
      categoria: '',
      ubicacion: '',
      proveedor: '',
      unidad: ''
    });
    safeSetState(setModalVisible, true);
  };

  // Función para abrir el formulario para editar un ítem existente
  const handleEditItem = (item) => {
    if (!isMounted.current || isNavigatingRef.current) return;
    
    safeSetState(setEditMode, true);
    safeSetState(setFormData, {
      id: item.id,
      nombre: item.nombre || '',
      codigo: item.codigo || '',
      cantidad: (item.cantidad || 0).toString(),
      minimo: (item.minimo || 0).toString(),
      categoria: item.categoria || '',
      ubicacion: item.ubicacion || '',
      proveedor: item.proveedor || '',
      unidad: item.unidad || ''
    });
    safeSetState(setModalVisible, true);
  };

  // Función para eliminar un ítem
  const handleDeleteItem = (id) => {
    if (!isMounted.current || isNavigatingRef.current) return;
    
    if (window.confirm("¿Está seguro que desea eliminar este elemento? Esta acción no se puede deshacer.")) {
      safeSetState(setIsLoading, true);
      
      deleteDoc(doc(firestore, 'repuestos', id))
        .then(() => {
          if (!isMounted.current || isNavigatingRef.current) return;
          safeSetState(setIsLoading, false);
          alert("Elemento eliminado correctamente");
        })
        .catch((error) => {
          if (!isMounted.current || isNavigatingRef.current) return;
          console.error("Error al eliminar:", error);
          safeSetState(setIsLoading, false);
          alert("No se pudo eliminar el elemento. Intente nuevamente.");
        });
    }
  };

  // Función para guardar un nuevo ítem o actualizar uno existente
  const handleSaveItem = async () => {
    if (!isMounted.current || isNavigatingRef.current) return;
    
    if (!formData.nombre || !formData.codigo || !formData.cantidad) {
      alert('Por favor complete los campos obligatorios');
      return;
    }

    try {
      safeSetState(setIsLoading, true);
      
      const itemData = {
        nombre: formData.nombre,
        codigo: formData.codigo,
        cantidad: parseInt(formData.cantidad) || 0,
        minimo: parseInt(formData.minimo) || 0,
        categoria: formData.categoria || '',
        ubicacion: formData.ubicacion || '',
        proveedor: formData.proveedor || '',
        unidad: formData.unidad || '',
        fechaActualizacion: serverTimestamp()
      };

      if (editMode) {
        const itemRef = doc(firestore, 'repuestos', formData.id);
        await updateDoc(itemRef, itemData);
        
        if (!isMounted.current || isNavigatingRef.current) return;
        alert("Elemento actualizado correctamente");
      } else {
        itemData.fechaCreacion = serverTimestamp();
        itemData.stock = parseInt(formData.cantidad) || 0;
        
        await addDoc(collection(firestore, 'repuestos'), itemData);
        
        if (!isMounted.current || isNavigatingRef.current) return;
        alert("Elemento agregado correctamente");
      }

      safeSetState(setModalVisible, false);
      safeSetState(setIsLoading, false);
    } catch (error) {
      if (!isMounted.current || isNavigatingRef.current) return;
      
      console.error("Error al guardar:", error);
      safeSetState(setIsLoading, false);
      alert("No se pudo guardar el elemento. Intente nuevamente.");
    }
  };

  // Función para actualizar la cantidad de un ítem
  const actualizarCantidadItem = async (item, cantidad) => {
    if (!isMounted.current || isNavigatingRef.current) return;
    
    try {
      safeSetState(setIsLoading, true);
      
      const nuevaCantidad = Math.max(0, cantidad);
      
      const itemRef = doc(firestore, 'repuestos', item.id);
      await updateDoc(itemRef, {
        cantidad: nuevaCantidad,
        stock: nuevaCantidad,
        fechaActualizacion: serverTimestamp()
      });
      
      if (!isMounted.current || isNavigatingRef.current) return;
      safeSetState(setIsLoading, false);
    } catch (error) {
      if (!isMounted.current || isNavigatingRef.current) return;
      
      console.error("Error al actualizar cantidad:", error);
      safeSetState(setIsLoading, false);
      alert("No se pudo actualizar la cantidad. Intente nuevamente.");
    }
  };

  // Función para descontar unidades
  const handleDescontarItem = (item) => {
    if (!isMounted.current || isNavigatingRef.current) return;
    
    if (item.cantidad > 0) {
      actualizarCantidadItem(item, item.cantidad - 1);
    } else {
      alert('No hay unidades disponibles para descontar');
    }
  };

  // Función para agregar unidades
  const handleAgregarItem = (item) => {
    if (!isMounted.current || isNavigatingRef.current) return;
    actualizarCantidadItem(item, item.cantidad + 1);
  };

  // Función para ver historial de uso de un producto
  const handleVerHistorial = async (item) => {
    if (!isMounted.current || isNavigatingRef.current) return;
    
    safeSetState(setItemSeleccionado, item);
    safeSetState(setHistorialModalVisible, true);
    
    try {
      safeSetState(setIsLoadingHistorial, true);
      
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const mantenimientosSnap = await getDocs(mantenimientosRef);
      
      if (!isMounted.current || isNavigatingRef.current) return;
      
      const mantenimientosData = [];
      mantenimientosSnap.forEach((doc) => {
        const data = doc.data();
        const usaRepuesto = data.repuestos && data.repuestos.some(r => r.id === item.id);
        
        if (usaRepuesto) {
          mantenimientosData.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      if (!isMounted.current || isNavigatingRef.current) return;
      safeSetState(setHistorialMantenimientos, mantenimientosData);
      
      const equiposRef = collection(firestore, 'equipos');
      const equiposSnap = await getDocs(equiposRef);
      
      if (!isMounted.current || isNavigatingRef.current) return;
      
      const equiposData = [];
      equiposSnap.forEach((doc) => {
        equiposData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      if (!isMounted.current || isNavigatingRef.current) return;
      safeSetState(setCamiones, equiposData);
      safeSetState(setIsLoadingHistorial, false);
    } catch (error) {
      if (!isMounted.current || isNavigatingRef.current) return;
      
      console.error("Error al cargar historial:", error);
      safeSetState(setIsLoadingHistorial, false);
      alert("No se pudo cargar el historial. Intente nuevamente.");
    }
  };

  // Función para obtener nombre de equipo por ID
  const obtenerNombreEquipo = (equipoId) => {
    const equipo = camiones.find(e => e.id === equipoId);
    return equipo ? `Camión #${equipo.numero} - ${equipo.modelo || ''}` : "Equipo desconocido";
  };

  // Filtrar historial por producto seleccionado y formatear
  const obtenerHistorialProducto = () => {
    if (!itemSeleccionado || !historialMantenimientos.length) return [];
    
    const registros = [];
    historialMantenimientos.forEach(mantenimiento => {
      if (mantenimiento.repuestos && mantenimiento.repuestos.length > 0) {
        mantenimiento.repuestos.forEach(repuesto => {
          if (repuesto.id === itemSeleccionado.id) {
            registros.push({
              fecha: mantenimiento.fecha || 'Fecha desconocida',
              camionId: mantenimiento.equipoId,
              cantidad: repuesto.cantidad || 1,
              descripcion: mantenimiento.descripcion || 'Sin descripción',
              mantenimientoId: mantenimiento.id,
              kilometraje: mantenimiento.kilometraje || 0,
              tipo: mantenimiento.tipo || 'Sin tipo'
            });
          }
        });
      }
    });
    
    return registros;
  };

  // Calcular total utilizado del producto seleccionado
  const calcularTotalUtilizado = () => {
    if (!itemSeleccionado || !historialMantenimientos.length) return 0;
    
    let total = 0;
    historialMantenimientos.forEach(mantenimiento => {
      if (mantenimiento.repuestos && mantenimiento.repuestos.length > 0) {
        mantenimiento.repuestos.forEach(repuesto => {
          if (repuesto.id === itemSeleccionado.id) {
            total += repuesto.cantidad || 1;
          }
        });
      }
    });
    
    return total;
  };

  // Función para seleccionar un repuesto para el mantenimiento de manera segura
  const handleSeleccionarRepuesto = async (item) => {
    if (!isMounted.current || isNavigatingRef.current) return;
    
    try {
      // Marcar que estamos comenzando una operación de navegación
      isNavigatingRef.current = true;
      
      // Verificar stock una vez más por seguridad
      if (item.cantidad <= 0) {
        alert('No hay stock disponible');
        isNavigatingRef.current = false;
        return;
      }
      
      console.log("Seleccionando repuesto para mantenimiento:", item.nombre);
      console.log("ID de mantenimiento:", route.params.mantenimientoId);
      
      // Cerrar cualquier modal abierto primero
      safeSetState(setModalVisible, false);
      safeSetState(setHistorialModalVisible, false);
      
      // Mostrar indicador de carga
      safeSetState(setIsLoading, true);
      
      // Obtener el mantenimiento actual
      const mantenimientoRef = doc(firestore, 'mantenimientos', route.params.mantenimientoId);
      let mantenimientoDoc;
      
      try {
        mantenimientoDoc = await getDoc(mantenimientoRef);
      } catch (error) {
        console.error("Error al obtener mantenimiento:", error);
        isNavigatingRef.current = false;
        safeSetState(setIsLoading, false);
        alert("Error: No se pudo acceder al mantenimiento seleccionado");
        return;
      }
      
      if (!mantenimientoDoc.exists()) {
        isNavigatingRef.current = false;
        safeSetState(setIsLoading, false);
        alert('Error: No se encontró el mantenimiento seleccionado');
        return;
      }
      
      const mantenimientoData = mantenimientoDoc.data();
      
      // Verificar si el repuesto ya está en la lista
      const repuestosActuales = mantenimientoData.repuestos || [];
      const repuestoExistente = repuestosActuales.find(r => r.id === item.id);
      
      let nuevosRepuestos = [];
      let cantidadASumar = 1; // Cantidad a agregar o sumar
      
      if (repuestoExistente) {
        // Si ya existe, incrementar cantidad
        if (repuestoExistente.cantidad >= item.cantidad) {
          isNavigatingRef.current = false;
          safeSetState(setIsLoading, false);
          alert(`No hay suficiente stock de ${item.nombre}. Disponible: ${item.cantidad}`);
          return;
        }
        
        nuevosRepuestos = repuestosActuales.map(r => 
          r.id === item.id 
            ? { ...r, cantidad: r.cantidad + cantidadASumar } 
            : r
        );
      } else {
        // Si no existe, agregarlo
        nuevosRepuestos = [
          ...repuestosActuales,
          {
            id: item.id,
            nombre: item.nombre,
            cantidad: cantidadASumar
          }
        ];
      }
      
      try {
        // Actualizar el mantenimiento con los nuevos repuestos
        await updateDoc(mantenimientoRef, {
          repuestos: nuevosRepuestos,
          fechaActualizacion: serverTimestamp()
        });
      } catch (error) {
        console.error("Error al actualizar mantenimiento:", error);
        isNavigatingRef.current = false;
        safeSetState(setIsLoading, false);
        alert("Error al actualizar el mantenimiento. Intente nuevamente.");
        return;
      }
      
      try {
        // Actualizar el stock del repuesto
        const nuevoStock = Math.max(0, item.cantidad - cantidadASumar);
        const repuestoRef = doc(firestore, 'repuestos', item.id);
        
        await updateDoc(repuestoRef, {
          cantidad: nuevoStock,
          stock: nuevoStock,
          fechaActualizacion: serverTimestamp()
        });
      } catch (error) {
        console.error("Error al actualizar stock:", error);
        // Continuar a pesar del error, ya que el mantenimiento se actualizó
      }
      
      // Utilizar el NavigationHelper para navegar de forma segura
      const resultado = NavigationHelper.navigate('MantencionScreen', { 
        mantenimientoId: route.params.mantenimientoId,
        repuestoActualizado: true,
        timestamp: new Date().getTime() // Para forzar refresh
      });
      
      if (!resultado) {
        // Si la navegación no fue exitosa, restablecer estado
        isNavigatingRef.current = false;
        safeSetState(setIsLoading, false);
        alert("Repuesto agregado correctamente. Por favor regrese a la pantalla anterior manualmente.");
      }
    } catch (error) {
      isNavigatingRef.current = false;
      safeSetState(setIsLoading, false);
      console.error("Error al seleccionar repuesto:", error);
      alert("Error al seleccionar repuesto: " + error.message);
    }
  };

  // Función para navegar al mantenimiento desde el historial
  const navegarAMantenimiento = (mantenimientoId) => {
    if (!isMounted.current || isNavigatingRef.current) return;
    
    try {
      // Cerrar el modal primero
      safeSetState(setHistorialModalVisible, false);
      
      // Marcar que estamos navegando
      isNavigatingRef.current = true;
      
      // Cancelar cualquier suscripción pendiente
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        } catch (error) {
          console.error("Error al cancelar suscripción:", error);
        }
      }
      
      // Usar NavigationHelper para navegar de forma segura
      NavigationHelper.navigate('MantencionScreen', { 
        mantenimientoId: mantenimientoId,
        timestamp: new Date().getTime() // Para forzar refresh
      });
    } catch (error) {
      console.error("Error al navegar a mantenimiento:", error);
      isNavigatingRef.current = false;
      alert("Error al navegar: " + error.message);
    }
  };

  // Manejar el cierre seguro de modales
  const cerrarModalSeguro = (setterFn) => {
    if (!isMounted.current) return;
    
    try {
      // Usar un pequeño retraso para evitar problemas de DOM
      setTimeout(() => {
        if (isMounted.current) {
          setterFn(false);
        }
      }, 50);
    } catch (error) {
      console.error("Error al cerrar modal:", error);
    }
  };

  // Si está cargando, mostrar indicador
  if (isLoading && inventario.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Cargando inventario...</Typography>
      </Box>
    );
  }

  // Renderizar el componente SOLO si no estamos navegando
  if (isNavigatingRef.current) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        sx={{ 
          position: 'fixed',
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          backgroundColor: 'rgba(255,255,255,0.7)',
          zIndex: 9999
        }}
      >
        <CircularProgress size={60} />
        <Typography sx={{ ml: 2, fontWeight: 'bold' }}>Navegando...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, position: 'relative' }}>
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <CircularProgress />
        </Box>
      )}
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {route?.params?.seleccionarRepuestos ? 'Seleccionar Repuestos' : 'Inventario'}
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Buscar repuesto o insumo..."
              value={busqueda}
              onChange={(e) => !isNavigatingRef.current && safeSetState(setBusqueda, e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel id="categoria-select-label">Categoría</InputLabel>
              <Select
                labelId="categoria-select-label"
                id="categoria-select"
                value={categoriaSeleccionada}
                label="Categoría"
                onChange={handleCategoriaChange}
                startAdornment={
                  <InputAdornment position="start">
                    <FilterAltIcon />
                  </InputAdornment>
                }
              >
                {CATEGORIAS_PREDEFINIDAS.map((categoria) => (
                  <MenuItem key={categoria} value={categoria}>
                    {categoria}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>
      
      {errorMsg && (
        <Collapse in={true}>
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => !isNavigatingRef.current && window.location.reload()}
              >
                Recargar
              </Button>
            }
          >
            {errorMsg}
          </Alert>
        </Collapse>
      )}
      
      <Grid container spacing={3}>
        {inventarioFiltrado.map((item) => (
          <Grid item xs={12} md={6} lg={4} key={item.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <div>
                    <Typography variant="h6" gutterBottom>
                      {item.nombre}
                    </Typography>
                    <Chip label={item.codigo} size="small" sx={{ mb: 1, mr: 1 }} />
                    {item.categoria && (
                      <Chip 
                        label={item.categoria} 
                        size="small" 
                        sx={{ mb: 1 }} 
                        color={
                          item.categoria.toLowerCase() === 'lubricantes' ? 'primary' : 
                          item.categoria.toLowerCase() === 'neumáticos' ? 'secondary' : 
                          item.categoria.toLowerCase() === 'repuestos' ? 'success' : 
                          'default'
                        }
                      />
                    )}
                  </div>
                  
                  {!route?.params?.seleccionarRepuestos && (
                    <IconButton 
                      size="small" 
                      onClick={() => !isNavigatingRef.current && handleDeleteItem(item.id)}
                      disabled={isLoading || isNavigatingRef.current}
                    >
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                  )}
                </Box>
                
                <Grid container spacing={1} sx={{ mb: 2 }}>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>Categoría:</strong> {item.categoria || 'No especificada'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>Ubicación:</strong> {item.ubicacion || 'No especificada'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>Proveedor:</strong> {item.proveedor || 'No especificado'}
                    </Typography>
                  </Grid>
                  {item.unidad && (
                    <Grid item xs={12}>
                      <Typography variant="body2">
                        <strong>Unidad:</strong> {item.unidad}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
                
                <Box sx={{ borderTop: '1px solid #eee', pt: 2, mt: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box display="flex" alignItems="center">
                      <Typography variant="body2" fontWeight="bold" sx={{ mr: 1 }}>
                        Cantidad:
                      </Typography>
                      <Box display="flex" alignItems="center">
                        {!route?.params?.seleccionarRepuestos && (
                          <IconButton 
                            size="small" 
                            onClick={() => !isNavigatingRef.current && handleDescontarItem(item)}
                            disabled={isLoading || isNavigatingRef.current}
                          >
                            <RemoveIcon fontSize="small" color="error" />
                          </IconButton>
                        )}
                        
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            mx: 2,
                            color: item.cantidad < item.minimo ? '#ff4d4f' : 'inherit' 
                          }}
                        >
                          {item.cantidad}
                        </Typography>
                        
                        {!route?.params?.seleccionarRepuestos && (
                          <IconButton 
                            size="small" 
                            onClick={() => !isNavigatingRef.current && handleAgregarItem(item)}
                            disabled={isLoading || isNavigatingRef.current}
                          >
                            <AddIcon fontSize="small" color="success" />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                  </Box>
                  
                  {!route?.params?.seleccionarRepuestos && (
                    <Box display="flex" justifyContent="flex-end" gap={1}>
                      <Button 
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => !isNavigatingRef.current && handleEditItem(item)}
                        disabled={isNavigatingRef.current}
                      >
                        Editar
                      </Button>
                      <Button 
                        size="small"
                        startIcon={<HistoryIcon />}
                        onClick={() => !isNavigatingRef.current && handleVerHistorial(item)}
                        disabled={isNavigatingRef.current}
                      >
                        Historial
                      </Button>
                    </Box>
                  )}
                </Box>
                
                {item.cantidad < item.minimo && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Stock bajo el mínimo recomendado ({item.minimo})
                  </Alert>
                )}
                
                {route?.params?.seleccionarRepuestos && (
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={<AddCircleIcon />}
                    disabled={item.cantidad <= 0 || isLoading || isNavigatingRef.current}
                    onClick={() => !isNavigatingRef.current && handleSeleccionarRepuesto(item)}
                    sx={{ mt: 2 }}
                  >
                    {item.cantidad > 0 ? 'Seleccionar' : 'Sin stock'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {inventarioFiltrado.length === 0 && (
        <Box display="flex" justifyContent="center" alignItems="center" p={5}>
          <Typography variant="h6" color="textSecondary">
            No se encontraron items
          </Typography>
        </Box>
      )}
      
      {!route?.params?.seleccionarRepuestos && (
        <Fab
          color="primary"
          onClick={() => !isNavigatingRef.current && handleAddItem()}
          disabled={isNavigatingRef.current}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 24
          }}
        >
          <AddIcon />
        </Fab>
      )}
      
      {/* Modal para agregar o editar ítem - Renderizado condicionalmente */}
      {modalVisible && !isNavigatingRef.current && (
        <Dialog
          open={modalVisible}
          onClose={() => !isNavigatingRef.current && cerrarModalSeguro(setModalVisible)}
          maxWidth="sm"
          fullWidth
          disableRestoreFocus={true}
          disableEnforceFocus={true}
          disablePortal={true}
        >
          <DialogTitle>
            {editMode ? 'Editar Ítem' : 'Agregar Nuevo Ítem'}
            <IconButton
              onClick={() => !isNavigatingRef.current && cerrarModalSeguro(setModalVisible)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
              disabled={isNavigatingRef.current}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" color="primary" gutterBottom sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', pb: 1, mb: 2 }}>
                Información del Producto
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nombre *"
                    value={formData.nombre}
                    onChange={(e) => !isNavigatingRef.current && safeSetState(setFormData, {...formData, nombre: e.target.value})}
                    placeholder="Nombre del repuesto o insumo"
                    disabled={isNavigatingRef.current}
                    required
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Código *"
                    value={formData.codigo}
                    onChange={(e) => !isNavigatingRef.current && safeSetState(setFormData, {...formData, codigo: e.target.value})}
                    placeholder="Código de referencia"
                    disabled={isNavigatingRef.current}
                    required
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControl fullWidth variant="outlined" sx={{ mt: 1, mb: 1 }}>
                    <InputLabel shrink htmlFor="categoria-select">Categoría</InputLabel>
                    <Select
                      native
                      id="categoria-select"
                      value={formData.categoria}
                      onChange={(e) => !isNavigatingRef.current && safeSetState(setFormData, {...formData, categoria: e.target.value})}
                      disabled={isNavigatingRef.current}
                      inputProps={{
                        id: 'categoria-select',
                        name: 'categoria',
                      }}
                    >
                      <option value="" disabled>Seleccionar categoría</option>
                      {CATEGORIAS_PREDEFINIDAS.filter(cat => cat !== 'Todas').map((categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Unidad"
                    value={formData.unidad}
                    onChange={(e) => !isNavigatingRef.current && safeSetState(setFormData, {...formData, unidad: e.target.value})}
                    placeholder="Ej: litros, unidades, piezas, etc."
                    disabled={isNavigatingRef.current}
                  />
                </Grid>
              </Grid>
              
              <Typography variant="subtitle1" color="primary" gutterBottom sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', pb: 1, mt: 4, mb: 2 }}>
                Información de Stock
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Cantidad Actual *"
                    type="number"
                    value={formData.cantidad}
                    onChange={(e) => !isNavigatingRef.current && safeSetState(setFormData, {...formData, cantidad: e.target.value})}
                    placeholder="Cantidad disponible"
                    disabled={isNavigatingRef.current}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{formData.unidad || 'unidades'}</InputAdornment>,
                    }}
                    required
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Cantidad Mínima"
                    type="number"
                    value={formData.minimo}
                    onChange={(e) => !isNavigatingRef.current && safeSetState(setFormData, {...formData, minimo: e.target.value})}
                    placeholder="Cantidad mínima recomendada"
                    disabled={isNavigatingRef.current}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{formData.unidad || 'unidades'}</InputAdornment>,
                    }}
                    helperText="Nivel para alertas de stock bajo"
                  />
                </Grid>
              </Grid>
              
              <Typography variant="subtitle1" color="primary" gutterBottom sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', pb: 1, mt: 4, mb: 2 }}>
                Información de Ubicación
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Ubicación"
                    value={formData.ubicacion}
                    onChange={(e) => !isNavigatingRef.current && safeSetState(setFormData, {...formData, ubicacion: e.target.value})}
                    placeholder="Ej: Estante A, Bodega 2, etc."
                    disabled={isNavigatingRef.current}
                    helperText="Ubicación en almacén o bodega"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Proveedor"
                    value={formData.proveedor}
                    onChange={(e) => !isNavigatingRef.current && safeSetState(setFormData, {...formData, proveedor: e.target.value})}
                    placeholder="Nombre del proveedor"
                    disabled={isNavigatingRef.current}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => !isNavigatingRef.current && cerrarModalSeguro(setModalVisible)}
              disabled={isNavigatingRef.current}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={() => !isNavigatingRef.current && handleSaveItem()}
              disabled={isLoading || isNavigatingRef.current}
            >
              {isLoading ? <CircularProgress size={24} /> : (editMode ? 'Actualizar' : 'Guardar')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      
      {/* Modal para mostrar historial de uso - Renderizado condicionalmente */}
      {historialModalVisible && !isNavigatingRef.current && (
        <Dialog
          open={historialModalVisible}
          onClose={() => !isNavigatingRef.current && cerrarModalSeguro(setHistorialModalVisible)}
          maxWidth="md"
          fullWidth
          disableRestoreFocus={true}
          disableEnforceFocus={true}
          disablePortal={true}
        >
          <DialogTitle>
            Historial de Uso: {itemSeleccionado?.nombre}
            <IconButton
              onClick={() => !isNavigatingRef.current && cerrarModalSeguro(setHistorialModalVisible)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
              disabled={isNavigatingRef.current}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {isLoadingHistorial ? (
              <Box display="flex" justifyContent="center" alignItems="center" p={5}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Cargando historial...</Typography>
              </Box>
            ) : itemSeleccionado && (
              <>
                <Paper sx={{ bgcolor: '#e6f7ff', p: 2, mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Total utilizado: {calcularTotalUtilizado()} {itemSeleccionado.unidad || 'unidades'}
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Disponible actualmente: {itemSeleccionado.cantidad} {itemSeleccionado.unidad || 'unidades'}
                  </Typography>
                </Paper>
                
                {obtenerHistorialProducto().length > 0 ? (
                  obtenerHistorialProducto()
                    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                    .map((registro, index) => (
                      <Paper 
                        key={`${registro.mantenimientoId}-${index}`} 
                        sx={{ 
                          p: 2, 
                          mb: 2,
                          borderLeft: '4px solid #1890ff'
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography fontWeight="bold">
                            {registro.fecha}
                          </Typography>
                          <Chip 
                            label={`${registro.cantidad} ${itemSeleccionado.unidad || 'unidades'}`}
                            color="primary"
                            size="small"
                          />
                        </Box>
                        
                        <Grid container spacing={1} sx={{ borderTop: '1px solid #eee', pt: 1 }}>
                          <Grid item xs={12}>
                            <Typography variant="body2">
                              <strong>Equipo:</strong> {obtenerNombreEquipo(registro.camionId)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="body2">
                              <strong>Tipo:</strong>{' '}
                              <span style={{ color: registro.tipo === 'preventivo' ? '#52c41a' : '#1890ff' }}>
                                {registro.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'}
                              </span>
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="body2">
                              <strong>Kilometraje:</strong>{' '}
                              {registro.kilometraje ? registro.kilometraje.toLocaleString() + ' km' : 'No registrado'}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="body2">
                              <strong>Descripción:</strong> {registro.descripcion || 'Sin descripción'}
                            </Typography>
                          </Grid>
                        </Grid>
                        
                        <Box display="flex" justifyContent="flex-end" mt={1}>
                          <Button
                            size="small"
                            endIcon={<ChevronRightIcon />}
                            onClick={() => !isNavigatingRef.current && navegarAMantenimiento(registro.mantenimientoId)}
                            disabled={isNavigatingRef.current}
                          >
                            Ver mantenimiento
                          </Button>
                        </Box>
                      </Paper>
                    ))
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" p={5}>
                    <Typography variant="h6" color="textSecondary">
                      No hay registros de uso para este producto
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

// Exportar el componente envuelto con el HOC de protección de navegación
export default withNavigationProtection(InventarioScreen);