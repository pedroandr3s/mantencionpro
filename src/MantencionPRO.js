import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tab, Tabs, useMediaQuery, useTheme } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import InventoryIcon from '@mui/icons-material/Inventory';
import BuildIcon from '@mui/icons-material/Build';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';

// Importar Firebase
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseApp from './firebase/credenciales';

// Importaciones de los componentes que necesitaremos
import InventarioScreen from './components/InventarioScreen';
import EquiposScreen from './components/EquiposScreen';
import MantencionScreen from './components/MantencionScreen';
import DisponibilidadScreen from './components/DisponibilidadScreen';
import ReporteFallasScreen from './components/ReporteFallasScreen';
import Home from './components/Home';

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

// Este componente manejará la navegación según el rol del usuario
const MantencionPRO = ({ userData, onLogout }) => {
  const [userRole, setUserRole] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const isMountedRef = useRef(true);
  
  // Usar theme y media query para detectar tamaño de pantalla
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Control de montaje del componente
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Obtener el rol del usuario siempre verificando en Firebase primero
  useEffect(() => {
    let isCancelled = false;
    
    const getUserData = async () => {
      try {
        if (!isMountedRef.current) return;
        
        setIsLoading(true);
        console.log("MantencionPRO: Obteniendo datos del usuario...");
        
        // SIEMPRE verificar en Firebase primero para tener los datos más actuales
        const currentUser = auth.currentUser;
        
        if (currentUser) {
          console.log("Verificando datos en Firebase para:", currentUser.uid);
          try {
            const docRef = doc(firestore, `usuarios/${currentUser.uid}`);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists() && !isCancelled && isMountedRef.current) {
              const firebaseUserData = docSnap.data();
              console.log("Datos actuales obtenidos de Firebase:", firebaseUserData);
              
              // Asegurarse de que el rol existe
              if (firebaseUserData.rol) {
                const completeUserData = {
                  uid: currentUser.uid,
                  correo: currentUser.email,
                  rol: firebaseUserData.rol
                };
                
                // Guardar en el estado y en localStorage
                setUserRole(firebaseUserData.rol);
                setUserInfo(completeUserData);
                
                // Actualizar localStorage con los datos correctos
                localStorage.setItem('userData', JSON.stringify(completeUserData));
                console.log("Datos actualizados en localStorage desde Firebase:", completeUserData);
                if (isMountedRef.current) {
                  setIsLoading(false);
                }
                return;
              }
            }
          } catch (error) {
            console.error("Error al verificar en Firebase:", error);
            // Continuamos con los datos alternativos si hay error
          }
        }
        
        // Si no se pudo obtener de Firebase, intentamos con los props
        if (userData && userData.rol && !isCancelled && isMountedRef.current) {
          console.log("Usando datos pasados como prop:", userData);
          setUserRole(userData.rol);
          setUserInfo(userData);
          setIsLoading(false);
          return;
        }
        
        // Si no hay props, intentar obtener de localStorage
        if (!isCancelled && isMountedRef.current) {
          try {
            const storedUserData = localStorage.getItem('userData');
            
            if (storedUserData && !isCancelled && isMountedRef.current) {
              const parsedUserData = JSON.parse(storedUserData);
              console.log("Datos obtenidos de localStorage:", parsedUserData);
              
              if (parsedUserData.rol) {
                setUserRole(parsedUserData.rol);
                setUserInfo(parsedUserData);
                setIsLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error("Error al obtener datos de localStorage:", error);
          }
        }
        
        // Si no hay información de usuario en ningún lado pero hay usuario autenticado
        if (currentUser && !isCancelled && isMountedRef.current) {
          console.error("Error: No se encontró información del usuario");
          alert("No se encontró información de tu usuario");
          setIsLoading(false);
        } else if (!isCancelled && isMountedRef.current) {
          console.error("Error: No hay usuario autenticado");
          navigate('/login');
        }
      } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
        if (!isCancelled && isMountedRef.current) {
          alert("Hubo un problema al obtener tu información de usuario");
          setIsLoading(false);
        }
      }
    };

    getUserData();
    
    return () => {
      isCancelled = true;
    };
  }, [userData, navigate]);

  // Función para manejar el cambio de tabs
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  // Función para navegar a una pestaña específica (se pasará como prop a los componentes hijos)
  const navigateToTab = (tabIndex) => {
    setCurrentTab(tabIndex);
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p style={styles.loadingText}>Cargando...</p>
      </div>
    );
  }

  console.log("Renderizando interfaz para rol:", userRole);

  // Definir tabs según el rol del usuario
  const getTabs = () => {
    switch (userRole) {
      case 'admin':
      case 'mecanico':
        return [
          { label: 'Home', icon: <HomeIcon />, component: Home },
          { label: 'Inventario', icon: <InventoryIcon />, component: InventarioScreen },
          { label: 'Equipos', icon: <DirectionsCarIcon />, component: EquiposScreen },
          { label: 'Mantención', icon: <BuildIcon />, component: MantencionScreen },
          { label: 'Disponibilidad', icon: <CheckCircleIcon />, component: DisponibilidadScreen },
          { label: 'Reportes', icon: <WarningIcon />, component: ReporteFallasScreen }
        ];
      case 'conductor':
        return [
          { label: 'Home', icon: <HomeIcon />, component: Home },
          { label: 'Disponibilidad', icon: <CheckCircleIcon />, component: DisponibilidadScreen },
          { label: 'Reportar Falla', icon: <WarningIcon />, component: ReporteFallasScreen }
        ];
      default:
        return [
          { label: 'Home', icon: <HomeIcon />, component: Home },
          { label: 'Disponibilidad', icon: <CheckCircleIcon />, component: DisponibilidadScreen }
        ];
    }
  };

  const tabs = getTabs();
  const CurrentComponent = tabs[currentTab].component;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <CurrentComponent 
          userRole={userRole} 
          userData={userInfo} 
          onLogout={onLogout}
          onNavigateToTab={navigateToTab}
        />
      </div>
      <div style={styles.tabContainer}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="fullWidth"
          centered
          sx={{
            '& .MuiTab-root': {
              color: 'gray',
              minWidth: isMobile ? '40px' : '80px', // Reducir el ancho mínimo en móvil
              padding: isMobile ? '6px 0' : '12px 16px', // Reducir el padding en móvil
              '&.Mui-selected': {
                color: '#1890FF',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#1890FF',
            },
          }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              icon={tab.icon}
              label={isMobile ? '' : tab.label} // No mostrar etiqueta en móvil
              iconPosition="top"
              sx={{ 
                textTransform: 'none',
                '& .MuiSvgIcon-root': {
                  fontSize: isMobile ? '1.2rem' : '1.5rem', // Iconos más pequeños en móvil
                }
              }}
              aria-label={tab.label} // Mantener accesibilidad
            />
          ))}
        </Tabs>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#FFFFFF'
  },
  content: {
    flex: 1,
    overflowY: 'auto'
  },
  tabContainer: {
    borderTop: '1px solid #e0e0e0',
    backgroundColor: '#FFFFFF'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: '10px',
    fontSize: '16px',
    color: '#1890FF',
  },
};

export default MantencionPRO;