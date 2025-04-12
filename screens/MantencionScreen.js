import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

// Firebase imports
import firebaseApp from "../firebase/credenciales";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  where
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const MantencionScreen = ({ navigation, route }) => {
  // Estados para la gestión de mantenimientos
  const [mantenimientos, setMantenimientos] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalRepuestosVisible, setModalRepuestosVisible] = useState(false);
  const [equipos, setEquipos] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [repuestosSeleccionados, setRepuestosSeleccionados] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Estado para el formulario
  const [formData, setFormData] = useState({
    equipo: '',
    tipo: 'preventivo',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    estado: 'pendiente',
    kilometraje: '',
    mecanico: '',
    repuestos: []
  });

  // Verificar si se está accediendo desde EquiposScreen
  useEffect(() => {
    if (route.params?.equipoId && route.params?.equipoNumero) {
      const equipoSeleccionado = {
        id: route.params.equipoId,
        numero: route.params.equipoNumero,
        kilometraje: route.params.kilometraje || '0'
      };
      
      setFormData(prev => ({
        ...prev,
        equipo: `Camión #${equipoSeleccionado.numero}`,
        equipoId: equipoSeleccionado.id,
        kilometraje: equipoSeleccionado.kilometraje.toString()
      }));
      
      // Abrir automáticamente el modal de nuevo mantenimiento
      setModalVisible(true);
    }
  }, [route.params]);

  // Cargar datos desde Firebase
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        
        // Obtener el usuario actual para usar como mecánico por defecto
        const currentUser = auth.currentUser;
        let nombreMecanico = 'Usuario sin identificar';
        
        if (currentUser) {
          // Intentar obtener el nombre del usuario desde Firestore
          try {
            const docRef = doc(firestore, `usuarios/${currentUser.uid}`);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              const userData = docSnap.data();
              nombreMecanico = userData.nombre || currentUser.email;
            } else {
              nombreMecanico = currentUser.email;
            }
          } catch (error) {
            console.error("Error al obtener datos del usuario:", error);
            nombreMecanico = currentUser.email;
          }
        }
        
        // Actualizar el formulario con el mecánico actual
        setFormData(prev => ({
          ...prev,
          mecanico: nombreMecanico
        }));
        
        // 1. Cargar mantenimientos
        const mantenimientosRef = collection(firestore, 'mantenimientos');
        const q = query(mantenimientosRef, orderBy('fecha', 'desc'));
        const mantenimientosSnap = await getDocs(q);
        
        const mantenimientosData = [];
        mantenimientosSnap.forEach((docSnap) => {
          const data = docSnap.data();
          mantenimientosData.push({
            id: docSnap.id,
            ...data,
            fecha: data.fecha ? data.fecha : new Date().toISOString().split('T')[0]
          });
        });
        
        setMantenimientos(mantenimientosData);
        
        // 2. Cargar equipos
        const equiposRef = collection(firestore, 'equipos');
        const equiposSnap = await getDocs(equiposRef);
        
        const equiposData = [];
        equiposSnap.forEach((docSnap) => {
          equiposData.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        
        setEquipos(equiposData);
        
        // 3. Cargar repuestos
        const repuestosRef = collection(firestore, 'repuestos');
        const repuestosSnap = await getDocs(repuestosRef);
        
        const repuestosData = [];
        repuestosSnap.forEach((docSnap) => {
          repuestosData.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        
        setRepuestos(repuestosData);
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error al cargar datos:", error);
        setErrorMsg("Error al cargar datos. Intente nuevamente.");
        setIsLoading(false);
      }
    };

    cargarDatos();
  }, []);

  // Filtrar mantenimientos según el tipo seleccionado
  const mantenimientosFiltrados = filtroTipo === 'todos' 
    ? mantenimientos 
    : mantenimientos.filter(m => m.tipo === filtroTipo);

  // Función para agregar un nuevo mantenimiento
  const handleAddMantenimiento = async () => {
    // Validar campos
    if (!formData.equipo || !formData.descripcion) {
      Alert.alert('Error', 'Por favor complete los campos obligatorios');
      return;
    }

    try {
      setIsLoading(true);
      
      // Crear nuevo mantenimiento
      const nuevoMantenimiento = {
        ...formData,
        kilometraje: parseInt(formData.kilometraje) || 0,
        repuestos: repuestosSeleccionados,
        equipoId: formData.equipoId, // Asegúrate de que este campo exista
        fechaCreacion: serverTimestamp(),
        fechaActualizacion: serverTimestamp()
      };  

      // Agregar a Firestore
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const docRef = await addDoc(mantenimientosRef, nuevoMantenimiento);

      // Actualizar estado local
      setMantenimientos([{
        id: docRef.id,
        ...nuevoMantenimiento,
        fecha: nuevoMantenimiento.fecha
      }, ...mantenimientos]);

      // Si hay repuestos seleccionados, actualizar su stock
      if (repuestosSeleccionados.length > 0) {
        for (const repuesto of repuestosSeleccionados) {
          const repuestoRef = doc(firestore, 'repuestos', repuesto.id);
          const repuestoDoc = await getDoc(repuestoRef);
          
          if (repuestoDoc.exists()) {
            const repuestoData = repuestoDoc.data();
            const nuevoStock = Math.max(0, (repuestoData.stock || 0) - repuesto.cantidad);
            
            await updateDoc(repuestoRef, {
              stock: nuevoStock,
              fechaActualizacion: serverTimestamp()
            });
          }
        }
        
        // Actualizar la lista de repuestos local
        const repuestosRef = collection(firestore, 'repuestos');
        const repuestosSnap = await getDocs(repuestosRef);
        
        const repuestosData = [];
        repuestosSnap.forEach((docSnap) => {
          repuestosData.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        
        setRepuestos(repuestosData);
      }
      
      // Actualizar el kilometraje del equipo si es necesario
      if (formData.equipoId) {
        const equipoRef = doc(firestore, 'equipos', formData.equipoId);
        const equipoDoc = await getDoc(equipoRef);
        
        if (equipoDoc.exists()) {
          await updateDoc(equipoRef, {
            kilometraje: parseInt(formData.kilometraje) || 0,
            ultimoMantenimiento: nuevoMantenimiento.fecha,
            fechaActualizacion: serverTimestamp()
          });
        }
      }
      
      setModalVisible(false);
      
      // Reiniciar el formulario
      setFormData({
        equipo: '',
        tipo: 'preventivo',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
        estado: 'pendiente',
        kilometraje: '',
        mecanico: formData.mecanico, // Mantener el mecánico actual
        repuestos: []
      });
      
      setRepuestosSeleccionados([]);
      setIsLoading(false);
      
      Alert.alert('Éxito', 'Mantenimiento registrado correctamente');
    } catch (error) {
      console.error("Error al registrar mantenimiento:", error);
      setIsLoading(false);
      Alert.alert('Error', 'No se pudo registrar el mantenimiento. Intente nuevamente.');
    }
  };

  // Función para agregar repuestos al mantenimiento
  const handleAddRepuesto = (id, nombre, stockActual) => {
    // Verificar si ya está en la lista
    const existente = repuestosSeleccionados.find(r => r.id === id);
    
    if (existente) {
      // Verificar stock antes de aumentar la cantidad
      if (existente.cantidad >= stockActual) {
        Alert.alert('Error', `No hay suficiente stock de ${nombre}. Disponible: ${stockActual}`);
        return;
      }
      
      // Actualizar cantidad
      const actualizados = repuestosSeleccionados.map(r => 
        r.id === id ? { ...r, cantidad: r.cantidad + 1 } : r
      );
      setRepuestosSeleccionados(actualizados);
    } else {
      // Verificar que haya stock
      if (stockActual <= 0) {
        Alert.alert('Error', `No hay stock disponible de ${nombre}`);
        return;
      }
      
      // Agregar nuevo
      setRepuestosSeleccionados([
        ...repuestosSeleccionados,
        { id, nombre, cantidad: 1 }
      ]);
    }
  };

  // Función para eliminar un repuesto
  const handleRemoveRepuesto = (id) => {
    const actualizados = repuestosSeleccionados.filter(r => r.id !== id);
    setRepuestosSeleccionados(actualizados);
  };

  // Función para cambiar el estado de un mantenimiento
  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      setIsLoading(true);
      
      // Actualizar en Firestore
      const mantenimientoRef = doc(firestore, 'mantenimientos', id);
      const mantenimientoDoc = await getDoc(mantenimientoRef);
      
      if (!mantenimientoDoc.exists()) {
        throw new Error("El mantenimiento no existe");
      }
      
      const mantenimientoData = mantenimientoDoc.data();
      
      await updateDoc(mantenimientoRef, {
        estado: nuevoEstado,
        fechaActualizacion: serverTimestamp(),
        fechaCompletado: nuevoEstado === 'completado' ? new Date().toISOString().split('T')[0] : null
      });
      
      // Si se completó el mantenimiento, actualizar el equipo
      if (nuevoEstado === 'completado' && mantenimientoData.equipoId) {
        const equipoRef = doc(firestore, 'equipos', mantenimientoData.equipoId);
        await updateDoc(equipoRef, {
          ultimoMantenimiento: new Date().toISOString().split('T')[0],
          proximoMantenimiento: calcularProximoMantenimiento(new Date(), mantenimientoData.tipo),
          estadoMantenimiento: 'bueno',
          fechaActualizacion: serverTimestamp()
        });
      }
      
      // Actualizar estado local
      const mantenimientosActualizados = mantenimientos.map(m => 
        m.id === id ? { 
          ...m, 
          estado: nuevoEstado,
          fechaCompletado: nuevoEstado === 'completado' ? new Date().toISOString().split('T')[0] : null
        } : m
      );
      
      setMantenimientos(mantenimientosActualizados);
      setIsLoading(false);
      
      Alert.alert('Éxito', `Estado actualizado a ${nuevoEstado === 'pendiente' ? 'Pendiente' : nuevoEstado === 'en_proceso' ? 'En Proceso' : 'Completado'}`);
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      setIsLoading(false);
      Alert.alert('Error', 'No se pudo actualizar el estado. Intente nuevamente.');
    }
  };
  
  // Función para calcular la fecha del próximo mantenimiento
  const calcularProximoMantenimiento = (fechaActual, tipoMantenimiento) => {
    const fecha = new Date(fechaActual);
    // Si es preventivo, programar para 3 meses después
    // Si es correctivo, programar para 1 mes después (revisión)
    const mesesAdicionales = tipoMantenimiento === 'preventivo' ? 3 : 1;
    fecha.setMonth(fecha.getMonth() + mesesAdicionales);
    return fecha.toISOString().split('T')[0];
  };

  // Función para ver el historial de mantenimientos de un equipo
  const verHistorialEquipo = (equipoId) => {
    navigation.navigate('HistorialMantenimiento', { equipoId });
  };

  // Renderizado de un ítem de mantenimiento
  const renderItem = ({ item }) => (
    <View style={styles.mantenimientoItem}>
      <View style={styles.mantenimientoHeader}>
        <Text style={styles.mantenimientoEquipo}>{item.equipo}</Text>
        <View style={[
          styles.estadoBadge,
          { 
            backgroundColor: 
              item.estado === 'pendiente' ? '#FFA940' :
              item.estado === 'en_proceso' ? '#1890FF' : '#52C41A'
          }
        ]}>
          <Text style={styles.estadoText}>
            {item.estado === 'pendiente' ? 'Pendiente' :
             item.estado === 'en_proceso' ? 'En Proceso' : 'Completado'}
          </Text>
        </View>
      </View>
      
      <View style={styles.mantenimientoInfo}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Tipo:</Text>
            <Text style={[
              styles.tipoText,
              { color: item.tipo === 'preventivo' ? '#52C41A' : '#1890FF' }
            ]}>
              {item.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'}
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Fecha:</Text>
            <Text>{item.fecha}</Text>
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Kilometraje:</Text>
            <Text>{item.kilometraje ? item.kilometraje.toLocaleString() : '0'} km</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Mecánico:</Text>
            <Text>{item.mecanico}</Text>
          </View>
        </View>
        
        <Text style={styles.infoLabel}>Descripción:</Text>
        <Text style={styles.descripcionText}>{item.descripcion}</Text>
        
        <Text style={styles.infoLabel}>Repuestos utilizados:</Text>
        {item.repuestos && item.repuestos.length > 0 ? (
          item.repuestos.map((repuesto, index) => (
            <Text key={index} style={styles.repuestoItem}>
              • {repuesto.nombre} (x{repuesto.cantidad})
            </Text>
          ))
        ) : (
          <Text style={styles.noRepuestos}>No se utilizaron repuestos</Text>
        )}
      </View>
      
      {item.estado !== 'completado' && (
        <View style={styles.accionesContainer}>
          {item.estado === 'pendiente' && (
            <TouchableOpacity 
              style={[styles.accionBtn, {backgroundColor: '#1890FF'}]}
              onPress={() => handleCambiarEstado(item.id, 'en_proceso')}
            >
              <Text style={styles.accionBtnText}>Iniciar</Text>
            </TouchableOpacity>
          )}
          
          {item.estado === 'en_proceso' && (
            <TouchableOpacity 
              style={[styles.accionBtn, {backgroundColor: '#52C41A'}]}
              onPress={() => handleCambiarEstado(item.id, 'completado')}
            >
              <Text style={styles.accionBtnText}>Completar</Text>
            </TouchableOpacity>
          )}
          
          {(item.equipoId && (item.estado === 'en_proceso' || item.estado === 'pendiente')) && (
            <TouchableOpacity 
              style={[styles.accionBtn, {backgroundColor: '#722ED1'}]}
              onPress={() => navigation.navigate('InventarioScreen', {
                seleccionarRepuestos: true,
                mantenimientoId: item.id
              })}
            >
              <Text style={styles.accionBtnText}>Añadir Repuestos</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {item.equipoId && (
        <TouchableOpacity 
          style={styles.verHistorialBtn}
          onPress={() => verHistorialEquipo(item.equipoId)}
        >
          <Text style={styles.verHistorialText}>Ver historial de este equipo</Text>
          <Ionicons name="chevron-forward" size={16} color="#1890FF" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading && mantenimientos.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890FF" />
        <Text style={styles.loadingText}>Cargando datos...</Text>
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
        <Text style={styles.title}>Mantenimientos</Text>
        
        <View style={styles.filtroContainer}>
          <TouchableOpacity 
            style={[
              styles.filtroBtn, 
              filtroTipo === 'todos' && styles.filtroBtnActivo
            ]}
            onPress={() => setFiltroTipo('todos')}
          >
            <Text style={[
              styles.filtroText,
              filtroTipo === 'todos' && styles.filtroTextActivo
            ]}>
              Todos
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filtroBtn, 
              filtroTipo === 'preventivo' && styles.filtroBtnActivo
            ]}
            onPress={() => setFiltroTipo('preventivo')}
          >
            <Text style={[
              styles.filtroText,
              filtroTipo === 'preventivo' && styles.filtroTextActivo
            ]}>
              Preventivos
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filtroBtn, 
              filtroTipo === 'correctivo' && styles.filtroBtnActivo
            ]}
            onPress={() => setFiltroTipo('correctivo')}
          >
            <Text style={[
              styles.filtroText,
              filtroTipo === 'correctivo' && styles.filtroTextActivo
            ]}>
              Correctivos
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity 
            style={styles.reloadButton}
            onPress={() => window.location.reload()}
          >
            <Text style={styles.reloadButtonText}>Recargar</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <FlatList
        data={mantenimientosFiltrados}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listaContainer}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>No hay mantenimientos registrados</Text>
          </View>
        }
      />
      
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
        disabled={isLoading}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
      
      {/* Modal para agregar mantenimiento */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Mantenimiento</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formContainer}>
              <Text style={styles.inputLabel}>Equipo *</Text>
              <Picker
                selectedValue={formData.equipo}
                style={styles.picker}
                onValueChange={(itemValue) => {
                  const equipoSeleccionado = equipos.find(e => e.id === itemValue || `Camión #${e.numero}` === itemValue);
                  setFormData({
                    ...formData, 
                    equipo: itemValue,
                    equipoId: equipoSeleccionado ? equipoSeleccionado.id : null,
                    kilometraje: equipoSeleccionado ? equipoSeleccionado.kilometraje.toString() : ''
                  });
                }}
                enabled={!route.params?.equipoId} // Desactivar si viene preseleccionado
              >
                <Picker.Item label="Seleccione un equipo" value="" />
                {equipos.map(equipo => (
                  <Picker.Item 
                    key={equipo.id} 
                    label={`Camión #${equipo.numero} - ${equipo.modelo}`} 
                    value={`Camión #${equipo.numero}`} 
                  />
                ))}
              </Picker>
              
              <Text style={styles.inputLabel}>Tipo de mantenimiento *</Text>
              <Picker
                selectedValue={formData.tipo}
                style={styles.picker}
                onValueChange={(itemValue) => setFormData({...formData, tipo: itemValue})}
              >
                <Picker.Item label="Preventivo" value="preventivo" />
                <Picker.Item label="Correctivo" value="correctivo" />
              </Picker>
              
              <Text style={styles.inputLabel}>Kilometraje actual</Text>
              <TextInput
                style={styles.input}
                value={formData.kilometraje}
                onChangeText={(text) => setFormData({...formData, kilometraje: text})}
                placeholder="Kilometraje actual del equipo"
                keyboardType="numeric"
              />
              
              <Text style={styles.inputLabel}>Descripción *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.descripcion}
                onChangeText={(text) => setFormData({...formData, descripcion: text})}
                placeholder="Describa el mantenimiento a realizar"
                multiline={true}
                numberOfLines={4}
              />
              
              <Text style={styles.inputLabel}>Repuestos e Insumos</Text>
              <View style={styles.repuestosContainer}>
                {repuestosSeleccionados.map((repuesto) => (
                  <View key={repuesto.id} style={styles.repuestoSeleccionado}>
                    <Text style={styles.repuestoNombre}>
                      {repuesto.nombre} (x{repuesto.cantidad})
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveRepuesto(repuesto.id)}>
                      <Ionicons name="close-circle" size={20} color="#FF4D4F" />
                    </TouchableOpacity>
                  </View>
                ))}
                
                <TouchableOpacity 
                  style={styles.agregarRepuestoBtn}
                  onPress={() => setModalRepuestosVisible(true)}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#1890FF" />
                  <Text style={styles.agregarRepuestoText}>Agregar Repuestos</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleAddMantenimiento}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Registrar Mantenimiento</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Modal para seleccionar repuestos */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalRepuestosVisible}
        onRequestClose={() => setModalRepuestosVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Repuestos</Text>
              <TouchableOpacity onPress={() => setModalRepuestosVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={repuestos}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.repuestoListItem}
                  onPress={() => handleAddRepuesto(item.id, item.nombre, item.stock)}
                  disabled={item.stock <= 0}
                >
                  <View>
                    <Text style={styles.repuestoListNombre}>{item.nombre}</Text>
                    <Text style={[
                      styles.repuestoListStock,
                      item.stock <= 0 && styles.stockAgotado
                    ]}>
                      Stock: {item.stock} unidades
                    </Text>
                  </View>
                  {item.stock > 0 ? (
                    <Ionicons name="add-circle" size={24} color="#1890FF" />
                  ) : (
                    <Text style={styles.agotadoText}>Agotado</Text>
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.repuestosList}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={styles.emptyText}>No hay repuestos disponibles</Text>
                </View>
              }
            />
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={() => setModalRepuestosVisible(false)}
            >
              <Text style={styles.submitButtonText}>Confirmar Selección</Text>
            </TouchableOpacity>
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
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filtroContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  filtroBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F5F5F5',
  },
  filtroBtnActivo: {
    backgroundColor: '#1890FF',
  },
  filtroText: {
    color: '#666',
  },
  filtroTextActivo: {
    color: 'white',
    fontWeight: 'bold',
  },
  listaContainer: {
    padding: 16,
  },
  mantenimientoItem: {
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
  mantenimientoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mantenimientoEquipo: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  estadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  estadoText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mantenimientoInfo: {
    backgroundColor: '#F9F9F9',
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tipoText: {
    fontWeight: 'bold',
  },
  descripcionText: {
    marginBottom: 12,
  },
  repuestoItem: {
    marginLeft: 8,
    marginBottom: 2,
  },
  noRepuestos: {
    fontStyle: 'italic',
    color: '#999',
    marginLeft: 8,
  },
  accionesContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  accionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  accionBtnText: {
    color: 'white',
    fontWeight: 'bold',
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 4,
    marginBottom: 8,
  },
  repuestosContainer: {
    marginVertical: 8,
  },
  repuestoSeleccionado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  repuestoNombre: {
    flex: 1,
  },
  agregarRepuestoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  agregarRepuestoText: {
    color: '#1890FF',
    marginLeft: 4,
  },
  repuestosList: {
    padding: 16,
  },
  repuestoListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  repuestoListNombre: {
    fontSize: 16,
  },
  repuestoListStock: {
    fontSize: 12,
    color: '#999',
  },
  stockAgotado: {
    color: '#FF4D4F',
  },
  agotadoText: {
    color: '#FF4D4F',
    fontWeight: 'bold',
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: '#1890FF',
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    margin: 16,
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#1890FF',
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
    zIndex: 1000,
  },
  errorContainer: {
    backgroundColor: '#fff2f0',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF4D4F',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF4D4F',
    flex: 1,
  },
  reloadButton: {
    backgroundColor: '#FF4D4F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 12,
  },
  reloadButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
});

export default MantencionScreen;