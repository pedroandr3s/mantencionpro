import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

const ReporteFallasScreen = () => {
  // Estado para almacenar el rol del usuario
  const [userRole, setUserRole] = useState('conductor'); // Cambia a 'mecanico' para probar otra vista
  
  // Estados para la lista de reportes y formulario
  const [reportes, setReportes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    equipo: '',
    kilometraje: '',
    descripcion: '',
    fecha: '',
    estado: 'pendiente',
    conductor: '',
    prioridad: 'media'
  });

  // Estado para filtrado
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Cargar datos de ejemplo (esto sería reemplazado por una API real)
  useEffect(() => {
    // Simulación de carga de datos
    const reportesEjemplo = [
      {
        id: '1',
        equipo: 'Camión #102',
        kilometraje: '45000',
        descripcion: 'Frenos hacen ruido al frenar',
        fecha: '2025-03-20',
        estado: 'pendiente',
        conductor: 'Juan Pérez',
        prioridad: 'alta'
      },
      {
        id: '2',
        equipo: 'Camión #105',
        kilometraje: '32500',
        descripcion: 'Fuga de aceite',
        fecha: '2025-03-22',
        estado: 'en_proceso',
        conductor: 'Carlos Rodríguez',
        prioridad: 'media'
      },
      {
        id: '3',
        equipo: 'Camión #103',
        kilometraje: '28900',
        descripcion: 'Problema con el sistema eléctrico',
        fecha: '2025-03-15',
        estado: 'solucionado',
        conductor: 'Ana Gómez',
        prioridad: 'media'
      },
    ];
    
    setReportes(reportesEjemplo);
  }, []);

  // Función para enviar un nuevo reporte
  const handleSubmitReporte = () => {
    const newFormData = {
      ...formData,
      id: Date.now().toString(),
      fecha: new Date().toISOString().split('T')[0],
      estado: 'pendiente',
      conductor: 'Usuario Actual' // En una app real, esto vendría del perfil del usuario
    };
    
    setReportes([newFormData, ...reportes]);
    setModalVisible(false);
    
    // Resetear el formulario
    setFormData({
      id: '',
      equipo: '',
      kilometraje: '',
      descripcion: '',
      fecha: '',
      estado: 'pendiente',
      conductor: '',
      prioridad: 'media'
    });
  };

  // Función para actualizar el estado de un reporte (solo para mecánicos)
  const handleUpdateEstado = (id, nuevoEstado) => {
    const updatedReportes = reportes.map(reporte => 
      reporte.id === id ? { ...reporte, estado: nuevoEstado } : reporte
    );
    
    setReportes(updatedReportes);
  };

  // Filtrar reportes según el estado seleccionado
  const reportesFiltrados = filtroEstado === 'todos' 
    ? reportes 
    : reportes.filter(reporte => reporte.estado === filtroEstado);

  // Función para obtener un color según la prioridad
  const getPrioridadColor = (prioridad) => {
    switch(prioridad) {
      case 'alta': return '#FF4D4F';
      case 'media': return '#FFA940';
      case 'baja': return '#52C41A';
      default: return '#FFA940';
    }
  };

  // Función para obtener un texto según el estado
  const getEstadoText = (estado) => {
    switch(estado) {
      case 'pendiente': return 'Pendiente';
      case 'en_proceso': return 'En proceso';
      case 'solucionado': return 'Solucionado';
      default: return 'Desconocido';
    }
  };

  // Renderizado de un ítem de la lista
  const renderItem = ({ item }) => (
    <View style={styles.reporteItem}>
      <View style={styles.reporteHeader}>
        <Text style={styles.reporteTitulo}>{item.equipo}</Text>
        <View style={[styles.estadoBadge, {
          backgroundColor: 
            item.estado === 'pendiente' ? '#FF4D4F' :
            item.estado === 'en_proceso' ? '#FFA940' : '#52C41A'
        }]}>
          <Text style={styles.estadoText}>{getEstadoText(item.estado)}</Text>
        </View>
      </View>
      
      <Text style={styles.reporteInfo}>
        <Text style={styles.reporteLabel}>Kilometraje: </Text>
        {item.kilometraje} km
      </Text>
      
      <Text style={styles.reporteDescripcion}>{item.descripcion}</Text>
      
      <View style={styles.reporteFooter}>
        <Text style={styles.reporteInfo}>
          <Text style={styles.reporteLabel}>Fecha: </Text>
          {item.fecha}
        </Text>
        
        <View style={[styles.prioridadBadge, {backgroundColor: getPrioridadColor(item.prioridad)}]}>
          <Text style={styles.prioridadText}>
            {item.prioridad.charAt(0).toUpperCase() + item.prioridad.slice(1)}
          </Text>
        </View>
      </View>
      
      {/* Botones de actualización (solo visible para mecánicos) */}
      {userRole === 'mecanico' && (
        <View style={styles.accionesContainer}>
          {item.estado !== 'en_proceso' && (
            <TouchableOpacity 
              style={[styles.accionBtn, {backgroundColor: '#1890FF'}]}
              onPress={() => handleUpdateEstado(item.id, 'en_proceso')}
            >
              <Text style={styles.accionBtnText}>Iniciar</Text>
            </TouchableOpacity>
          )}
          
          {item.estado !== 'solucionado' && (
            <TouchableOpacity 
              style={[styles.accionBtn, {backgroundColor: '#52C41A'}]}
              onPress={() => handleUpdateEstado(item.id, 'solucionado')}
            >
              <Text style={styles.accionBtnText}>Solucionar</Text>
            </TouchableOpacity>
          )}
          
          {item.estado === 'solucionado' && (
            <TouchableOpacity 
              style={[styles.accionBtn, {backgroundColor: '#FF4D4F'}]}
              onPress={() => handleUpdateEstado(item.id, 'pendiente')}
            >
              <Text style={styles.accionBtnText}>Reabrir</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Encabezado con título y filtro */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {userRole === 'conductor' ? 'Mis Reportes de Fallas' : 'Fallas Reportadas'}
        </Text>
        
        {/* Filtro de estado (solo visible para mecánicos) */}
        {userRole === 'mecanico' && (
          <View style={styles.filtroContainer}>
            <Text style={styles.filtroLabel}>Filtrar por:</Text>
            <Picker
              selectedValue={filtroEstado}
              style={styles.filtroPicker}
              onValueChange={(itemValue) => setFiltroEstado(itemValue)}
            >
              <Picker.Item label="Todos" value="todos" />
              <Picker.Item label="Pendientes" value="pendiente" />
              <Picker.Item label="En Proceso" value="en_proceso" />
              <Picker.Item label="Solucionados" value="solucionado" />
            </Picker>
          </View>
        )}
      </View>
      
      {/* Lista de reportes */}
      <FlatList
        data={reportesFiltrados}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listaContainer}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>No hay reportes disponibles</Text>
          </View>
        }
      />
      
      {/* Botón flotante para agregar reporte (solo visible para conductores) */}
      {userRole === 'conductor' && (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      )}
      
      {/* Modal para agregar nuevo reporte */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Reporte de Falla</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formContainer}>
              <Text style={styles.inputLabel}>Equipo</Text>
              <Picker
                selectedValue={formData.equipo}
                style={styles.picker}
                onValueChange={(itemValue) => setFormData({...formData, equipo: itemValue})}
              >
                <Picker.Item label="Seleccionar equipo" value="" />
                <Picker.Item label="Camión #101" value="Camión #101" />
                <Picker.Item label="Camión #102" value="Camión #102" />
                <Picker.Item label="Camión #103" value="Camión #103" />
                <Picker.Item label="Camión #104" value="Camión #104" />
                <Picker.Item label="Camión #105" value="Camión #105" />
              </Picker>
              
              <Text style={styles.inputLabel}>Kilometraje</Text>
              <TextInput
                style={styles.input}
                value={formData.kilometraje}
                onChangeText={(text) => setFormData({...formData, kilometraje: text})}
                placeholder="Ingrese el kilometraje actual"
                keyboardType="numeric"
              />
              
              <Text style={styles.inputLabel}>Descripción de la falla</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.descripcion}
                onChangeText={(text) => setFormData({...formData, descripcion: text})}
                placeholder="Describa detalladamente la falla que presenta el equipo"
                multiline={true}
                numberOfLines={4}
              />
              
              <Text style={styles.inputLabel}>Prioridad</Text>
              <Picker
                selectedValue={formData.prioridad}
                style={styles.picker}
                onValueChange={(itemValue) => setFormData({...formData, prioridad: itemValue})}
              >
                <Picker.Item label="Baja" value="baja" />
                <Picker.Item label="Media" value="media" />
                <Picker.Item label="Alta" value="alta" />
              </Picker>
              
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleSubmitReporte}
              >
                <Text style={styles.submitButtonText}>Enviar Reporte</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  },
  filtroContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  filtroLabel: {
    marginRight: 10,
  },
  filtroPicker: {
    flex: 1,
    height: 40,
  },
  listaContainer: {
    padding: 16,
  },
  reporteItem: {
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
  reporteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reporteTitulo: {
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
  reporteInfo: {
    marginBottom: 4,
  },
  reporteLabel: {
    fontWeight: 'bold',
  },
  reporteDescripcion: {
    marginVertical: 8,
  },
  reporteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  prioridadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  prioridadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  accionesContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  accionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  },
  formContainer: {
    padding: 16,
  },
  inputLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 4,
    marginBottom: 10,
  },
  submitButton: {
    backgroundColor: '#1890FF',
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
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

export default ReporteFallasScreen;