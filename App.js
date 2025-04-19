import React, { useState, useEffect } from 'react';
import { 
  StyleSheet,
  View, 
  Text, 
  ActivityIndicator, 
  StatusBar,
  SafeAreaView
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Importar pantallas
import MantencionPRO from './MantencionPRO';
import Login from './screens/Login';

// Importar Firebase
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseApp from './firebase/credenciales';

const Stack = createNativeStackNavigator();
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);

  // Comprobar si el usuario está logueado al iniciar la app
  useEffect(() => {
    console.log("App: Verificando estado de autenticación...");
    
    const checkLoginStatus = async () => {
      try {
        // Esperar a que se verifique el estado de autenticación de Firebase
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            console.log("App: Usuario autenticado, obteniendo datos de Firestore...");
            
            // Intentar obtener datos de Firestore primero
            try {
              const docRef = doc(firestore, `usuarios/${user.uid}`);
              const docSnap = await getDoc(docRef);
              
              if (docSnap.exists()) {
                const firestoreData = docSnap.data();
                console.log("App: Datos de Firestore:", firestoreData);
                
                // Crear objeto de usuario con datos de Firestore
                const completeUserData = {
                  uid: user.uid,
                  correo: user.email,
                  rol: firestoreData.rol
                };
                
                // Actualizar AsyncStorage
                await AsyncStorage.setItem('userData', JSON.stringify(completeUserData));
                console.log("App: Datos actualizados en AsyncStorage desde Firestore:", completeUserData);
                
                // Actualizar estado
                setUserData(completeUserData);
                setIsLoggedIn(true);
                setIsLoading(false);
                return;
              } else {
                console.log("App: No se encontró documento del usuario en Firestore");
              }
            } catch (error) {
              console.error("App: Error al obtener datos de Firestore:", error);
            }
            
            // Si no se pudo obtener de Firestore, intentar con AsyncStorage
            console.log("App: Intentando obtener datos de AsyncStorage...");
            const userDataJSON = await AsyncStorage.getItem('userData');
            
            if (userDataJSON) {
              const userInfo = JSON.parse(userDataJSON);
              console.log("App: Datos de AsyncStorage:", userInfo);
              setUserData(userInfo);
              setIsLoggedIn(true);
            } else {
              // Si no hay datos en AsyncStorage, establecer valores por defecto
              console.log("App: No hay datos en AsyncStorage, creando perfil básico");
              const basicUserData = {
                uid: user.uid,
                correo: user.email,
                rol: '' // Rol por defecto
              };
              setUserData(basicUserData);
              setIsLoggedIn(true);
            }
          } else {
            console.log("App: No hay usuario autenticado");
            setIsLoggedIn(false);
            setUserData(null);
          }
          
          setIsLoading(false);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('App: Error al verificar sesión:', error);
        setIsLoading(false);
      }
    };

    // Simular un tiempo de carga breve para mostrar la splash screen
    setTimeout(() => {
      checkLoginStatus();
    }, 500);
  }, []);

  // Función para manejar el cierre de sesión
  const handleLogout = async () => {
    try {
      console.log("App: Cerrando sesión...");
      // Cerrar sesión en Firebase
      await auth.signOut();
      
      // Eliminar datos del usuario del almacenamiento local
      await AsyncStorage.removeItem('userData');
      
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890FF" />
        <Text style={styles.loadingText}>Cargando MantencionPRO...</Text>
      </View>
    );
  }
  
  // Componente de navegación con todas las pantallas
  const Navigation = () => {
    // Referencia para la navegación
    const navigationRef = React.useRef(null);
    
    // Usar useEffect para navegar basado en el estado de autenticación
    useEffect(() => {
      if (navigationRef.current) {
        if (isLoggedIn) {
          navigationRef.current.navigate('MantencionPRO');
        } else {
          navigationRef.current.navigate('Login');
        }
      }
    }, [isLoggedIn]);
    
    return (
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="MantencionPRO">
            {props => (
              <MantencionPRO 
                {...props}
                userData={userData} 
                onLogout={handleLogout} 
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />
      <Navigation />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#1890FF'
  }
});

export default App;