import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DisponibilidadScreen = () => {
  // Estado para almacenar el rol del usuario (en una app real vendría de un context o store)
  const [userRole, setUserRole] = useState('mecanico'); // Cambia a 'conductor' para probar otra vista
  
  // Estado para la lista de camiones
  const [camiones, setCamiones] = useState([]);
  
  // Estado para el modal de edición
  const [modalVisible, setModalVisible] = useState(false);
  const [camionSeleccionado, setCamionSeleccionado] = useState(null);
  
  // Estado para el formulario del modal
  const [formData, setFormData] = useState({
    disponible: true,
    motivo: '',
    estimacionFinalizacion: ''
  });

  // Función para filtrar camiones disponibles
  const camionesDisponibles = camiones.filter(camion => camion.disponible);
  
  // Función para filtrar camiones no disponibles
  const camionesNoDisponibles = camiones.filter(camion => !camion.disponible);
  
  // Determinar qué datos mostrar según el filtro
  const [mostrarSoloDisponibles, setMostrarSoloDisponibles] = useState(false);
  const [mostrarSoloNoDisponibles, setMostrarSoloNoDisponibles] = useState(false);
  
  // Datos filtrados para mostrar
  const datosFiltrados = mostrarSoloDisponibles 
    ? camionesDisponibles 
    : mostrarSoloNoDisponibles 
      ? camionesNoDisponibles 
      : camiones;

  // Cargar datos de ejemplo
  useEffect(() => {
    // En una app real, estos datos vendrían de una API
    const camionesEjemplo = [
      {
        id: '1',
        numero: '101',
        modelo: 'Volvo FH16',
        disponible: true,
        ultimaActualizacion: '2025-03-27',
        actualizadoPor: 'Miguel Torres',
        motivo: '',
        estimacionFinalizacion: ''
      },
      {
        id: '2',
        numero: '102',
        modelo: 'Scania R500',
        disponible: false,
        ultimaActualizacion: '2025-03-26',
        actualizadoPor: 'Laura Mendoza',
        motivo: 'Mantenimiento preventivo',
        estimacionFinalizacion: '2025-03-29'
      },
      {
        id: '3',
        numero: '103',
        modelo: 'Mercedes-Benz Actros',
        disponible: true,
        ultimaActualizacion: '2025-03-25',
        actualizadoPor: 'Miguel Torres',
        motivo: '',
        estimacionFinalizacion: ''
      },
      {
        id: '4',
        numero: '104',
        modelo: 'MAN TGX',
        disponible: false,
        ultimaActualizacion: '2025-03-24',
        actualizadoPor: 'Laura Mendoza',
        motivo: 'Reparación de frenos',
        estimacionFinalizacion: '2025-03-30'
      },
      {
        id: '5',
        numero: '105',
        modelo: 'Kenworth T680',
        disponible: true,
        ultimaActualizacion: '2025-03-23',
        actualizadoPor: 'Miguel Torres',
        motivo: '',
        estimacionFinalizacion: ''
      }
    ];
    
    setCamiones(camionesEjemplo);
  }, []);

  // Función para abrir el modal de edición
  const handleEdit = (camion) => {
    setCamionSeleccionado(camion);
    setFormData({
      disponible: camion.disponible,
      motivo: camion.motivo || '',
      estimacionFinalizacion: camion.estimacionFinalizacion || ''
    });
    setModalVisible(true);
  };

  // Función para guardar los cambios del camión
  const handleSave = () => {
    if (!formData.disponible && !formData.motivo) {
      Alert.alert('Error', 'Debe ingresar un motivo cuando el camión no está disponible');
      return;
    }

    const camionesActualizados = camiones.map(camion => {
      if (camion.id === camionSeleccionado.id) {
        return {
          ...camion,
          disponible: formData.disponible,
          motivo: formData.disponible ? '' : formData.motivo,
          estimacionFinalizacion: formData.disponible ? '' : formData.estimacionFinalizacion,
          ultimaActualizacion: new Date().toISOString().split('T')[0],
          actualizadoPor: 'Usuario Actual' // En una app real, esto vendría del usuario logueado
        };
      }
      return camion;
    });
    
    setCamiones(camionesActualizados);
    setModalVisible(false);
  };

  // Renderizado de un ítem de la lista
  const renderItem = ({ item }) => (
    <View style={styles.camionItem}>
      <View style={styles.camionHeader}>
        <Text style={styles.camionNumero}>Camión #{item.numero}</Text>
        <View style={[
          styles.disponibilidadBadge, 
          {backgroundColor: item.disponible ? '#52C41A' : '#FF4D4F'}
        ]}>
          <Text style={styles.disponibilidadText}>
            {item.disponible ? 'Disponible' : 'No Disponible'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.camionModelo}>{item.modelo}</Text>
      
      {/* Mostrar información adicional si no está disponible */}
      {!item.disponible && (
        <View style={styles.infoNoDisponible}>
          <Text style={styles.motivoText}>
            <Text style={styles.camionLabel}>Motivo: </Text>
            {item.motivo}
          </Text>
          
          {item.estimacionFinalizacion && (
            <Text style={styles.estimacionText}>
              <Text style={styles.camionLabel}>Disponible a partir de: </Text>
              {item.estimacionFinalizacion}
            </Text>
          )}
        </View>
      )}
      
      <View style={styles.camionFooter}>
        <Text style={styles.actualizacionText}>
          <Text style={styles.camionLabel}>Actualizado: </Text>
          {item.ultimaActualizacion} por {item.actualizadoPor}
        </Text>
        
        {/* Botón de edición (solo visible para mecánicos) */}
        {userRole === 'mecanico' && (
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Disponibilidad de Camiones
        </Text>
        
        {/* Filtros */}
        <View style={styles.filtrosContainer}>
          <TouchableOpacity 
            style={[
              styles.filtroButton, 
              !mostrarSoloDisponibles && !mostrarSoloNoDisponibles && styles.filtroActivo
            ]}
            onPress={() => {
              setMostrarSoloDisponibles(false);
              setMostrarSoloNoDisponibles(false);
            }}
          >
            <Text style={styles.filtroText}>Todos</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filtroButton, 
              mostrarSoloDisponibles && styles.filtroActivo
            ]}
            onPress={() => {
              setMostrarSoloDisponibles(true);
              setMostrarSoloNoDisponibles(false);
            }}
          >
            <Text style={styles.filtroText}>Disponibles</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filtroButton, 
              mostrarSoloNoDisponibles && styles.filtroActivo
            ]}
            onPress={() => {
              setMostrarSoloDisponibles(false);
              setMostrarSoloNoDisponibles(true);
            }}
          >
            <Text style={styles.filtroText}>No Disponibles</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Lista de camiones */}
      <FlatList
        data={datosFiltrados}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listaContainer}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>No hay camiones disponibles</Text>
          </View>
        }
      />
      
      {/* Modal para editar disponibilidad (solo para mecánicos) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible && userRole === 'mecanico'}
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
            
            <View style={styles.formContainer}>
              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Estado del camión:</Text>
                <View style={styles.switchWrapper}>
                  <Text>No Disponible</Text>
                  <Switch
                    value={formData.disponible}
                    onValueChange={(value) => setFormData({...formData, disponible: value})}
                    trackColor={{ false: "#FF4D4F", true: "#52C41A" }}
                    thumbColor={formData.disponible ? "#fff" : "#fff"}
                    style={styles.switch}
                  />
                  <Text>Disponible</Text>
                </View>
              </View>
              
              {!formData.disponible && (
                <>
                  <Text style={styles.inputLabel}>Motivo de indisponibilidad</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.motivo}
                    onChangeText={(text) => setFormData({...formData, motivo: text})}
                    placeholder="Ingrese el motivo por el cual no está disponible"
                  />
                  
                  <Text style={styles.inputLabel}>Fecha estimada de disponibilidad</Text>
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
              >
                <Text style={styles.submitButtonText}>Guardar Cambios</Text>
              </TouchableOpacity>
            </View>
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
  filtrosContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  filtroButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F0F0F0',
  },
  filtroActivo: {
    backgroundColor: '#1890FF',
  },
  filtroText: {
    fontWeight: '500',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
  switchContainer: {
    marginBottom: 20,
  },
  switchLabel: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  switchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  switch: {
    marginHorizontal: 10,
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