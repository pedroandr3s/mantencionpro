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
import firebaseApp from './firebase/credenciales';

const Stack = createNativeStackNavigator();
const auth = getAuth(firebaseApp);

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);

  // Comprobar si el usuario está logueado al iniciar la app
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        // Esperar a que se verifique el estado de autenticación de Firebase
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            // Obtener datos del usuario almacenados localmente
            const userDataJSON = await AsyncStorage.getItem('userData');
            
            if (userDataJSON) {
              const userInfo = JSON.parse(userDataJSON);
              setUserData(userInfo);
              setIsLoggedIn(true);
            } else {
              // Si no hay datos en AsyncStorage, pero el usuario está autenticado
              // establecer valores por defecto
              setUserData({
                uid: user.uid,
                correo: user.email,
                rol: 'user' // Rol por defecto hasta que se obtenga de Firestore
              });
              setIsLoggedIn(true);
            }
          } else {
            setIsLoggedIn(false);
            setUserData(null);
          }
          
          setIsLoading(false);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Error al verificar sesión:', error);
        setIsLoading(false);
      }
    };

    // Simular un tiempo de carga para mostrar la splash screen
    setTimeout(() => {
      checkLoginStatus();
    }, 1500);
  }, []);

  // Función para manejar el cierre de sesión
  const handleLogout = async () => {
    try {
      // Cerrar sesión en Firebase
      await auth.signOut();
      
      // Eliminar datos del usuario del almacenamiento local
      await AsyncStorage.removeItem('userData');
      
      setUserData(null);
      setIsLoggedIn(false);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />
      
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isLoggedIn ? (
            // Si está logueado, mostrar la app principal
            <Stack.Screen name="MantencionPRO">
              {props => (
                <MantencionPRO 
                  {...props}
                  userData={userData} 
                  onLogout={handleLogout} 
                />
              )}
            </Stack.Screen>
          ) : (
            // Si no está logueado, mostrar la pantalla de login
            <Stack.Screen name="Login" component={Login} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
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