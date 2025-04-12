import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Firebase imports
import firebaseApp from "../firebase/credenciales";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
  limit,
  onSnapshot
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const InventarioScreen = ({ navigation, route }) => {
  // Estado para los repuestos e insumos
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [historialModalVisible, setHistorialModalVisible] = useState(false);
  const [itemSeleccionado, setItemSeleccionado] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    nombre: '',
    codigo: '',
    cantidad: '',
    minimo: '',
    categoria: '',
    ubicacion: '',
    proveedor: '',
    unidad: ''
  });
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Estados para historial de mantenimientos
  const [historialMantenimientos, setHistorialMantenimientos] = useState([]);
  const [camiones, setCamiones] = useState([]);
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false);

  // Verificar si se está accediendo desde MantencionScreen
  useEffect(() => {
    if (route.params?.seleccionarRepuestos && route.params?.mantenimientoId) {
      // Implementar lógica para seleccionar repuestos para un mantenimiento
      console.log("Seleccionando repuestos para mantenimiento:", route.params.mantenimientoId);
    }
  }, [route.params]);

  // Configurar listener para actualizaciones en tiempo real del inventario
  useEffect(() => {
    setIsLoading(true);
    setErrorMsg(null);
    
    // Crear query para obtener inventario ordenado por nombre
    const inventarioRef = collection(firestore, 'repuestos');
    const q = query(inventarioRef, orderBy('nombre', 'asc'));
    
    // Establecer listener para cambios en tiempo real
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const inventarioData = [];
        snapshot.forEach((doc) => {
          inventarioData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        setInventario(inventarioData);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error al escuchar cambios en inventario:", error);
        setErrorMsg("Error al obtener datos en tiempo real. Intente nuevamente.");
        setIsLoading(false);
      }
    );
    
    // Limpiar listener al desmontar componente
    return () => unsubscribe();
  }, []);

  // Filtrar inventario según término de búsqueda
  const inventarioFiltrado = inventario.filter(item => 
    item.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.categoria?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Función para abrir el formulario para agregar un nuevo ítem
  const handleAddItem = () => {
    setEditMode(false);
    setFormData({
      id: '',
      nombre: '',
      codigo: '',
      cantidad: '',
      minimo: '',
      categoria: '',
      ubicacion: '',
      proveedor: '',
      unidad: ''
    });
    setModalVisible(true);
  };

  // Función para abrir el formulario para editar un ítem existente
  const handleEditItem = (item) => {
    setEditMode(true);
    setFormData({
      id: item.id,
      nombre: item.nombre || '',
      codigo: item.codigo || '',
      cantidad: (item.cantidad || 0).toString(),
      minimo: (item.minimo || 0).toString(),
      categoria: item.categoria || '',
      ubicacion: item.ubicacion || '',
      proveedor: item.proveedor || '',
      unidad: item.unidad || ''
    });
    setModalVisible(true);
  };

  // Función para eliminar un ítem
  const handleDeleteItem = (id) => {
    Alert.alert(
      "Confirmar eliminación",
      "¿Está seguro que desea eliminar este elemento? Esta acción no se puede deshacer.",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Eliminar de Firestore
              await deleteDoc(doc(firestore, 'repuestos', id));
              
              // No es necesario actualizar el estado local porque el listener lo hará automáticamente
              setIsLoading(false);
              Alert.alert("Éxito", "Elemento eliminado correctamente");
            } catch (error) {
              console.error("Error al eliminar:", error);
              setIsLoading(false);
              Alert.alert("Error", "No se pudo eliminar el elemento. Intente nuevamente.");
            }
          }
        }
      ]
    );
  };

  // Función para guardar un nuevo ítem o actualizar uno existente
  const handleSaveItem = async () => {
    // Validación básica
    if (!formData.nombre || !formData.codigo || !formData.cantidad) {
      Alert.alert('Error', 'Por favor complete los campos obligatorios');
      return;
    }

    try {
      setIsLoading(true);
      
      // Datos a guardar
      const itemData = {
        nombre: formData.nombre,
        codigo: formData.codigo,
        cantidad: parseInt(formData.cantidad) || 0,
        minimo: parseInt(formData.minimo) || 0,
        categoria: formData.categoria || '',
        ubicacion: formData.ubicacion || '',
        proveedor: formData.proveedor || '',
        unidad: formData.unidad || '',
        fechaActualizacion: serverTimestamp()
      };

      if (editMode) {
        // Actualizar ítem existente
        const itemRef = doc(firestore, 'repuestos', formData.id);
        await updateDoc(itemRef, itemData);
        
        // No es necesario actualizar el estado local porque el listener lo hará automáticamente
        Alert.alert("Éxito", "Elemento actualizado correctamente");
      } else {
        // Agregar nuevo ítem
        itemData.fechaCreacion = serverTimestamp();
        itemData.stock = parseInt(formData.cantidad) || 0;
        
        await addDoc(collection(firestore, 'repuestos'), itemData);
        
        // No es necesario actualizar el estado local porque el listener lo hará automáticamente
        Alert.alert("Éxito", "Elemento agregado correctamente");
      }

      setModalVisible(false);
      setIsLoading(false);
    } catch (error) {
      console.error("Error al guardar:", error);
      setIsLoading(false);
      Alert.alert("Error", "No se pudo guardar el elemento. Intente nuevamente.");
    }
  };

  // Función para actualizar la cantidad de un ítem
  const actualizarCantidadItem = async (item, cantidad) => {
    try {
      setIsLoading(true);
      
      // No permitir cantidades negativas
      const nuevaCantidad = Math.max(0, cantidad);
      
      // Actualizar en Firestore
      const itemRef = doc(firestore, 'repuestos', item.id);
      await updateDoc(itemRef, {
        cantidad: nuevaCantidad,
        stock: nuevaCantidad,
        fechaActualizacion: serverTimestamp()
      });
      
      // No es necesario actualizar el estado local porque el listener lo hará automáticamente
      setIsLoading(false);
    } catch (error) {
      console.error("Error al actualizar cantidad:", error);
      setIsLoading(false);
      Alert.alert("Error", "No se pudo actualizar la cantidad. Intente nuevamente.");
    }
  };

  // Función para descontar unidades
  const handleDescontarItem = (item) => {
    if (item.cantidad > 0) {
      actualizarCantidadItem(item, item.cantidad - 1);
    } else {
      Alert.alert('Error', 'No hay unidades disponibles para descontar');
    }
  };

  // Función para agregar unidades
  const handleAgregarItem = (item) => {
    actualizarCantidadItem(item, item.cantidad + 1);
  };

  // Función para recarga manual (por si acaso)
  const recargarDatos = () => {
    setIsLoading(true);
    setErrorMsg(null);
    
    // La actualización se hará automáticamente por el listener onSnapshot
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  // Nueva función para ver historial de uso de un producto
  const handleVerHistorial = async (item) => {
    setItemSeleccionado(item);
    setHistorialModalVisible(true);
    
    try {
      setIsLoadingHistorial(true);
      
      // Configurar listener para mantenimientos en tiempo real
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      
      // Obtener todos los mantenimientos y filtrar los que usan este repuesto
      const mantenimientosSnap = await getDocs(mantenimientosRef);
      
      const mantenimientosData = [];
      mantenimientosSnap.forEach((doc) => {
        const data = doc.data();
        // Verificar si este mantenimiento usó el repuesto seleccionado
        const usaRepuesto = data.repuestos && data.repuestos.some(r => r.id === item.id);
        
        if (usaRepuesto) {
          mantenimientosData.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      setHistorialMantenimientos(mantenimientosData);
      
      // Cargar datos de equipos para mostrar información completa
      const equiposRef = collection(firestore, 'equipos');
      const equiposSnap = await getDocs(equiposRef);
      
      const equiposData = [];
      equiposSnap.forEach((doc) => {
        equiposData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setCamiones(equiposData);
      
      setIsLoadingHistorial(false);
    } catch (error) {
      console.error("Error al cargar historial:", error);
      setIsLoadingHistorial(false);
      Alert.alert("Error", "No se pudo cargar el historial. Intente nuevamente.");
    }
  };

  // Función para obtener nombre de equipo por ID
  const obtenerNombreEquipo = (equipoId) => {
    const equipo = camiones.find(e => e.id === equipoId);
    return equipo ? `Camión #${equipo.numero} - ${equipo.modelo || ''}` : "Equipo desconocido";
  };

  // Filtrar historial por producto seleccionado y formatear
  const obtenerHistorialProducto = () => {
    if (!itemSeleccionado || !historialMantenimientos.length) return [];
    
    const registros = [];
    historialMantenimientos.forEach(mantenimiento => {
      if (mantenimiento.repuestos && mantenimiento.repuestos.length > 0) {
        mantenimiento.repuestos.forEach(repuesto => {
          if (repuesto.id === itemSeleccionado.id) {
            registros.push({
              fecha: mantenimiento.fecha || 'Fecha desconocida',
              camionId: mantenimiento.equipoId,
              cantidad: repuesto.cantidad || 1,
              descripcion: mantenimiento.descripcion || 'Sin descripción',
              mantenimientoId: mantenimiento.id,
              kilometraje: mantenimiento.kilometraje || 0,
              tipo: mantenimiento.tipo || 'Sin tipo'
            });
          }
        });
      }
    });
    
    return registros;
  };

  // Calcular total utilizado del producto seleccionado
  const calcularTotalUtilizado = () => {
    if (!itemSeleccionado || !historialMantenimientos.length) return 0;
    
    let total = 0;
    historialMantenimientos.forEach(mantenimiento => {
      if (mantenimiento.repuestos && mantenimiento.repuestos.length > 0) {
        mantenimiento.repuestos.forEach(repuesto => {
          if (repuesto.id === itemSeleccionado.id) {
            total += repuesto.cantidad || 1;
          }
        });
      }
    });
    
    return total;
  };

  // Renderizado de un ítem del inventario
  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemNombre}>{item.nombre}</Text>
        <Text style={styles.itemCodigo}>{item.codigo}</Text>
      </View>
      
      <View style={styles.itemDetalles}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemLabel}>Categoría:</Text>
          <Text>{item.categoria || 'No especificada'}</Text>
        </View>
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemLabel}>Ubicación:</Text>
          <Text>{item.ubicacion || 'No especificada'}</Text>
        </View>
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemLabel}>Proveedor:</Text>
          <Text>{item.proveedor || 'No especificado'}</Text>
        </View>

        {item.unidad && (
          <View style={styles.itemInfo}>
            <Text style={styles.itemLabel}>Unidad:</Text>
            <Text>{item.unidad}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.itemFooter}>
        <View style={styles.cantidadContainer}>
          <Text style={styles.itemLabel}>Cantidad:</Text>
          <View style={styles.cantidadWrapper}>
            <TouchableOpacity 
              style={styles.cantidadBtn}
              onPress={() => handleDescontarItem(item)}
              disabled={isLoading}
            >
              <Ionicons name="remove" size={18} color="#FF4D4F" />
            </TouchableOpacity>
            
            <Text style={[
              styles.cantidadText, 
              item.cantidad < item.minimo && styles.cantidadBaja
            ]}>
              {item.cantidad}
            </Text>
            
            <TouchableOpacity 
              style={styles.cantidadBtn}
              onPress={() => handleAgregarItem(item)}
              disabled={isLoading}
            >
              <Ionicons name="add" size={18} color="#52C41A" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.botonesContainer}>
          <TouchableOpacity 
            style={styles.editarBtn}
            onPress={() => handleEditItem(item)}
            disabled={isLoading}
          >
            <Ionicons name="create-outline" size={18} color="#1890FF" />
            <Text style={styles.editarBtnText}>Editar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.historialBtn}
            onPress={() => handleVerHistorial(item)}
            disabled={isLoading}
          >
            <Ionicons name="time-outline" size={18} color="#722ED1" />
            <Text style={styles.historialBtnText}>Historial</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.eliminarBtn}
            onPress={() => handleDeleteItem(item.id)}
            disabled={isLoading}
          >
            <Ionicons name="trash-outline" size={18} color="#FF4D4F" />
            <Text style={styles.eliminarBtnText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {item.cantidad < item.minimo && (
        <View style={styles.alertaContainer}>
          <Ionicons name="warning-outline" size={16} color="#FF4D4F" />
          <Text style={styles.alertaText}>
            Stock bajo el mínimo recomendado ({item.minimo})
          </Text>
        </View>
      )}
      
      {/* Para la integración con MantencionScreen */}
      {route.params?.seleccionarRepuestos && (
        <TouchableOpacity 
          style={[
            styles.seleccionarBtn,
            item.cantidad <= 0 && styles.seleccionarBtnDisabled
          ]}
          onPress={() => {
            if (item.cantidad > 0) {
              // Implementar la lógica para añadir este repuesto al mantenimiento
              // Y volver a la pantalla de mantenimiento
              navigation.navigate('MantencionScreen', {
                mantenimientoId: route.params.mantenimientoId,
                repuestoSeleccionado: {
                  id: item.id,
                  nombre: item.nombre,
                  cantidad: 1,
                  stock: item.cantidad
                }
              });
            } else {
              Alert.alert('Error', 'No hay stock disponible');
            }
          }}
          disabled={item.cantidad <= 0 || isLoading}
        >
          <Ionicons name="add-circle" size={20} color={item.cantidad > 0 ? "white" : "#CCCCCC"} />
          <Text style={styles.seleccionarBtnText}>
            {item.cantidad > 0 ? 'Seleccionar' : 'Sin stock'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading && inventario.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890FF" />
        <Text style={styles.loadingText}>Cargando inventario...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.overlayLoading}>
          <ActivityIndicator size="large" color="#1890FF" />
        </View>
      )}
      
      <View style={styles.header}>
        <Text style={styles.title}>
          {route.params?.seleccionarRepuestos 
            ? 'Seleccionar Repuestos' 
            : 'Inventario'}
        </Text>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar repuesto o insumo..."
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
      </View>
      
      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity 
            style={styles.reloadButton}
            onPress={recargarDatos}
          >
            <Text style={styles.reloadButtonText}>Recargar</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <FlatList
        data={inventarioFiltrado}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listaContainer}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>No se encontraron items</Text>
          </View>
        }
      />
      
      {!route.params?.seleccionarRepuestos && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddItem}
          disabled={isLoading}
        >
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      )}
      
      {/* Modal para agregar o editar ítem */}
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
                {editMode ? 'Editar Ítem' : 'Agregar Nuevo Ítem'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formContainer}>
              <Text style={styles.inputLabel}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={formData.nombre}
                onChangeText={(text) => setFormData({...formData, nombre: text})}
                placeholder="Nombre del repuesto o insumo"
              />
              
              <Text style={styles.inputLabel}>Código *</Text>
              <TextInput
                style={styles.input}
                value={formData.codigo}
                onChangeText={(text) => setFormData({...formData, codigo: text})}
                placeholder="Código de referencia"
              />
              
              <Text style={styles.inputLabel}>Cantidad *</Text>
              <TextInput
                style={styles.input}
                value={formData.cantidad}
                onChangeText={(text) => setFormData({...formData, cantidad: text})}
                placeholder="Cantidad disponible"
                keyboardType="numeric"
              />
              
              <Text style={styles.inputLabel}>Cantidad Mínima</Text>
              <TextInput
                style={styles.input}
                value={formData.minimo}
                onChangeText={(text) => setFormData({...formData, minimo: text})}
                placeholder="Cantidad mínima recomendada"
                keyboardType="numeric"
              />
              
              <Text style={styles.inputLabel}>Unidad</Text>
              <TextInput
                style={styles.input}
                value={formData.unidad}
                onChangeText={(text) => setFormData({...formData, unidad: text})}
                placeholder="Unidad (litros, unidades, etc.)"
              />
              
              <Text style={styles.inputLabel}>Categoría</Text>
              <TextInput
                style={styles.input}
                value={formData.categoria}
                onChangeText={(text) => setFormData({...formData, categoria: text})}
                placeholder="Categoría del ítem"
              />
              
              <Text style={styles.inputLabel}>Ubicación</Text>
              <TextInput
                style={styles.input}
                value={formData.ubicacion}
                onChangeText={(text) => setFormData({...formData, ubicacion: text})}
                placeholder="Ubicación en almacén"
              />
              
              <Text style={styles.inputLabel}>Proveedor</Text>
              <TextInput
                style={styles.input}
                value={formData.proveedor}
                onChangeText={(text) => setFormData({...formData, proveedor: text})}
                placeholder="Proveedor"
              />
              
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleSaveItem}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editMode ? 'Actualizar' : 'Guardar'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Modal para mostrar historial de uso */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={historialModalVisible}
        onRequestClose={() => setHistorialModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Historial de Uso: {itemSeleccionado ? itemSeleccionado.nombre : ''}
              </Text>
              <TouchableOpacity onPress={() => setHistorialModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            {isLoadingHistorial ? (
              <View style={styles.loadingHistorial}>
                <ActivityIndicator size="large" color="#1890FF" />
                <Text style={styles.loadingText}>Cargando historial...</Text>
              </View>
            ) : itemSeleccionado && (
              <ScrollView style={styles.historialContainer}>
                <View style={styles.historialInfo}>
                  <Text style={styles.historialLabel}>
                    Total utilizado: {calcularTotalUtilizado()} {itemSeleccionado.unidad || 'unidades'}
                  </Text>
                  <Text style={styles.historialLabel}>
                    Disponible actualmente: {itemSeleccionado.cantidad} {itemSeleccionado.unidad || 'unidades'}
                  </Text>
                </View>
                
                {obtenerHistorialProducto().length > 0 ? (
                  obtenerHistorialProducto()
                    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                    .map((registro, index) => (
                    <View key={`${registro.mantenimientoId}-${index}`} style={styles.registroItem}>
                      <View style={styles.registroHeader}>
                        <Text style={styles.registroFecha}>{registro.fecha}</Text>
                        <Text style={styles.registroCantidad}>
                          {registro.cantidad} {itemSeleccionado.unidad || 'unidades'}
                        </Text>
                      </View>
                      
                      <View style={styles.registroInfo}>
                        <View style={styles.registroInfoItem}>
                          <Text style={styles.registroInfoLabel}>Equipo:</Text>
                          <Text style={styles.registroInfoText}>
                            {obtenerNombreEquipo(registro.camionId)}
                          </Text>
                        </View>
                        
                        <View style={styles.registroInfoItem}>
                          <Text style={styles.registroInfoLabel}>Tipo:</Text>
                          <Text style={[
                            styles.registroInfoText,
                            {
                              color: registro.tipo === 'preventivo' ? '#52C41A' : '#1890FF'
                            }
                          ]}>
                            {registro.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'}
                          </Text>
                        </View>
                        
                        <View style={styles.registroInfoItem}>
                          <Text style={styles.registroInfoLabel}>Kilometraje:</Text>
                          <Text style={styles.registroInfoText}>
                            {registro.kilometraje ? registro.kilometraje.toLocaleString() + ' km' : 'No registrado'}
                          </Text>
                        </View>
                        
                        <View style={styles.registroInfoItem}>
                          <Text style={styles.registroInfoLabel}>Descripción:</Text>
                          <Text style={styles.registroInfoText}>{registro.descripcion || 'Sin descripción'}</Text>
                        </View>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.verMantenimientoBtn}
                        onPress={() => {
                          setHistorialModalVisible(false);
                          navigation.navigate('MantencionScreen', { 
                            mantenimientoId: registro.mantenimientoId 
                          });
                        }}
                      >
                        <Text style={styles.verMantenimientoBtnText}>Ver mantenimiento</Text>
                        <Ionicons name="chevron-forward" size={16} color="#1890FF" />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyHistorial}>
                    <Text style={styles.emptyHistorialText}>
                      No hay registros de uso para este producto
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: 50, // Ajustar según necesidades de espacio superior
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  listaContainer: {
    padding: 16,
  },
  itemContainer: {
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNombre: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  itemCodigo: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  itemDetalles: {
    marginVertical: 8,
  },
  itemInfo: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  itemLabel: {
    fontWeight: 'bold',
    marginRight: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  cantidadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cantidadWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  cantidadBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cantidadText: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cantidadBaja: {
    color: '#FF4D4F',
  },
  botonesContainer: {
    flexDirection: 'row',
  },
  editarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  editarBtnText: {
    color: '#1890FF',
    marginLeft: 4,
  },
  historialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  historialBtnText: {
    color: '#722ED1',
    marginLeft: 4,
  },
  eliminarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eliminarBtnText: {
    color: '#FF4D4F',
    marginLeft: 4,
  },
  alertaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F0',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  alertaText: {
    color: '#FF4D4F',
    marginLeft: 4,
    fontSize: 12,
  },
  seleccionarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1890FF',
    padding: 10,
    borderRadius: 6,
    marginTop: 12,
  },
  seleccionarBtnDisabled: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D9D9D9',
  },
  seleccionarBtnText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    backgroundColor: '#1890FF',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
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
  },
  formContainer: {
    padding: 16,
  },
  inputLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: '#1890FF',
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
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
  
  // Estilos para el modal de historial
  historialContainer: {
    padding: 16,
  },
  loadingHistorial: {
    padding: 40,
    alignItems: 'center',
  },
  historialInfo: {
    backgroundColor: '#E6F7FF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  historialLabel: {
    fontSize: 15,
    marginBottom: 6,
    fontWeight: '500',
  },
  registroItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1890FF',
  },
  registroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  registroFecha: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  registroCantidad: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#1890FF',
  },
  registroInfo: {
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    paddingTop: 8,
    marginBottom: 8,
  },
  registroInfoItem: {
    flexDirection: 'row',
    marginTop: 4,
  },
  registroInfoLabel: {
    fontWeight: 'bold',
    marginRight: 4,
    width: 85,
  },
  registroInfoText: {
    flex: 1,
  },
  verMantenimientoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  verMantenimientoBtnText: {
    color: '#1890FF',
    marginRight: 4,
  },
  emptyHistorial: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyHistorialText: {
    fontSize: 15,
    color: '#999',
  }
});

export default InventarioScreen;