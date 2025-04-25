import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Fab,
  Paper,
  Container,
  Tabs,
  Tab,
  Badge,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Pending as PendingIcon,
  CheckCircle as CompletedIcon,
  Build as ProcessIcon,
  AddCircle as AddCircleIcon,
  RemoveCircle as RemoveCircleIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// Importación de firebase
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

// Importar NavigationManager si es necesario
import NavigationHelper, { withNavigationProtection, useNavigation } from '../NavigationManager';

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const ReporteFallasMecanico = ({ navigation, route }) => {
  // Inicializar NavigationHelper si se usa
  useEffect(() => {
    if (navigation) {
      NavigationHelper.initialize(navigation);
    }
  }, [navigation]);

  const [isLoading, setIsLoading] = useState(true);

  // Ref para controlar si el componente está montado
  const isMounted = useRef(true);
  
  // Estado para almacenar el rol del usuario
  const [userRole, setUserRole] = useState('mecanico'); // 'conductor' o 'mecanico'
  
  // Estados para la lista de reportes y formulario
  const [reportes, setReportes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    equipo: '',
    kilometraje: '',
    descripcion: '',
    fecha: '',
    estado: 'pendiente',
    conductor: '',
    prioridad: 'media'
  });

  // Estado para pestañas - 0: pendientes, 1: completados
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Estados para la gestión de reportes y repuestos
  const [modalAtenderVisible, setModalAtenderVisible] = useState(false);
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);
  const [modalRepuestosVisible, setModalRepuestosVisible] = useState(false);
  const [equipos, setEquipos] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [repuestosSeleccionados, setRepuestosSeleccionados] = useState([]);
  const [kmActualizado, setKmActualizado] = useState('');
  const [mecanico, setMecanico] = useState('');
  const [comentario, setComentario] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('en_proceso');
  const [historial, setHistorial] = useState([]);

  // Controlar el montaje/desmontaje del componente
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      
      // Cerrar modales al desmontar
      setModalVisible(false);
      setModalAtenderVisible(false);
      setModalRepuestosVisible(false);
    };
  }, []);

  // Función segura para actualizar estado
  const safeSetState = useCallback((setter, value) => {
    if (isMounted.current) {
      try {
        setter(value);
      } catch (error) {
        console.error("Error en safeSetState:", error);
      }
    }
  }, []);

  // Obtener información del usuario actual
  useEffect(() => {
    const obtenerInfoUsuario = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            const docRef = doc(firestore, `usuarios/${currentUser.uid}`);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              const userData = docSnap.data();
              setMecanico(userData.nombre || currentUser.email);
              
              // Establecer el rol del usuario si existe en los datos
              if (userData.rol) {
                setUserRole(userData.rol);
              }
            } else {
              setMecanico(currentUser.email);
            }
          } catch (error) {
            console.error("Error al obtener datos del usuario:", error);
            setMecanico(currentUser.email);
          }
        }
      } catch (error) {
        console.error("Error al obtener usuario actual:", error);
      }
    };
    
    obtenerInfoUsuario();
  }, []);

  // Cargar datos de Firebase
  const cargarDatos = async () => {
    try {
      setIsLoading(true);
      
      // 1. Cargar reportes
      const reportesRef = collection(firestore, 'reportes');
      const q = query(reportesRef, orderBy('fechaCreacion', 'desc'));
      const reportesSnap = await getDocs(q);
      
      const reportesData = [];
      reportesSnap.forEach((docSnap) => {
        const data = docSnap.data();
        reportesData.push({
          id: docSnap.id,
          ...data,
          fecha: data.fecha ? data.fecha : new Date().toISOString().split('T')[0]
        });
      });
      
      setReportes(reportesData);
      
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
      setIsLoading(false);
      
      setSnackbar({
        open: true,
        message: 'Error al cargar datos: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatos();
  }, []);

  // Función para mostrar el modal de atender reporte
  const handleAtenderReporte = (reporte) => {
    setReporteSeleccionado(reporte);
    setKmActualizado(reporte.kilometraje || '');
    setRepuestosSeleccionados(reporte.repuestos || []);
    setHistorial(reporte.historial || []);
    setNuevoEstado(reporte.estado === 'pendiente' ? 'en_proceso' : 'solucionado');
    setComentario('');
    setModalAtenderVisible(true);
  };

  // Función para gestionar los repuestos
  const handleAddRepuesto = (id, nombre, stockActual) => {
    // Buscar si ya existe en la lista
    const existente = repuestosSeleccionados.find(r => r.id === id);
    
    if (existente) {
      // Si ya existe, verificar stock disponible
      if (existente.cantidad >= stockActual) {
        setSnackbar({
          open: true,
          message: `¡No hay suficiente stock de ${nombre}! Disponible: ${stockActual} unidades`,
          severity: 'warning'
        });
        return;
      }
      
      // Incrementamos la cantidad
      const nuevoArray = repuestosSeleccionados.map(r => {
        if (r.id === id) {
          return { ...r, cantidad: r.cantidad + 1 };
        }
        return { ...r };
      });
      
      setRepuestosSeleccionados(nuevoArray);
    } else {
      // Si no existe, verificar stock
      if (stockActual <= 0) {
        setSnackbar({
          open: true,
          message: `¡No hay stock disponible de ${nombre}!`,
          severity: 'warning'
        });
        return;
      }
      
      // Agregar nuevo con cantidad 1
      const nuevoRepuesto = { id, nombre, cantidad: 1 };
      setRepuestosSeleccionados([...repuestosSeleccionados, nuevoRepuesto]);
    }
  };

  // Función para eliminar un repuesto
  const handleRemoveRepuesto = (id) => {
    const actualizados = repuestosSeleccionados.filter(r => r.id !== id);
    setRepuestosSeleccionados(actualizados);
  };

  // Función para completar un reporte
  const handleCompletarReporte = async () => {
    if (!reporteSeleccionado) return;
    
    if (!comentario) {
      setSnackbar({
        open: true,
        message: 'Por favor ingrese un comentario sobre la atención',
        severity: 'error'
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Preparar el nuevo historial
      const nuevoHistorialItem = {
        estado: nuevoEstado,
        fecha: new Date().toISOString(),
        usuario: mecanico,
        comentario: comentario
      };
      
      const historialActualizado = [...historial, nuevoHistorialItem];
      
      // 1. Actualizar el reporte original como solucionado
      const reporteRef = doc(firestore, 'reportes', reporteSeleccionado.id);
      await updateDoc(reporteRef, {
        estado: nuevoEstado,
        kilometraje: kmActualizado,
        repuestos: repuestosSeleccionados,
        mecanico: mecanico,
        fechaSolucion: nuevoEstado === 'solucionado' ? new Date().toISOString().split('T')[0] : null,
        fechaActualizacion: serverTimestamp(),
        historial: historialActualizado
      });
      
      // 2. Si está solucionado, guardar en la colección "arregladas"
      if (nuevoEstado === 'solucionado') {
        const arregladaData = {
          fecha: new Date().toISOString().split('T')[0],
          tipo: "Correctivo",
          estado: "Completado",
          kilometraje: kmActualizado,
          descripcion: reporteSeleccionado.descripcion,
          mecanico: mecanico,
          repuestos: repuestosSeleccionados,
          equipoId: reporteSeleccionado.equipoId,
          equipo: reporteSeleccionado.equipo,
          reporteOriginalId: reporteSeleccionado.id,
          fechaCreacion: serverTimestamp(),
          historial: historialActualizado
        };
        
        await addDoc(collection(firestore, 'arregladas'), arregladaData);
      }
      
      // 3. Actualizar repuestos (reducir stock) solo si se soluciona
      if (nuevoEstado === 'solucionado') {
        for (const repuesto of repuestosSeleccionados) {
          const repuestoRef = doc(firestore, 'repuestos', repuesto.id);
          const repuestoDoc = await getDoc(repuestoRef);
          
          if (repuestoDoc.exists()) {
            const repuestoData = repuestoDoc.data();
            const stockActual = repuestoData.stock || repuestoData.cantidad || 0;
            const nuevoStock = Math.max(0, stockActual - repuesto.cantidad);
            
            await updateDoc(repuestoRef, {
              stock: nuevoStock,
              cantidad: nuevoStock,
              fechaActualizacion: serverTimestamp()
            });
          }
        }
      }
      
      // 4. Actualizar el equipo si existe ID de equipo y se soluciona
      if (reporteSeleccionado.equipoId && nuevoEstado === 'solucionado') {
        const equipoRef = doc(firestore, 'equipos', reporteSeleccionado.equipoId);
        const equipoDoc = await getDoc(equipoRef);
        
        if (equipoDoc.exists()) {
          await updateDoc(equipoRef, {
            kilometraje: parseInt(kmActualizado) || 0,
            ultimoMantenimiento: new Date().toISOString().split('T')[0],
            estadoMantenimiento: 'bueno',
            fechaActualizacion: serverTimestamp()
          });
        }
      }
      
      // 5. Actualizar la lista local
      const reportesActualizados = reportes.map(reporte => 
        reporte.id === reporteSeleccionado.id 
          ? { 
              ...reporte, 
              estado: nuevoEstado, 
              kilometraje: kmActualizado,
              repuestos: repuestosSeleccionados,
              mecanico: mecanico,
              fechaSolucion: nuevoEstado === 'solucionado' ? new Date().toISOString().split('T')[0] : null,
              historial: historialActualizado
            } 
          : reporte
      );
      
      setReportes(reportesActualizados);
      setModalAtenderVisible(false);
      
      setSnackbar({
        open: true,
        message: nuevoEstado === 'solucionado' 
          ? '¡Reporte completado con éxito!' 
          : 'Estado actualizado correctamente',
        severity: 'success'
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error al procesar reporte:", error);
      setIsLoading(false);
      
      setSnackbar({
        open: true,
        message: 'Error al procesar reporte: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Función para actualizar el estado de un reporte
  const handleUpdateEstado = async (id, nuevoEstado) => {
    try {
      setIsLoading(true);
      
      // Obtener el reporte actual para su historial
      const reporteRef = doc(firestore, 'reportes', id);
      const reporteDoc = await getDoc(reporteRef);
      
      if (!reporteDoc.exists()) {
        throw new Error("El reporte no existe");
      }
      
      const reporteData = reporteDoc.data();
      const historialActual = reporteData.historial || [];
      
      // Actualizar en Firestore
      await updateDoc(reporteRef, {
        estado: nuevoEstado,
        fechaActualizacion: serverTimestamp(),
        historial: [
          ...historialActual,
          {
            estado: nuevoEstado,
            fecha: new Date().toISOString(),
            usuario: mecanico,
            comentario: `Estado actualizado a ${nuevoEstado === 'pendiente' ? 'Pendiente' : nuevoEstado === 'en_proceso' ? 'En Proceso' : 'Solucionado'}`
          }
        ]
      });
      
      // Actualizar la lista local
      const updatedReportes = reportes.map(reporte => 
        reporte.id === id ? { 
          ...reporte, 
          estado: nuevoEstado,
          historial: [
            ...(reporte.historial || []),
            {
              estado: nuevoEstado,
              fecha: new Date().toISOString(),
              usuario: mecanico,
              comentario: `Estado actualizado a ${nuevoEstado === 'pendiente' ? 'Pendiente' : nuevoEstado === 'en_proceso' ? 'En Proceso' : 'Solucionado'}`
            }
          ]
        } : reporte
      );
      
      setReportes(updatedReportes);
      
      setSnackbar({
        open: true,
        message: `Estado actualizado a ${nuevoEstado === 'pendiente' ? 'Pendiente' : nuevoEstado === 'en_proceso' ? 'En Proceso' : 'Solucionado'}`,
        severity: 'success'
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      setIsLoading(false);
      
      setSnackbar({
        open: true,
        message: 'Error al actualizar estado: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Obtener contadores para el dashboard
  const contadorPendientes = reportes.filter(r => r.estado === 'pendiente' || r.estado === 'en_proceso').length;
  const contadorSolucionados = reportes.filter(r => r.estado === 'solucionado').length;

  // Filtrar reportes según la pestaña seleccionada
  const getReportesFiltrados = () => {
    switch(tabValue) {
      case 0: // Pendientes
        return reportes.filter(r => r.estado === 'pendiente' || r.estado === 'en_proceso');
      case 1: // Completados
        return reportes.filter(r => r.estado === 'solucionado');
      default:
        return reportes;
    }
  };

  const reportesFiltrados = getReportesFiltrados();

  // Función para obtener un color según la prioridad
  const getPrioridadColor = (prioridad) => {
    switch(prioridad) {
      case 'alta': return '#FF4D4F';
      case 'media': return '#FFA940';
      case 'baja': return '#52C41A';
      default: return '#FFA940';
    }
  };

  // Función para obtener un texto según el estado
  const getEstadoText = (estado) => {
    switch(estado) {
      case 'pendiente': return 'Pendiente';
      case 'en_proceso': return 'En proceso';
      case 'solucionado': return 'Solucionado';
      default: return 'Desconocido';
    }
  };

  // Función para obtener el color del estado
  const getEstadoColor = (estado) => {
    switch(estado) {
      case 'pendiente': return '#FF4D4F';
      case 'en_proceso': return '#FFA940';
      case 'solucionado': return '#52C41A';
      default: return '#999';
    }
  };

  // Función para formatear fecha
  const formatearFecha = (timestamp) => {
    if (!timestamp) return 'Fecha no disponible';
    
    try {
      const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error("Error al formatear fecha:", error);
      return 'Fecha no válida';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Overlay de carga */}
      {isLoading && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <Box sx={{ 
            p: 3, 
            borderRadius: 2, 
            bgcolor: 'white', 
            boxShadow: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Cargando...</Typography>
          </Box>
        </Box>
      )}
      
      {/* Snackbar para mensajes */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({...snackbar, open: false})}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({...snackbar, open: false})} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      {/* Header con título y dashboard de estado */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        mb: 4 
      }}>
        {/* Título principal */}
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Fallas Reportadas
          </Typography>
        </Box>
        
        {/* Dashboard de estado */}
        <Paper sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          boxShadow: 2
        }}>
          <Button 
            startIcon={<RefreshIcon />}
            onClick={cargarDatos}
            variant="outlined"
            size="small"
          >
            Actualizar
          </Button>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Badge badgeContent={contadorPendientes} color="error" max={99}>
              <Chip 
                icon={<PendingIcon />} 
                label="Pendientes" 
                sx={{ backgroundColor: '#FF4D4F', color: 'white' }}
              />
            </Badge>
            
            <Badge badgeContent={contadorSolucionados} color="success" max={99}>
              <Chip 
                icon={<CompletedIcon />} 
                label="Solucionados" 
                sx={{ backgroundColor: '#52C41A', color: 'white' }}
              />
            </Badge>
          </Box>
        </Paper>
      </Box>
      
      {/* Pestañas para filtrar entre pendientes y completados */}
      <Box sx={{ mb: 4 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{ mb: 2 }}
        >
          <Tab label="Pendientes" />
          <Tab label="Completados" />
        </Tabs>
      </Box>
      
      {/* Lista de reportes */}
      <Grid container spacing={3}>
        {reportesFiltrados.length > 0 ? (
          reportesFiltrados.map((item) => (
            <Grid item xs={12} md={6} key={item.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" component="h2">
                      {item.equipo}
                    </Typography>
                    <Chip
                      label={getEstadoText(item.estado)}
                      sx={{
                        backgroundColor: getEstadoColor(item.estado),
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    />
                  </Box>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Kilometraje:</strong> {item.kilometraje} km
                  </Typography>
                  
                  <Typography variant="body1" sx={{ my: 2 }}>
                    {item.descripcion}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Fecha reporte:</strong> {item.fecha}
                    </Typography>
                    <Chip
                      label={item.prioridad ? item.prioridad.charAt(0).toUpperCase() + item.prioridad.slice(1) : 'Media'}
                      sx={{
                        backgroundColor: getPrioridadColor(item.prioridad || 'media'),
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                      size="small"
                    />
                  </Box>
                  
                  {/* Mostrar quién reportó la falla */}
                  {item.conductor && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Reportado por:</strong> {item.conductor}
                    </Typography>
                  )}
                  
                  {/* Si hay repuestos, mostrarlos */}
                  {item.repuestos && item.repuestos.length > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Repuestos utilizados:
                      </Typography>
                      {item.repuestos.map((repuesto, idx) => (
                        <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                          • {repuesto.nombre} (x{repuesto.cantidad})
                        </Typography>
                      ))}
                    </Box>
                  )}
                  
                  {/* Si está completado, mostrar la fecha de solución y el mecánico */}
                  {item.estado === 'solucionado' && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                      <Typography variant="body2">
                        <strong>Fecha solución:</strong> {item.fechaSolucion || 'N/A'}
                      </Typography>
                      {item.mecanico && (
                        <Typography variant="body2">
                          <strong>Atendido por:</strong> {item.mecanico}
                        </Typography>
                      )}
                    </Box>
                  )}
                  
                  {/* Botones de acción para reportes no solucionados */}
                  {item.estado !== 'solucionado' && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                      {item.estado === 'pendiente' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => handleUpdateEstado(item.id, 'en_proceso')}
                        >
                          Iniciar
                        </Button>
                      )}
                      
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => handleAtenderReporte(item)}
                      >
                        Atender
                      </Button>
                    </Box>
                  )}
                  
                  {/* Opción para reabrir un reporte solucionado */}
                  {item.estado === 'solucionado' && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<InfoIcon />}
                        onClick={() => handleAtenderReporte(item)}
                      >
                        Ver Detalles
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        onClick={() => handleUpdateEstado(item.id, 'pendiente')}
                      >
                        Reabrir
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary">
                No hay reportes disponibles en esta categoría
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
      
      {/* Modal para atender reporte */}
      <Dialog
        open={modalAtenderVisible}
        onClose={() => setModalAtenderVisible(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {reporteSeleccionado?.estado === 'solucionado' ? 'Detalles del Reporte' : 'Atender Reporte de Falla'}
          <IconButton
            aria-label="close"
            onClick={() => setModalAtenderVisible(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
        {reporteSeleccionado && (
            <Box sx={{ pt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {reporteSeleccionado.equipo}
                </Typography>
                <Chip
                  label={getEstadoText(reporteSeleccionado.estado)}
                  sx={{
                    backgroundColor: getEstadoColor(reporteSeleccionado.estado),
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                />
              </Box>
              
              <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
                {reporteSeleccionado.descripcion}
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    <strong>Fecha reporte:</strong> {reporteSeleccionado.fecha}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    <strong>Reportado por:</strong> {reporteSeleccionado.conductor || 'No especificado'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    <strong>Kilometraje actual:</strong> {reporteSeleccionado.kilometraje || '0'} km
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    <strong>Prioridad:</strong> {reporteSeleccionado.prioridad ? reporteSeleccionado.prioridad.charAt(0).toUpperCase() + reporteSeleccionado.prioridad.slice(1) : 'Media'}
                  </Typography>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              {/* Sección de actualización de estado - solo si no está solucionado */}
              {reporteSeleccionado.estado !== 'solucionado' && (
                <>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Atender Falla
                  </Typography>
                
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel id="estado-label">Actualizar Estado</InputLabel>
                        <Select
                          labelId="estado-label"
                          id="estado-select"
                          value={nuevoEstado}
                          label="Actualizar Estado"
                          onChange={(e) => setNuevoEstado(e.target.value)}
                        >
                          {reporteSeleccionado.estado === 'pendiente' && (
                            <MenuItem value="en_proceso">En Proceso</MenuItem>
                          )}
                          <MenuItem value="solucionado">Solucionado</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Actualizar Kilometraje"
                        type="number"
                        value={kmActualizado}
                        onChange={(e) => setKmActualizado(e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                  </Grid>
                  
                  <TextField
                    fullWidth
                    label="Comentario de atención"
                    multiline
                    rows={3}
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Describa la atención realizada o el estado actual de la reparación"
                    sx={{ mb: 3 }}
                  />
                </>
              )}
              
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                Repuestos e Insumos
              </Typography>
              
              {/* Lista de repuestos seleccionados */}
              <List sx={{ mb: 2 }}>
                {repuestosSeleccionados.map((repuesto) => (
                  <ListItem 
                    key={repuesto.id}
                    secondaryAction={
                      reporteSeleccionado.estado !== 'solucionado' && (
                        <IconButton 
                          edge="end" 
                          aria-label="delete" 
                          onClick={() => handleRemoveRepuesto(repuesto.id)}
                        >
                          <RemoveCircleIcon color="error" />
                        </IconButton>
                      )
                    }
                  >
                    <ListItemText 
                      primary={`${repuesto.nombre}`} 
                      secondary={`Cantidad: ${repuesto.cantidad}`} 
                    />
                  </ListItem>
                ))}
                
                {repuestosSeleccionados.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No hay repuestos seleccionados
                  </Typography>
                )}
              </List>
              
              {reporteSeleccionado.estado !== 'solucionado' && (
                <Button
                  variant="outlined"
                  startIcon={<AddCircleIcon />}
                  onClick={() => setModalRepuestosVisible(true)}
                  fullWidth
                  sx={{ mb: 3 }}
                >
                  Agregar Repuestos
                </Button>
              )}
              
              {/* Historial de atención */}
              {historial && historial.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Historial
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    {historial.map((item, index) => (
                      <Box key={index} sx={{ 
                        mb: 2, 
                        pb: 2, 
                        borderBottom: index < historial.length - 1 ? '1px solid #eee' : 'none' 
                      }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" fontWeight="bold">
                            {item.estado === 'pendiente' ? 'Pendiente' : 
                             item.estado === 'en_proceso' ? 'En proceso' : 'Solucionado'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatearFecha(item.fecha)}
                          </Typography>
                        </Box>
                        <Typography variant="body2">
                          <strong>Usuario:</strong> {item.usuario}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {item.comentario}
                        </Typography>
                      </Box>
                    ))}
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setModalAtenderVisible(false)}>
            {reporteSeleccionado?.estado === 'solucionado' ? 'Cerrar' : 'Cancelar'}
          </Button>
          {reporteSeleccionado?.estado !== 'solucionado' && (
            <Button
              variant="contained"
              color="success"
              onClick={handleCompletarReporte}
            >
              {nuevoEstado === 'solucionado' ? 'Completar Reparación' : 'Actualizar Estado'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Modal para seleccionar repuestos */}
      <Dialog
        open={modalRepuestosVisible}
        onClose={() => setModalRepuestosVisible(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Seleccionar Repuestos
          <IconButton
            aria-label="close"
            onClick={() => setModalRepuestosVisible(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {repuestos.length > 0 ? (
              repuestos.map(item => {
                // Para cada repuesto, calculamos si ya está en la lista
                const repuestoExistente = repuestosSeleccionados.find(r => r.id === item.id);
                const cantidadActual = repuestoExistente ? repuestoExistente.cantidad : 0;
                const stockDisponible = item.stock || item.cantidad || 0;
                
                return (
                  <Card key={item.id} sx={{ mb: 2, p: 1 }}>
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, '&:last-child': { pb: 1 } }}>
                      <Box>
                        <Typography variant="subtitle1">{item.nombre}</Typography>
                        <Typography variant="body2" color={stockDisponible <= 0 ? "error" : "text.secondary"}>
                          Stock: {stockDisponible} unidades
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {cantidadActual > 0 && (
                          <IconButton 
                            color="error"
                            onClick={() => {
                              if (cantidadActual === 1) {
                                handleRemoveRepuesto(item.id);
                              } else {
                                const nuevosRepuestos = repuestosSeleccionados.map(r => 
                                  r.id === item.id ? { ...r, cantidad: r.cantidad - 1 } : r
                                );
                                setRepuestosSeleccionados(nuevosRepuestos);
                              }
                            }}
                          >
                            <RemoveCircleIcon />
                          </IconButton>
                        )}
                        
                        {cantidadActual > 0 && (
                          <Typography sx={{ minWidth: '30px', textAlign: 'center' }}>
                            {cantidadActual}
                          </Typography>
                        )}
                        
                        <IconButton 
                          color="primary"
                          disabled={stockDisponible <= 0 || cantidadActual >= stockDisponible}
                          onClick={() => handleAddRepuesto(item.id, item.nombre, stockDisponible)}
                        >
                          <AddCircleIcon />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Typography variant="body1" sx={{ textAlign: 'center', py: 2 }}>
                No hay repuestos disponibles
              </Typography>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setModalRepuestosVisible(false)}>
            Cerrar
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setModalRepuestosVisible(false)}
          >
            Confirmar Selección
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

// Exportar el componente
export default withNavigationProtection ? withNavigationProtection(ReporteFallasMecanico) : ReporteFallasMecanico;