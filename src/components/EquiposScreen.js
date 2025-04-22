import React, { useState, useEffect, useRef } from 'react';
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
  onSnapshot
} from 'firebase/firestore';
import firebaseApp from '../firebase/credenciales';

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

const EquiposScreen = ({ navigation }) => {
  // Estado para los equipos
  const [equipos, setEquipos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [historialVisible, setHistorialVisible] = useState(false);
  const [crearModalVisible, setCrearModalVisible] = useState(false);
  const [editarModalVisible, setEditarModalVisible] = useState(false);
  const [eliminarModalVisible, setEliminarModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [nuevoKilometraje, setNuevoKilometraje] = useState('');
  const [conductores, setConductores] = useState([]);
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
  
  // Ref to track component mount state
  const isMounted = useRef(true);

  // Cargar datos desde Firebase
  useEffect(() => {
    let unsubscribeEquipos = null;
    let unsubscribeMantenimientos = null;

    const cargarDatos = async () => {
      try {
        if (isMounted.current) {
          setIsLoading(true);
          setErrorMsg(null);
        }

        // 1. Cargar conductores
        const cargarConductores = async () => {
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
          } catch (error) {
            console.error("Error al cargar conductores:", error);
          }
        };

        await cargarConductores();
        
        // 2. Suscribirse a cambios en equipos
        const equiposRef = collection(firestore, 'equipos');
        const qEquipos = query(equiposRef, orderBy('numero', 'asc'));
        
        unsubscribeEquipos = onSnapshot(qEquipos, async (equiposSnap) => {
          if (!isMounted.current) return;
          
          const equiposData = equiposSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            historial: []
          }));
          
          // 3. Suscribirse a cambios en mantenimientos
          const mantenimientosRef = collection(firestore, 'mantenimientos');
          
          unsubscribeMantenimientos = onSnapshot(mantenimientosRef, async (mantenimientosSnap) => {
            if (!isMounted.current) return;
            
            const mantenimientosData = mantenimientosSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            // Actualizar los equipos con el historial de mantenimientos
            const equiposActualizados = await Promise.all(equiposData.map(async (equipo) => {
              // Filtrar mantenimientos para este equipo
              const historialEquipo = mantenimientosData.filter(
                m => m.equipoId === equipo.id
              ).map(mantenimiento => ({
                id: mantenimiento.id,
                fecha: mantenimiento.fecha || new Date().toISOString().split('T')[0],
                tipo: mantenimiento.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo',
                kilometraje: mantenimiento.kilometraje || 0,
                descripcion: mantenimiento.descripcion || '',
                repuestos: mantenimiento.repuestos || [],
                mecanico: mantenimiento.mecanico || 'No asignado',
                estado: mantenimiento.estado || 'pendiente'
              }));
              
              // Ordenar por fecha más reciente primero
              historialEquipo.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
              
              // Verificar si hay mantenimientos en proceso para actualizar el estado del equipo
              const mantenimientoEnProceso = historialEquipo.find(m => m.estado === 'en_proceso');
              let estadoEquipo = equipo.estado;
              
              if (mantenimientoEnProceso && equipo.estado === 'Operativo') {
                // Si hay un mantenimiento en proceso, actualizar el estado en Firestore
                const equipoRef = doc(firestore, 'equipos', equipo.id);
                await updateDoc(equipoRef, {
                  estado: 'En Mantenimiento',
                  fechaActualizacion: serverTimestamp()
                });
                estadoEquipo = 'En Mantenimiento';
              } else if (!mantenimientoEnProceso && equipo.estado === 'En Mantenimiento') {
                // Verificar si todos los mantenimientos están completados
                const todoCompletado = !historialEquipo.some(m => m.estado === 'en_proceso' || m.estado === 'pendiente');
                
                if (todoCompletado) {
                  // Actualizar el estado a Operativo
                  const equipoRef = doc(firestore, 'equipos', equipo.id);
                  await updateDoc(equipoRef, {
                    estado: 'Operativo',
                    fechaActualizacion: serverTimestamp()
                  });
                  estadoEquipo = 'Operativo';
                }
              }
              
              // Calcular último y próximo mantenimiento
              const mantenimientosCompletados = historialEquipo.filter(m => m.estado === 'completado');
              let ultimoMantenimiento = equipo.ultimoMantenimiento;
              let proximoMantenimiento = equipo.proximoMantenimiento;
              
              if (mantenimientosCompletados.length > 0) {
                ultimoMantenimiento = mantenimientosCompletados[0].fecha;
                
                // Calcular próximo mantenimiento (2 meses después del último)
                const fechaUltimo = new Date(mantenimientosCompletados[0].fecha);
                fechaUltimo.setMonth(fechaUltimo.getMonth() + 2);
                proximoMantenimiento = fechaUltimo.toISOString().split('T')[0];
              }
              
              return {
                ...equipo,
                historial: historialEquipo,
                ultimoMantenimiento,
                proximoMantenimiento,
                estado: estadoEquipo
              };
            }));
            
            if (isMounted.current) {
              setEquipos(equiposActualizados);
              setIsLoading(false);
            }
          });
        });
        
      } catch (error) {
        console.error("Error al cargar equipos:", error);
        if (isMounted.current) {
          setErrorMsg("Error al cargar los equipos. Intente nuevamente.");
          setIsLoading(false);
        }
      }
    };
    
    cargarDatos();
    
    // Limpiar suscripciones al desmontar
    return () => {
      isMounted.current = false;
      if (unsubscribeEquipos) unsubscribeEquipos();
      if (unsubscribeMantenimientos) unsubscribeMantenimientos();
    };
  }, []);

  // Filtrar equipos según término de búsqueda
  const equiposFiltrados = equipos.filter(equipo => {
    const searchTerm = busqueda.toLowerCase();
    return (
      (equipo.numero && equipo.numero.includes(searchTerm)) ||
      (equipo.modelo && equipo.modelo.toLowerCase().includes(searchTerm)) ||
      (equipo.placa && equipo.placa.toLowerCase().includes(searchTerm)) ||
      (equipo.conductor && equipo.conductor.toLowerCase().includes(searchTerm))
    );
  });

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
      
      setIsLoading(false);
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
      setIsLoading(false);
      alert("Equipo actualizado correctamente");
    } catch (error) {
      console.error("Error al editar equipo:", error);
      setIsLoading(false);
      alert("No se pudo actualizar el equipo. Intente nuevamente.");
    }
  };

  // Función para eliminar un equipo
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
        where('equipoId', '==', equipoSeleccionado.id)
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
      const qMantenimientos = query(
        mantenimientosRef,
        where('equipoId', '==', equipoSeleccionado.id)
      );
      
      const mantenimientosSnap = await getDocs(qMantenimientos);
      
      const eliminarMantenimientos = mantenimientosSnap.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(eliminarMantenimientos);
      
      // Eliminar el equipo de Firestore
      const equipoRef = doc(firestore, 'equipos', equipoSeleccionado.id);
      await deleteDoc(equipoRef);
      
      setEliminarModalVisible(false);
      setIsLoading(false);
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
      setIsLoading(false);
      
      alert("Kilometraje actualizado correctamente");
      
      // Verificar si se debe programar un mantenimiento
      const equipo = equipos.find(e => e.id === id);
      if (equipo && equipo.proximoMantenimientoKm && kmNum >= equipo.proximoMantenimientoKm) {
        if (window.confirm("El equipo ha alcanzado el kilometraje para mantenimiento preventivo. ¿Desea programar un mantenimiento?")) {
          // Navigate to maintenance screen
          navigation?.navigate?.('MantencionScreen', {
            equipoId: id,
            equipoNumero: equipo.numero,
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

  // Función para obtener el color del estado
  const getEstadoColor = (estado) => {
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
  };

  if (isLoading && equipos.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Cargando equipos...</Typography>
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
              <Button color="inherit" size="small" onClick={() => window.location.reload()}>
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
                        // Show action menu
                      }}
                    >
                      <MoreVertIcon />
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
                  Actualizar KM
                </Button>
                <Button 
                  size="small"
                  startIcon={<HistoryIcon />}
                  onClick={() => {
                    setEquipoSeleccionado(equipo);
                    setHistorialVisible(true);
                  }}
                >
                  Ver Historial
                </Button>
                <Button 
                  size="small"
                  startIcon={<BuildIcon />}
                  onClick={() => {
                    // Navigate to maintenance screen
                    navigation?.navigate?.('MantencionScreen', {
                      equipoId: equipo.id,
                      equipoNumero: equipo.numero,
                      kilometraje: equipo.kilometraje.toString()
                    });
                  }}
                >
                  Mantenimiento
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {equiposFiltrados.length === 0 && (
        <Box display="flex" flexDirection="column" alignItems="center" my={5}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No se encontraron equipos
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
          {equipoSeleccionado?.historial && equipoSeleccionado.historial.length > 0 ? (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Mecánico</TableCell>
                    <TableCell>Repuestos</TableCell>
                    <TableCell>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {equipoSeleccionado.historial.map((item) => (
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
              <Typography color="textSecondary">
                No hay registros de mantenimiento
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistorialVisible(false)}>Cerrar</Button>
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