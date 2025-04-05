import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Home = ({ navigation, route }) => {
  const [userRole, setUserRole] = useState(route.params?.userRole || null);
  const [userData, setUserData] = useState(route.params?.userData || null);
  const [userName, setUserName] = useState('');
  
  const onLogout = route.params?.onLogout;

  useEffect(() => {
    // Set username based on userData or role
    if (userData && userData.correo) {
      // Extract username from email (remove @domain.com)
      const emailName = userData.correo.split('@')[0];
      setUserName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
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
    }
  }, [userData, userRole]);

  const handleLogout = async () => {
    try {
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

  // Datos simulados para el panel de control según el rol
  const getStatsForRole = () => {
    switch (userRole) {
      case 'admin':
        return {
          totalEquipos: 28,
          mantencionPendiente: 5,
          mantencionHoy: 3,
          fallasReportadas: 7,
          equiposDisponibles: 20,
          inventarioBajo: 12,
        };
      case 'mecanico':
        return {
          totalEquipos: 28,
          mantencionPendiente: 5,
          mantencionHoy: 3,
          fallasReportadas: 7,
          equiposDisponibles: 20,
          inventarioBajo: 12,
        };
      case 'conductor':
        return {
          equiposDisponibles: 20,
          fallasReportadas: 7,
          proximaMantencion: '15/04/2025',
        };
      default:
        return {
          equiposDisponibles: 20,
        };
    }
  };

  const stats = getStatsForRole();

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
  const renderDriverDashboard = () => (
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
        
        {(userRole === 'admin' || userRole === 'mecanico') ? 
          renderAdminMechanicDashboard() : 
          userRole === 'conductor' ? 
          renderDriverDashboard() : 
          renderUserDashboard()
        }
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
});

export default Home;