import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// Importar Firebase
import firebaseApp from "../firebase/credenciales";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const ReporteFallasScreen = ({ navigation, route }) => {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [equipo, setEquipo] = useState('');
  const [prioridad, setPrioridad] = useState('media');
  const [isLoading, setIsLoading] = useState(false);
  const [fallasReportadas, setFallasReportadas] = useState([]);
  const [loadingFallas, setLoadingFallas] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  
  // Estados para el modal de atención
  const [modalVisible, setModalVisible] = useState(false);
  const [fallaSeleccionada, setFallaSeleccionada] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState('en_proceso');
  const [comentario, setComentario] = useState('');
  const [loadingAtencion, setLoadingAtencion] = useState(false);

  // Simulación de equipos disponibles
  const equiposDisponibles = [
    { id: 'equipo1', nombre: 'Camión 1' },
    { id: 'equipo2', nombre: 'Camión 2' },
    { id: 'equipo3', nombre: 'Camión 3' },
    { id: 'equipo4', nombre: 'Camión 4' },
    { id: 'equipo5', nombre: 'Excavadora 1' },
    { id: 'equipo6', nombre: 'Excavadora 2' },
    { id: 'equipo7', nombre: 'Retroexcavadora 1' },
    { id: 'equipo8', nombre: 'Cargador Frontal 1' },
  ];

  // Obtener el rol del usuario
  useEffect(() => {
    const getUserData = async () => {
      try {
        const userData = route.params?.userData;
        
        if (userData && userData.rol) {
          setUserRole(userData.rol);
          setUserInfo(userData);
        } else {
          // Si no hay datos en route.params, intentar obtener de AsyncStorage
          const storedUserData = await AsyncStorage.getItem('userData');
          
          if (storedUserData) {
            const parsedUserData = JSON.parse(storedUserData);
            setUserRole(parsedUserData.rol);
            setUserInfo(parsedUserData);
          }
        }
      } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
      }
    };

    getUserData();
  }, [route.params]);

  // Cargar las fallas reportadas - SOLUCIÓN MEJORADA
  const cargarFallas = async () => {
    try {
      setLoadingFallas(true);
      const fallasRef = collection(firestore, 'fallas');
      let fallasQuery;
      
      // Si es conductor, mostrar solo sus fallas
      if (userRole === 'conductor' && userInfo) {
        try {
          // Intentar con la consulta indexada (mejor opción a largo plazo)
          fallasQuery = query(
            fallasRef, 
            where('usuarioId', '==', userInfo.uid),
            orderBy('fechaCreacion', 'desc')
          );
          
          const querySnapshot = await getDocs(fallasQuery);
          const fallas = [];
          
          querySnapshot.forEach((doc) => {
            fallas.push({
              id: doc.id,
              ...doc.data()
            });
          });
          
          setFallasReportadas(fallas);
        } catch (indexError) {
          console.error('Error de índice, usando consulta alternativa:', indexError);
          
          // Si falla por error de índice, usar consulta sin ordenamiento
          fallasQuery = query(
            fallasRef, 
            where('usuarioId', '==', userInfo.uid)
          );
          
          const querySnapshot = await getDocs(fallasQuery);
          const fallas = [];
          
          querySnapshot.forEach((doc) => {
            fallas.push({
              id: doc.id,
              ...doc.data()
            });
          });
          
          // Ordenar manualmente los resultados
          fallas.sort((a, b) => {
            // Si no hay fechaCreacion, colocar al final
            if (!a.fechaCreacion) return 1;
            if (!b.fechaCreacion) return -1;
            
            // Convertir a Date si es necesario
            const fechaA = a.fechaCreacion.toDate ? a.fechaCreacion.toDate() : new Date(a.fechaCreacion);
            const fechaB = b.fechaCreacion.toDate ? b.fechaCreacion.toDate() : new Date(b.fechaCreacion);
            
            // Ordenar de más reciente a más antiguo
            return fechaB - fechaA;
          });
          
          setFallasReportadas(fallas);
          
          // Mostrar alerta para crear el índice solo la primera vez
          const indexAlertShown = await AsyncStorage.getItem('indexAlertShown');
          if (!indexAlertShown) {
            Alert.alert(
              'Índice requerido',
              'Para mejorar el rendimiento, se recomienda crear un índice en Firestore. Por favor, siga el enlace en la consola de desarrollo.',
              [
                {
                  text: 'OK',
                  onPress: async () => {
                    await AsyncStorage.setItem('indexAlertShown', 'true');
                  }
                }
              ]
            );
          }
        }
      } else {
        // Si es admin o mecánico, mostrar todas las fallas
        fallasQuery = query(
          fallasRef,
          orderBy('fechaCreacion', 'desc')
        );
        
        const querySnapshot = await getDocs(fallasQuery);
        const fallas = [];
        
        querySnapshot.forEach((doc) => {
          fallas.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        setFallasReportadas(fallas);
      }
    } catch (error) {
      console.error('Error al cargar fallas:', error);
      Alert.alert('Error', 'No se pudieron cargar las fallas reportadas');
    } finally {
      setLoadingFallas(false);
    }
  };

  useEffect(() => {
    if (userRole) {
      cargarFallas();
    }
  }, [userRole, userInfo]);

  // Función para reportar una falla
  const reportarFalla = async () => {
    if (!titulo || !descripcion || !equipo) {
      Alert.alert('Error', 'Por favor complete todos los campos');
      return;
    }

    setIsLoading(true);

    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        Alert.alert('Error', 'Debe iniciar sesión para reportar una falla');
        setIsLoading(false);
        return;
      }

      // Obtener datos del equipo seleccionado
      const equipoSeleccionado = equiposDisponibles.find(e => e.id === equipo);

      // Crear documento en la colección "fallas"
      const fallaData = {
        titulo,
        descripcion,
        equipoId: equipo,
        equipoNombre: equipoSeleccionado.nombre,
        prioridad,
        estado: 'pendiente',
        usuarioId: currentUser.uid,
        usuarioEmail: currentUser.email,
        fechaCreacion: serverTimestamp(),
        fechaActualizacion: serverTimestamp(),
        historial: [
          {
            estado: 'pendiente',
            fecha: new Date().toISOString(),
            usuario: currentUser.email,
            comentario: 'Falla reportada'
          }
        ]
      };

      await addDoc(collection(firestore, 'fallas'), fallaData);

      Alert.alert('Éxito', 'Falla reportada correctamente');
      
      // Limpiar el formulario
      setTitulo('');
      setDescripcion('');
      setEquipo('');
      setPrioridad('media');
      
      // Recargar las fallas
      cargarFallas();
    } catch (error) {
      console.error('Error al reportar falla:', error);
      Alert.alert('Error', 'No se pudo reportar la falla');
    } finally {
      setIsLoading(false);
    }
  };

  // Función para abrir el modal de atención
  const handleAtender = (falla) => {
    setFallaSeleccionada(falla);
    setNuevoEstado(falla.estado === 'pendiente' ? 'en_proceso' : 'completado');
    setComentario('');
    setModalVisible(true);
  };

  // Función para procesar la atención de la falla
  const procesarAtencion = async () => {
    if (!comentario) {
      Alert.alert('Error', 'Por favor ingrese un comentario');
      return;
    }

    setLoadingAtencion(true);

    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        Alert.alert('Error', 'Debe iniciar sesión para atender la falla');
        setLoadingAtencion(false);
        return;
      }

      // Preparar historial
      const nuevoHistorial = [
        ...(fallaSeleccionada.historial || []),
        {
          estado: nuevoEstado,
          fecha: new Date().toISOString(),
          usuario: currentUser.email,
          comentario: comentario
        }
      ];

      // Actualizar documento en la colección "fallas"
      const fallaRef = doc(firestore, 'fallas', fallaSeleccionada.id);
      
      await updateDoc(fallaRef, {
        estado: nuevoEstado,
        fechaActualizacion: serverTimestamp(),
        historial: nuevoHistorial,
        tecnicoAsignado: currentUser.email
      });

      Alert.alert('Éxito', `Falla ${nuevoEstado === 'en_proceso' ? 'en proceso' : 'completada'} correctamente`);
      
      // Cerrar modal
      setModalVisible(false);
      
      // Recargar las fallas
      cargarFallas();
    } catch (error) {
      console.error('Error al atender falla:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado de la falla');
    } finally {
      setLoadingAtencion(false);
    }
  };

  // Función para obtener color según prioridad
  const getPrioridadColor = (prioridad) => {
    switch (prioridad) {
      case 'alta':
        return '#F44336';
      case 'media':
        return '#FF9800';
      case 'baja':
        return '#4CAF50';
      default:
        return '#FF9800';
    }
  };

  // Función para obtener color según estado
  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'pendiente':
        return '#FF9800';
      case 'en_proceso':
        return '#2196F3';
      case 'completado':
        return '#4CAF50';
      case 'cancelado':
        return '#9E9E9E';
      default:
        return '#FF9800';
    }
  };

  // Función para formatear la fecha
  const formatearFecha = (timestamp) => {
    if (!timestamp) return 'Fecha no disponible';
    
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return fecha.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para obtener texto del botón según estado
  const getTextoBoton = (estado) => {
    switch (estado) {
      case 'pendiente':
        return 'Atender';
      case 'en_proceso':
        return 'Completar';
      case 'completado':
        return 'Ver Detalles';
      default:
        return 'Atender';
    }
  };

  // Función para obtener icono del botón según estado
  const getIconoBoton = (estado) => {
    switch (estado) {
      case 'pendiente':
        return 'construct';
      case 'en_proceso':
        return 'checkmark-circle';
      case 'completado':
        return 'information-circle';
      default:
        return 'construct';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {userRole === 'conductor' ? 'Reportar Falla' : 'Gestión de Fallas Reportadas'}
        </Text>
      </View>

      {/* Formulario para reportar falla (solo visible para conductores) */}
      {userRole === 'conductor' && (
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Título:</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Falla en frenos"
              value={titulo}
              onChangeText={setTitulo}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Equipo:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={equipo}
                onValueChange={(itemValue) => setEquipo(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Seleccione un equipo" value="" />
                {equiposDisponibles.map((equipoItem) => (
                  <Picker.Item 
                    key={equipoItem.id} 
                    label={equipoItem.nombre} 
                    value={equipoItem.id} 
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Prioridad:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={prioridad}
                onValueChange={(itemValue) => setPrioridad(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Alta" value="alta" />
                <Picker.Item label="Media" value="media" />
                <Picker.Item label="Baja" value="baja" />
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descripción:</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describa detalladamente la falla observada"
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={reportarFalla}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="warning" size={20} color="#ffffff" />
                <Text style={styles.submitButtonText}>Reportar Falla</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de fallas reportadas */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Fallas Reportadas</Text>
        
        {loadingFallas ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1890FF" />
            <Text style={styles.loadingText}>Cargando fallas...</Text>
          </View>
        ) : fallasReportadas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="information-circle-outline" size={50} color="#1890FF" />
            <Text style={styles.emptyText}>No hay fallas reportadas</Text>
          </View>
        ) : (
          fallasReportadas.map((falla) => (
            <View key={falla.id} style={styles.fallaCard}>
              <View style={styles.fallaHeader}>
                <View>
                  <Text style={styles.fallaTitulo}>{falla.titulo}</Text>
                  <Text style={styles.fallaEquipo}>{falla.equipoNombre}</Text>
                </View>
                <View style={[
                  styles.prioridadBadge, 
                  { backgroundColor: getPrioridadColor(falla.prioridad) }
                ]}>
                  <Text style={styles.prioridadText}>
                    {falla.prioridad.charAt(0).toUpperCase() + falla.prioridad.slice(1)}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.fallaDescripcion}>{falla.descripcion}</Text>
              
              <View style={styles.fallaFooter}>
                <View style={[
                  styles.estadoBadge, 
                  { backgroundColor: getEstadoColor(falla.estado) }
                ]}>
                  <Text style={styles.estadoText}>
                    {falla.estado === 'pendiente' ? 'Pendiente' : 
                     falla.estado === 'en_proceso' ? 'En proceso' :
                     falla.estado === 'completado' ? 'Completado' : 'Cancelado'}
                  </Text>
                </View>
                <Text style={styles.fallaFecha}>
                  {falla.fechaCreacion ? formatearFecha(falla.fechaCreacion) : 'Fecha no disponible'}
                </Text>
              </View>
              
              {falla.tecnicoAsignado && falla.estado !== 'pendiente' && (
                <Text style={styles.tecnicoText}>
                  Atendido por: {falla.tecnicoAsignado}
                </Text>
              )}
              
              {(userRole === 'admin' || userRole === 'mecanico') && falla.estado !== 'cancelado' && (
                <TouchableOpacity 
                  style={[
                    styles.actionButton,
                    { backgroundColor: getEstadoColor(falla.estado) }
                  ]}
                  onPress={() => handleAtender(falla)}
                >
                  <Ionicons name={getIconoBoton(falla.estado)} size={16} color="#ffffff" />
                  <Text style={styles.actionButtonText}>{getTextoBoton(falla.estado)}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>

      {/* Modal para atender falla */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {nuevoEstado === 'en_proceso' ? 'Atender Falla' : 'Completar Falla'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            {fallaSeleccionada && (
              <View style={styles.modalBody}>
                <View style={styles.fallaInfo}>
                  <Text style={styles.fallaInfoTitulo}>{fallaSeleccionada.titulo}</Text>
                  <Text style={styles.fallaInfoEquipo}>{fallaSeleccionada.equipoNombre}</Text>
                  <View style={[
                    styles.estadoBadgeModal, 
                    { backgroundColor: getEstadoColor(fallaSeleccionada.estado) }
                  ]}>
                    <Text style={styles.estadoTextModal}>
                      Estado actual: {fallaSeleccionada.estado === 'pendiente' ? 'Pendiente' : 
                                     fallaSeleccionada.estado === 'en_proceso' ? 'En proceso' : 'Completado'}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.modalLabel}>Actualizar estado a:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={nuevoEstado}
                    onValueChange={(itemValue) => setNuevoEstado(itemValue)}
                    style={styles.picker}
                    enabled={fallaSeleccionada.estado !== 'completado'}
                  >
                    {fallaSeleccionada.estado === 'pendiente' && (
                      <Picker.Item label="En proceso" value="en_proceso" />
                    )}
                    {(fallaSeleccionada.estado === 'pendiente' || fallaSeleccionada.estado === 'en_proceso') && (
                      <Picker.Item label="Completado" value="completado" />
                    )}
                    {fallaSeleccionada.estado === 'en_proceso' && (
                      <Picker.Item label="Cancelado" value="cancelado" />
                    )}
                    {fallaSeleccionada.estado === 'completado' && (
                      <Picker.Item label="Completado" value="completado" />
                    )}
                  </Picker>
                </View>
                
                <Text style={styles.modalLabel}>Comentario:</Text>
                <TextInput
                  style={[styles.input, styles.textAreaModal]}
                  placeholder="Agregue un comentario sobre la atención realizada"
                  value={comentario}
                  onChangeText={setComentario}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={fallaSeleccionada.estado !== 'completado'}
                />
                
                {fallaSeleccionada.historial && fallaSeleccionada.historial.length > 0 && (
                  <View style={styles.historialContainer}>
                    <Text style={styles.historialTitle}>Historial de la falla:</Text>
                    {fallaSeleccionada.historial.map((item, index) => (
                      <View key={index} style={styles.historialItem}>
                        <View style={styles.historialHeader}>
                          <Text style={styles.historialFecha}>
                            {new Date(item.fecha).toLocaleString()}
                          </Text>
                          <View style={[
                            styles.historialEstado,
                            { backgroundColor: getEstadoColor(item.estado) }
                          ]}>
                            <Text style={styles.historialEstadoText}>
                              {item.estado === 'pendiente' ? 'Pendiente' : 
                               item.estado === 'en_proceso' ? 'En proceso' : 
                               item.estado === 'completado' ? 'Completado' : 'Cancelado'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.historialUsuario}>Por: {item.usuario}</Text>
                        <Text style={styles.historialComentario}>{item.comentario}</Text>
                      </View>
                    ))}
                  </View>
                )}
                
                {fallaSeleccionada.estado !== 'completado' && (
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: getEstadoColor(nuevoEstado) }]}
                    onPress={procesarAtencion}
                    disabled={loadingAtencion}
                  >
                    {loadingAtencion ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.modalButtonText}>
                        {nuevoEstado === 'en_proceso' ? 'Iniciar atención' : 
                        nuevoEstado === 'completado' ? 'Marcar como completado' : 'Cancelar falla'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingTop: 50, // Ajustar según necesidades
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#444',
  },
  input: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 5,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 100,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    backgroundColor: '#f9f9f9',
  },
  picker: {
    height: 50,
  },
  submitButton: {
    backgroundColor: '#1890FF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  listContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#1890FF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  fallaCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  fallaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  fallaTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  fallaEquipo: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  prioridadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  prioridadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fallaDescripcion: {
    fontSize: 14,
    color: '#444',
    marginBottom: 10,
    lineHeight: 20,
  },
  fallaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  estadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  estadoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fallaFecha: {
    fontSize: 12,
    color: '#666',
  },
  tecnicoText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
  },
  actionButton: {
    backgroundColor: '#1890FF',
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    width: 100,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  
  // Estilos para el modal
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingBottom: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  modalBody: {
    padding: 16,
  },
  fallaInfo: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  fallaInfoTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  fallaInfoEquipo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  estadoBadgeModal: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  estadoTextModal: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
    color: '#444',
  },
  textAreaModal: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButton: {
    backgroundColor: '#1890FF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
    justifyContent: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historialContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  historialTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  historialItem: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1890FF',
  },
  historialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historialFecha: {
    fontSize: 12,
    color: '#666',
  },
  historialEstado: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historialEstadoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  historialUsuario: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 4,
  },
  historialComentario: {
    fontSize: 13,
    color: '#444',
  }});

  export default ReporteFallasScreen;