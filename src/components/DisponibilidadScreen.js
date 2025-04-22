import React, { useState, useEffect, useRef } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Cancel as CancelIcon,
  DirectionsCar as CarIcon
} from '@mui/icons-material';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  updateDoc, 
  doc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  getDoc
} from 'firebase/firestore';
import firebaseApp from '../firebase/credenciales';

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

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

const DisponibilidadScreen = ({ route, userData }) => {
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
        // Intentar obtener el rol del usuario desde userData
        if (userData?.rol) {
          setUserRole(userData.rol);
          setUserName(userData.nombre || userData.correo || 'Usuario');
        } else {
          // Si no hay userData, intentar obtener del usuario autenticado
          const currentUser = auth.currentUser;
          if (currentUser) {
            // Intentar obtener el perfil completo desde Firestore
            try {
              const userDoc = await getDoc(doc(firestore, 'usuarios', currentUser.uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                setUserRole(userData.rol || 'conductor');
                setUserName(userData.nombre || userData.correo || currentUser.email || 'Usuario');
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
  }, [userData]);

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
      alert('Debe ingresar un motivo cuando el camión no está disponible');
      return;
    }

    if (formData.estadoDisponibilidad === 'parcial' && (!formData.motivo || !formData.limitaciones)) {
      alert('Debe ingresar un motivo y las limitaciones cuando el camión está parcialmente disponible');
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
      
      alert('Disponibilidad del camión actualizada correctamente');
    } catch (err) {
      console.error('Error al guardar cambios:', err);
      setLoadingAction(false);
      alert('No se pudo actualizar la disponibilidad. Intente nuevamente.');
    }
  };

  // Obtener color y texto según estado de disponibilidad
  const getEstadoInfo = (estado) => {
    switch (estado) {
      case 'disponible':
        return { color: '#52C41A', text: 'Disponible', icon: <CheckCircleIcon /> };
      case 'parcial':
        return { color: '#FAAD14', text: 'Parcialmente Disponible', icon: <WarningIcon /> };
      case 'no_disponible':
        return { color: '#FF4D4F', text: 'No Disponible', icon: <CancelIcon /> };
      default:
        return { color: '#999', text: 'Desconocido', icon: <CarIcon /> };
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

  if (loading && camiones.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Cargando equipos...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, position: 'relative' }}>
      {loading && (
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
        <Typography variant="h4">Disponibilidad de Camiones</Typography>
        <IconButton onClick={handleRefresh} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>
      
      {/* Filtros */}
      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={filtroActual}
          exclusive
          onChange={(event, newValue) => {
            if (newValue !== null) {
              setFiltroActual(newValue);
            }
          }}
          aria-label="filtro de disponibilidad"
        >
          <ToggleButton value="todos">
            Todos
          </ToggleButton>
          <ToggleButton value="disponible" sx={{ '&.Mui-selected': { backgroundColor: '#52C41A', color: 'white' } }}>
            Disponibles
          </ToggleButton>
          <ToggleButton value="parcial" sx={{ '&.Mui-selected': { backgroundColor: '#FAAD14', color: 'white' } }}>
            Parcial
          </ToggleButton>
          <ToggleButton value="no_disponible" sx={{ '&.Mui-selected': { backgroundColor: '#FF4D4F', color: 'white' } }}>
            No Disponibles
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      
      {/* Mostrar mensaje de error si existe */}
      {error && (
        <Collapse in={true}>
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={handleRefresh}>
                Reintentar
              </Button>
            }
          >
            {error}
          </Alert>
        </Collapse>
      )}
      
      {/* Lista de camiones */}
      <Grid container spacing={3}>
        {datosFiltrados.map((camion) => {
          const estadoInfo = getEstadoInfo(camion.estadoDisponibilidad);
          
          return (
            <Grid item xs={12} md={6} lg={4} key={camion.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Camión #{camion.numero}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {camion.modelo}
                      </Typography>
                    </Box>
                    <Chip
                      icon={estadoInfo.icon}
                      label={estadoInfo.text}
                      sx={{
                        backgroundColor: estadoInfo.color,
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                      size="small"
                    />
                  </Box>
                  
                  {/* Mostrar información adicional si no está totalmente disponible */}
                  {camion.estadoDisponibilidad !== 'disponible' && (
                    <Paper 
                      elevation={0} 
                      sx={{ 
                        mt: 2, 
                        p: 2, 
                        backgroundColor: '#FFF7E6',
                        borderLeft: `4px solid ${camion.estadoDisponibilidad === 'parcial' ? '#FAAD14' : '#FF4D4F'}`
                      }}
                    >
                      <Typography variant="body2" gutterBottom>
                        <strong>Motivo:</strong> {camion.motivo || 'No especificado'}
                      </Typography>
                      
                      {camion.estadoDisponibilidad === 'parcial' && camion.limitaciones && (
                        <Typography variant="body2" gutterBottom sx={{ color: '#d48806' }}>
                          <strong>Limitaciones:</strong> {camion.limitaciones}
                        </Typography>
                      )}
                      
                      {camion.estimacionFinalizacion && (
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          <strong>Reparación estimada:</strong> {camion.estimacionFinalizacion}
                        </Typography>
                      )}
                    </Paper>
                  )}
                  
                  <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="textSecondary">
                      <strong>Actualizado:</strong> {camion.ultimaActualizacion || 'No registrado'}
                      {camion.actualizadoPor ? ` por ${camion.actualizadoPor}` : ''}
                    </Typography>
                    
                    {/* Botón de edición (solo visible para mecánicos y administradores) */}
                    {canEdit && (
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleEdit(camion)}
                      >
                        Editar
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      
      {datosFiltrados.length === 0 && (
        <Box display="flex" justifyContent="center" alignItems="center" py={5}>
          <Typography variant="h6" color="textSecondary">
            No hay camiones que coincidan con el filtro
          </Typography>
        </Box>
      )}
      
      {/* Modal para editar disponibilidad (solo para mecánicos y administradores) */}
      {canEdit && (
        <Dialog
          open={modalVisible}
          onClose={() => setModalVisible(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Editar Disponibilidad - Camión #{camionSeleccionado?.numero}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Estado del camión
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <Paper
                    elevation={formData.estadoDisponibilidad === 'disponible' ? 3 : 1}
                    sx={{
                      p: 2,
                      border: '2px solid',
                      borderColor: formData.estadoDisponibilidad === 'disponible' ? '#52C41A' : '#E8E8E8',
                      backgroundColor: formData.estadoDisponibilidad === 'disponible' ? '#F6FFED' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                    onClick={() => setFormData({
                      ...formData, 
                      estadoDisponibilidad: 'disponible',
                      motivo: '',
                      limitaciones: '',
                      estimacionFinalizacion: ''
                    })}
                  >
                    <Box sx={{ color: '#52C41A', mb: 1 }}>
                      <CheckCircleIcon />
                    </Box>
                    <Typography fontWeight="bold">Disponible</Typography>
                    <Typography variant="caption" color="textSecondary">
                      100% operativo
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={4}>
                  <Paper
                    elevation={formData.estadoDisponibilidad === 'parcial' ? 3 : 1}
                    sx={{
                      p: 2,
                      border: '2px solid',
                      borderColor: formData.estadoDisponibilidad === 'parcial' ? '#FAAD14' : '#E8E8E8',
                      backgroundColor: formData.estadoDisponibilidad === 'parcial' ? '#FFF7E6' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                    onClick={() => setFormData({...formData, estadoDisponibilidad: 'parcial'})}
                  >
                    <Box sx={{ color: '#FAAD14', mb: 1 }}>
                      <WarningIcon />
                    </Box>
                    <Typography fontWeight="bold">Parcial</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Con limitaciones
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={4}>
                  <Paper
                    elevation={formData.estadoDisponibilidad === 'no_disponible' ? 3 : 1}
                    sx={{
                      p: 2,
                      border: '2px solid',
                      borderColor: formData.estadoDisponibilidad === 'no_disponible' ? '#FF4D4F' : '#E8E8E8',
                      backgroundColor: formData.estadoDisponibilidad === 'no_disponible' ? '#FFF1F0' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                    onClick={() => setFormData({...formData, estadoDisponibilidad: 'no_disponible'})}
                  >
                    <Box sx={{ color: '#FF4D4F', mb: 1 }}>
                      <CancelIcon />
                    </Box>
                    <Typography fontWeight="bold">No Disponible</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Fuera de servicio
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              
              {formData.estadoDisponibilidad !== 'disponible' && (
                <>
                  <TextField
                    fullWidth
                    label="Motivo"
                    multiline
                    rows={2}
                    value={formData.motivo}
                    onChange={(e) => setFormData({...formData, motivo: e.target.value})}
                    placeholder={formData.estadoDisponibilidad === 'parcial' ? 
                      "Describa el problema" : 
                      "Ingrese el motivo por el cual no está disponible"}
                    sx={{ mb: 2 }}
                  />
                  
                  {formData.estadoDisponibilidad === 'parcial' && (
                    <TextField
                      fullWidth
                      label="Limitaciones"
                      multiline
                      rows={2}
                      value={formData.limitaciones}
                      onChange={(e) => setFormData({...formData, limitaciones: e.target.value})}
                      placeholder="Especifique las limitaciones de operación"
                      sx={{ mb: 2 }}
                    />
                  )}
                  
                  <TextField
                    fullWidth
                    label="Fecha estimada de reparación"
                    type="date"
                    value={formData.estimacionFinalizacion}
                    onChange={(e) => setFormData({...formData, estimacionFinalizacion: e.target.value})}
                    InputLabelProps={{ shrink: true }}
                  />
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setModalVisible(false)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={loadingAction}
            >
              {loadingAction ? <CircularProgress size={24} /> : 'Guardar Cambios'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default DisponibilidadScreen;