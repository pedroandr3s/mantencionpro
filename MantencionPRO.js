import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  SafeAreaView,
  Alert
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Importar Firebase
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseApp from './firebase/credenciales';

// Importaciones de los componentes que necesitaremos
import InventarioScreen from './screens/InventarioScreen';
import EquiposScreen from './screens/EquiposScreen';
import MantencionScreen from './screens/MantencionScreen';
import DisponibilidadScreen from './screens/DisponibilidadScreen';
import ReporteFallasScreen from './screens/ReporteFallasScreen';
import Home from './screens/Home';

const Tab = createBottomTabNavigator();
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

// Este componente manejará la navegación según el rol del usuario
const MantencionPRO = ({ navigation, route, userData, onLogout }) => {
  const [userRole, setUserRole] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Obtener el rol del usuario desde props, AsyncStorage o Firebase
  useEffect(() => {
    const getUserData = async () => {
      try {
        setIsLoading(true);
        console.log("MantencionPRO: Obteniendo datos del usuario...");
        
        // Primero, intentar usar los datos pasados como prop
        if (userData && userData.rol) {
          console.log("Usando datos pasados como prop:", userData);
          setUserRole(userData.rol);
          setUserInfo(userData);
          setIsLoading(false);
          return;
        }
        
        // Si no hay props, intentar obtener de AsyncStorage
        const storedUserData = await AsyncStorage.getItem('userData');
        
        if (storedUserData) {
          const parsedUserData = JSON.parse(storedUserData);
          console.log("Datos obtenidos de AsyncStorage:", parsedUserData);
          
          if (parsedUserData.rol) {
            setUserRole(parsedUserData.rol);
            setUserInfo(parsedUserData);
            setIsLoading(false);
            return;
          }
        }
        
        // Si no está en AsyncStorage o no tiene rol, intentar obtener directamente de Firebase
        const currentUser = auth.currentUser;
        
        if (currentUser) {
          console.log("Obteniendo datos de Firebase para:", currentUser.uid);
          const docRef = doc(firestore, `usuarios/${currentUser.uid}`);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const firebaseUserData = docSnap.data();
            console.log("Datos obtenidos de Firebase:", firebaseUserData);
            
            // Asegurarse de que el rol existe
            if (firebaseUserData.rol) {
              const completeUserData = {
                uid: currentUser.uid,
                correo: currentUser.email,
                rol: firebaseUserData.rol
              };
              
              // Guardar en el estado y en AsyncStorage
              setUserRole(firebaseUserData.rol);
              setUserInfo(completeUserData);
              
              // Actualizar AsyncStorage con los datos correctos
              await AsyncStorage.setItem('userData', JSON.stringify(completeUserData));
              console.log("Datos actualizados en AsyncStorage:", completeUserData);
            } else {
              console.error("Error: Documento de usuario sin rol en Firebase");
              Alert.alert("Error", "No se pudo determinar tu rol de usuario");
              
              // Asignar un rol por defecto
              setUserRole('user');
            }
          } else {
            console.error("Error: No se encontró el documento del usuario en Firebase");
            Alert.alert("Error", "No se encontró información de tu usuario");
            
            // Asignar un rol por defecto
            setUserRole('user');
          }
        } else {
          console.error("Error: No hay usuario autenticado");
          
          // Si no hay usuario, redirigir a login
          if (onLogout) {
            onLogout();
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        }
      } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
        Alert.alert("Error", "Hubo un problema al obtener tu información de usuario");
        
        // Asignar un rol por defecto
        setUserRole('user');
      } finally {
        setIsLoading(false);
      }
    };

    getUserData();
  }, [userData, navigation, onLogout]);

  // Función para cerrar sesión
  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      try {
        await auth.signOut();
        await AsyncStorage.removeItem('userData');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        Alert.alert('Error', 'No se pudo cerrar sesión');
      }
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890FF" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  console.log("Renderizando interfaz para rol:", userRole);

  // Navegación para administradores (acceso completo)
  const AdminTabs = () => {
    return (
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Inventario') {
              iconName = focused ? 'cube' : 'cube-outline';
            } else if (route.name === 'Equipos') {
              iconName = focused ? 'car' : 'car-outline';
            } else if (route.name === 'Mantención') {
              iconName = focused ? 'construct' : 'construct-outline';
            } else if (route.name === 'Disponibilidad') {
              iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
            } else if (route.name === 'Reportes') {
              iconName = focused ? 'warning' : 'warning-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#1890FF',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={Home} 
          initialParams={{ userRole, userData: userInfo, onLogout: handleLogout }} 
        />
        <Tab.Screen name="Inventario" component={InventarioScreen} />
        <Tab.Screen name="Equipos" component={EquiposScreen} />
        <Tab.Screen name="Mantención" component={MantencionScreen} />
        <Tab.Screen name="Disponibilidad" component={DisponibilidadScreen} />
        <Tab.Screen 
          name="Reportes" 
          component={ReporteFallasScreen} 
          initialParams={{ userRole, userData: userInfo }}
          options={{ title: 'Fallas Reportadas' }} 
        />
      </Tab.Navigator>
    );
  };

  // Navegación para mecánicos (acceso completo, igual que admin por ahora)
  const MecanicoTabs = () => {
    return (
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Inventario') {
              iconName = focused ? 'cube' : 'cube-outline';
            } else if (route.name === 'Equipos') {
              iconName = focused ? 'car' : 'car-outline';
            } else if (route.name === 'Mantención') {
              iconName = focused ? 'construct' : 'construct-outline';
            } else if (route.name === 'Disponibilidad') {
              iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
            } else if (route.name === 'Reportes') {
              iconName = focused ? 'warning' : 'warning-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#1890FF',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={Home} 
          initialParams={{ userRole, userData: userInfo, onLogout: handleLogout }} 
        />
        <Tab.Screen name="Inventario" component={InventarioScreen} />
        <Tab.Screen name="Equipos" component={EquiposScreen} />
        <Tab.Screen name="Mantención" component={MantencionScreen} />
        <Tab.Screen name="Disponibilidad" component={DisponibilidadScreen} />
        <Tab.Screen 
          name="Reportes" 
          component={ReporteFallasScreen}
          initialParams={{ userRole, userData: userInfo }}
          options={{ title: 'Fallas Reportadas' }} 
        />
      </Tab.Navigator>
    );
  };

  // Navegación para conductores (acceso limitado a Home, Disponibilidad y Reportar Fallas)
  const ConductorTabs = () => {
    return (
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'ReportarFalla') {
              iconName = focused ? 'warning' : 'warning-outline';
            } else if (route.name === 'Disponibilidad') {
              iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#1890FF',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={Home} 
          initialParams={{ userRole, userData: userInfo, onLogout: handleLogout }} 
        />
        <Tab.Screen 
          name="Disponibilidad" 
          component={DisponibilidadScreen}
        />
        <Tab.Screen 
          name="ReportarFalla" 
          component={ReporteFallasScreen}
          initialParams={{ userRole, userData: userInfo }}
          options={{ title: 'Reportar Falla' }} 
        />
      </Tab.Navigator>
    );
  };

  // Navegación para usuarios regulares (acceso muy limitado)
  const UserTabs = () => {
    return (
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Disponibilidad') {
              iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#1890FF',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={Home} 
          initialParams={{ userRole, userData: userInfo, onLogout: handleLogout }} 
        />
        <Tab.Screen 
          name="Disponibilidad" 
          component={DisponibilidadScreen}
        />
      </Tab.Navigator>
    );
  };

  // Renderizar la interfaz según el rol del usuario
  return (
    <SafeAreaView style={{ flex: 1 }}>
      {userRole === 'admin' ? (
        <AdminTabs />
      ) : userRole === 'mecanico' ? (
        <MecanicoTabs />
      ) : userRole === 'conductor' ? (
        <ConductorTabs />
      ) : (
        <UserTabs />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#1890FF',
  },
});

export default MantencionPRO;