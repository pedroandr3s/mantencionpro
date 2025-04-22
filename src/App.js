import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importar componentes
import MantencionPRO from './MantencionPRO';
import Login from './components/Login';
import LoadingBridge from './components/LoadingBridge';

// Importar Firebase
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseApp from './firebase/credenciales';

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

// Función global para manejar promesas rechazadas no capturadas
const setupUnhandledRejectionHandler = () => {
  window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message && event.reason.message.includes('message channel closed')) {
      console.log('Ignorando error específico de canal de mensajes:', event.reason.message);
      event.preventDefault();
    }
  });
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);

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
      isMounted = false;
      clearTimeout(timer);
      if (authUnsubscribe) {
        authUnsubscribe();
      }
    };
  }, []);

  // Función para manejar el cierre de sesión
  const handleLogout = async () => {
    try {
      console.log("App: Cerrando sesión...");
      // Cerrar sesión en Firebase
      await auth.signOut();
      
      // Eliminar datos del usuario del almacenamiento local
      localStorage.removeItem('userData');
      
      setUserData(null);
      setIsLoggedIn(false);
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
            path="/mantencionpro" 
            element={
              isLoggedIn ? (
                <MantencionPRO 
                  userData={userData} 
                  onLogout={handleLogout} 
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