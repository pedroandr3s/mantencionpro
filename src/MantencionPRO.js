import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import TrabajadoresScreen from './components/TrabajadoresScreen';
import Home from './components/Home';

// Import NavigationManager
import NavigationHelper from './NavigationManager';

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
  const [isNavigating, setIsNavigating] = useState(false);
  const [showTabNav, setShowTabNav] = useState(true);
  const [currentScreen, setCurrentScreen] = useState(null);
  
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const isMountedRef = useRef(true);
  
  // Responsive design hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  // Initialize NavigationHelper with a hybrid navigation object
  useEffect(() => {
    // Create a hybrid navigation object that works with both our system and React Router
    const hybridNavigation = {
      navigate: (routeName, params = {}) => {
        if (isNavigating) return false;
        
        try {
          setIsNavigating(true);
          
          // Handle special navigation case for tabs
          if (routeName.toLowerCase() === 'inventario') {
            // Find tab index for Inventario
            const tabIndex = tabs.findIndex(tab => tab.label === 'Inventario');
            if (tabIndex >= 0) {
              setTimeout(() => {
                setCurrentScreen(null);
                setShowTabNav(true);
                setCurrentTab(tabIndex);
                setIsNavigating(false);
              }, 100);
              return true;
            }
          } else if (routeName.toLowerCase() === 'mantencion' || 
                     routeName.toLowerCase() === 'mantencionscreen') {
            // Find tab index for Mantención
            const tabIndex = tabs.findIndex(tab => tab.label === 'Mantención');
            if (tabIndex >= 0) {
              setTimeout(() => {
                setCurrentScreen(null);
                setShowTabNav(true);
                setCurrentTab(tabIndex);
                setIsNavigating(false);
              }, 100);
              return true;
            }
          } else if (routeName.toLowerCase() === 'trabajadores') {
            // Special case for Trabajadores screen (not a tab)
            setTimeout(() => {
              setCurrentScreen('trabajadores');
              setShowTabNav(false);
              setIsNavigating(false);
            }, 100);
            return true;
          } else if (routeName.toLowerCase() === 'mantencionpro') {
            // Navigate back to home tab
            setTimeout(() => {
              setCurrentScreen(null);
              setShowTabNav(true);
              setCurrentTab(0); // Home tab index
              setIsNavigating(false);
            }, 100);
            return true;
          }
          
          // For other routes, use React Router's navigate
          setTimeout(() => {
            navigate(routeName.toLowerCase(), { state: params });
            setIsNavigating(false);
          }, 100);
          
          return true;
        } catch (error) {
          console.error("Navigation error:", error);
          setIsNavigating(false);
          return false;
        }
      },
      goBack: () => {
        if (isNavigating) return false;
        
        try {
          setIsNavigating(true);
          
          // If we're in a special screen, go back to the tabs
          if (currentScreen) {
            setTimeout(() => {
              setCurrentScreen(null);
              setShowTabNav(true);
              setCurrentTab(0); // Default to Home tab
              setIsNavigating(false);
            }, 100);
            return true;
          }
          
          // Otherwise use standard navigation
          setTimeout(() => {
            navigate(-1);
            setIsNavigating(false);
          }, 100);
          
          return true;
        } catch (error) {
          console.error("Navigation back error:", error);
          setIsNavigating(false);
          return false;
        }
      }
    };
    
    NavigationHelper.initialize(hybridNavigation);
  }, [navigate, isNavigating, currentScreen, tabs]);

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

  // Tab change handler - with protection against rapid tab switching
  const handleTabChange = (event, newValue) => {
    if (isNavigating) return; // Prevent tab change during navigation
    
    setIsNavigating(true);
    
    // Add a small delay to ensure proper cleanup
    setTimeout(() => {
      setCurrentTab(newValue);
      setIsNavigating(false);
    }, 100);
  };

  // Safe function to navigate to a specific tab (passed to child components)
  const navigateToTab = (tabIndex) => {
    if (isNavigating) return;
    
    if (tabIndex >= 0 && tabIndex < tabs.length) {
      setIsNavigating(true);
      
      setTimeout(() => {
        setCurrentScreen(null);
        setShowTabNav(true);
        setCurrentTab(tabIndex);
        setIsNavigating(false);
      }, 100);
    }
  };

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

  // Prepare route parameters from location
  const extractRouteParams = () => {
    const params = {};
    
    // Get params from location search
    if (location.search) {
      const searchParams = new URLSearchParams(location.search);
      for (const [key, value] of searchParams.entries()) {
        try {
          params[key] = JSON.parse(value);
        } catch (e) {
          params[key] = value;
        }
      }
    }
    
    // Get params from location state
    if (location.state) {
      Object.assign(params, location.state);
    }
    
    return { params };
  };

  // Create navigation object to pass to components
  const navigationObject = {
    navigate: (routeName, params) => NavigationHelper.navigate(routeName, params),
    goBack: () => NavigationHelper.goBack()
  };

  // Create route object to pass to components
  const routeObject = extractRouteParams();

  // Get current component based on selected tab
  const CurrentComponent = tabs[currentTab].component;

  // Navigation in progress overlay
  const NavigationOverlay = () => (
    isNavigating && (
      <div style={styles.navigationOverlay}>
        <div className="spinner-border text-primary" style={styles.navigationSpinner} role="status">
          <span className="visually-hidden">Navegando...</span>
        </div>
      </div>
    )
  );

  // Render special screens or tab-based content
  const renderContent = () => {
    if (currentScreen === 'trabajadores') {
      return (
        <TrabajadoresScreen 
          userRole={userRole}
          userData={userInfo}
          navigation={navigationObject}
          route={routeObject}
        />
      );
    } else {
      return (
        <CurrentComponent 
          userRole={userRole} 
          userData={userInfo} 
          onLogout={onLogout}
          onNavigateToTab={navigateToTab}
          location={location}
          navigate={navigate}
          navigation={navigationObject}
          route={routeObject}
          isNavigating={isNavigating}
        />
      );
    }
  };

  return (
    <div style={styles.container}>
      {/* Navigation overlay */}
      <NavigationOverlay />
      
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
        {renderContent()}
      </div>
      
      {/* Bottom navigation tabs - only show if not in a special screen */}
      {showTabNav && (
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
                disabled={isNavigating} // Disable tabs during navigation
              />
            ))}
          </Tabs>
        </div>
      )}
      
      {/* Add global styles for navigation animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
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
    overflowY: 'auto',
    position: 'relative'
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
  },
  navigationOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  navigationSpinner: {
    width: '3rem',
    height: '3rem',
  }
};

export default MantencionPRO;