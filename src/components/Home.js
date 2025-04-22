import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Grid, 
  Card, 
  CardContent, 
  Typography,
  Box
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

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

const Home = ({ userRole, userData, onLogout }) => {
  const [activeEquipments, setActiveEquipments] = useState(0);
  const [pendingMaintenance, setPendingMaintenance] = useState(0);
  const [lowInventory, setLowInventory] = useState(0);
  const [operationalPercentage, setOperationalPercentage] = useState(100);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Obtener equipos activos/inactivos
      const equiposRef = collection(firestore, 'equipos');
      const equiposSnapshot = await getDocs(equiposRef);
      const totalEquipos = equiposSnapshot.size;
      const equiposActivos = equiposSnapshot.docs.filter(doc => 
        doc.data().estado === 'operativo'
      ).length;
      setActiveEquipments(equiposActivos);
      
      // Calcular porcentaje de disponibilidad
      if (totalEquipos > 0) {
        setOperationalPercentage(Math.round((equiposActivos / totalEquipos) * 100));
      }

      // Obtener mantenciones pendientes
      const hoy = new Date();
      const mantencionesRef = collection(firestore, 'mantenciones');
      const mantencionesQuery = query(
        mantencionesRef, 
        where('estado', '==', 'pendiente')
      );
      const mantencionesSnapshot = await getDocs(mantencionesQuery);
      setPendingMaintenance(mantencionesSnapshot.size);

      // Obtener inventario bajo
      const itemsRef = collection(firestore, 'inventario');
      const itemsSnapshot = await getDocs(itemsRef);
      const itemsBajos = itemsSnapshot.docs.filter(doc => {
        const item = doc.data();
        return item.cantidad <= item.minimo;
      }).length;
      setLowInventory(itemsBajos);

    } catch (error) {
      console.error("Error al cargar datos del dashboard:", error);
    }
    setIsLoading(false);
  };

  const StatCard = ({ title, value, icon, color }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" color="textSecondary">
              {title}
            </Typography>
            <Typography variant="h4" color={color || 'primary'}>
              {value}
            </Typography>
          </Box>
          <Box sx={{ color: color || 'primary' }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Typography variant="h4" style={styles.title}>
          Panel Principal
        </Typography>
        <Typography variant="subtitle1" style={styles.subtitle}>
          Bienvenido, {userData?.correo}
        </Typography>
        <Typography variant="body2" style={styles.role}>
          Rol: {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)}
        </Typography>
      </div>

      <Grid container spacing={3} style={styles.statsContainer}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Equipos Activos"
            value={activeEquipments}
            icon={<CarIcon style={{ fontSize: 40 }} />}
            color="#4CAF50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Mantenciones Pendientes"
            value={pendingMaintenance}
            icon={<BuildIcon style={{ fontSize: 40 }} />}
            color="#FF9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Inventario Bajo"
            value={lowInventory}
            icon={<InventoryIcon style={{ fontSize: 40 }} />}
            color="#F44336"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Disponibilidad"
            value={`${operationalPercentage}%`}
            icon={<CheckCircleIcon style={{ fontSize: 40 }} />}
            color="#2196F3"
          />
        </Grid>
      </Grid>

      <Box style={styles.actionsContainer}>
        <Typography variant="h5" gutterBottom>
          Acciones Rápidas
        </Typography>
        <Grid container spacing={2}>
          {userRole === 'conductor' && (
            <Grid item xs={12} sm={6}>
              <Button
                variant="contained"
                color="error"
                fullWidth
                startIcon={<WarningIcon />}
                sx={{ height: '60px' }}
              >
                Reportar Falla
              </Button>
            </Grid>
          )}
          {(userRole === 'admin' || userRole === 'mecanico') && (
            <>
              <Grid item xs={12} sm={6}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  startIcon={<BuildIcon />}
                  sx={{ height: '60px' }}
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
                  sx={{ height: '60px' }}
                >
                  Gestionar Inventario
                </Button>
              </Grid>
            </>
          )}
        </Grid>
      </Box>

      <Button
        variant="outlined"
        startIcon={<LogoutIcon />}
        onClick={onLogout}
        sx={{ 
          position: 'absolute',
          bottom: 20,
          right: 20,
          color: '#F44336',
          borderColor: '#F44336',
          '&:hover': {
            borderColor: '#D32F2F',
            backgroundColor: 'rgba(244, 67, 54, 0.04)'
          }
        }}
      >
        Cerrar Sesión
      </Button>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    height: '100%',
    minHeight: '100vh',
    position: 'relative',
    backgroundColor: '#f5f5f5'
  },
  header: {
    marginBottom: '32px'
  },
  title: {
    fontWeight: 600,
    color: '#1890FF'
  },
  subtitle: {
    color: '#666',
    marginTop: '8px'
  },
  role: {
    color: '#999',
    marginTop: '4px'
  },
  statsContainer: {
    marginBottom: '32px'
  },
  actionsContainer: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '80px' // Para que el botón de logout no se superponga
  }
};

export default Home;