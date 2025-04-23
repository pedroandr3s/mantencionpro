import React, { useState, useEffect } from 'react';
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
  Tooltip,
  Fab
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
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc,
  addDoc,
  getDocs, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import firebaseApp from '../firebase/credenciales';

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const InventarioScreen = ({ navigation, route }) => {
  // Estado para los repuestos e insumos
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
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

  // Verificar si se está accediendo desde MantencionScreen
  useEffect(() => {
    if (route?.params?.seleccionarRepuestos && route?.params?.mantenimientoId) {
      console.log("Seleccionando repuestos para mantenimiento:", route.params.mantenimientoId);
    }
  }, [route?.params]);

  // Configurar listener para actualizaciones en tiempo real del inventario
  useEffect(() => {
    setIsLoading(true);
    setErrorMsg(null);
    
    const inventarioRef = collection(firestore, 'repuestos');
    const q = query(inventarioRef, orderBy('nombre', 'asc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const inventarioData = [];
        snapshot.forEach((doc) => {
          inventarioData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        setInventario(inventarioData);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error al escuchar cambios en inventario:", error);
        setErrorMsg("Error al obtener datos en tiempo real. Intente nuevamente.");
        setIsLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, []);

  // Filtrar inventario según término de búsqueda
  const inventarioFiltrado = inventario.filter(item => 
    item.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.categoria?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Función para abrir el formulario para agregar un nuevo ítem
  const handleAddItem = () => {
    setEditMode(false);
    setFormData({
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
    setModalVisible(true);
  };

  // Función para abrir el formulario para editar un ítem existente
  const handleEditItem = (item) => {
    setEditMode(true);
    setFormData({
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
    setModalVisible(true);
  };

  // Función para eliminar un ítem
  const handleDeleteItem = (id) => {
    if (window.confirm("¿Está seguro que desea eliminar este elemento? Esta acción no se puede deshacer.")) {
      setIsLoading(true);
      
      deleteDoc(doc(firestore, 'repuestos', id))
        .then(() => {
          setIsLoading(false);
          alert("Elemento eliminado correctamente");
        })
        .catch((error) => {
          console.error("Error al eliminar:", error);
          setIsLoading(false);
          alert("No se pudo eliminar el elemento. Intente nuevamente.");
        });
    }
  };

  // Función para guardar un nuevo ítem o actualizar uno existente
  const handleSaveItem = async () => {
    if (!formData.nombre || !formData.codigo || !formData.cantidad) {
      alert('Por favor complete los campos obligatorios');
      return;
    }

    try {
      setIsLoading(true);
      
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
        alert("Elemento actualizado correctamente");
      } else {
        itemData.fechaCreacion = serverTimestamp();
        itemData.stock = parseInt(formData.cantidad) || 0;
        
        await addDoc(collection(firestore, 'repuestos'), itemData);
        alert("Elemento agregado correctamente");
      }

      setModalVisible(false);
      setIsLoading(false);
    } catch (error) {
      console.error("Error al guardar:", error);
      setIsLoading(false);
      alert("No se pudo guardar el elemento. Intente nuevamente.");
    }
  };

  // Función para actualizar la cantidad de un ítem
  const actualizarCantidadItem = async (item, cantidad) => {
    try {
      setIsLoading(true);
      
      const nuevaCantidad = Math.max(0, cantidad);
      
      const itemRef = doc(firestore, 'repuestos', item.id);
      await updateDoc(itemRef, {
        cantidad: nuevaCantidad,
        stock: nuevaCantidad,
        fechaActualizacion: serverTimestamp()
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error al actualizar cantidad:", error);
      setIsLoading(false);
      alert("No se pudo actualizar la cantidad. Intente nuevamente.");
    }
  };

  // Función para descontar unidades
  const handleDescontarItem = (item) => {
    if (item.cantidad > 0) {
      actualizarCantidadItem(item, item.cantidad - 1);
    } else {
      alert('No hay unidades disponibles para descontar');
    }
  };

  // Función para agregar unidades
  const handleAgregarItem = (item) => {
    actualizarCantidadItem(item, item.cantidad + 1);
  };

  // Función para ver historial de uso de un producto
  const handleVerHistorial = async (item) => {
    setItemSeleccionado(item);
    setHistorialModalVisible(true);
    
    try {
      setIsLoadingHistorial(true);
      
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const mantenimientosSnap = await getDocs(mantenimientosRef);
      
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
      
      setHistorialMantenimientos(mantenimientosData);
      
      const equiposRef = collection(firestore, 'equipos');
      const equiposSnap = await getDocs(equiposRef);
      
      const equiposData = [];
      equiposSnap.forEach((doc) => {
        equiposData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setCamiones(equiposData);
      
      setIsLoadingHistorial(false);
    } catch (error) {
      console.error("Error al cargar historial:", error);
      setIsLoadingHistorial(false);
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

  // Si está cargando, mostrar indicador
  if (isLoading && inventario.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Cargando inventario...</Typography>
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
        
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Buscar repuesto o insumo..."
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
        {inventarioFiltrado.map((item) => (
          <Grid item xs={12} md={6} lg={4} key={item.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <div>
                    <Typography variant="h6" gutterBottom>
                      {item.nombre}
                    </Typography>
                    <Chip label={item.codigo} size="small" sx={{ mb: 1 }} />
                  </div>
                  
                  <IconButton size="small" onClick={() => handleDeleteItem(item.id)}>
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
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
                        <IconButton 
                          size="small" 
                          onClick={() => handleDescontarItem(item)}
                          disabled={isLoading}
                        >
                          <RemoveIcon fontSize="small" color="error" />
                        </IconButton>
                        
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            mx: 2,
                            color: item.cantidad < item.minimo ? '#ff4d4f' : 'inherit' 
                          }}
                        >
                          {item.cantidad}
                        </Typography>
                        
                        <IconButton 
                          size="small" 
                          onClick={() => handleAgregarItem(item)}
                          disabled={isLoading}
                        >
                          <AddIcon fontSize="small" color="success" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                  
                  <Box display="flex" justifyContent="flex-end" gap={1}>
                    <Button 
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleEditItem(item)}
                    >
                      Editar
                    </Button>
                    <Button 
                      size="small"
                      startIcon={<HistoryIcon />}
                      onClick={() => handleVerHistorial(item)}
                    >
                      Historial
                    </Button>
                  </Box>
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
                    disabled={item.cantidad <= 0 || isLoading}
                    onClick={() => {
                      if (item.cantidad > 0) {
                        navigation?.navigate?.('MantencionScreen', {
                          mantenimientoId: route.params.mantenimientoId,
                          repuestoSeleccionado: {
                            id: item.id,
                            nombre: item.nombre,
                            cantidad: 1,
                            stock: item.cantidad
                          }
                        });
                      } else {
                        alert('No hay stock disponible');
                      }
                    }}
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
          onClick={handleAddItem}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 24
          }}
        >
          <AddIcon />
        </Fab>
      )}
      
      {/* Modal para agregar o editar ítem */}
      <Dialog
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editMode ? 'Editar Ítem' : 'Agregar Nuevo Ítem'}
          <IconButton
            onClick={() => setModalVisible(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre *"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  placeholder="Nombre del repuesto o insumo"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Código *"
                  value={formData.codigo}
                  onChange={(e) => setFormData({...formData, codigo: e.target.value})}
                  placeholder="Código de referencia"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Cantidad *"
                  type="number"
                  value={formData.cantidad}
                  onChange={(e) => setFormData({...formData, cantidad: e.target.value})}
                  placeholder="Cantidad disponible"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Cantidad Mínima"
                  type="number"
                  value={formData.minimo}
                  onChange={(e) => setFormData({...formData, minimo: e.target.value})}
                  placeholder="Cantidad mínima recomendada"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Unidad"
                  value={formData.unidad}
                  onChange={(e) => setFormData({...formData, unidad: e.target.value})}
                  placeholder="Unidad (litros, unidades, etc.)"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Categoría"
                  value={formData.categoria}
                  onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                  placeholder="Categoría del ítem"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Ubicación"
                  value={formData.ubicacion}
                  onChange={(e) => setFormData({...formData, ubicacion: e.target.value})}
                  placeholder="Ubicación en almacén"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Proveedor"
                  value={formData.proveedor}
                  onChange={(e) => setFormData({...formData, proveedor: e.target.value})}
                  placeholder="Proveedor"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalVisible(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveItem}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : (editMode ? 'Actualizar' : 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Modal para mostrar historial de uso */}
      <Dialog
        open={historialModalVisible}
        onClose={() => setHistorialModalVisible(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Historial de Uso: {itemSeleccionado?.nombre}
          <IconButton
            onClick={() => setHistorialModalVisible(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
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
                          onClick={() => {
                            setHistorialModalVisible(false);
                            navigation?.navigate?.('MantencionScreen', { 
                              mantenimientoId: registro.mantenimientoId 
                            });
                          }}
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
    </Box>
  );
};

export default InventarioScreen;