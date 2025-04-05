import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EquiposScreen = () => {
  // Estado para los equipos
  const [equipos, setEquipos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [historialVisible, setHistorialVisible] = useState(false);

  // Cargar datos de ejemplo
  useEffect(() => {
    // En una app real, estos datos vendrían de una API
    const equiposEjemplo = [
      {
        id: '1',
        numero: '101',
        modelo: 'Volvo FH16',
        placa: 'ABC-123',
        anio: 2020,
        kilometraje: 75000,
        ultimoMantenimiento: '2025-02-15',
        proximoMantenimiento: '2025-04-15',
        conductor: 'Juan Pérez',
        estado: 'Operativo',
        historial: [
          {
            id: '1',
            fecha: '2025-02-15',
            tipo: 'Preventivo',
            kilometraje: 70000,
            descripcion: 'Cambio de aceite y filtros',
            repuestos: ['Filtro de aceite', 'Aceite 10W-40'],
            mecanico: 'Miguel Torres'
          },
          {
            id: '2',
            fecha: '2024-12-10',
            tipo: 'Correctivo',
            kilometraje: 65000,
            descripcion: 'Reparación del sistema de frenos',
            repuestos: ['Pastillas de freno delanteras'],
            mecanico: 'Laura Mendoza'
          }
        ]
      },
      {
        id: '2',
        numero: '102',
        modelo: 'Scania R500',
        placa: 'DEF-456',
        anio: 2019,
        kilometraje: 95000,
        ultimoMantenimiento: '2025-03-05',
        proximoMantenimiento: '2025-05-05',
        conductor: 'Carlos Rodríguez',
        estado: 'En Mantenimiento',
        historial: [
          {
            id: '1',
            fecha: '2025-03-05',
            tipo: 'Preventivo',
            kilometraje: 90000,
            descripcion: 'Cambio de aceite y revisión general',
            repuestos: ['Filtro de aceite', 'Aceite 10W-40'],
            mecanico: 'Miguel Torres'
          }
        ]
      },
      {
        id: '3',
        numero: '103',
        modelo: 'Mercedes-Benz Actros',
        placa: 'GHI-789',
        anio: 2021,
        kilometraje: 45000,
        ultimoMantenimiento: '2025-01-20',
        proximoMantenimiento: '2025-04-20',
        conductor: 'Ana Gómez',
        estado: 'Operativo',
        historial: [
          {
            id: '1',
            fecha: '2025-01-20',
            tipo: 'Preventivo',
            kilometraje: 40000,
            descripcion: 'Cambio de aceite y filtros',
            repuestos: ['Filtro de aceite', 'Aceite 10W-40'],
            mecanico: 'Laura Mendoza'
          }
        ]
      }
    ];
    
    setEquipos(equiposEjemplo);
  }, []);

  // Filtrar equipos según término de búsqueda
  const equiposFiltrados = equipos.filter(equipo => 
    equipo.numero.includes(busqueda) ||
    equipo.modelo.toLowerCase().includes(busqueda.toLowerCase()) ||
    equipo.placa.toLowerCase().includes(busqueda.toLowerCase()) ||
    equipo.conductor.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Función para actualizar el kilometraje
  const handleActualizarKilometraje = (id, nuevoKilometraje) => {
    const updatedEquipos = equipos.map(equipo => 
      equipo.id === id ? {
        ...equipo,
        kilometraje: parseInt(nuevoKilometraje)
      } : equipo
    );
    
    setEquipos(updatedEquipos);
    setModalVisible(false);
  };

  // Función para abrir el modal de actualización
  const handleOpenModal = (equipo) => {
    setEquipoSeleccionado(equipo);
    setModalVisible(true);
  };

  // Función para abrir el modal de historial
  const handleOpenHistorial = (equipo) => {
    setEquipoSeleccionado(equipo);
    setHistorialVisible(true);
  };

  // Renderizado de un ítem de equipo
  const renderItem = ({ item }) => (
    <View style={styles.equipoContainer}>
      <View style={styles.equipoHeader}>
        <View>
          <Text style={styles.equipoNumero}>Camión #{item.numero}</Text>
          <Text style={styles.equipoModelo}>{item.modelo}</Text>
        </View>
        <View style={[
          styles.estadoBadge,
          { backgroundColor: item.estado === 'Operativo' ? '#52C41A' : '#FFA940' }
        ]}>
          <Text style={styles.estadoText}>{item.estado}</Text>
        </View>
      </View>
      
      <View style={styles.equipoInfo}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Placa:</Text>
          <Text style={styles.infoValue}>{item.placa}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Año:</Text>
          <Text style={styles.infoValue}>{item.anio}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Conductor:</Text>
          <Text style={styles.infoValue}>{item.conductor}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Kilometraje:</Text>
          <Text style={styles.infoValue}>{item.kilometraje.toLocaleString()} km</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Último mantenimiento:</Text>
          <Text style={styles.infoValue}>{item.ultimoMantenimiento}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Próximo mantenimiento:</Text>
          <Text style={styles.infoValue}>{item.proximoMantenimiento}</Text>
        </View>
      </View>
      
      <View style={styles.equipoActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleOpenModal(item)}
        >
          <Ionicons name="speedometer-outline" size={18} color="#1890FF" />
          <Text style={styles.actionText}>Actualizar KM</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleOpenHistorial(item)}
        >
          <Ionicons name="time-outline" size={18} color="#1890FF" />
          <Text style={styles.actionText}>Ver Historial</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Equipos</Text>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por número, modelo o conductor..."
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
      </View>
      
      <FlatList
        data={equiposFiltrados}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listaContainer}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>No se encontraron equipos</Text>
          </View>
        }
      />
      
      {/* Modal para actualizar kilometraje */}
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
                Actualizar Kilometraje - Camión #{equipoSeleccionado?.numero}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formContainer}>
              <Text style={styles.kmActual}>
                Kilometraje actual: {equipoSeleccionado?.kilometraje.toLocaleString()} km
              </Text>
              
              <Text style={styles.inputLabel}>Nuevo kilometraje:</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingrese el nuevo kilometraje"
                keyboardType="numeric"
                defaultValue=""
                onSubmitEditing={(e) => {
                  const valor = parseInt(e.nativeEvent.text);
                  if (valor && valor >= equipoSeleccionado?.kilometraje) {
                    handleActualizarKilometraje(equipoSeleccionado?.id, valor);
                  } else {
                    alert("El nuevo kilometraje debe ser mayor al actual");
                  }
                }}
              />
              
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.submitButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal para ver historial */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={historialVisible}
        onRequestClose={() => setHistorialVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Historial - Camión #{equipoSeleccionado?.numero}
              </Text>
              <TouchableOpacity onPress={() => setHistorialVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.historialContainer}>
              {equipoSeleccionado?.historial.map((item) => (
                <View style={styles.historialItem} key={item.id}>
                  <View style={styles.historialHeader}>
                    <Text style={styles.historialFecha}>{item.fecha}</Text>
                    <View style={[
                      styles.tipoMantenimiento,
                      { backgroundColor: item.tipo === 'Preventivo' ? '#52C41A' : '#FFA940' }
                    ]}>
                      <Text style={styles.tipoText}>{item.tipo}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.historialKm}>
                    <Text style={styles.historialLabel}>Kilometraje: </Text>
                    {item.kilometraje.toLocaleString()} km
                  </Text>
                  
                  <Text style={styles.historialDesc}>
                    <Text style={styles.historialLabel}>Descripción: </Text>
                    {item.descripcion}
                  </Text>
                  
                  <Text style={styles.historialLabel}>Repuestos utilizados:</Text>
                  {item.repuestos.map((repuesto, index) => (
                    <Text key={index} style={styles.historialRepuesto}>• {repuesto}</Text>
                  ))}
                  
                  <Text style={styles.historialMecanico}>
                    <Text style={styles.historialLabel}>Mecánico: </Text>
                    {item.mecanico}
                  </Text>
                </View>
              ))}
              
              {equipoSeleccionado?.historial.length === 0 && (
                <Text style={styles.emptyText}>No hay registros de mantenimiento</Text>
              )}
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={() => setHistorialVisible(false)}
            >
              <Text style={styles.submitButtonText}>Cerrar</Text>
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
  equipoContainer: {
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
  equipoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  equipoNumero: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  equipoModelo: {
    color: '#666',
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
  equipoInfo: {
    backgroundColor: '#F9F9F9',
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    fontWeight: 'bold',
    marginRight: 4,
    width: 140,
  },
  infoValue: {
    flex: 1,
  },
  equipoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  actionText: {
    color: '#1890FF',
    marginLeft: 4,
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
    flex: 1,
  },
  formContainer: {
    padding: 16,
  },
  kmActual: {
    fontSize: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#1890FF',
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  historialContainer: {
    padding: 16,
  },
  historialItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  historialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historialFecha: {
    fontWeight: 'bold',
  },
  tipoMantenimiento: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tipoText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  historialKm: {
    marginBottom: 4,
  },
  historialDesc: {
    marginBottom: 8,
  },
  historialLabel: {
    fontWeight: 'bold',
  },
  historialRepuesto: {
    marginLeft: 16,
    marginBottom: 2,
  },
  historialMecanico: {
    marginTop: 8,
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

export default EquiposScreen;