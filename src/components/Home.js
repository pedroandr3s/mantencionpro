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
  useTheme
} from '@mui/material';
import { 
  Build as BuildIcon, 
  DirectionsCar as CarIcon, 
  Inventory as InventoryIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import firebaseApp from '../firebase/credenciales';
import './Home.css';

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

const Home = ({ userRole, userData, onLogout, onNavigateToTab }) => {
  const [activeEquipments, setActiveEquipments] = useState(0);
  const [pendingMaintenance, setPendingMaintenance] = useState(0);
  const [lowInventory, setLowInventory] = useState(0);
  const [disponibilidadCount, setDisponibilidadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Obtener equipos
      const equiposRef = collection(firestore, 'equipos');
      const equiposSnapshot = await getDocs(equiposRef);
      
      // Equipos con estado "Operativo"
      const equiposOperativos = equiposSnapshot.docs.filter(doc => 
        doc.data().estado === 'Operativo'
      ).length;
      
      setActiveEquipments(equiposOperativos);
      
      // Equipos con estadoDisponibilidad "disponible"
      const equiposDisponibilidad = equiposSnapshot.docs.filter(doc => 
        doc.data().estadoDisponibilidad === 'disponible'
      ).length;
      
      setDisponibilidadCount(equiposDisponibilidad);

      // Solo cargar datos adicionales para admin y mecánico
      if (userRole === 'admin' || userRole === 'mecanico') {
        // Obtener mantenciones pendientes
        const mantencionesRef = collection(firestore, 'mantenciones');
        try {
          const mantencionesQuery = query(
            mantencionesRef, 
            where('estado', '==', 'pendiente')
          );
          const mantencionesSnapshot = await getDocs(mantencionesQuery);
          setPendingMaintenance(mantencionesSnapshot.size);
        } catch (error) {
          console.error("Error al cargar mantenciones:", error);
          setPendingMaintenance(0);
        }

        // Obtener inventario bajo
        try {
          const itemsRef = collection(firestore, 'inventario');
          const itemsSnapshot = await getDocs(itemsRef);
          const itemsBajos = itemsSnapshot.docs.filter(doc => {
            const item = doc.data();
            return item.cantidad <= item.minimo;
          }).length;
          setLowInventory(itemsBajos);
        } catch (error) {
          console.error("Error al cargar inventario:", error);
          setLowInventory(0);
        }
      }

    } catch (error) {
      console.error("Error al cargar datos del dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color }) => (
    <Card className="stat-card">
      <CardContent>
        <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} 
             justifyContent="space-between" alignItems="center" className="stat-card-content">
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

  const renderDriverView = () => {
    // Encontrar el índice de la pestaña "Reportar Falla" para conductores
    let reporteFallaTabIndex = 2; // Predeterminado para conductores según MantencionPRO.js
    
    return (
      <Box>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <StatCard
              title="Equipos Disponibles"
              value={disponibilidadCount}
              icon={<CheckCircleIcon />}
              color="#2196F3"
            />
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Acciones Rápidas
          </Typography>
          <Button
            variant="contained"
            color="error"
            fullWidth
            startIcon={<WarningIcon />}
            className="action-button"
            onClick={() => onNavigateToTab(reporteFallaTabIndex)}
          >
            Reportar Falla
          </Button>
        </Box>
      </Box>
    );
  };

  const renderAdminMechanicView = () => {
    // Encontrar los índices de las pestañas para admin/mecánico
    let mantencionTabIndex = 3; // Índice para "Mantención" según MantencionPRO.js
    let inventarioTabIndex = 1; // Índice para "Inventario" según MantencionPRO.js
    
    return (
      <Box>
        <Grid container spacing={isMobile ? 2 : 3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Equipos Disponibles"
              value={activeEquipments}
              icon={<CarIcon />}
              color="#4CAF50"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Mantenciones Pendientes"
              value={pendingMaintenance}
              icon={<BuildIcon />}
              color="#FF9800"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Inventario Bajo"
              value={lowInventory}
              icon={<InventoryIcon />}
              color="#F44336"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Próxima Mantención"
              value="3 días"
              icon={<CheckCircleIcon />}
              color="#2196F3"
            />
          </Grid>
        </Grid>

        <Box className="actions-container">
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
              >
                Gestionar Inventario
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Box>
    );
  };

  return (
    <Box className="home-container">
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant={isMobile ? 'h6' : 'h5'} className="app-title">
              Panel Principal
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {userData?.correo} - {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}
            </Typography>
          </Box>
          <IconButton color="error" onClick={onLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" className="main-content">
        {userRole === 'conductor' ? renderDriverView() : renderAdminMechanicView()}
      </Container>
    </Box>
  );
};

export default Home;