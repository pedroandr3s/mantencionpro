import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tab, Tabs, useMediaQuery, useTheme } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import InventoryIcon from '@mui/icons-material/Inventory';
import BuildIcon from '@mui/icons-material/Build';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';

// Firebase imports
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseApp from './firebase/credenciales';

// Component imports
import InventarioScreen from './components/InventarioScreen';
import EquiposScreen from './components/EquiposScreen';
import MantencionScreen from './components/MantencionScreen';
import DisponibilidadScreen from './components/DisponibilidadScreen';
import ReporteFallasScreen from './components/ReporteFallasScreen';
import Home from './components/Home';

// Initialize Firebase services
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

/**
 * Main navigation component for the MantencionPRO app
 * Handles user role-based navigation and tab management
 */
const MantencionPRO = ({ userData: propUserData, onLogout }) => {
  // State declarations
  const [userRole, setUserRole] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const [error, setError] = useState(null);
  
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const isMountedRef = useRef(true);
  
  // Responsive design hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // User authentication and role management
  useEffect(() => {
    let unsubscribe = () => {};
    let isCancelled = false;
    
    const getUserData = async () => {
      try {
        if (!isMountedRef.current) return;
        
        setIsLoading(true);
        setError(null);
        console.log("MantencionPRO: Fetching user data...");
        
        // Always check Firebase first for most up-to-date data
        const currentUser = auth.currentUser;
        
        if (currentUser) {
          console.log("Verifying Firebase data for:", currentUser.uid);
          try {
            const docRef = doc(firestore, `usuarios/${currentUser.uid}`);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists() && !isCancelled && isMountedRef.current) {
              const firebaseUserData = docSnap.data();
              console.log("Current data from Firebase:", firebaseUserData);
              
              // Ensure role exists
              if (firebaseUserData.rol) {
                const completeUserData = {
                  uid: currentUser.uid,
                  correo: currentUser.email,
                  nombre: firebaseUserData.nombre || currentUser.email,
                  rol: firebaseUserData.rol
                };
                
                // Save to state and localStorage
                setUserRole(firebaseUserData.rol);
                setUserInfo(completeUserData);
                
                // Update localStorage with correct data
                localStorage.setItem('userData', JSON.stringify(completeUserData));
                console.log("Data updated in localStorage from Firebase:", completeUserData);
                if (isMountedRef.current) {
                  setIsLoading(false);
                }
                return;
              }
            }
          } catch (error) {
            console.error("Error verifying Firebase data:", error);
            setError("Error al verificar datos en Firebase");
            // Continue with alternative data sources if Firebase fails
          }
        }
        
        // If Firebase query failed, try with props
        if (propUserData && propUserData.rol && !isCancelled && isMountedRef.current) {
          console.log("Using prop data:", propUserData);
          setUserRole(propUserData.rol);
          setUserInfo(propUserData);
          setIsLoading(false);
          return;
        }
        
        // If no props, try localStorage
        if (!isCancelled && isMountedRef.current) {
          try {
            const storedUserData = localStorage.getItem('userData');
            
            if (storedUserData && !isCancelled && isMountedRef.current) {
              const parsedUserData = JSON.parse(storedUserData);
              console.log("Data from localStorage:", parsedUserData);
              
              if (parsedUserData.rol) {
                setUserRole(parsedUserData.rol);
                setUserInfo(parsedUserData);
                setIsLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error("Error getting data from localStorage:", error);
            setError("Error al recuperar datos guardados");
          }
        }
        
        // If no user information anywhere but authenticated user exists
        if (currentUser && !isCancelled && isMountedRef.current) {
          console.error("Error: No user information found");
          setError("No se encontró información de tu usuario");
          setIsLoading(false);
        } else if (!isCancelled && isMountedRef.current) {
          console.error("Error: No authenticated user");
          navigate('/login');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        if (!isCancelled && isMountedRef.current) {
          setError("Hubo un problema al obtener tu información de usuario");
          setIsLoading(false);
        }
      }
    };

    // Set up auth state listener for better reactivity
    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && isMountedRef.current) {
        // Redirect to login if no authenticated user
        navigate('/login');
      } else {
        getUserData();
      }
    });
    
    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [propUserData, navigate]);

  // Tab change handler
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  // Function to navigate to a specific tab (passed to child components)
  const navigateToTab = (tabIndex) => {
    if (tabIndex >= 0 && tabIndex < tabs.length) {
      setCurrentTab(tabIndex);
    }
  };

  // Define tabs based on user role - memoized to prevent unnecessary recalculations
  const tabs = useMemo(() => {
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
  }, [userRole]);

  // Loading state UI
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

  console.log("Rendering interface for role:", userRole);

  // Get current component based on selected tab
  const CurrentComponent = tabs[currentTab].component;

  return (
    <div style={styles.container}>
      {/* Error message if any */}
      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>{error}</p>
          <button 
            style={styles.reloadButton}
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      )}
      
      {/* Main content area */}
      <div style={styles.content}>
        <CurrentComponent 
          userRole={userRole} 
          userData={userInfo} 
          onLogout={onLogout}
          onNavigateToTab={navigateToTab}
          location={location}
          navigate={navigate}
        />
      </div>
      
      {/* Bottom navigation tabs */}
      <div style={styles.tabContainer}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="fullWidth"
          centered
          sx={{
            '& .MuiTab-root': {
              color: 'gray',
              minWidth: isMobile ? '40px' : '80px',
              padding: isMobile ? '6px 0' : '12px 16px',
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
              label={isMobile ? '' : tab.label}
              iconPosition="top"
              sx={{ 
                textTransform: 'none',
                '& .MuiSvgIcon-root': {
                  fontSize: isMobile ? '1.2rem' : '1.5rem',
                }
              }}
              aria-label={tab.label}
            />
          ))}
        </Tabs>
      </div>
    </div>
  );
};

// Styles object
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
  errorContainer: {
    backgroundColor: '#FFF1F0',
    border: '1px solid #FFA39E',
    padding: '16px',
    margin: '16px',
    borderRadius: '4px',
    textAlign: 'center',
  },
  errorText: {
    color: '#FF4D4F',
    marginBottom: '8px',
  },
  reloadButton: {
    backgroundColor: '#FF4D4F',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  }
};

export default MantencionPRO;