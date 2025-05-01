import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Grid, 
  Card, 
  CardContent, 
  Typography,
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Container,
  useMediaQuery,
  useTheme,
  CircularProgress
} from '@mui/material';
import { 
  Build as BuildIcon, 
  DirectionsCar as CarIcon, 
  Inventory as InventoryIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import firebaseApp from '../firebase/credenciales';
import './Home.css';
import NavigationHelper from '../NavigationManager';

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

/**
 * Home component for the MantencionPRO dashboard
 * Shows key metrics and quick actions based on user role
 */
const Home = ({ userRole, userData, onLogout, onNavigateToTab }) => {
  // Dashboard metrics state
  const [stats, setStats] = useState({
    equiposOperativos: 0,
    mantencionesPendientes: 0,
    inventarioBajo: 0,
    equiposDisponibles: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Responsive design hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Load dashboard data on component mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Function to fetch and load dashboard data
  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get equipment data
      const equiposRef = collection(firestore, 'equipos');
      const equiposSnapshot = await getDocs(equiposRef);
      
      // Count equipment with "Operativo" status
      const equiposOperativos = equiposSnapshot.docs.filter(doc => 
        doc.data().estado === 'Operativo'
      ).length;
      
      // Count equipment with "disponible" availability status
      const equiposDisponibles = equiposSnapshot.docs.filter(doc => 
        doc.data().estadoDisponibilidad === 'disponible'
      ).length;

      // Only load additional data for admin and mechanic roles
      let mantencionesPendientes = 0;
      let inventarioBajo = 0;
      
      if (userRole === 'admin' || userRole === 'mecanico') {
        // Get pending maintenance count
        try {
          // Contar mantenciones pendientes de la colección mantenimientos
          const mantencionesRef = collection(firestore, 'mantenimientos');
          const mantencionesQuery = query(
            mantencionesRef, 
            where('estado', 'in', ['pendiente', 'en_proceso'])
          );
          const mantencionesSnapshot = await getDocs(mantencionesQuery);
          mantencionesPendientes = mantencionesSnapshot.size;
          
          // NUEVO: Contar también las fallas con estado pendiente
          const fallasRef = collection(firestore, 'fallas');
          const fallasQuery = query(
            fallasRef,
            where('estado', '==', 'pendiente')
          );
          const fallasSnapshot = await getDocs(fallasQuery);
          // También contar fallas que tengan estado pendiente en su último historial
          const fallasConHistorialPendiente = [];
          const todasLasFallasQuery = query(fallasRef);
          const todasLasFallasSnapshot = await getDocs(todasLasFallasQuery);
          
          todasLasFallasSnapshot.docs.forEach(doc => {
            const falla = doc.data();
            if (falla.historial && falla.historial.length > 0) {
              const ultimoEstado = falla.historial[falla.historial.length - 1];
              if (ultimoEstado.estado === 'pendiente') {
                fallasConHistorialPendiente.push(doc.id);
              }
            }
          });
          
          // Sumamos las fallas con estado pendiente más las que tienen el último historial como pendiente
          // (evitando contar duplicados)
          const fallasIds = new Set([
            ...fallasSnapshot.docs.map(doc => doc.id),
            ...fallasConHistorialPendiente
          ]);
          
          mantencionesPendientes += fallasIds.size;
          
          // Get recent activities
          const recentMaintenanceQuery = query(
            mantencionesRef,
            orderBy('fechaActualizacion', 'desc'),
            limit(3)
          );
          const recentMaintenanceSnap = await getDocs(recentMaintenanceQuery);
          
          const maintenanceActivities = recentMaintenanceSnap.docs.map(doc => {
            const mant = doc.data();
            return {
              id: doc.id,
              type: 'maintenance',
              title: `Mantenimiento ${mant.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'}`,
              description: `${mant.equipo} - ${mant.descripcion?.substring(0, 60)}${mant.descripcion?.length > 60 ? '...' : ''}`,
              date: mant.fechaActualizacion?.toDate() || new Date(),
              estado: mant.estado
            };
          });
          
          setRecentActivities(maintenanceActivities);
        } catch (error) {
          console.error("Error al cargar mantenciones:", error);
          mantencionesPendientes = 0;
        }

        // Get low inventory items
        try {
          // Check both 'inventario' and 'repuestos' collections
          const inventarioRef = collection(firestore, 'inventario');
          const inventarioSnapshot = await getDocs(inventarioRef);
          const itemsBajosInventario = inventarioSnapshot.docs.filter(doc => {
            const item = doc.data();
            return item.cantidad <= item.minimo;
          }).length;
          
          // MODIFICADO: Compara el stock con el minimo para cada repuesto
          const repuestosRef = collection(firestore, 'repuestos');
          const repuestosSnapshot = await getDocs(repuestosRef);
          const repuestosBajosStock = repuestosSnapshot.docs.filter(doc => {
            const repuesto = doc.data();
            // Compara el stock con el minimo específico de cada repuesto
            return repuesto.stock !== undefined && 
                   repuesto.minimo !== undefined && 
                   repuesto.stock < repuesto.minimo;
          }).length;
          
          inventarioBajo = itemsBajosInventario + repuestosBajosStock;
        } catch (error) {
          console.error("Error al cargar inventario:", error);
          inventarioBajo = 0;
        }
      }

      // Update state with fetched data
      setStats({
        equiposOperativos,
        mantencionesPendientes,
        inventarioBajo,
        equiposDisponibles
      });

    } catch (error) {
      console.error("Error al cargar datos del dashboard:", error);
      setError("Error al cargar datos. Intente nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  // Stat Card component for displaying metrics
  const StatCard = ({ title, value, icon, color }) => (
    <Card className="stat-card" elevation={2}>
      <CardContent>
        <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} 
             justifyContent="space-between" alignItems="center" className="stat-card-content"
             sx={{ height: isMobile ? '100%' : 'auto' }}>
          <Box textAlign={isMobile ? 'center' : 'left'} mb={isMobile ? 2 : 0}>
            <Typography variant={isMobile ? 'body1' : 'h6'} color="textSecondary" className="stat-title">
              {title}
            </Typography>
            <Typography variant={isMobile ? 'h5' : 'h4'} className="stat-value" style={{ color: color || '#1890FF' }}>
              {value}
            </Typography>
          </Box>
          <Box sx={{ color: color || '#1890FF' }} className="stat-icon">
            {React.cloneElement(icon, { style: { fontSize: isMobile ? 30 : 40 } })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // Activity Item component for recent activities
  const ActivityItem = ({ activity }) => (
    <Box 
      sx={{
        p: 2, 
        mb: 1,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: '1px solid #eee'
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight="bold">
          {activity.title}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {activity.date instanceof Date 
            ? activity.date.toLocaleDateString() 
            : 'Fecha no disponible'}
        </Typography>
      </Box>
      <Typography variant="body2" mt={1}>
        {activity.description}
      </Typography>
      <Box mt={1} display="flex" justifyContent="flex-end">
        <Typography 
          variant="caption" 
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: activity.estado === 'pendiente' 
              ? '#FFF7E6' 
              : activity.estado === 'en_proceso'
                ? '#E6F7FF'
                : '#F6FFED',
            color: activity.estado === 'pendiente' 
              ? '#FA8C16' 
              : activity.estado === 'en_proceso'
                ? '#1890FF'
                : '#52C41A',
          }}
        >
          {activity.estado === 'pendiente' 
            ? 'Pendiente' 
            : activity.estado === 'en_proceso' 
              ? 'En Proceso' 
              : 'Completado'}
        </Typography>
      </Box>
    </Box>
  );

  // Navigate to Trabajadores screen
  const handleNavigateToTrabajadores = () => {
    NavigationHelper.navigate('trabajadores');
  };

  // View for driver role
  const renderDriverView = () => {
    // Find the index of "Reportar Falla" tab for drivers
    const reporteFallaTabIndex = 2; // Default for drivers based on MantencionPRO.js
    
    return (
      <Box>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <StatCard
              title="Equipos Disponibles"
              value={stats.equiposDisponibles}
              icon={<CheckCircleIcon />}
              color="#52C41A"
            />
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Acciones Rápidas
          </Typography>
          <Button
            variant="contained"
            color="warning"
            fullWidth
            startIcon={<WarningIcon />}
            className="action-button"
            onClick={() => onNavigateToTab(reporteFallaTabIndex)}
            sx={{ py: 1.5, borderRadius: 2 }}
          >
            Reportar Falla
          </Button>
        </Box>
      </Box>
    );
  };

  // View for admin and mechanic roles
  const renderAdminMechanicView = () => {
    // Tab indices for admin/mechanic
    const mantencionTabIndex = 3; // Index for "Mantención" based on MantencionPRO.js
    const inventarioTabIndex = 1; // Index for "Inventario" based on MantencionPRO.js
    
    return (
      <>
        <Grid container spacing={isMobile ? 2 : 3} className="equal-height-cards">
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Equipos Operativos"
              value={stats.equiposOperativos}
              icon={<CarIcon />}
              color="#4CAF50"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Mantenciones Pendientes"
              value={stats.mantencionesPendientes}
              icon={<BuildIcon />}
              color="#FF9800"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Inventario Bajo"
              value={stats.inventarioBajo}
              icon={<InventoryIcon />}
              color="#F44336"
            />
          </Grid>
        </Grid>

        <Box className="actions-container" mt={4} mb={4}>
          <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>
            Acciones Rápidas
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                startIcon={<BuildIcon />}
                className="action-button"
                onClick={() => onNavigateToTab(mantencionTabIndex)}
                sx={{ py: 1.5, borderRadius: 2 }}
              >
                Nueva Mantención
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                variant="contained"
                color="secondary"
                fullWidth
                startIcon={<InventoryIcon />}
                className="action-button"
                onClick={() => onNavigateToTab(inventarioTabIndex)}
                sx={{ py: 1.5, borderRadius: 2 }}
              >
                Gestionar Inventario
              </Button>
            </Grid>
            
            {/* Admin-only button for Workers Management */}
            {userRole === 'admin' && (
              <Grid item xs={12} mt={2}>
                <Button
                  variant="contained"
                  color="info"
                  fullWidth
                  startIcon={<PeopleIcon />}
                  className="action-button"
                  onClick={handleNavigateToTrabajadores}
                  sx={{ py: 1.5, borderRadius: 2 }}
                >
                  Ver Trabajadores
                </Button>
              </Grid>
            )}
          </Grid>
        </Box>
        
        {/* Recent Activities Section */}
        {recentActivities.length > 0 && (
          <Box mt={4}>
            <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>
              Actividades Recientes
            </Typography>
            {recentActivities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </Box>
        )}
      </>
    );
  };

  // Handle sign out
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userData');
      if (onLogout && typeof onLogout === 'function') {
        onLogout();
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert("Error al cerrar sesión");
    }
  };

  return (
    <Box className="home-container">
      {/* App Bar / Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant={isMobile ? 'h6' : 'h5'} className="app-title">
              Panel Principal
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {userData?.nombre || userData?.correo} - {
                userRole === 'admin' ? 'Administrador' : 
                userRole === 'mecanico' ? 'Mecánico' : 
                userRole === 'conductor' ? 'Conductor' : 'Usuario'
              }
            </Typography>
          </Box>
          <IconButton 
            color="primary" 
            onClick={loadDashboardData} 
            disabled={isLoading}
            sx={{ mr: 1 }}
          >
            <RefreshIcon />
          </IconButton>
          <IconButton color="error" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="lg" className="main-content" sx={{ py: 3 }}>
        {/* Error Message */}
        {error && (
          <Box 
            sx={{ 
              p: 2, 
              mb: 3, 
              borderRadius: 1, 
              bgcolor: '#FFF1F0', 
              border: '1px solid #FFA39E' 
            }}
          >
            <Typography color="error">{error}</Typography>
            <Button 
              startIcon={<RefreshIcon />}
              onClick={loadDashboardData}
              variant="outlined"
              color="error"
              size="small"
              sx={{ mt: 1 }}
            >
              Reintentar
            </Button>
          </Box>
        )}
        
        {/* Loading State */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          userRole === 'conductor' ? renderDriverView() : renderAdminMechanicView()
        )}
      </Container>
    </Box>
  );
};

export default Home;