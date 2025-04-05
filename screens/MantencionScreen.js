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
  Alert
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

const MantencionScreen = () => {
  // Estados para la gestión de mantenimientos
  const [mantenimientos, setMantenimientos] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalRepuestosVisible, setModalRepuestosVisible] = useState(false);
  const [equipos, setEquipos] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [repuestosSeleccionados, setRepuestosSeleccionados] = useState([]);

  // Estado para el formulario
  const [formData, setFormData] = useState({
    id: '',
    equipo: '',
    tipo: 'preventivo',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    estado: 'pendiente',
    kilometraje: '',
    mecanico: 'Usuario Actual',
    repuestos: []
  });

  // Cargar datos de ejemplo
  useEffect(() => {
    // En una app real, estos datos vendrían de una API
    const mantenimientosEjemplo = [
      {
        id: '1',
        equipo: 'Camión #101',
        tipo: 'preventivo',
        descripcion: 'Cambio de aceite y filtros',
        fecha: '2025-03-25',
        estado: 'completado',
        kilometraje: 75000,
        mecanico: 'Miguel Torres',
        repuestos: [
          { id: '1', nombre: 'Filtro de aceite', cantidad: 1 },
          { id: '2', nombre: 'Aceite 10W-40', cantidad: 8 }
        ]
      },
      {
        id: '2',
        equipo: 'Camión #102',
        tipo: 'correctivo',
        descripcion: 'Reparación de sistema de frenos',
        fecha: '2025-03-26',
        estado: 'en_proceso',
        kilometraje: 95000,
        mecanico: 'Laura Mendoza',
        repuestos: [
          { id: '3', nombre: 'Pastillas de freno delanteras', cantidad: 1 }
        ]
      },
      {
        id: '3',
        equipo: 'Camión #103',
        tipo: 'preventivo',
        descripcion: 'Revisión general',
        fecha: '2025-03-20',
        estado: 'pendiente',
        kilometraje: 45000,
        mecanico: 'Miguel Torres',
        repuestos: []
      }
    ];
    
    setMantenimientos(mantenimientosEjemplo);

    // Datos de ejemplo para equipos
    const equiposEjemplo = [
      { id: '1', numero: '101', modelo: 'Volvo FH16', kilometraje: 75000 },
      { id: '2', numero: '102', modelo: 'Scania R500', kilometraje: 95000 },
      { id: '3', numero: '103', modelo: 'Mercedes-Benz Actros', kilometraje: 45000 }
    ];
    
    setEquipos(equiposEjemplo);

    // Datos de ejemplo para repuestos
    const repuestosEjemplo = [
      { id: '1', nombre: 'Filtro de aceite', stock: 15 },
      { id: '2', nombre: 'Aceite 10W-40', stock: 8 },
      { id: '3', nombre: 'Pastillas de freno delanteras', stock: 6 },
      { id: '4', nombre: 'Correa de distribución', stock: 3 },
      { id: '5', nombre: 'Batería 12V', stock: 4 }
    ];
    
    setRepuestos(repuestosEjemplo);
  }, []);

  // Filtrar mantenimientos según el tipo seleccionado
  const mantenimientosFiltrados = filtroTipo === 'todos' 
    ? mantenimientos 
    : mantenimientos.filter(m => m.tipo === filtroTipo);

  // Función para agregar un nuevo mantenimiento
  const handleAddMantenimiento = () => {
    // Validar campos
    if (!formData.equipo || !formData.descripcion) {
      Alert.alert('Error', 'Por favor complete los campos obligatorios');
      return;
    }

    // Crear nuevo mantenimiento
    const nuevoMantenimiento = {
      ...formData,
      id: Date.now().toString(),
      kilometraje: parseInt(formData.kilometraje),
      repuestos: repuestosSeleccionados
    };

    setMantenimientos([nuevoMantenimiento, ...mantenimientos]);
    setModalVisible(false);
    
    // Reiniciar el formulario
    setFormData({
      id: '',
      equipo: '',
      tipo: 'preventivo',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0],
      estado: 'pendiente',
      kilometraje: '',
      mecanico: 'Usuario Actual',
      repuestos: []
    });
    
    setRepuestosSeleccionados([]);
  };

  // Función para agregar repuestos al mantenimiento
  const handleAddRepuesto = (id, nombre) => {
    // Verificar si ya está en la lista
    const existente = repuestosSeleccionados.find(r => r.id === id);
    
    if (existente) {
      // Actualizar cantidad
      const actualizados = repuestosSeleccionados.map(r => 
        r.id === id ? { ...r, cantidad: r.cantidad + 1 } : r
      );
      setRepuestosSeleccionados(actualizados);
    } else {
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
  const handleCambiarEstado = (id, nuevoEstado) => {
    const mantenimientosActualizados = mantenimientos.map(m => 
      m.id === id ? { ...m, estado: nuevoEstado } : m
    );
    
    setMantenimientos(mantenimientosActualizados);
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
            <Text>{item.kilometraje.toLocaleString()} km</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Mecánico:</Text>
            <Text>{item.mecanico}</Text>
          </View>
        </View>
        
        <Text style={styles.infoLabel}>Descripción:</Text>
        <Text style={styles.descripcionText}>{item.descripcion}</Text>
        
        <Text style={styles.infoLabel}>Repuestos utilizados:</Text>
        {item.repuestos.length > 0 ? (
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
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
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
                  const equipoSeleccionado = equipos.find(e => `Camión #${e.numero}` === itemValue);
                  setFormData({
                    ...formData, 
                    equipo: itemValue,
                    kilometraje: equipoSeleccionado ? equipoSeleccionado.kilometraje.toString() : ''
                  });
                }}
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
                editable={false}
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
              >
                <Text style={styles.submitButtonText}>Registrar Mantenimiento</Text>
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
                  onPress={() => handleAddRepuesto(item.id, item.nombre)}
                >
                  <View>
                    <Text style={styles.repuestoListNombre}>{item.nombre}</Text>
                    <Text style={styles.repuestoListStock}>Stock: {item.stock} unidades</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color="#1890FF" />
                </TouchableOpacity>
              )}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.repuestosList}
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
});

export default MantencionScreen;