import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Fab,
  Typography,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Chip,
  Tooltip,
  Alert,
  Collapse,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  History as HistoryIcon,
  Build as BuildIcon,
  Search as SearchIcon,
  DirectionsCar as CarIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  orderBy,
  serverTimestamp,
  where,
  onSnapshot,
  limit
} from 'firebase/firestore';
import firebaseApp from '../firebase/credenciales';

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

const EquiposScreen = ({ navigation }) => {
  // Estado para los equipos
  const [equipos, setEquipos] = useState([]);
  const [mantenimientos, setMantenimientos] = useState([]);
  const [conductores, setConductores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [historialVisible, setHistorialVisible] = useState(false);
  const [historialMantenimientos, setHistorialMantenimientos] = useState([]);
  const [crearModalVisible, setCrearModalVisible] = useState(false);
  const [editarModalVisible, setEditarModalVisible] = useState(false);
  const [eliminarModalVisible, setEliminarModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [nuevoKilometraje, setNuevoKilometraje] = useState('');
  const [formEquipo, setFormEquipo] = useState({
    numero: '',
    modelo: '',
    placa: '',
    anio: new Date().getFullYear().toString(),
    kilometraje: '',
    ultimoMantenimientoKm: '',
    proximoMantenimientoKm: '',
    estado: 'Operativo'
  });
  
  // Refs para controlar el estado de montaje y carga
  const isMounted = useRef(true);
  const isInitialLoad = useRef(true);
  const loadTimeoutRef = useRef(null);

  // Función para cargar conductores - simplificada
  const cargarConductores = useCallback(async () => {
    if (!isMounted.current) return [];
    
    try {
      const conductoresRef = collection(firestore, 'usuarios');
      const qConductores = query(
        conductoresRef,
        where('rol', '==', 'conductor')
      );
      
      const conductoresSnap = await getDocs(qConductores);
      const conductoresData = [];
      
      conductoresSnap.forEach((docSnap) => {
        const conductor = docSnap.data();
        conductoresData.push({
          id: docSnap.id,
          nombre: conductor.nombre || conductor.correo || 'Sin nombre',
          correo: conductor.correo || ''
        });
      });
      
      if (isMounted.current) {
        setConductores(conductoresData);
      }
      return conductoresData;
    } catch (error) {
      console.error("Error al cargar conductores:", error);
      return [];
    }
  }, []);

  // Función para cargar datos completa que se ejecuta al montar y al forzar recarga
  const cargarDatosCompletos = useCallback(async () => {
    console.log('Iniciando carga de datos completa...');
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      // 1. Cargar equipos básicos primero
      const equiposRef = collection(firestore, 'equipos');
      const qEquiposBasicos = query(equiposRef, orderBy('numero', 'asc'));
      
      const equiposSnap = await getDocs(qEquiposBasicos);
      if (!isMounted.current) return;
      
      // 2. Transformar datos y actualizar estado inmediatamente para mostrar UI
      const equiposData = equiposSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        historial: [] // Inicializado vacío, lo cargaremos después
      }));
      
      // Actualizar estado y desactivar carga
      setEquipos(equiposData);
      
      // 3. Cargar datos adicionales en segundo plano
      cargarConductores();
      
      // 4. Cargar TODOS los mantenimientos para asegurar que tengamos el historial completo
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const mantenimientosSnap = await getDocs(mantenimientosRef);
      if (!isMounted.current) return;
      
      const mantenimientosData = mantenimientosSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setMantenimientos(mantenimientosData);
      
      // 5. Procesar historial después de tener mantenimientos
      if (isMounted.current && equiposData.length > 0) {
        procesarHistorialEquipos(equiposData, mantenimientosData);
      }
      
      // Desactivar la carga inicial
      isInitialLoad.current = false;
      setIsLoading(false);
      
    } catch (error) {
      console.error("Error al cargar datos completos:", error);
      if (isMounted.current) {
        setErrorMsg("Error al cargar los equipos. Intente nuevamente.");
        setIsLoading(false);
      }
    }
  }, [cargarConductores]);

  // Cargar datos al montar el componente y forzar recarga inmediata
  useEffect(() => {
    console.log('Iniciando carga de datos al montar componente...');
    
    // Safety timeout: si después de 10 segundos no ha cargado, mostrar interfaz
    loadTimeoutRef.current = setTimeout(() => {
      if (isMounted.current && isLoading) {
        console.log('Timeout de carga activado, mostrando UI...');
        setIsLoading(false);
      }
    }, 10000);
    
    // Ejecutar carga de datos completa inmediatamente
    cargarDatosCompletos();
    
    // Limpiar
    return () => {
      isMounted.current = false;
      clearTimeout(loadTimeoutRef.current);
    };
  }, []); // Solo ejecutar en montaje
  
  // Función para cargar los mantenimientos específicos de un equipo cuando se abre el historial
  const cargarMantenimientosEquipo = useCallback(async (equipoId, equipoNumero) => {
    setIsLoading(true);
    try {
      console.log(`Cargando mantenimientos para equipo ID: ${equipoId}, Número: ${equipoNumero}`);
      
      // Consulta por equipoId (método principal)
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const qMantenimientosId = query(
        mantenimientosRef,
        where('equipoId', '==', equipoId)
      );
      
      // Consulta alternativa por número de equipo en caso de que algunos registros usen este método
      const qMantenimientosNumero = query(
        mantenimientosRef,
        where('equipo', '==', `Camión #${equipoNumero}`)
      );
      
      // Ejecutar ambas consultas en paralelo
      const [snapId, snapNumero] = await Promise.all([
        getDocs(qMantenimientosId),
        getDocs(qMantenimientosNumero)
      ]);
      
      // Combinar resultados, asegurándose de no duplicar entradas
      const resultadosMap = new Map();
      
      // Procesar resultados de la primera consulta
      snapId.forEach((doc) => {
        resultadosMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      
      // Agregar resultados de la segunda consulta que no estén duplicados
      snapNumero.forEach((doc) => {
        if (!resultadosMap.has(doc.id)) {
          resultadosMap.set(doc.id, { id: doc.id, ...doc.data() });
        }
      });
      
      // Convertir map a array
      const mantenimientosEquipo = Array.from(resultadosMap.values());
      
      // Procesar mantenimientos para formato de visualización
      const mantenimientosProcesados = mantenimientosEquipo.map(mantenimiento => ({
        id: mantenimiento.id,
        fecha: mantenimiento.fecha || new Date(mantenimiento.fechaCreacion?.seconds * 1000 || Date.now()).toISOString().split('T')[0],
        tipo: mantenimiento.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo',
        kilometraje: mantenimiento.kilometraje || 0,
        descripcion: mantenimiento.descripcion || '',
        repuestos: mantenimiento.repuestos || [],
        mecanico: mantenimiento.mecanico || 'No asignado',
        estado: mantenimiento.estado || 'pendiente',
        fechaCompletado: mantenimiento.fechaCompletado
      }));
      
      // Ordenar por fecha más reciente
      mantenimientosProcesados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      
      console.log(`Se encontraron ${mantenimientosProcesados.length} mantenimientos para el equipo`);
      setHistorialMantenimientos(mantenimientosProcesados);
    } catch (error) {
      console.error("Error al cargar mantenimientos del equipo:", error);
      setHistorialMantenimientos([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Función simplificada para procesar historial
  const procesarHistorialEquipos = useCallback((equiposData, mantenimientosData) => {
    if (!isMounted.current) return;
    
    try {
      const equiposActualizados = equiposData.map(equipo => {
        // Solo procesar si hay mantenimientos para este equipo (optimización)
        const mantenimientosEquipo = mantenimientosData.filter(m => 
          m.equipoId === equipo.id || m.equipo === `Camión #${equipo.numero}`
        );
        
        if (mantenimientosEquipo.length === 0) return equipo;
        
        // Procesamiento del historial para este equipo
        const historialEquipo = mantenimientosEquipo.map(mantenimiento => ({
          id: mantenimiento.id,
          fecha: mantenimiento.fecha || new Date(mantenimiento.fechaCreacion?.seconds * 1000 || Date.now()).toISOString().split('T')[0],
          tipo: mantenimiento.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo',
          kilometraje: mantenimiento.kilometraje || 0,
          descripcion: mantenimiento.descripcion || '',
          repuestos: mantenimiento.repuestos || [],
          mecanico: mantenimiento.mecanico || 'No asignado',
          estado: mantenimiento.estado || 'pendiente'
        }));
        
        // Ordenar por fecha más reciente
        historialEquipo.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        // Determinar estado basado en mantenimientos
        const mantenimientoEnProceso = historialEquipo.find(m => m.estado === 'en_proceso');
        const todoCompletado = !historialEquipo.some(m => m.estado === 'en_proceso' || m.estado === 'pendiente');
        
        let estadoEquipo = equipo.estado;
        
        // Actualizar estado solo si es necesario
        if (mantenimientoEnProceso && equipo.estado === 'Operativo') {
          estadoEquipo = 'En Mantenimiento';
        } else if (!mantenimientoEnProceso && equipo.estado === 'En Mantenimiento' && todoCompletado) {
          estadoEquipo = 'Operativo';
        }
        
        return {
          ...equipo,
          historial: historialEquipo,
          estado: estadoEquipo
        };
      });
      
      setEquipos(equiposActualizados);
    } catch (error) {
      console.error("Error al procesar historial:", error);
    }
  }, []);

  // Memoización para filtrar equipos
  const equiposFiltrados = useMemo(() => {
    try {
      const searchTerm = busqueda.toLowerCase();
      return equipos.filter(equipo => (
        (equipo.numero && equipo.numero.includes(searchTerm)) ||
        (equipo.modelo && equipo.modelo.toLowerCase().includes(searchTerm)) ||
        (equipo.placa && equipo.placa.toLowerCase().includes(searchTerm)) ||
        (equipo.conductor && equipo.conductor.toLowerCase().includes(searchTerm))
      ));
    } catch (error) {
      console.error("Error al filtrar equipos:", error);
      return equipos;
    }
  }, [equipos, busqueda]);

  // Función para crear un nuevo equipo
  const handleCrearEquipo = async () => {
    try {
      // Validación básica
      if (!formEquipo.numero || !formEquipo.placa) {
        alert("Número de camión y patente son campos obligatorios");
        return;
      }
      
      setIsLoading(true);
      
      // Verificar que no exista otro equipo con el mismo número o placa
      const equiposRef = collection(firestore, 'equipos');
      const qNumero = query(equiposRef, where('numero', '==', formEquipo.numero));
      const qPlaca = query(equiposRef, where('placa', '==', formEquipo.placa));
      
      const [numeroSnap, placaSnap] = await Promise.all([
        getDocs(qNumero),
        getDocs(qPlaca)
      ]);
      
      if (!numeroSnap.empty) {
        setIsLoading(false);
        alert(`Ya existe un equipo con el número ${formEquipo.numero}`);
        return;
      }
      
      if (!placaSnap.empty) {
        setIsLoading(false);
        alert(`Ya existe un equipo con la patente ${formEquipo.placa}`);
        return;
      }
      
      // Crear nuevo equipo en Firestore
      const nuevoEquipo = {
        ...formEquipo,
        anio: parseInt(formEquipo.anio) || new Date().getFullYear(),
        kilometraje: parseInt(formEquipo.kilometraje) || 0,
        ultimoMantenimientoKm: parseInt(formEquipo.ultimoMantenimientoKm) || 0,
        proximoMantenimientoKm: parseInt(formEquipo.proximoMantenimientoKm) || 0,
        conductor: '',
        estado: 'Operativo',
        fechaCreacion: serverTimestamp(),
        fechaActualizacion: serverTimestamp()
      };
      
      await addDoc(equiposRef, nuevoEquipo);
      
      setCrearModalVisible(false);
      
      // Reset the form
      setFormEquipo({
        numero: '',
        modelo: '',
        placa: '',
        anio: new Date().getFullYear().toString(),
        kilometraje: '',
        ultimoMantenimientoKm: '',
        proximoMantenimientoKm: '',
        estado: 'Operativo'
      });
      
      // Recargar datos para mostrar el nuevo equipo
      cargarDatosCompletos();
      
      alert("Equipo creado correctamente");
    } catch (error) {
      console.error("Error al crear equipo:", error);
      setIsLoading(false);
      alert("No se pudo crear el equipo. Intente nuevamente.");
    }
  };

  // Función para editar un equipo
  const handleEditarEquipo = async () => {
    try {
      // Validación básica
      if (!formEquipo.numero || !formEquipo.placa) {
        alert("Número de camión y patente son campos obligatorios");
        return;
      }
      
      if (!equipoSeleccionado) {
        alert("No se ha seleccionado ningún equipo para editar");
        return;
      }
      
      setIsLoading(true);
      
      // Verificar que no exista otro equipo con el mismo número o placa (excepto el actual)
      const equiposRef = collection(firestore, 'equipos');
      const qNumero = query(equiposRef, where('numero', '==', formEquipo.numero));
      const qPlaca = query(equiposRef, where('placa', '==', formEquipo.placa));
      
      const [numeroSnap, placaSnap] = await Promise.all([
        getDocs(qNumero),
        getDocs(qPlaca)
      ]);
      
      // Verificar si hay otro equipo con el mismo número
      let duplicadoNumero = false;
      numeroSnap.forEach(doc => {
        if (doc.id !== equipoSeleccionado.id) {
          duplicadoNumero = true;
        }
      });
      
      if (duplicadoNumero) {
        setIsLoading(false);
        alert(`Ya existe otro equipo con el número ${formEquipo.numero}`);
        return;
      }
      
      // Verificar si hay otro equipo con la misma placa
      let duplicadoPlaca = false;
      placaSnap.forEach(doc => {
        if (doc.id !== equipoSeleccionado.id) {
          duplicadoPlaca = true;
        }
      });
      
      if (duplicadoPlaca) {
        setIsLoading(false);
        alert(`Ya existe otro equipo con la patente ${formEquipo.placa}`);
        return;
      }
      
      // Actualizar equipo en Firestore
      const equipoActualizado = {
        ...formEquipo,
        anio: parseInt(formEquipo.anio) || new Date().getFullYear(),
        kilometraje: parseInt(formEquipo.kilometraje) || 0,
        ultimoMantenimientoKm: parseInt(formEquipo.ultimoMantenimientoKm) || 0,
        proximoMantenimientoKm: parseInt(formEquipo.proximoMantenimientoKm) || 0,
        fechaActualizacion: serverTimestamp()
      };
      
      const equipoRef = doc(firestore, 'equipos', equipoSeleccionado.id);
      await updateDoc(equipoRef, equipoActualizado);
      
      setEditarModalVisible(false);
      
      // Recargar datos para mostrar los cambios
      cargarDatosCompletos();
      
      alert("Equipo actualizado correctamente");
    } catch (error) {
      console.error("Error al editar equipo:", error);
      setIsLoading(false);
      alert("No se pudo actualizar el equipo. Intente nuevamente.");
    }
  };

  // Función para eliminar un equipo - optimizada
  const handleEliminarEquipo = async () => {
    try {
      if (!equipoSeleccionado) {
        alert("No se ha seleccionado ningún equipo para eliminar");
        return;
      }
      
      setIsLoading(true);
      
      // Verificar si hay mantenimientos asociados
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const qMantenimientos = query(
        mantenimientosRef,
        where('equipoId', '==', equipoSeleccionado.id),
        limit(1) // Solo necesitamos saber si hay al menos uno
      );
      
      const mantenimientosSnap = await getDocs(qMantenimientos);
      
      if (!mantenimientosSnap.empty) {
        setIsLoading(false);
        if (window.confirm("Este equipo tiene mantenimientos asociados. Si lo elimina, perderá el historial. ¿Desea continuar?")) {
          await confirmarEliminarEquipo();
        }
        return;
      }
      
      await confirmarEliminarEquipo();
    } catch (error) {
      console.error("Error al eliminar equipo:", error);
      setIsLoading(false);
      alert("No se pudo eliminar el equipo. Intente nuevamente.");
    }
  };
  
  // Función auxiliar para confirmar eliminación
  const confirmarEliminarEquipo = async () => {
    try {
      setIsLoading(true);
      
      // Eliminar mantenimientos asociados
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      
      // Consulta por equipoId (principal)
      const qMantenimientosId = query(
        mantenimientosRef,
        where('equipoId', '==', equipoSeleccionado.id)
      );
      
      // Consulta alternativa por número de equipo
      const qMantenimientosNumero = query(
        mantenimientosRef,
        where('equipo', '==', `Camión #${equipoSeleccionado.numero}`)
      );
      
      // Ejecutar ambas consultas
      const [snapId, snapNumero] = await Promise.all([
        getDocs(qMantenimientosId),
        getDocs(qMantenimientosNumero)
      ]);
      
      // Eliminar todos los mantenimientos encontrados
      const eliminarMantenimientos = [
        ...snapId.docs.map(doc => deleteDoc(doc.ref)),
        ...snapNumero.docs.map(doc => deleteDoc(doc.ref))
      ];
      
      await Promise.all(eliminarMantenimientos);
      
      // Eliminar el equipo de Firestore
      const equipoRef = doc(firestore, 'equipos', equipoSeleccionado.id);
      await deleteDoc(equipoRef);
      
      setEliminarModalVisible(false);
      
      // Recargar datos
      cargarDatosCompletos();
      
      alert("Equipo eliminado correctamente");
    } catch (error) {
      console.error("Error al confirmar eliminación:", error);
      setIsLoading(false);
      alert("No se pudo eliminar el equipo. Intente nuevamente.");
    }
  };

  // Función para actualizar el kilometraje
  const handleActualizarKilometraje = async (id, kmValue) => {
    try {
      // Validación
      const kmNum = parseInt(kmValue);
      if (!kmNum) {
        alert("Ingrese un kilometraje válido");
        return;
      }
      
      const equipoActual = equipos.find(e => e.id === id);
      if (!equipoActual) {
        alert("Equipo no encontrado");
        return;
      }
      
      if (kmNum < equipoActual.kilometraje) {
        alert("El nuevo kilometraje debe ser mayor al actual");
        return;
      }
      
      setIsLoading(true);
      
      // Actualizar en Firestore
      const equipoRef = doc(firestore, 'equipos', id);
      await updateDoc(equipoRef, {
        kilometraje: kmNum,
        fechaActualizacion: serverTimestamp()
      });
      
      setModalVisible(false);
      setNuevoKilometraje('');
      
      // Recargar datos para mostrar el cambio
      cargarDatosCompletos();
      
      alert("Kilometraje actualizado correctamente");
      
      // Verificar si se debe programar un mantenimiento
      if (equipoActual && equipoActual.proximoMantenimientoKm && kmNum >= equipoActual.proximoMantenimientoKm) {
        if (window.confirm("El equipo ha alcanzado el kilometraje para mantenimiento preventivo. ¿Desea programar un mantenimiento?")) {
          // Navigate to maintenance screen
          navigation?.navigate?.('MantencionScreen', {
            equipoId: id,
            equipoNumero: equipoActual.numero,
            kilometraje: kmNum.toString()
          });
        }
      }
    } catch (error) {
      console.error("Error al actualizar kilometraje:", error);
      setIsLoading(false);
      alert("No se pudo actualizar el kilometraje. Intente nuevamente.");
    }
  };

  // Memoizar función para obtener color del estado
  const getEstadoColor = useCallback((estado) => {
    switch (estado) {
      case 'Operativo':
        return '#52C41A';
      case 'En Mantenimiento':
        return '#FFA940';
      case 'Fuera de Servicio':
        return '#FF4D4F';
      default:
        return '#999';
    }
  }, []);

  // Función para forzar recarga de datos
  // Función para forzar recarga
const handleForceReload = () => {
  setIsLoading(true);
  
  // Recargar datos básicos rápidamente
  const cargarBasico = async () => {
    try {
      const equiposRef = collection(firestore, 'equipos');
      const qEquipos = query(equiposRef, orderBy('numero', 'asc'));
      
      const equiposSnap = await getDocs(qEquipos);
      
      const equiposData = equiposSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        historial: []
      }));
      
      setEquipos(equiposData);
      setIsLoading(false);
      
      // Cargar el resto en segundo plano
      setTimeout(() => {
        cargarConductores();
        
        // Recargar mantenimientos
        const recargarMantenimientos = async () => {
          const mantenimientosRef = collection(firestore, 'mantenimientos');
          const mantenimientosSnap = await getDocs(mantenimientosRef);
          
          const mantenimientosData = mantenimientosSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setMantenimientos(mantenimientosData);
          procesarHistorialEquipos(equiposData, mantenimientosData);
        };
        
        recargarMantenimientos();
      }, 500);
    } catch (error) {
      console.error("Error al recargar datos:", error);
      setIsLoading(false);
      setErrorMsg("Error al recargar los equipos. Intente nuevamente.");
    }
  };
  
  cargarBasico();
};
  
  // Pantalla de carga
  if (isLoading && equipos.length === 0) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress size={60} />
        <Typography sx={{ mt: 2, mb: 1 }}>Cargando equipos...</Typography>
        <Button 
          variant="outlined" 
          onClick={handleForceReload}
          startIcon={<RefreshIcon />}
          sx={{ mt: 2 }}
        >
          Revisar equipos
        </Button>
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
      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3 
      }}>
        <Typography variant="h4">Equipos</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleForceReload}
            sx={{ mr: 1 }}
            disabled={isLoading}
          >
            Recargar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setFormEquipo({
                numero: '',
                modelo: '',
                placa: '',
                anio: new Date().getFullYear().toString(),
                kilometraje: '',
                ultimoMantenimientoKm: '',
                proximoMantenimientoKm: '',
                estado: 'Operativo'
              });
              setCrearModalVisible(true);
            }}
          >
            Nuevo Equipo
          </Button>
        </Box>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Buscar por número, modelo o conductor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      
      {errorMsg && (
        <Collapse in={true}>
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={handleForceReload}>
                Recargar
              </Button>
            }
          >
            {errorMsg}
          </Alert>
        </Collapse>
      )}
      
      <Grid container spacing={3}>
        {equiposFiltrados.map((equipo) => (
          <Grid item xs={12} md={6} lg={4} key={equipo.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Camión #{equipo.numero}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {equipo.modelo}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center">
                    <Chip
                      label={equipo.estado}
                      sx={{
                        backgroundColor: getEstadoColor(equipo.estado),
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                      size="small"
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEquipoSeleccionado(equipo);
                        setFormEquipo({
                          numero: equipo.numero || '',
                          modelo: equipo.modelo || '',
                          placa: equipo.placa || '',
                          anio: equipo.anio?.toString() || new Date().getFullYear().toString(),
                          kilometraje: equipo.kilometraje?.toString() || '',
                          ultimoMantenimientoKm: equipo.ultimoMantenimientoKm?.toString() || '',
                          proximoMantenimientoKm: equipo.proximoMantenimientoKm?.toString() || '',
                          estado: equipo.estado || 'Operativo',
                          conductor: equipo.conductor || ''
                        });
                        setEditarModalVisible(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                
                <Box mt={2}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Placa:</strong> {equipo.placa}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Año:</strong> {equipo.anio}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Conductor:</strong> {equipo.conductor || 'No asignado'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Kilometraje:</strong> {equipo.kilometraje?.toLocaleString() || 0} km
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Último mantenimiento:</strong> {equipo.ultimoMantenimiento || 'No registrado'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Próximo mantenimiento:</strong> {equipo.proximoMantenimiento || 'No programado'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
              
              <CardActions>
                <Button 
                  size="small"
                  startIcon={<SpeedIcon />}
                  onClick={() => {
                    setEquipoSeleccionado(equipo);
                    setNuevoKilometraje('');
                    setModalVisible(true);
                  }}
                >
                  KM
                </Button>
                <Button 
                  size="small"
                  startIcon={<HistoryIcon />}
                  onClick={() => {
                    setEquipoSeleccionado(equipo);
                    // Cargar los mantenimientos específicos de este equipo
                    cargarMantenimientosEquipo(equipo.id, equipo.numero);
                    setHistorialVisible(true);
                  }}
                >
                  Historial
                </Button>
                <IconButton 
                  size="small" 
                  color="error"
                  onClick={() => {
                    setEquipoSeleccionado(equipo);
                    setEliminarModalVisible(true);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {equiposFiltrados.length === 0 && !isLoading && (
        <Box display="flex" flexDirection="column" alignItems="center" my={5}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            {busqueda ? 'No se encontraron equipos con esa búsqueda' : 'No hay equipos registrados'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setFormEquipo({
                numero: '',
                modelo: '',
                placa: '',
                anio: new Date().getFullYear().toString(),
                kilometraje: '',
                ultimoMantenimientoKm: '',
                proximoMantenimientoKm: '',
                estado: 'Operativo'
              });
              setCrearModalVisible(true);
            }}
          >
            Crear Nuevo Equipo
          </Button>
        </Box>
      )}
      
      {/* Modal para actualizar kilometraje */}
      <Dialog 
        open={modalVisible} 
        onClose={() => setModalVisible(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Actualizar Kilometraje - Camión #{equipoSeleccionado?.numero}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Kilometraje actual: {equipoSeleccionado?.kilometraje?.toLocaleString() || 0} km
            </Alert>
            <TextField
              fullWidth
              label="Nuevo kilometraje"
              type="number"
              value={nuevoKilometraje}
              onChange={(e) => setNuevoKilometraje(e.target.value)}
              placeholder="Ingrese el nuevo kilometraje"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalVisible(false)}>Cancelar</Button>
          <Button 
            variant="contained"
            onClick={() => handleActualizarKilometraje(equipoSeleccionado?.id, nuevoKilometraje)}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'Actualizar'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Modal para crear/editar equipo */}
      <Dialog
        open={crearModalVisible || editarModalVisible}
        onClose={() => {
          setCrearModalVisible(false);
          setEditarModalVisible(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {crearModalVisible ? 'Crear Nuevo Equipo' : 'Editar Camión #' + equipoSeleccionado?.numero}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Número de camión *"
                  value={formEquipo.numero}
                  onChange={(e) => setFormEquipo({...formEquipo, numero: e.target.value})}
                  placeholder="Ej: 101"
                  type="number"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Modelo"
                  value={formEquipo.modelo}
                  onChange={(e) => setFormEquipo({...formEquipo, modelo: e.target.value})}
                  placeholder="Ej: Volvo FH16"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Patente/Placa *"
                  value={formEquipo.placa}
                  onChange={(e) => setFormEquipo({...formEquipo, placa: e.target.value})}
                  placeholder="Ej: ABC-123"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Año"
                  type="number"
                  value={formEquipo.anio}
                  onChange={(e) => setFormEquipo({...formEquipo, anio: e.target.value})}
                  placeholder="Ej: 2022"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Kilometraje actual"
                  type="number"
                  value={formEquipo.kilometraje}
                  onChange={(e) => setFormEquipo({...formEquipo, kilometraje: e.target.value})}
                  placeholder="Ej: 50000"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Último mantenimiento en kilometraje"
                  type="number"
                  value={formEquipo.ultimoMantenimientoKm}
                  onChange={(e) => setFormEquipo({...formEquipo, ultimoMantenimientoKm: e.target.value})}
                  placeholder="Ej: 45000"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Próximo mantenimiento en kilometraje"
                  type="number"
                  value={formEquipo.proximoMantenimientoKm}
                  onChange={(e) => setFormEquipo({...formEquipo, proximoMantenimientoKm: e.target.value})}
                  placeholder="Ej: 55000"
                />
              </Grid>
              
              {editarModalVisible && (
                <>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Conductor</InputLabel>
                      <Select
                        value={formEquipo.conductor || ''}
                        onChange={(e) => setFormEquipo({...formEquipo, conductor: e.target.value})}
                        label="Conductor"
                      >
                        <MenuItem value="">
                          <em>Seleccionar conductor</em>
                        </MenuItem>
                        {conductores.map((conductor) => (
                          <MenuItem key={conductor.id} value={conductor.nombre}>
                            {conductor.nombre}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Estado</InputLabel>
                      <Select
                        value={formEquipo.estado}
                        onChange={(e) => setFormEquipo({...formEquipo, estado: e.target.value})}
                        label="Estado"
                      >
                        <MenuItem value="Operativo">Operativo</MenuItem>
                        <MenuItem value="En Mantenimiento">En Mantenimiento</MenuItem>
                        <MenuItem value="Fuera de Servicio">Fuera de Servicio</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCrearModalVisible(false);
            setEditarModalVisible(false);
          }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={crearModalVisible ? handleCrearEquipo : handleEditarEquipo}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : (crearModalVisible ? 'Guardar Equipo' : 'Guardar Cambios')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Modal para ver historial */}
      <Dialog
        open={historialVisible}
        onClose={() => setHistorialVisible(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Historial - Camión #{equipoSeleccionado?.numero}
        </DialogTitle>
        <DialogContent>
          {historialMantenimientos.length > 0 ? (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Kilometraje</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell>Mecánico</TableCell>
                    <TableCell>Repuestos</TableCell>
                    <TableCell>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historialMantenimientos.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.fecha}</TableCell>
                      <TableCell>
                        <Chip 
                          label={item.tipo}
                          color={item.tipo === 'Preventivo' ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={
                            item.estado === 'pendiente' ? 'Pendiente' :
                            item.estado === 'en_proceso' ? 'En Proceso' : 'Completado'
                          }
                          color={
                            item.estado === 'pendiente' ? 'warning' :
                            item.estado === 'en_proceso' ? 'info' : 'success'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{item.kilometraje?.toLocaleString() || 0} km</TableCell>
                      <TableCell>{item.descripcion}</TableCell>
                      <TableCell>{item.mecanico}</TableCell>
                      <TableCell>
                        {item.repuestos && item.repuestos.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: '20px' }}>
                            {item.repuestos.map((repuesto, index) => (
                              <li key={index}>
                                {typeof repuesto === 'string' ? repuesto : repuesto.nombre}
                                {repuesto.cantidad ? ` (x${repuesto.cantidad})` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          'Sin repuestos'
                        )}
                      </TableCell>
                      <TableCell>
                        {item.estado !== 'completado' && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setHistorialVisible(false);
                              navigation?.navigate?.('MantencionScreen', { 
                                mantenimientoId: item.id
                              });
                            }}
                          >
                            Ir a mantenimiento
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box display="flex" justifyContent="center" alignItems="center" p={4}>
              {isLoading ? (
                <CircularProgress size={40} />
              ) : (
                <Typography color="textSecondary">
                  No hay registros de mantenimiento
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleForceReload} 
            startIcon={<RefreshIcon />}
            color="primary"
          >
            Recargar datos
          </Button>
          <Button onClick={() => setHistorialVisible(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
      
      {/* Modal para confirmar eliminación */}
      <Dialog
        open={eliminarModalVisible}
        onClose={() => setEliminarModalVisible(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar Camión</DialogTitle>
        <DialogContent>
          <Box textAlign="center" py={2}>
            <DeleteIcon sx={{ fontSize: 60, color: '#FF4D4F', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              ¿Está seguro?
            </Typography>
            <Typography>
              Está a punto de eliminar el Camión #{equipoSeleccionado?.numero}. 
              Esta acción no se puede deshacer.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEliminarModalVisible(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleEliminarEquipo}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EquiposScreen;