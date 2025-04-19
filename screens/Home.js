import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase imports
import firebaseApp from "../firebase/credenciales";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Función auxiliar para convertir timestamps de Firebase a string
const formatFirebaseTimestamp = (timestamp) => {
  if (!timestamp) return '';
  
  // Si es un objeto Firebase Timestamp
  if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
    return timestamp.toDate().toISOString().split('T')[0];
  }
  
  // Si ya es string
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  
  // Si es date
  if (timestamp instanceof Date) {
    return timestamp.toISOString().split('T')[0];
  }
  
  return '';
};

const Home = ({ navigation, route }) => {
  const [userRole, setUserRole] = useState(route.params?.userRole || null);
  const [userData, setUserData] = useState(route.params?.userData || null);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  
  // Referencias para limpieza
  const unsubscribeRef = useRef(null);
  const isMountedRef = useRef(true);
  
  const onLogout = route.params?.onLogout;

  // Control de montaje del componente
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Obtener información del usuario
  useEffect(() => {
    const getUserInfo = async () => {
      try {
        // Intentar obtener el rol del usuario desde los parámetros de la ruta
        if (userData) {
          if (userData.correo) {
            // Extract username from email (remove @domain.com)
            const emailName = userData.correo.split('@')[0];
            setUserName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
          } else if (userData.email) {
            const emailName = userData.email.split('@')[0];
            setUserName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
          } else if (userData.nombre) {
            setUserName(userData.nombre);
          }
          
          setUserRole(userData.rol || userRole);
          setUserId(userData.uid || userData.id || '');
        } else if (userRole) {
          // Fallback to role-based name if no email
          if (userRole === 'admin') {
            setUserName('Administrador');
          } else if (userRole === 'mecanico') {
            setUserName('Mecánico');
          } else if (userRole === 'conductor') {
            setUserName('Conductor');
          } else {
            setUserName('Usuario');
          }
        } else {
          // Si no está en los parámetros, intentar obtenerlo de AsyncStorage
          try {
            const userDataString = await AsyncStorage.getItem('userData');
            if (userDataString) {
              const userDataObj = JSON.parse(userDataString);
              setUserRole(userDataObj.rol || 'conductor');
              setUserName(userDataObj.nombre || userDataObj.email || 'Usuario');
              setUserId(userDataObj.uid || userDataObj.id || '');
              setUserData(userDataObj);
            } else {
              // Intentar obtener del usuario autenticado
              const currentUser = auth.currentUser;
              if (currentUser) {
                // Intentar obtener el perfil completo desde Firestore
                try {
                  const userDoc = await getDoc(doc(firestore, 'usuarios', currentUser.uid));
                  if (userDoc.exists()) {
                    const userDataObj = userDoc.data();
                    setUserRole(userDataObj.rol || 'conductor');
                    setUserName(userDataObj.nombre || userDataObj.email || currentUser.email || 'Usuario');
                    setUserId(currentUser.uid);
                    setUserData({...userDataObj, uid: currentUser.uid});
                  } else {
                    setUserRole('conductor'); // Rol por defecto
                    setUserName(currentUser.email || 'Usuario');
                    setUserId(currentUser.uid);
                  }
                } catch (err) {
                  console.error('Error al obtener datos de usuario de Firestore:', err);
                  setUserRole('conductor');
                  setUserName(currentUser.email || 'Usuario');
                  setUserId(currentUser.uid);
                }
              } else {
                setUserRole('conductor'); // Rol por defecto
                setUserName('Usuario');
              }
            }
          } catch (parseError) {
            console.error('Error al analizar datos de usuario de AsyncStorage:', parseError);
            setUserRole('conductor');
            setUserName('Usuario');
          }
        }
      } catch (err) {
        console.error('Error al obtener información del usuario:', err);
        setUserRole('conductor'); // Rol por defecto en caso de error
        setUserName('Usuario');
      }
    };

    getUserInfo();
  }, [userData, userRole]);
  
  // Fetch real-time data from Firebase based on role
  useEffect(() => {
    // Solo realizar la consulta si tenemos el rol del usuario
    if (userRole) {
      fetchDashboardData();
    }
  }, [userRole, userId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Datos comunes para todos los roles
      let statsData = {};
      
      // Configurar listeners para actualizaciones en tiempo real
      
      // Equipos - listener común para todos los roles
      const equiposRef = collection(firestore, 'equipos');
      const equiposQuery = query(equiposRef, orderBy('numero', 'asc'));
      
      unsubscribeRef.current = onSnapshot(equiposQuery, 
        async (equiposSnapshot) => {
          if (!isMountedRef.current) return;
          
          const totalEquipos = equiposSnapshot.size;
          
          // Obtener equipos disponibles
          const equiposDisponibles = equiposSnapshot.docs.filter(
            doc => doc.data().estadoDisponibilidad === 'disponible'
          ).length;
          
          // Datos específicos según rol
          if (userRole === 'admin' || userRole === 'mecanico') {
            try {
              // Obtener cantidad de mantenciones pendientes
              const mantencionesRef = collection(firestore, 'mantenciones');
              const mantencionPendienteQuery = query(mantencionesRef, where('estado', '==', 'pendiente'));
              const mantencionPendienteSnapshot = await getDocs(mantencionPendienteQuery);
              const mantencionPendiente = mantencionPendienteSnapshot.size;
              
              // Obtener mantenciones programadas para hoy
              const today = new Date();
              const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
              const mantencionHoyQuery = query(
                mantencionesRef, 
                where('fechaProgramada', '==', formattedDate),
                where('estado', '==', 'pendiente')
              );
              const mantencionHoySnapshot = await getDocs(mantencionHoyQuery);
              const mantencionHoy = mantencionHoySnapshot.size;
              
              // Obtener fallas reportadas
              const fallasRef = collection(firestore, 'fallas');
              const fallasReportadasQuery = query(fallasRef, where('estado', '==', 'pendiente'));
              const fallasReportadasSnapshot = await getDocs(fallasReportadasQuery);
              const fallasReportadas = fallasReportadasSnapshot.size;
              
              // Obtener productos con inventario bajo
              const inventarioRef = collection(firestore, 'inventario');
              const inventarioBajoQuery = query(inventarioRef, where('cantidad', '<', 10)); // Asumiendo que "bajo" es menos de 10 unidades
              const inventarioBajoSnapshot = await getDocs(inventarioBajoQuery);
              const inventarioBajo = inventarioBajoSnapshot.size;
              
              statsData = {
                totalEquipos,
                mantencionPendiente,
                mantencionHoy,
                fallasReportadas,
                equiposDisponibles,
                inventarioBajo,
              };
            } catch (error) {
              console.error('Error al cargar datos específicos de administrador/mecánico:', error);
              statsData = {
                totalEquipos,
                mantencionPendiente: 0,
                mantencionHoy: 0,
                fallasReportadas: 0,
                equiposDisponibles,
                inventarioBajo: 0,
              };
            }
          } else if (userRole === 'conductor') {
            try {
              // Obtener fallas reportadas por este conductor
              const fallasRef = collection(firestore, 'fallas');
              const fallasReportadasQuery = query(
                fallasRef, 
                where('usuarioId', '==', userId || auth.currentUser?.uid || ''),
                where('estado', '!=', 'completado')
              );
              const fallasReportadasSnapshot = await getDocs(fallasReportadasQuery);
              const fallasReportadas = fallasReportadasSnapshot.size;
              
              // Obtener próxima mantención programada para este conductor
              let proximaMantencion = 'No programada';
              const mantencionesRef = collection(firestore, 'mantenciones');
              const mantencionConductorQuery = query(
                mantencionesRef, 
                where('conductorId', '==', userId || auth.currentUser?.uid || ''),
                where('estado', '==', 'pendiente')
              );
              const mantencionConductorSnapshot = await getDocs(mantencionConductorQuery);
              
              if (!mantencionConductorSnapshot.empty) {
                // Ordenar mantenciones por fecha para obtener la próxima
                const mantenciones = [];
                mantencionConductorSnapshot.forEach(doc => {
                  mantenciones.push({
                    id: doc.id,
                    ...doc.data()
                  });
                });
                
                mantenciones.sort((a, b) => {
                  // Intentar varias formas de formato de fecha
                  let dateA, dateB;
                  
                  if (a.fechaProgramada && a.fechaProgramada.includes('/')) {
                    const [diaA, mesA, anioA] = a.fechaProgramada.split('/');
                    dateA = new Date(anioA, mesA - 1, diaA);
                  } else if (a.fechaProgramada && a.fechaProgramada.includes('-')) {
                    const [anioA, mesA, diaA] = a.fechaProgramada.split('-');
                    dateA = new Date(anioA, mesA - 1, diaA);
                  } else if (a.fecha && typeof a.fecha === 'object' && a.fecha.toDate) {
                    dateA = a.fecha.toDate();
                  } else {
                    dateA = new Date(9999, 11, 31); // Fecha lejana para ordenar al final
                  }
                  
                  if (b.fechaProgramada && b.fechaProgramada.includes('/')) {
                    const [diaB, mesB, anioB] = b.fechaProgramada.split('/');
                    dateB = new Date(anioB, mesB - 1, diaB);
                  } else if (b.fechaProgramada && b.fechaProgramada.includes('-')) {
                    const [anioB, mesB, diaB] = b.fechaProgramada.split('-');
                    dateB = new Date(anioB, mesB - 1, diaB);
                  } else if (b.fecha && typeof b.fecha === 'object' && b.fecha.toDate) {
                    dateB = b.fecha.toDate();
                  } else {
                    dateB = new Date(9999, 11, 31); // Fecha lejana para ordenar al final
                  }
                  
                  return dateA - dateB;
                });
                
                if (mantenciones.length > 0 && mantenciones[0].fechaProgramada) {
                  proximaMantencion = mantenciones[0].fechaProgramada;
                }
              }
              
              statsData = {
                equiposDisponibles,
                fallasReportadas,
                proximaMantencion,
              };
            } catch (error) {
              console.error('Error al cargar datos específicos de conductor:', error);
              statsData = {
                equiposDisponibles,
                fallasReportadas: 0,
                proximaMantencion: 'No disponible',
              };
            }
          } else {
            // Usuario normal solo ve equipos disponibles
            statsData = {
              equiposDisponibles,
            };
          }
          
          if (isMountedRef.current) {
            setStats(statsData);
            setLoading(false);
          }
        },
        (error) => {
          console.error('Error al escuchar cambios en equipos:', error);
          if (isMountedRef.current) {
            Alert.alert('Error', 'No se pudieron cargar los datos del panel de control');
            // Si hay un error, usar datos de respaldo
            setStats(getBackupStatsForRole());
            setLoading(false);
          }
        }
      );
      
    } catch (error) {
      console.error('Error al cargar datos del dashboard:', error);
      if (isMountedRef.current) {
        Alert.alert('Error', 'No se pudieron cargar los datos del panel de control');
        // Si hay un error, usar datos de respaldo
        setStats(getBackupStatsForRole());
        setLoading(false);
      }
    }
  };

  // Datos de respaldo en caso de fallo de conexión
  const getBackupStatsForRole = () => {
    switch (userRole) {
      case 'admin':
        return {
          totalEquipos: 0,
          mantencionPendiente: 0,
          mantencionHoy: 0,
          fallasReportadas: 0,
          equiposDisponibles: 0,
          inventarioBajo: 0,
        };
      case 'mecanico':
        return {
          totalEquipos: 0,
          mantencionPendiente: 0,
          mantencionHoy: 0,
          fallasReportadas: 0,
          equiposDisponibles: 0,
          inventarioBajo: 0,
        };
      case 'conductor':
        return {
          equiposDisponibles: 0,
          fallasReportadas: 0,
          proximaMantencion: 'No disponible',
        };
      default:
        return {
          equiposDisponibles: 0,
        };
    }
  };
  
  // Función para forzar recarga de datos
  const handleRefresh = () => {
    setLoading(true);
    
    // Desuscribirse y volver a suscribirse para forzar recarga
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    
    // Volver a cargar datos
    fetchDashboardData();
  };

  const handleLogout = async () => {
    try {
      // Limpiar suscripción a Firebase si existe
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      // Use the onLogout function from props if available
      if (onLogout) {
        onLogout();
      } else {
        // Fallback logout method
        await AsyncStorage.removeItem('userData');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión');
    }
  };

  // Componente para los datos del panel de administrador y mecánico
  const renderAdminMechanicDashboard = () => (
    <>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="car" size={30} color="#1890FF" />
          <Text style={styles.statNumber}>{stats.totalEquipos}</Text>
          <Text style={styles.statLabel}>Total Equipos</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="construct" size={30} color="#FF9800" />
          <Text style={styles.statNumber}>{stats.mantencionPendiente}</Text>
          <Text style={styles.statLabel}>Mantención Pendiente</Text>
        </View>
      </View>
      
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="calendar" size={30} color="#4CAF50" />
          <Text style={styles.statNumber}>{stats.mantencionHoy}</Text>
          <Text style={styles.statLabel}>Mantención Hoy</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="warning" size={30} color="#F44336" />
          <Text style={styles.statNumber}>{stats.fallasReportadas}</Text>
          <Text style={styles.statLabel}>Fallas Reportadas</Text>
        </View>
      </View>
      
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={30} color="#4CAF50" />
          <Text style={styles.statNumber}>{stats.equiposDisponibles}</Text>
          <Text style={styles.statLabel}>Equipos Disponibles</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="alert-circle" size={30} color="#FF9800" />
          <Text style={styles.statNumber}>{stats.inventarioBajo}</Text>
          <Text style={styles.statLabel}>Inventario Bajo</Text>
        </View>
      </View>
      
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Mantención')}
        >
          <Ionicons name="construct" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Gestionar Mantención</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Inventario')}
        >
          <Ionicons name="cube" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Gestionar Inventario</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Componente para los datos del panel de conductor
  const   renderDriverDashboard = () => (
    <>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={30} color="#4CAF50" />
          <Text style={styles.statNumber}>{stats.equiposDisponibles}</Text>
          <Text style={styles.statLabel}>Equipos Disponibles</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="warning" size={30} color="#F44336" />
          <Text style={styles.statNumber}>{stats.fallasReportadas}</Text>
          <Text style={styles.statLabel}>Fallas Reportadas</Text>
        </View>
      </View>
      
      <View style={styles.nextMaintenanceCard}>
        <View style={styles.nextMaintenanceHeader}>
          <Ionicons name="calendar" size={24} color="#1890FF" />
          <Text style={styles.nextMaintenanceTitle}>Próxima Mantención</Text>
        </View>
        <Text style={styles.nextMaintenanceDate}>{stats.proximaMantencion}</Text>
        <Text style={styles.nextMaintenanceInfo}>
          No olvides programar tu equipo para la próxima mantención preventiva.
        </Text>
      </View>
      
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('ReportarFalla')}
        >
          <Ionicons name="warning" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Reportar Falla</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('VerDisponibilidad')}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Ver Disponibilidad</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Componente para los datos del panel de usuario normal
  const renderUserDashboard = () => (
    <>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { width: '100%' }]}>
          <Ionicons name="checkmark-circle" size={30} color="#4CAF50" />
          <Text style={styles.statNumber}>{stats.equiposDisponibles}</Text>
          <Text style={styles.statLabel}>Equipos Disponibles</Text>
        </View>
      </View>
      
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={30} color="#1890FF" />
        <Text style={styles.infoText}>
          Bienvenido a MantencionPRO. Desde aquí puedes ver la disponibilidad de equipos.
        </Text>
      </View>
      
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, { width: '100%' }]}
          onPress={() => navigation.navigate('VerDisponibilidad')}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Ver Disponibilidad</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Componente de carga mientras se obtienen los datos
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#1890FF" />
      <Text style={styles.loadingText}>Cargando datos...</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Bienvenido,</Text>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.roleName}>
            {userRole === 'admin' ? 'Administrador' : 
             userRole === 'mecanico' ? 'Mecánico' : 
             userRole === 'conductor' ? 'Conductor' : 'Usuario'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#1890FF" />
        </TouchableOpacity>
      </View>

      <View style={styles.dashboardContainer}>
        <Text style={styles.dashboardTitle}>Panel de Control</Text>
        
        {loading ? renderLoading() : (
          (userRole === 'admin' || userRole === 'mecanico') ? 
            renderAdminMechanicDashboard() : 
            userRole === 'conductor' ? 
            renderDriverDashboard() : 
            renderUserDashboard()
        )}

        {/* Botón para refrescar datos */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.refreshButtonText}>Actualizar datos</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingTop: 50, // Ajustado para tener espacio superior adecuado
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  roleName: {
    fontSize: 16,
    color: '#1890FF',
    marginTop: 4,
  },
  logoutButton: {
    padding: 10,
  },
  dashboardContainer: {
    padding: 20,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: 200, // Altura mínima para el contenedor de carga
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 5,
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  nextMaintenanceCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  nextMaintenanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextMaintenanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  nextMaintenanceDate: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1890FF',
    marginBottom: 10,
  },
  nextMaintenanceInfo: {
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#1890FF',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  refreshButton: {
    backgroundColor: '#52c41a',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  errorContainer: {
    backgroundColor: '#FFF1F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFA39E',
  },
  errorText: {
    color: '#F5222D',
    fontSize: 14,
  },
});

export default Home;