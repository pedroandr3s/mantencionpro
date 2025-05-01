import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importar componentes
import MantencionPRO from './MantencionPRO';
import Login from './components/Login';
import LoadingBridge from './components/LoadingBridge';

// Importar Firebase
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import firebaseApp from './firebase/credenciales';

// Importar NavigationProvider
import { NavigationProvider } from './NavigationManager';

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

// Función global para manejar promesas rechazadas no capturadas
const setupUnhandledRejectionHandler = () => {
  window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message) {
      // Ignorar errores específicos relacionados con la navegación y DOM
      if (event.reason.message.includes('message channel closed') || 
          event.reason.message.includes('removeChild') ||
          event.reason.message.includes('Node') ||
          event.reason.message.includes('child of this node')) {
        console.log('Ignorando error específico:', event.reason.message);
        event.preventDefault();
      }
    }
  });
};

// Función para crear navegación compatible con nuestro NavigationManager
const createNavigationCompatibilityLayer = () => {
  return {
    navigate: (routeName, params = {}) => {
      let url = '/' + routeName.toLowerCase();
      
      // Añadir parámetros como query string
      if (Object.keys(params).length > 0) {
        url += '?' + new URLSearchParams(params).toString();
      }
      
      // Usar window.location para navegar
      window.location.href = url;
      return true;
    },
    goBack: () => {
      window.history.back();
      return true;
    }
  };
};

// Función para extraer parámetros de la URL
const extractUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const params = {};
  
  for (const [key, value] of urlParams.entries()) {
    try {
      // Intentar analizar valores JSON si es posible
      params[key] = JSON.parse(value);
    } catch (e) {
      // Si no es JSON, usar el valor como está
      params[key] = value;
    }
  }
  
  return { params };
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [navigationObject] = useState(createNavigationCompatibilityLayer());
  const [routeObject] = useState(extractUrlParams());
  const [forcedLogoutListener, setForcedLogoutListener] = useState(null);

  // Configurar el manejador de errores global
  useEffect(() => {
    setupUnhandledRejectionHandler();
  }, []);

  // Comprobar si el usuario está logueado al iniciar la app
  useEffect(() => {
    console.log("App: Verificando estado de autenticación...");
    
    let isMounted = true;
    let authUnsubscribe = null;
    
    const checkLoginStatus = async () => {
      try {
        // Esperar a que se verifique el estado de autenticación de Firebase
        authUnsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!isMounted) return;
          
          if (user) {
            console.log("App: Usuario autenticado, obteniendo datos de Firestore...");
            
            // Configurar listener para cierre forzado de sesión
            setupForcedLogoutListener(user.uid);
            
            // Intentar obtener datos de Firestore primero
            try {
              const docRef = doc(firestore, `usuarios/${user.uid}`);
              const docSnap = await getDoc(docRef);
              
              if (docSnap.exists() && isMounted) {
                const firestoreData = docSnap.data();
                console.log("App: Datos de Firestore:", firestoreData);
                
                // Crear objeto de usuario con datos de Firestore
                const completeUserData = {
                  uid: user.uid,
                  correo: user.email,
                  rol: firestoreData.rol
                };
                
                // Actualizar localStorage
                localStorage.setItem('userData', JSON.stringify(completeUserData));
                console.log("App: Datos actualizados en localStorage desde Firestore:", completeUserData);
                
                // Actualizar estado
                if (isMounted) {
                  setUserData(completeUserData);
                  setIsLoggedIn(true);
                  setIsLoading(false);
                }
                return;
              } else if (!isMounted) {
                return;
              } else {
                console.log("App: No se encontró documento del usuario en Firestore");
              }
            } catch (error) {
              console.error("App: Error al obtener datos de Firestore:", error);
            }
            
            // Si no se pudo obtener de Firestore, intentar con localStorage
            if (!isMounted) return;
            
            console.log("App: Intentando obtener datos de localStorage...");
            const userDataJSON = localStorage.getItem('userData');
            
            if (userDataJSON && isMounted) {
              const userInfo = JSON.parse(userDataJSON);
              console.log("App: Datos de localStorage:", userInfo);
              setUserData(userInfo);
              setIsLoggedIn(true);
            } else if (isMounted) {
              // Si no hay datos en localStorage, establecer valores por defecto
              console.log("App: No hay datos en localStorage, creando perfil básico");
              const basicUserData = {
                uid: user.uid,
                correo: user.email,
                rol: '' // Rol por defecto
              };
              setUserData(basicUserData);
              setIsLoggedIn(true);
            }
          } else if (isMounted) {
            console.log("App: No hay usuario autenticado");
            setIsLoggedIn(false);
            setUserData(null);
            // Eliminar listener de cierre forzado si existe
            if (forcedLogoutListener) {
              forcedLogoutListener();
              setForcedLogoutListener(null);
            }
          }
          
          if (isMounted) {
            setIsLoading(false);
          }
        });
      } catch (error) {
        console.error('App: Error al verificar sesión:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Simular un tiempo de carga breve para mostrar la splash screen
    const timer = setTimeout(() => {
      if (isMounted) {
        checkLoginStatus();
      }
    }, 500);
    
    return () => {
      isMounted = true;
      clearTimeout(timer);
      if (authUnsubscribe) {
        authUnsubscribe();
      }
      // Limpiar listener de cierre forzado
      if (forcedLogoutListener) {
        forcedLogoutListener();
      }
    };
  }, []);

  // Configurar listener para cierre forzado de sesión
  const setupForcedLogoutListener = (uid) => {
    // Limpiar listener anterior si existe
    if (forcedLogoutListener) {
      forcedLogoutListener();
    }

    // Crear listener para documento de cierre forzado
    const unsubscribe = onSnapshot(
      doc(firestore, 'forcedLogouts', uid),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const currentTime = new Date().getTime();
          
          // Si el documento de cierre forzado fue creado recientemente (en los últimos 5 minutos)
          if (data.timestamp && (currentTime - data.timestamp < 5 * 60 * 1000)) {
            console.log("App: Cierre forzado de sesión detectado:", data.reason);
            handleLogout(true);
          }
        }
      },
      (error) => {
        console.error("App: Error en listener de cierre forzado:", error);
      }
    );

    setForcedLogoutListener(() => unsubscribe);
  };

  // Función para manejar el cierre de sesión
  const handleLogout = async (isForcedLogout = false) => {
    try {
      console.log("App: Cerrando sesión...");
      // Cerrar sesión en Firebase
      await signOut(auth);
      
      // Eliminar datos del usuario del almacenamiento local
      localStorage.removeItem('userData');
      
      setUserData(null);
      setIsLoggedIn(false);
      
      // Mostrar mensaje si fue cierre forzado
      if (isForcedLogout) {
        alert("Tu sesión ha sido cerrada por un administrador");
        // Redirigir a login
        window.location.href = '/login';
      }
      
      console.log("App: Sesión cerrada con éxito");
    } catch (error) {
      console.error('App: Error al cerrar sesión:', error);
    }
  };

  // Mientras está cargando, mostrar un indicador
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p style={styles.loadingText}>Cargando MantencionPRO...</p>
      </div>
    );
  }

  return (
    <NavigationProvider>
      <Router>
        <div style={styles.container}>
          <Routes>
            <Route 
              path="/login" 
              element={isLoggedIn ? <Navigate to="/mantencionpro" /> : <Login />} 
            />
            <Route 
              path="/loading" 
              element={<LoadingBridge />} 
            />
            <Route 
              path="/mantencionpro/*" 
              element={
                isLoggedIn ? (
                  <MantencionPRO 
                    userData={userData} 
                    onLogout={handleLogout}
                    navigation={navigationObject}
                    route={routeObject}
                  />
                ) : (
                  <Navigate to="/login" />
                )
              } 
            />
            <Route 
              path="/" 
              element={<Navigate to={isLoggedIn ? "/mantencionpro" : "/login"} />} 
            />
          </Routes>
        </div>
      </Router>
      
      {/* Estilos globales para la capa de transición y animaciones */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .navigation-transition {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255, 255, 255, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }
        
        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 5px solid #f3f3f3;
          border-top: 5px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
      `}</style>
    </NavigationProvider>
  );
};

const styles = {
  container: {
    height: '100vh',
    width: '100vw',
    backgroundColor: '#FFFFFF'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#FFFFFF'
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '16px',
    color: '#1890FF'
  }
};

export default App;