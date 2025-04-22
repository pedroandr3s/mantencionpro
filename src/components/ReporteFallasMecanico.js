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
  Container
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon
} from '@mui/icons-material';

const ReporteFallasScreen = () => {
  // Estado para almacenar el rol del usuario
  const [userRole, setUserRole] = useState('conductor'); // Cambia a 'mecanico' para probar otra vista
  
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

  // Estado para filtrado
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Cargar datos de ejemplo
  useEffect(() => {
    const reportesEjemplo = [
      {
        id: '1',
        equipo: 'Camión #102',
        kilometraje: '45000',
        descripcion: 'Frenos hacen ruido al frenar',
        fecha: '2025-03-20',
        estado: 'pendiente',
        conductor: 'Juan Pérez',
        prioridad: 'alta'
      },
      {
        id: '2',
        equipo: 'Camión #105',
        kilometraje: '32500',
        descripcion: 'Fuga de aceite',
        fecha: '2025-03-22',
        estado: 'en_proceso',
        conductor: 'Carlos Rodríguez',
        prioridad: 'media'
      },
      {
        id: '3',
        equipo: 'Camión #103',
        kilometraje: '28900',
        descripcion: 'Problema con el sistema eléctrico',
        fecha: '2025-03-15',
        estado: 'solucionado',
        conductor: 'Ana Gómez',
        prioridad: 'media'
      },
    ];
    
    setReportes(reportesEjemplo);
  }, []);

  // Función para enviar un nuevo reporte
  const handleSubmitReporte = () => {
    const newFormData = {
      ...formData,
      id: Date.now().toString(),
      fecha: new Date().toISOString().split('T')[0],
      estado: 'pendiente',
      conductor: 'Usuario Actual'
    };
    
    setReportes([newFormData, ...reportes]);
    setModalVisible(false);
    
    // Resetear el formulario
    setFormData({
      id: '',
      equipo: '',
      kilometraje: '',
      descripcion: '',
      fecha: '',
      estado: 'pendiente',
      conductor: '',
      prioridad: 'media'
    });
  };

  // Función para actualizar el estado de un reporte
  const handleUpdateEstado = (id, nuevoEstado) => {
    const updatedReportes = reportes.map(reporte => 
      reporte.id === id ? { ...reporte, estado: nuevoEstado } : reporte
    );
    
    setReportes(updatedReportes);
  };

  // Filtrar reportes según el estado seleccionado
  const reportesFiltrados = filtroEstado === 'todos' 
    ? reportes 
    : reportes.filter(reporte => reporte.estado === filtroEstado);

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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Encabezado con título y filtro */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {userRole === 'conductor' ? 'Mis Reportes de Fallas' : 'Fallas Reportadas'}
        </Typography>
        
        {/* Filtro de estado (solo visible para mecánicos) */}
        {userRole === 'mecanico' && (
          <FormControl fullWidth sx={{ mt: 2, maxWidth: 300 }}>
            <InputLabel>Filtrar por estado</InputLabel>
            <Select
              value={filtroEstado}
              label="Filtrar por estado"
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="pendiente">Pendientes</MenuItem>
              <MenuItem value="en_proceso">En Proceso</MenuItem>
              <MenuItem value="solucionado">Solucionados</MenuItem>
            </Select>
          </FormControl>
        )}
      </Box>
      
      {/* Lista de reportes */}
      <Grid container spacing={3}>
        {reportesFiltrados.length > 0 ? (
          reportesFiltrados.map((item) => (
            <Grid item xs={12} md={6} key={item.id}>
              <Card>
                <CardContent>
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
                      <strong>Fecha:</strong> {item.fecha}
                    </Typography>
                    <Chip
                      label={item.prioridad.charAt(0).toUpperCase() + item.prioridad.slice(1)}
                      sx={{
                        backgroundColor: getPrioridadColor(item.prioridad),
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                      size="small"
                    />
                  </Box>
                  
                  {/* Botones de actualización (solo visible para mecánicos) */}
                  {userRole === 'mecanico' && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                      {item.estado !== 'en_proceso' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => handleUpdateEstado(item.id, 'en_proceso')}
                        >
                          Iniciar
                        </Button>
                      )}
                      
                      {item.estado !== 'solucionado' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() => handleUpdateEstado(item.id, 'solucionado')}
                        >
                          Solucionar
                        </Button>
                      )}
                      
                      {item.estado === 'solucionado' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          onClick={() => handleUpdateEstado(item.id, 'pendiente')}
                        >
                          Reabrir
                        </Button>
                      )}
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
                No hay reportes disponibles
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
      
      {/* Botón flotante para agregar reporte (solo visible para conductores) */}
      {userRole === 'conductor' && (
        <Fab
          color="primary"
          aria-label="add"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => setModalVisible(true)}
        >
          <AddIcon />
        </Fab>
      )}
      
      {/* Modal para agregar nuevo reporte */}
      <Dialog
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Nuevo Reporte de Falla
          <IconButton
            aria-label="close"
            onClick={() => setModalVisible(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Equipo</InputLabel>
              <Select
                value={formData.equipo}
                label="Equipo"
                onChange={(e) => setFormData({...formData, equipo: e.target.value})}
              >
                <MenuItem value="">
                  <em>Seleccionar equipo</em>
                </MenuItem>
                <MenuItem value="Camión #101">Camión #101</MenuItem>
                <MenuItem value="Camión #102">Camión #102</MenuItem>
                <MenuItem value="Camión #103">Camión #103</MenuItem>
                <MenuItem value="Camión #104">Camión #104</MenuItem>
                <MenuItem value="Camión #105">Camión #105</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label="Kilometraje"
              type="number"
              value={formData.kilometraje}
              onChange={(e) => setFormData({...formData, kilometraje: e.target.value})}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Descripción de la falla"
              multiline
              rows={4}
              value={formData.descripcion}
              onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
              sx={{ mb: 2 }}
            />
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Prioridad</InputLabel>
              <Select
                value={formData.prioridad}
                label="Prioridad"
                onChange={(e) => setFormData({...formData, prioridad: e.target.value})}
              >
                <MenuItem value="baja">Baja</MenuItem>
                <MenuItem value="media">Media</MenuItem>
                <MenuItem value="alta">Alta</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setModalVisible(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmitReporte}
          >
            Enviar Reporte
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ReporteFallasScreen;