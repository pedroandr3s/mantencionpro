import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const InventarioScreen = () => {
  // Estado para los repuestos e insumos
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    nombre: '',
    codigo: '',
    cantidad: '',
    minimo: '',
    categoria: '',
    ubicacion: '',
    proveedor: ''
  });
  const [editMode, setEditMode] = useState(false);

  // Cargar datos de ejemplo
  useEffect(() => {
    // En una app real, estos datos vendrían de una API
    const inventarioEjemplo = [
      {
        id: '1',
        nombre: 'Filtro de aceite',
        codigo: 'FA-101',
        cantidad: 15,
        minimo: 5,
        categoria: 'Filtros',
        ubicacion: 'Estante A-12',
        proveedor: 'AutoParts Inc.'
      },
      {
        id: '2',
        nombre: 'Aceite 10W-40',
        codigo: 'AC-240',
        cantidad: 8,
        minimo: 10,
        categoria: 'Lubricantes',
        ubicacion: 'Estante B-5',
        proveedor: 'LubriMax'
      },
      {
        id: '3',
        nombre: 'Pastillas de freno delanteras',
        codigo: 'PF-352',
        cantidad: 6,
        minimo: 4,
        categoria: 'Frenos',
        ubicacion: 'Estante C-8',
        proveedor: 'BrakeSystem'
      },
      {
        id: '4',
        nombre: 'Correa de distribución',
        codigo: 'CD-183',
        cantidad: 3,
        minimo: 2,
        categoria: 'Correas',
        ubicacion: 'Estante D-3',
        proveedor: 'BeltPro'
      },
      {
        id: '5',
        nombre: 'Batería 12V',
        codigo: 'BA-450',
        cantidad: 4,
        minimo: 3,
        categoria: 'Eléctrico',
        ubicacion: 'Estante E-1',
        proveedor: 'PowerMax'
      }
    ];
    
    setInventario(inventarioEjemplo);
  }, []);

  // Filtrar inventario según término de búsqueda
  const inventarioFiltrado = inventario.filter(item => 
    item.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.categoria.toLowerCase().includes(busqueda.toLowerCase())
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
      proveedor: ''
    });
    setModalVisible(true);
  };

  // Función para abrir el formulario para editar un ítem existente
  const handleEditItem = (item) => {
    setEditMode(true);
    setFormData({
      id: item.id,
      nombre: item.nombre,
      codigo: item.codigo,
      cantidad: item.cantidad.toString(),
      minimo: item.minimo.toString(),
      categoria: item.categoria,
      ubicacion: item.ubicacion,
      proveedor: item.proveedor
    });
    setModalVisible(true);
  };

  // Función para guardar un nuevo ítem o actualizar uno existente
  const handleSaveItem = () => {
    // Validación básica
    if (!formData.nombre || !formData.codigo || !formData.cantidad) {
      Alert.alert('Error', 'Por favor complete los campos obligatorios');
      return;
    }

    if (editMode) {
      // Actualizar ítem existente
      const updatedInventario = inventario.map(item => 
        item.id === formData.id ? {
          ...formData,
          cantidad: parseInt(formData.cantidad),
          minimo: parseInt(formData.minimo)
        } : item
      );
      setInventario(updatedInventario);
    } else {
      // Agregar nuevo ítem
      const newItem = {
        ...formData,
        id: Date.now().toString(),
        cantidad: parseInt(formData.cantidad),
        minimo: parseInt(formData.minimo)
      };
      setInventario([...inventario, newItem]);
    }

    setModalVisible(false);
  };

  // Función para descontar unidades
  const handleDescontarItem = (item) => {
    if (item.cantidad > 0) {
      const updatedInventario = inventario.map(insumo => 
        insumo.id === item.id ? {
          ...insumo,
          cantidad: insumo.cantidad - 1
        } : insumo
      );
      setInventario(updatedInventario);
    } else {
      Alert.alert('Error', 'No hay unidades disponibles para descontar');
    }
  };

  // Función para agregar unidades
  const handleAgregarItem = (item) => {
    const updatedInventario = inventario.map(insumo => 
      insumo.id === item.id ? {
        ...insumo,
        cantidad: insumo.cantidad + 1
      } : insumo
    );
    setInventario(updatedInventario);
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
          <Text>{item.categoria}</Text>
        </View>
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemLabel}>Ubicación:</Text>
          <Text>{item.ubicacion}</Text>
        </View>
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemLabel}>Proveedor:</Text>
          <Text>{item.proveedor}</Text>
        </View>
      </View>
      
      <View style={styles.itemFooter}>
        <View style={styles.cantidadContainer}>
          <Text style={styles.itemLabel}>Cantidad:</Text>
          <View style={styles.cantidadWrapper}>
            <TouchableOpacity 
              style={styles.cantidadBtn}
              onPress={() => handleDescontarItem(item)}
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
            >
              <Ionicons name="add" size={18} color="#52C41A" />
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.editarBtn}
          onPress={() => handleEditItem(item)}
        >
          <Ionicons name="create-outline" size={18} color="#1890FF" />
          <Text style={styles.editarBtnText}>Editar</Text>
        </TouchableOpacity>
      </View>
      
      {item.cantidad < item.minimo && (
        <View style={styles.alertaContainer}>
          <Ionicons name="warning-outline" size={16} color="#FF4D4F" />
          <Text style={styles.alertaText}>
            Stock bajo el mínimo recomendado ({item.minimo})
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventario</Text>
        
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
      
      <TouchableOpacity 
        style={styles.addButton}
        onPress={handleAddItem}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
      
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
            
            <View style={styles.formContainer}>
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
              >
                <Text style={styles.submitButtonText}>
                  {editMode ? 'Actualizar' : 'Guardar'}
                </Text>
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
  editarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editarBtnText: {
    color: '#1890FF',
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
});

export default InventarioScreen;