import React, { useState, useEffect, useRef } from 'react';
    import {
      View,
      Text,
      StyleSheet,
      FlatList,
      TouchableOpacity,
      Modal,
      TextInput,
      Alert,
      ScrollView,
      ActivityIndicator
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
      updateDoc,
      query,
      orderBy,
      serverTimestamp,
      onSnapshot
    } from "firebase/firestore";
    import { getAuth } from "firebase/auth";
    
    const firestore = getFirestore(firebaseApp);
    const auth = getAuth(firebaseApp);
    
    // Intervalo de refresco (en milisegundos) si es necesario
    const REFRESH_INTERVAL = 10000; // 10 segundos
    
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
    
    const DisponibilidadScreen = ({ route, navigation }) => {
      // Estado para los datos del usuario
      const [userRole, setUserRole] = useState(null);
      const [userName, setUserName] = useState('');
      
      // Estado para la lista de camiones
      const [camiones, setCamiones] = useState([]);
      
      // Estado para el modal de edición
      const [modalVisible, setModalVisible] = useState(false);
      const [camionSeleccionado, setCamionSeleccionado] = useState(null);
      
      // Estado de carga
      const [loading, setLoading] = useState(true);
      const [loadingAction, setLoadingAction] = useState(false);
      
      // Estado para manejo de errores
      const [error, setError] = useState(null);
      
      // Estado para el formulario del modal
      const [formData, setFormData] = useState({
        estadoDisponibilidad: 'disponible',
        motivo: '',
        limitaciones: '',
        estimacionFinalizacion: ''
      });
    
      // Estado para filtros
      const [filtroActual, setFiltroActual] = useState('todos');
    
      // Referencias para limpieza
      const intervalRef = useRef(null);
      const unsubscribeRef = useRef(null);
      const isMountedRef = useRef(true);
    
      // Control de montaje del componente
      useEffect(() => {
        isMountedRef.current = true;
        return () => {
          isMountedRef.current = false;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
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
            if (route?.params?.userData?.rol) {
              setUserRole(route.params.userData.rol);
              setUserName(route.params.userData.nombre || route.params.userData.email || 'Usuario');
            } else {
              // Si no está en los parámetros, intentar obtenerlo de AsyncStorage
              try {
                const userDataString = await AsyncStorage.getItem('userData');
                if (userDataString) {
                  const userData = JSON.parse(userDataString);
                  setUserRole(userData.rol || 'conductor');
                  setUserName(userData.nombre || userData.email || 'Usuario');
                } else {
                  // Intentar obtener del usuario autenticado
                  const currentUser = auth.currentUser;
                  if (currentUser) {
                    // Intentar obtener el perfil completo desde Firestore
                    try {
                      const userDoc = await getDoc(doc(firestore, 'usuarios', currentUser.uid));
                      if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUserRole(userData.rol || 'conductor');
                        setUserName(userData.nombre || userData.email || currentUser.email || 'Usuario');
                      } else {
                        setUserRole('conductor'); // Rol por defecto
                        setUserName(currentUser.email || 'Usuario');
                      }
                    } catch (err) {
                      console.error('Error al obtener datos de usuario de Firestore:', err);
                      setUserRole('conductor');
                      setUserName(currentUser.email || 'Usuario');
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
      }, [route]);
    
      // Cargar datos desde Firebase
      useEffect(() => {
        const loadEquipos = async () => {
          setLoading(true);
          setError(null);
          
          try {
            // Configurar el listener para actualizaciones en tiempo real
            const equiposRef = collection(firestore, 'equipos');
            const q = query(equiposRef, orderBy('numero', 'asc'));
            
            // Suscribirse a cambios
            unsubscribeRef.current = onSnapshot(q, 
              (snapshot) => {
                if (isMountedRef.current) {
                  const equiposData = [];
                  snapshot.forEach((doc) => {
                    const data = doc.data();
                    
                    // Mapear datos del equipo y convertir los timestamps a string
                    equiposData.push({
                      id: doc.id,
                      numero: data.numero || '',
                      modelo: data.modelo || '',
                      estadoDisponibilidad: data.estadoDisponibilidad || 'disponible',
                      ultimaActualizacion: formatFirebaseTimestamp(data.fechaActualizacionDisponibilidad) ||
                                           formatFirebaseTimestamp(data.fechaActualizacion) || '',
                      actualizadoPor: data.actualizadoPor || '',
                      motivo: data.motivo || '',
                      limitaciones: data.limitaciones || '',
                      estimacionFinalizacion: data.estimacionFinalizacion || '',
                      estado: data.estado || 'Operativo' // Estado general del equipo
                    });
                  });
                  
                  setCamiones(equiposData);
                  setLoading(false);
                }
              },
              (error) => {
                console.error("Error al escuchar cambios en equipos:", error);
                setError("Error al cargar datos en tiempo real. Intente nuevamente.");
                setLoading(false);
              }
            );
          } catch (err) {
            console.error('Error al cargar equipos:', err);
            setError('No se pudieron cargar los datos. Intente nuevamente.');
            setLoading(false);
          }
        };
    
        loadEquipos();
      }, []);
    
      // Verificar si el usuario puede editar (solo mecánico o administrador)
      const canEdit = userRole === 'mecanico' || userRole === 'admin';
    
      // Función para filtrar camiones por estado de disponibilidad
      const filtrarCamionesPorEstado = (estado) => {
        return camiones.filter(camion => camion.estadoDisponibilidad === estado);
      };
      
      // Datos filtrados para mostrar
      const datosFiltrados = filtroActual === 'todos' 
        ? camiones 
        : filtrarCamionesPorEstado(filtroActual);
    
      // Función para abrir el modal de edición
      const handleEdit = (camion) => {
        setCamionSeleccionado(camion);
        setFormData({
          estadoDisponibilidad: camion.estadoDisponibilidad || 'disponible',
          motivo: camion.motivo || '',
          limitaciones: camion.limitaciones || '',
          estimacionFinalizacion: camion.estimacionFinalizacion || ''
        });
        setModalVisible(true);
      };
    
      // Función para guardar los cambios de disponibilidad del camión
      const handleSave = async () => {
        // Validaciones
        if (formData.estadoDisponibilidad === 'no_disponible' && !formData.motivo) {
          Alert.alert('Error', 'Debe ingresar un motivo cuando el camión no está disponible');
          return;
        }
    
        if (formData.estadoDisponibilidad === 'parcial' && (!formData.motivo || !formData.limitaciones)) {
          Alert.alert('Error', 'Debe ingresar un motivo y las limitaciones cuando el camión está parcialmente disponible');
          return;
        }
    
        try {
          setLoadingAction(true);
          
          // Fecha actual formateada para guardar como string
          const fechaActual = new Date().toISOString().split('T')[0];
          
          // Datos a actualizar
          const actualizacion = {
            estadoDisponibilidad: formData.estadoDisponibilidad,
            motivo: formData.estadoDisponibilidad === 'disponible' ? '' : formData.motivo,
            limitaciones: formData.estadoDisponibilidad === 'parcial' ? formData.limitaciones : '',
            estimacionFinalizacion: formData.estadoDisponibilidad === 'disponible' ? '' : formData.estimacionFinalizacion,
            fechaActualizacionDisponibilidad: fechaActual, // Guardar como string
            actualizadoPor: userName,
            fechaActualizacion: serverTimestamp() // Este valor no se muestra directamente en la UI
          };
          
          // Actualizar el estado del equipo según la disponibilidad
          if (formData.estadoDisponibilidad === 'no_disponible') {
            actualizacion.estado = 'Fuera de Servicio';
          } else if (formData.estadoDisponibilidad === 'parcial') {
            actualizacion.estado = 'En Mantenimiento';
          } else {
            actualizacion.estado = 'Operativo';
          }
          
          // Actualizar en Firestore
          const equipoRef = doc(firestore, 'equipos', camionSeleccionado.id);
          await updateDoc(equipoRef, actualizacion);
          
          // Los datos se actualizarán automáticamente debido al listener onSnapshot
          setLoadingAction(false);
          setModalVisible(false);
          
          Alert.alert('Éxito', 'Disponibilidad del camión actualizada correctamente');
        } catch (err) {
          console.error('Error al guardar cambios:', err);
          setLoadingAction(false);
          Alert.alert('Error', 'No se pudo actualizar la disponibilidad. Intente nuevamente.');
        }
      };
    
      // Obtener color y texto según estado de disponibilidad
      const getEstadoInfo = (estado) => {
        switch (estado) {
          case 'disponible':
            return { color: '#52C41A', text: 'Disponible', icon: 'checkmark-circle' };
          case 'parcial':
            return { color: '#FAAD14', text: 'Parcialmente Disponible', icon: 'alert-circle' };
          case 'no_disponible':
            return { color: '#FF4D4F', text: 'No Disponible', icon: 'close-circle' };
          default:
            return { color: '#999', text: 'Desconocido', icon: 'help-circle' };
        }
      };
    
      // Función para forzar recarga de datos
      const handleRefresh = async () => {
        setLoading(true);
        
        // Desuscribirse y volver a suscribirse para forzar recarga
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
        
        try {
          const equiposRef = collection(firestore, 'equipos');
          const q = query(equiposRef, orderBy('numero', 'asc'));
          
          // Obtener datos frescos
          const snapshot = await getDocs(q);
          const equiposData = [];
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            equiposData.push({
              id: doc.id,
              numero: data.numero || '',
              modelo: data.modelo || '',
              estadoDisponibilidad: data.estadoDisponibilidad || 'disponible',
              ultimaActualizacion: formatFirebaseTimestamp(data.fechaActualizacionDisponibilidad) ||
                                  formatFirebaseTimestamp(data.fechaActualizacion) || '',
              actualizadoPor: data.actualizadoPor || '',
              motivo: data.motivo || '',
              limitaciones: data.limitaciones || '',
              estimacionFinalizacion: data.estimacionFinalizacion || '',
              estado: data.estado || 'Operativo'
            });
          });
          
          setCamiones(equiposData);
          
          // Volver a configurar el listener
          unsubscribeRef.current = onSnapshot(q, 
            (snapshot) => {
              if (isMountedRef.current) {
                const newEquiposData = [];
                snapshot.forEach((doc) => {
                  const data = doc.data();
                  newEquiposData.push({
                    id: doc.id,
                    numero: data.numero || '',
                    modelo: data.modelo || '',
                    estadoDisponibilidad: data.estadoDisponibilidad || 'disponible',
                    ultimaActualizacion: formatFirebaseTimestamp(data.fechaActualizacionDisponibilidad) ||
                                        formatFirebaseTimestamp(data.fechaActualizacion) || '',
                    actualizadoPor: data.actualizadoPor || '',
                    motivo: data.motivo || '',
                    limitaciones: data.limitaciones || '',
                    estimacionFinalizacion: data.estimacionFinalizacion || '',
                    estado: data.estado || 'Operativo'
                  });
                });
                
                setCamiones(newEquiposData);
              }
            },
            (error) => {
              console.error("Error al escuchar cambios en equipos:", error);
              setError("Error al cargar datos en tiempo real. Intente nuevamente.");
            }
          );
          
          setError(null);
        } catch (err) {
          console.error('Error al recargar equipos:', err);
          setError('No se pudieron recargar los datos. Intente nuevamente.');
        }
        
        setLoading(false);
      };
    
      // Renderizado de un ítem de la lista
      const renderItem = ({ item }) => {
        const estadoInfo = getEstadoInfo(item.estadoDisponibilidad);
        
        return (
          <View style={styles.camionItem}>
            <View style={styles.camionHeader}>
              <Text style={styles.camionNumero}>Camión #{item.numero}</Text>
              <View style={[
                styles.disponibilidadBadge, 
                {backgroundColor: estadoInfo.color}
              ]}>
                <Ionicons name={estadoInfo.icon} size={14} color="white" style={styles.estadoIcon} />
                <Text style={styles.disponibilidadText}>
                  {estadoInfo.text}
                </Text>
              </View>
            </View>
            
            <Text style={styles.camionModelo}>{item.modelo}</Text>
            
            {/* Mostrar información adicional si no está totalmente disponible */}
            {item.estadoDisponibilidad !== 'disponible' && (
              <View style={[
                styles.infoNoDisponible,
                { borderLeftColor: item.estadoDisponibilidad === 'parcial' ? '#FAAD14' : '#FF4D4F' }
              ]}>
                <Text style={styles.motivoText}>
                  <Text style={styles.camionLabel}>Motivo: </Text>
                  {item.motivo || 'No especificado'}
                </Text>
                
                {item.estadoDisponibilidad === 'parcial' && item.limitaciones && (
                  <Text style={styles.limitacionesText}>
                    <Text style={styles.camionLabel}>Limitaciones: </Text>
                    {item.limitaciones}
                  </Text>
                )}
                
                {item.estimacionFinalizacion && (
                  <Text style={styles.estimacionText}>
                    <Text style={styles.camionLabel}>Reparación estimada: </Text>
                    {item.estimacionFinalizacion}
                  </Text>
                )}
              </View>
            )}
            
            <View style={styles.camionFooter}>
              <Text style={styles.actualizacionText}>
                <Text style={styles.camionLabel}>Actualizado: </Text>
                {item.ultimaActualizacion ? item.ultimaActualizacion : 'No registrado'} 
                {item.actualizadoPor ? ` por ${item.actualizadoPor}` : ''}
              </Text>
              
              {/* Botón de edición (solo visible para mecánicos y administradores) */}
              {canEdit && (
                <TouchableOpacity 
                  style={styles.editarButton}
                  onPress={() => handleEdit(item)}
                >
                  <Ionicons name="create-outline" size={20} color="#1890FF" />
                  <Text style={styles.editarButtonText}>Editar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      };
    
      // Si aún está cargando, mostrar indicador
      if (loading && camiones.length === 0) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1890FF" />
            <Text style={styles.loadingText}>Cargando equipos...</Text>
          </View>
        );
      }
    
      return (
        <View style={styles.container}>
          {loading && (
            <View style={styles.overlayLoading}>
              <ActivityIndicator size="large" color="#1890FF" />
            </View>
          )}
          
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.title}>
                Disponibilidad de Camiones
              </Text>
              
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={handleRefresh}
                disabled={loading}
              >
                <Ionicons name="refresh" size={20} color="#1890FF" />
              </TouchableOpacity>
            </View>
            
            {/* Filtros */}
            <View style={styles.filtrosContainer}>
              <TouchableOpacity 
                key="filtro-todos"
                style={[
                  styles.filtroButton, 
                  filtroActual === 'todos' && styles.filtroActivo
                ]}
                onPress={() => setFiltroActual('todos')}
              >
                <Text style={[
                  styles.filtroText,
                  filtroActual === 'todos' && styles.filtroTextoActivo
                ]}>Todos</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                key="filtro-disponible"
                style={[
                  styles.filtroButton, 
                  filtroActual === 'disponible' && styles.filtroActivo,
                  filtroActual === 'disponible' && { backgroundColor: '#52C41A' }
                ]}
                onPress={() => setFiltroActual('disponible')}
              >
                <Text style={[
                  styles.filtroText,
                  filtroActual === 'disponible' && styles.filtroTextoActivo
                ]}>Disponibles</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                key="filtro-parcial"
                style={[
                  styles.filtroButton, 
                  filtroActual === 'parcial' && styles.filtroActivo,
                  filtroActual === 'parcial' && { backgroundColor: '#FAAD14' }
                ]}
                onPress={() => setFiltroActual('parcial')}
              >
                <Text style={[
                  styles.filtroText,
                  filtroActual === 'parcial' && styles.filtroTextoActivo
                ]}>Parcial</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                key="filtro-no-disponible"
                style={[
                  styles.filtroButton, 
                  filtroActual === 'no_disponible' && styles.filtroActivo,
                  filtroActual === 'no_disponible' && { backgroundColor: '#FF4D4F' }
                ]}
                onPress={() => setFiltroActual('no_disponible')}
              >
                <Text style={[
                  styles.filtroText,
                  filtroActual === 'no_disponible' && styles.filtroTextoActivo
                ]}>No Disponibles</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Mostrar mensaje de error si existe */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity 
                style={styles.reloadButton}
                onPress={handleRefresh}
              >
                <Text style={styles.reloadButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Lista de camiones */}
          <FlatList
            data={datosFiltrados}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listaContainer}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>No hay camiones que coincidan con el filtro</Text>
              </View>
            }
          />
          
          {/* Modal para editar disponibilidad (solo para mecánicos y administradores) */}
          {canEdit && (
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
                      Editar Disponibilidad - Camión #{camionSeleccionado?.numero}
                    </Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                  </View>
                  
                  <ScrollView style={styles.formContainer}>
                    <Text style={styles.sectionTitle}>Estado del camión</Text>
                    
                    <View style={styles.estadoOptions}>
                      <TouchableOpacity 
                        style={[
                          styles.estadoOption,
                          formData.estadoDisponibilidad === 'disponible' && styles.estadoOptionSelected,
                          { borderColor: '#52C41A' }
                        ]}
                        onPress={() => setFormData({
                          ...formData, 
                          estadoDisponibilidad: 'disponible',
                          motivo: '',
                          limitaciones: '',
                          estimacionFinalizacion: ''
                        })}
                      >
                        <View style={[styles.estadoCircle, { backgroundColor: '#52C41A' }]}>
                          <Ionicons name="checkmark" size={16} color="white" />
                        </View>
                        <Text style={styles.estadoText}>Disponible</Text>
                        <Text style={styles.estadoDesc}>100% operativo</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[
                          styles.estadoOption,
                          formData.estadoDisponibilidad === 'parcial' && styles.estadoOptionSelected,
                          { borderColor: '#FAAD14' }
                        ]}
                        onPress={() => setFormData({...formData, estadoDisponibilidad: 'parcial'})}
                      >
                        <View style={[styles.estadoCircle, { backgroundColor: '#FAAD14' }]}>
                          <Ionicons name="alert" size={16} color="white" />
                        </View>
                        <Text style={styles.estadoText}>Parcial</Text>
                        <Text style={styles.estadoDesc}>Con limitaciones</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[
                          styles.estadoOption,
                          formData.estadoDisponibilidad === 'no_disponible' && styles.estadoOptionSelected,
                          { borderColor: '#FF4D4F' }
                        ]}
                        onPress={() => setFormData({...formData, estadoDisponibilidad: 'no_disponible'})}
                      >
                        <View style={[styles.estadoCircle, { backgroundColor: '#FF4D4F' }]}>
                          <Ionicons name="close" size={16} color="white" />
                        </View>
                        <Text style={styles.estadoText}>No Disponible</Text>
                        <Text style={styles.estadoDesc}>Fuera de servicio</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {formData.estadoDisponibilidad !== 'disponible' && (
                      <>
                        <Text style={styles.inputLabel}>Motivo</Text>
                        <TextInput
                          style={styles.input}
                          value={formData.motivo}
                          onChangeText={(text) => setFormData({...formData, motivo: text})}
                          placeholder={formData.estadoDisponibilidad === 'parcial' ? 
                            "Describa el problema" : 
                            "Ingrese el motivo por el cual no está disponible"}
                          multiline={true}
                          numberOfLines={2}
                        />
                        
                        {formData.estadoDisponibilidad === 'parcial' && (
                          <>
                            <Text style={styles.inputLabel}>Limitaciones</Text>
                            <TextInput
                              style={styles.input}
                              value={formData.limitaciones}
                              onChangeText={(text) => setFormData({...formData, limitaciones: text})}
                              placeholder="Especifique las limitaciones de operación"
                              multiline={true}
                              numberOfLines={2}
                            />
                          </>
                        )}
                        
                        <Text style={styles.inputLabel}>Fecha estimada de reparación</Text>
                        <TextInput
                          style={styles.input}
                          value={formData.estimacionFinalizacion}
                          onChangeText={(text) => setFormData({...formData, estimacionFinalizacion: text})}
                          placeholder="YYYY-MM-DD"
                        />
                      </>
                    )}
                    
                    <TouchableOpacity 
                      style={styles.submitButton}
                      onPress={handleSave}
                      disabled={loadingAction}
                    >
                      {loadingAction ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.submitButtonText}>Guardar Cambios</Text>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}
        </View>
      );
    };
    
    const styles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
      },
      loadingText: {
        marginTop: 10,
        color: '#666',
      },
      overlayLoading: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        zIndex: 10,
      },
      header: {
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        paddingTop: 50, // Ajustar según necesidades de espacio superior
      },
      headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      },
      refreshButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
      },
      title: {
        fontSize: 20,
        fontWeight: 'bold',
      },
      filtrosContainer: {
        flexDirection: 'row',
        marginTop: 8,
        flexWrap: 'wrap',
      },
      filtroButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: '#F0F0F0',
      },
      filtroActivo: {
        backgroundColor: '#1890FF',
      },
      filtroText: {
        fontWeight: '500',
        color: '#666',
      },
      filtroTextoActivo: {
        color: 'white',
      },
      errorContainer: {
        margin: 16,
        padding: 12,
        backgroundColor: '#FFF1F0',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFA39E',
      },
      errorText: {
        color: '#F5222D',
        marginBottom: 8,
      },
      reloadButton: {
        alignSelf: 'flex-end',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#1890FF',
        borderRadius: 4,
      },
      reloadButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
      },
      listaContainer: {
        padding: 16,
      },
      camionItem: {
        backgroundColor: '#FFF',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      camionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      },
      camionNumero: {
        fontSize: 18,
        fontWeight: 'bold',
      },
      camionModelo: {
        color: '#666',
        marginBottom: 8,
      },
      disponibilidadBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
      },
      estadoIcon: {
        marginRight: 4,
      },
      disponibilidadText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
      },
      infoNoDisponible: {
        backgroundColor: '#FFF7E6',
        padding: 12,
        borderRadius: 4,
        marginVertical: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#FFA940',
      },
      motivoText: {
        marginBottom: 4,
      },
      limitacionesText: {
        marginBottom: 4,
        color: '#d48806',
      },
      estimacionText: {
        fontWeight: '500',
      },
      camionLabel: {
        fontWeight: 'bold',
        color: '#666',
      },
      camionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
      },
      actualizacionText: {
        fontSize: 12,
        color: '#999',
      },
      editarButton: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      editarButtonText: {
        color: '#1890FF',
        marginLeft: 4,
      },
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
        maxHeight: '80%',
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
      formContainer: {
        padding: 16,
      },
      sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 16,
      },
      estadoOptions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
      },
      estadoOption: {
        width: '31%',
        borderWidth: 2,
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: '#E8E8E8',
      },
      estadoOptionSelected: {
        backgroundColor: '#F6FFED',
      },
      estadoCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
      },
      estadoText: {
        fontWeight: 'bold',
        marginBottom: 4,
      },
      estadoDesc: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
      },
      inputLabel: {
        fontWeight: 'bold',
        marginBottom: 4,
        marginTop: 16,
      },
      input: {
        borderWidth: 1,
        borderColor: '#CCCCCC',
        borderRadius: 4,
        padding: 10,
        marginBottom: 12,
        minHeight: 40,
        textAlignVertical: 'top',
      },
      submitButton: {
        backgroundColor: '#1890FF',
        padding: 14,
        borderRadius: 6,
        alignItems: 'center',
        marginTop: 24,
      },
      submitButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
      },
      emptyList: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      },
      emptyText: {
        fontSize: 16,
        color: '#999',
      },
    });
    
    export default DisponibilidadScreen;