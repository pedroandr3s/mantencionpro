import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Paper,
  Alert
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  deleteDoc, 
  setDoc 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseApp from '../firebase/credenciales';
import NavigationHelper from '../NavigationManager';

// Initialize Firebase services
const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

/**
 * TrabajadoresScreen component for listing workers by role
 * Allows administrators to view and delete workers
 * Now includes functionality to force sign out deleted users
 */
const TrabajadoresScreen = ({ userRole }) => {
  // State declarations
  const [trabajadores, setTrabajadores] = useState({
    mecanicos: [],
    conductores: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trabajadorToDelete, setTrabajadorToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Check if user has admin access
  useEffect(() => {
    if (userRole !== 'admin') {
      setError('No tienes permisos para acceder a esta sección');
      setIsLoading(false);
    } else {
      loadTrabajadores();
    }
  }, [userRole]);

  // Load workers from Firestore
  const loadTrabajadores = async () => {
    setIsLoading(true);
    setError(null);
    setDeleteSuccess(false);
    setDeleteError(null);
    
    try {
      // Reference to users collection
      const usuariosRef = collection(firestore, 'usuarios');
      
      // Query to get mechanics
      const mecanicoQuery = query(usuariosRef, where('rol', '==', 'mecanico'));
      const mecanicoSnapshot = await getDocs(mecanicoQuery);
      const mecanicos = mecanicoSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Query to get drivers
      const conductorQuery = query(usuariosRef, where('rol', '==', 'conductor'));
      const conductorSnapshot = await getDocs(conductorQuery);
      const conductores = conductorSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Update state with fetched data
      setTrabajadores({
        mecanicos,
        conductores
      });
    } catch (error) {
      console.error('Error al cargar trabajadores:', error);
      setError('Error al cargar los trabajadores. Intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (trabajador) => {
    setTrabajadorToDelete(trabajador);
    setDeleteDialogOpen(true);
  };

  // Close delete confirmation dialog
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setTrabajadorToDelete(null);
  };

  // Delete worker from Firestore and force sign out
  const handleDeleteTrabajador = async () => {
    if (!trabajadorToDelete) return;
    
    setIsLoading(true);
    try {
      // Step 1: Create a forced logout entry in Firestore
      if (trabajadorToDelete.uid) {
        await setDoc(doc(firestore, 'forcedLogouts', trabajadorToDelete.uid), {
          timestamp: new Date().getTime(),
          email: trabajadorToDelete.correo,
          reason: 'deleted_by_admin'
        });
        console.log('Documento de cierre forzado creado para:', trabajadorToDelete.uid);
      }
      
      // Step 2: Delete user document from Firestore
      await deleteDoc(doc(firestore, 'usuarios', trabajadorToDelete.id));
      console.log('Usuario eliminado:', trabajadorToDelete.id);
      
      // Step 3: Update local state to reflect deletion
      setTrabajadores(prev => {
        if (trabajadorToDelete.rol === 'mecanico') {
          return {
            ...prev,
            mecanicos: prev.mecanicos.filter(m => m.id !== trabajadorToDelete.id)
          };
        } else {
          return {
            ...prev,
            conductores: prev.conductores.filter(c => c.id !== trabajadorToDelete.id)
          };
        }
      });
      
      // Show success message
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3000);
    } catch (error) {
      console.error('Error al eliminar trabajador:', error);
      setDeleteError('Error al eliminar el trabajador. Intente nuevamente.');
      setTimeout(() => setDeleteError(null), 3000);
    } finally {
      setIsLoading(false);
      closeDeleteDialog();
    }
  };

  // Navigate back to home
  const handleBack = () => {
    NavigationHelper.navigate('mantencionpro');
  };

  // Render worker list
  const renderTrabajadorList = (trabajadorList) => {
    if (trabajadorList.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="textSecondary">No hay trabajadores para mostrar</Typography>
        </Box>
      );
    }

    return (
      <List>
        {trabajadorList.map((trabajador) => (
          <ListItem key={trabajador.id} divider>
            <ListItemText
              primary={trabajador.nombre || trabajador.correo}
              secondary={trabajador.correo}
            />
            <ListItemSecondaryAction>
              <IconButton 
                edge="end" 
                aria-label="delete" 
                onClick={() => openDeleteDialog(trabajador)}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    );
  };

  // Loading state UI
  if (isLoading && !trabajadores.mecanicos.length && !trabajadores.conductores.length) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        height: 'calc(100vh - 120px)' 
      }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="textSecondary">Cargando trabajadores...</Typography>
      </Box>
    );
  }

  // Error state UI
  if (error && !isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button 
            variant="contained" 
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
          >
            Volver al inicio
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 7 }}>
      {/* App Bar / Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="back"
            onClick={handleBack}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2, flexGrow: 1 }}>
            Administrar Trabajadores
          </Typography>
          <Button 
            color="primary" 
            onClick={loadTrabajadores}
            disabled={isLoading}
          >
            Actualizar
          </Button>
        </Toolbar>
      </AppBar>

      {/* Success/Error Messages */}
      {deleteSuccess && (
        <Alert severity="success" sx={{ mt: 2, mx: 2 }}>
          Trabajador eliminado exitosamente. Su sesión ha sido cerrada inmediatamente.
        </Alert>
      )}
      
      {deleteError && (
        <Alert severity="error" sx={{ mt: 2, mx: 2 }}>
          {deleteError}
        </Alert>
      )}

      {/* Content Area */}
      <Box sx={{ mt: 2 }}>
        <Paper sx={{ width: '100%' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label="Mecánicos" />
            <Tab label="Conductores" />
          </Tabs>
          
          <Box sx={{ p: 0 }}>
            {activeTab === 0 && (
              <Box>
                <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                  <Typography variant="subtitle1">
                    Total Mecánicos: {trabajadores.mecanicos.length}
                  </Typography>
                </Box>
                <Divider />
                {renderTrabajadorList(trabajadores.mecanicos)}
              </Box>
            )}
            
            {activeTab === 1 && (
              <Box>
                <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                  <Typography variant="subtitle1">
                    Total Conductores: {trabajadores.conductores.length}
                  </Typography>
                </Box>
                <Divider />
                {renderTrabajadorList(trabajadores.conductores)}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
      >
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de querer eliminar a{' '}
            <strong>{trabajadorToDelete?.nombre || trabajadorToDelete?.correo}</strong>?
            Esta acción no se puede deshacer y cerrará inmediatamente la sesión del usuario.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleDeleteTrabajador} 
            color="error" 
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrabajadoresScreen;