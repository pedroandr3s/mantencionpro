
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

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
  onSnapshot
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const EquiposScreen = ({ navigation, route }) => {
  // Estado para los equipos
  const [equipos, setEquipos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [historialVisible, setHistorialVisible] = useState(false);
  const [crearModalVisible, setCrearModalVisible] = useState(false);
  const [editarModalVisible, setEditarModalVisible] = useState(false);
  const [eliminarModalVisible, setEliminarModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [nuevoKilometraje, setNuevoKilometraje] = useState('');
  const [conductores, setConductores] = useState([]);
  const [formEquipo, setFormEquipo] = useState({
    numero: '',
    modelo: '',
    placa: '',
    anio: new Date().getFullYear().toString(),
    kilometraje: '',
    ultimoMantenimientoKm: '',
    proximoMantenimientoKm: '',
    conductor: '',
    estado: 'Operativo'
  });

  // Cargar datos desde Firebase
  useEffect(() => {
    let unsubscribeEquipos;
    let unsubscribeMantenimientos;

    const cargarDatos = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);

        // 1. Cargar conductores
        const cargarConductores = async () => {
          try {
            const conductoresRef = collection(firestore, 'usuarios');
            const qConductores = query(
              conductoresRef,
              where('rol', '==', 'conductor')
            );
            
            const conductoresSnap = await getDocs(qConductores);
            const conductoresData = [];
            
            conductoresSnap.forEach((docSnap) => {
              const conductor = docSnap.data();
              conductoresData.push({
                id: docSnap.id,
                nombre: conductor.nombre || conductor.correo || 'Sin nombre',
                correo: conductor.correo || ''
              });
            });
            
            setConductores(conductoresData);
          } catch (error) {
            console.error("Error al cargar conductores:", error);
          }
        };

        await cargarConductores();
        
        // 2. Suscribirse a cambios en equipos
        const equiposRef = collection(firestore, 'equipos');
        const qEquipos = query(equiposRef, orderBy('numero', 'asc'));
        
        unsubscribeEquipos = onSnapshot(qEquipos, async (equiposSnap) => {
          const equiposData = equiposSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            historial: []
          }));
          
          // 3. Suscribirse a cambios en mantenimientos
          const mantenimientosRef = collection(firestore, 'mantenimientos');
          
          unsubscribeMantenimientos = onSnapshot(mantenimientosRef, async (mantenimientosSnap) => {
            const mantenimientosData = mantenimientosSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            // Actualizar los equipos con el historial de mantenimientos
            const equiposActualizados = await Promise.all(equiposData.map(async (equipo) => {
              // Filtrar mantenimientos para este equipo
              const historialEquipo = mantenimientosData.filter(
                m => m.equipoId === equipo.id
              ).map(mantenimiento => ({
                id: mantenimiento.id,
                fecha: mantenimiento.fecha || new Date().toISOString().split('T')[0],
                tipo: mantenimiento.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo',
                kilometraje: mantenimiento.kilometraje || 0,
                descripcion: mantenimiento.descripcion || '',
                repuestos: mantenimiento.repuestos || [],
                mecanico: mantenimiento.mecanico || 'No asignado',
                estado: mantenimiento.estado || 'pendiente'
              }));
              
              // Ordenar por fecha más reciente primero
              historialEquipo.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
              
              // Verificar si hay mantenimientos en proceso para actualizar el estado del equipo
              const mantenimientoEnProceso = historialEquipo.find(m => m.estado === 'en_proceso');
              let estadoEquipo = equipo.estado;
              
              if (mantenimientoEnProceso && equipo.estado === 'Operativo') {
                // Si hay un mantenimiento en proceso, actualizar el estado en Firestore
                const equipoRef = doc(firestore, 'equipos', equipo.id);
                await updateDoc(equipoRef, {
                  estado: 'En Mantenimiento',
                  fechaActualizacion: serverTimestamp()
                });
                estadoEquipo = 'En Mantenimiento';
              } else if (!mantenimientoEnProceso && equipo.estado === 'En Mantenimiento') {
                // Verificar si todos los mantenimientos están completados
                const todoCompletado = !historialEquipo.some(m => m.estado === 'en_proceso' || m.estado === 'pendiente');
                
                if (todoCompletado) {
                  // Actualizar el estado a Operativo
                  const equipoRef = doc(firestore, 'equipos', equipo.id);
                  await updateDoc(equipoRef, {
                    estado: 'Operativo',
                    fechaActualizacion: serverTimestamp()
                  });
                  estadoEquipo = 'Operativo';
                }
              }
              
              // Calcular último y próximo mantenimiento
              const mantenimientosCompletados = historialEquipo.filter(m => m.estado === 'completado');
              let ultimoMantenimiento = equipo.ultimoMantenimiento;
              let proximoMantenimiento = equipo.proximoMantenimiento;
              
              if (mantenimientosCompletados.length > 0) {
                ultimoMantenimiento = mantenimientosCompletados[0].fecha;
                
                // Calcular próximo mantenimiento (2 meses después del último)
                const fechaUltimo = new Date(mantenimientosCompletados[0].fecha);
                fechaUltimo.setMonth(fechaUltimo.getMonth() + 2);
                proximoMantenimiento = fechaUltimo.toISOString().split('T')[0];
              }
              
              return {
                ...equipo,
                historial: historialEquipo,
                ultimoMantenimiento,
                proximoMantenimiento,
                estado: estadoEquipo
              };
            }));
            
            setEquipos(equiposActualizados);
            setIsLoading(false);
          });
        });
        
      } catch (error) {
        console.error("Error al cargar equipos:", error);
        setErrorMsg("Error al cargar los equipos. Intente nuevamente.");
        setIsLoading(false);
      }
    };
    
    cargarDatos();
    
    // Limpiar suscripciones al desmontar
    return () => {
      if (unsubscribeEquipos) unsubscribeEquipos();
      if (unsubscribeMantenimientos) unsubscribeMantenimientos();
    };
  }, []);

  // Filtrar equipos según término de búsqueda
  const equiposFiltrados = equipos.filter(equipo => 
    (equipo.numero && equipo.numero.includes(busqueda)) ||
    (equipo.modelo && equipo.modelo.toLowerCase().includes(busqueda.toLowerCase())) ||
    (equipo.placa && equipo.placa.toLowerCase().includes(busqueda.toLowerCase())) ||
    (equipo.conductor && equipo.conductor.toLowerCase().includes(busqueda.toLowerCase()))
  );

  // Función para crear un nuevo equipo
  const handleCrearEquipo = async () => {
    try {
      // Validación básica
      if (!formEquipo.numero || !formEquipo.placa) {
        Alert.alert("Error", "Número de camión y patente son campos obligatorios");
        return;
      }
      
      setIsLoading(true);
      
      // Verificar que no exista otro equipo con el mismo número o placa
      const equiposRef = collection(firestore, 'equipos');
      const qNumero = query(equiposRef, where('numero', '==', formEquipo.numero));
      const qPlaca = query(equiposRef, where('placa', '==', formEquipo.placa));
      
      const [numeroSnap, placaSnap] = await Promise.all([
        getDocs(qNumero),
        getDocs(qPlaca)
      ]);
      
      if (!numeroSnap.empty) {
        setIsLoading(false);
        Alert.alert("Error", `Ya existe un equipo con el número ${formEquipo.numero}`);
        return;
      }
      
      if (!placaSnap.empty) {
        setIsLoading(false);
        Alert.alert("Error", `Ya existe un equipo con la patente ${formEquipo.placa}`);
        return;
      }
      
      // Crear nuevo equipo en Firestore
      const nuevoEquipo = {
        ...formEquipo,
        anio: parseInt(formEquipo.anio),
        kilometraje: parseInt(formEquipo.kilometraje) || 0,
        ultimoMantenimientoKm: parseInt(formEquipo.ultimoMantenimientoKm) || 0,
        proximoMantenimientoKm: parseInt(formEquipo.proximoMantenimientoKm) || 0,
        fechaCreacion: serverTimestamp(),
        fechaActualizacion: serverTimestamp()
      };
      
      await addDoc(equiposRef, nuevoEquipo);
      
      setCrearModalVisible(false);
      setIsLoading(false);
      
      // Limpiar formulario
      setFormEquipo({
        numero: '',
        modelo: '',
        placa: '',
        anio: new Date().getFullYear().toString(),
        kilometraje: '',
        ultimoMantenimientoKm: '',
        proximoMantenimientoKm: '',
        conductor: '',
        estado: 'Operativo'
      });
      
      Alert.alert("Éxito", "Equipo creado correctamente");
    } catch (error) {
      console.error("Error al crear equipo:", error);
      setIsLoading(false);
      Alert.alert("Error", "No se pudo crear el equipo. Intente nuevamente.");
    }
  };

  // Función para editar un equipo
  const handleEditarEquipo = async () => {
    try {
      // Validación básica
      if (!formEquipo.numero || !formEquipo.placa) {
        Alert.alert("Error", "Número de camión y patente son campos obligatorios");
        return;
      }
      
      if (!equipoSeleccionado) {
        Alert.alert("Error", "No se ha seleccionado ningún equipo para editar");
        return;
      }
      
      setIsLoading(true);
      
      // Verificar que no exista otro equipo con el mismo número o placa (excepto el actual)
      const equiposRef = collection(firestore, 'equipos');
      const qNumero = query(equiposRef, where('numero', '==', formEquipo.numero));
      const qPlaca = query(equiposRef, where('placa', '==', formEquipo.placa));
      
      const [numeroSnap, placaSnap] = await Promise.all([
        getDocs(qNumero),
        getDocs(qPlaca)
      ]);
      
      // Verificar si hay otro equipo con el mismo número
      let duplicadoNumero = false;
      numeroSnap.forEach(doc => {
        if (doc.id !== equipoSeleccionado.id) {
          duplicadoNumero = true;
        }
      });
      
      if (duplicadoNumero) {
        setIsLoading(false);
        Alert.alert("Error", `Ya existe otro equipo con el número ${formEquipo.numero}`);
        return;
      }
      
      // Verificar si hay otro equipo con la misma placa
      let duplicadoPlaca = false;
      placaSnap.forEach(doc => {
        if (doc.id !== equipoSeleccionado.id) {
          duplicadoPlaca = true;
        }
      });
      
      if (duplicadoPlaca) {
        setIsLoading(false);
        Alert.alert("Error", `Ya existe otro equipo con la patente ${formEquipo.placa}`);
        return;
      }
      
      // Actualizar equipo en Firestore
      const equipoActualizado = {
        ...formEquipo,
        anio: parseInt(formEquipo.anio),
        kilometraje: parseInt(formEquipo.kilometraje) || 0,
        ultimoMantenimientoKm: parseInt(formEquipo.ultimoMantenimientoKm) || 0,
        proximoMantenimientoKm: parseInt(formEquipo.proximoMantenimientoKm) || 0,
        fechaActualizacion: serverTimestamp()
      };
      
      const equipoRef = doc(firestore, 'equipos', equipoSeleccionado.id);
      await updateDoc(equipoRef, equipoActualizado);
      
      setEditarModalVisible(false);
      setIsLoading(false);
      Alert.alert("Éxito", "Equipo actualizado correctamente");
    } catch (error) {
      console.error("Error al editar equipo:", error);
      setIsLoading(false);
      Alert.alert("Error", "No se pudo actualizar el equipo. Intente nuevamente.");
    }
  };

  // Función para eliminar un equipo
  const handleEliminarEquipo = async () => {
    try {
      if (!equipoSeleccionado) {
        Alert.alert("Error", "No se ha seleccionado ningún equipo para eliminar");
        return;
      }
      
      setIsLoading(true);
      
      // Verificar si hay mantenimientos asociados
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const qMantenimientos = query(
        mantenimientosRef,
        where('equipoId', '==', equipoSeleccionado.id)
      );
      
      const mantenimientosSnap = await getDocs(qMantenimientos);
      
      if (!mantenimientosSnap.empty) {
        setIsLoading(false);
        Alert.alert(
          "Advertencia", 
          "Este equipo tiene mantenimientos asociados. Si lo elimina, perderá el historial.",
          [
            { text: "Cancelar", style: "cancel" },
            { 
              text: "Eliminar de todos modos", 
              style: "destructive",
              onPress: () => confirmarEliminarEquipo()
            }
          ]
        );
        return;
      }
      
      await confirmarEliminarEquipo();
    } catch (error) {
      console.error("Error al eliminar equipo:", error);
      setIsLoading(false);
      Alert.alert("Error", "No se pudo eliminar el equipo. Intente nuevamente.");
    }
  };
  
  // Función auxiliar para confirmar eliminación
  const confirmarEliminarEquipo = async () => {
    try {
      setIsLoading(true);
      
      // Eliminar mantenimientos asociados
      const mantenimientosRef = collection(firestore, 'mantenimientos');
      const qMantenimientos = query(
        mantenimientosRef,
        where('equipoId', '==', equipoSeleccionado.id)
      );
      
      const mantenimientosSnap = await getDocs(qMantenimientos);
      
      const eliminarMantenimientos = mantenimientosSnap.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(eliminarMantenimientos);
      
      // Eliminar el equipo de Firestore
      const equipoRef = doc(firestore, 'equipos', equipoSeleccionado.id);
      await deleteDoc(equipoRef);
      
      setEliminarModalVisible(false);
      setIsLoading(false);
      Alert.alert("Éxito", "Equipo eliminado correctamente");
    } catch (error) {
      console.error("Error al confirmar eliminación:", error);
      setIsLoading(false);
      Alert.alert("Error", "No se pudo eliminar el equipo. Intente nuevamente.");
    }
  };

  // Función para actualizar el kilometraje
  const handleActualizarKilometraje = async (id, kmValue) => {
    try {
      // Validación
      const kmNum = parseInt(kmValue);
      if (!kmNum) {
        Alert.alert("Error", "Ingrese un kilometraje válido");
        return;
      }
      
      if (kmNum < equipoSeleccionado.kilometraje) {
        Alert.alert("Error", "El nuevo kilometraje debe ser mayor al actual");
        return;
      }
      
      setIsLoading(true);
      
      // Actualizar en Firestore
      const equipoRef = doc(firestore, 'equipos', id);
      await updateDoc(equipoRef, {
        kilometraje: kmNum,
        fechaActualizacion: serverTimestamp()
      });
      
      setModalVisible(false);
      setNuevoKilometraje('');
      setIsLoading(false);
      
      Alert.alert("Éxito", "Kilometraje actualizado correctamente");
      
      // Verificar si se debe programar un mantenimiento
      const equipo = equipos.find(e => e.id === id);
      if (equipo && equipo.proximoMantenimientoKm && kmNum >= equipo.proximoMantenimientoKm) {
        Alert.alert(
          "Mantenimiento necesario", 
          "El equipo ha alcanzado el kilometraje para mantenimiento preventivo.",
          [
            { text: "Después", style: "cancel" },
            { 
              text: "Programar ahora", 
              onPress: () => navigation.navigate('MantencionScreen', {
                equipoId: id,
                equipoNumero: equipo.numero,
                kilometraje: kmNum.toString()
              })
            }
          ]
        );
      }
    } catch (error) {
      console.error("Error al actualizar kilometraje:", error);
      setIsLoading(false);
      Alert.alert("Error", "No se pudo actualizar el kilometraje. Intente nuevamente.");
    }
  };

  // Función para programar un mantenimiento desde equipos
  const handleProgramarMantenimiento = (equipo) => {
    navigation.navigate('MantencionScreen', {
      equipoId: equipo.id,
      equipoNumero: equipo.numero,
      kilometraje: equipo.kilometraje.toString()
    });
  };

  // Función para abrir el modal de actualización
  const handleOpenModal = (equipo) => {
    setEquipoSeleccionado(equipo);
    setNuevoKilometraje('');
    setModalVisible(true);
  };

  // Función para abrir el modal de historial
  const handleOpenHistorial = (equipo) => {
    setEquipoSeleccionado(equipo);
    setHistorialVisible(true);
  };
  
  // Función para abrir el modal de edición
  const handleOpenEditarModal = (equipo) => {
    setEquipoSeleccionado(equipo);
    setFormEquipo({
      numero: equipo.numero || '',
      modelo: equipo.modelo || '',
      placa: equipo.placa || '',
      anio: equipo.anio ? equipo.anio.toString() : new Date().getFullYear().toString(),
      kilometraje: equipo.kilometraje ? equipo.kilometraje.toString() : '0',
      ultimoMantenimientoKm: equipo.ultimoMantenimientoKm ? equipo.ultimoMantenimientoKm.toString() : '0',
      proximoMantenimientoKm: equipo.proximoMantenimientoKm ? equipo.proximoMantenimientoKm.toString() : '0',
      conductor: equipo.conductor || '',
      estado: equipo.estado || 'Operativo'
    });
    setEditarModalVisible(true);
  };
  
  // Función para abrir el modal de eliminación
  const handleOpenEliminarModal = (equipo) => {
    setEquipoSeleccionado(equipo);
    setEliminarModalVisible(true);
  };

  // Renderizado de un ítem de equipo
  const renderItem = ({ item }) => (
    <View style={styles.equipoContainer}>
      <View style={styles.equipoHeader}>
        <View>
          <Text style={styles.equipoNumero}>Camión #{item.numero}</Text>
          <Text style={styles.equipoModelo}>{item.modelo}</Text>
        </View>
        <View style={styles.equipoHeaderRight}>
          <View style={[
            styles.estadoBadge,
            { backgroundColor: item.estado === 'Operativo' ? '#52C41A' : 
                              item.estado === 'En Mantenimiento' ? '#FFA940' : '#FF4D4F' }
          ]}>
            <Text style={styles.estadoText}>{item.estado}</Text>
          </View>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => {
              Alert.alert(
                "Opciones",
                `¿Qué desea hacer con el camión #${item.numero}?`,
                [
                  {
                    text: "Editar",
                    onPress: () => handleOpenEditarModal(item)
                  },
                  {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: () => handleOpenEliminarModal(item)
                  },
                  {
                    text: "Programar mantenimiento",
                    onPress: () => handleProgramarMantenimiento(item)
                  },
                  {
                    text: "Cancelar",
                    style: "cancel"
                  }
                ]
              )
            }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#666" />
          </TouchableOpacity>
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
          <Text style={styles.infoValue}>{item.conductor || 'No asignado'}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Kilometraje:</Text>
          <Text style={styles.infoValue}>{item.kilometraje ? item.kilometraje.toLocaleString() : 0} km</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Último mantenimiento:</Text>
          <Text style={styles.infoValue}>{item.ultimoMantenimiento || 'No registrado'}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Próximo mantenimiento:</Text>
          <Text style={styles.infoValue}>{item.proximoMantenimiento || 'No programado'}</Text>
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
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleProgramarMantenimiento(item)}
        >
          <Ionicons name="construct-outline" size={18} color="#1890FF" />
          <Text style={styles.actionText}>Mantenimiento</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading && equipos.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890FF" />
        <Text style={styles.loadingText}>Cargando equipos...</Text>
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
        <View style={styles.headerTop}>
          <Text style={styles.title}>Equipos</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              setFormEquipo({
                numero: '',
                modelo: '',
                placa: '',
                anio: new Date().getFullYear().toString(),
                kilometraje: '',
                ultimoMantenimientoKm: '',
                proximoMantenimientoKm: '',
                conductor: '',
                estado: 'Operativo'
              });
              setCrearModalVisible(true);
            }}
          >
            <Ionicons name="add-circle" size={20} color="white" />
            <Text style={styles.createButtonText}>Nuevo Equipo</Text>
          </TouchableOpacity>
        </View>
        
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
        data={equiposFiltrados}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listaContainer}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>No se encontraron equipos</Text>
            <TouchableOpacity
              style={[styles.createButton, styles.emptyCreateButton]}
              onPress={() => {
                setFormEquipo({
                  numero: '',
                  modelo: '',
                  placa: '',
                  anio: new Date().getFullYear().toString(),
                  kilometraje: '',
                  ultimoMantenimientoKm: '',
                  proximoMantenimientoKm: '',
                  conductor: '',
                  estado: 'Operativo'
                });
                setCrearModalVisible(true);
              }}
            >
              <Ionicons name="add-circle" size={20} color="white" />
              <Text style={styles.createButtonText}>Crear Nuevo Equipo</Text>
            </TouchableOpacity>
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
              Kilometraje actual: {equipoSeleccionado?.kilometraje ? equipoSeleccionado.kilometraje.toLocaleString() : 0} km
              </Text>
              
              <Text style={styles.inputLabel}>Nuevo kilometraje:</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingrese el nuevo kilometraje"
                keyboardType="numeric"
                value={nuevoKilometraje}
                onChangeText={setNuevoKilometraje}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={() => handleActualizarKilometraje(equipoSeleccionado?.id, nuevoKilometraje)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Actualizar</Text>
                  )}
                </TouchableOpacity>
              </View>
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
              {equipoSeleccionado?.historial && equipoSeleccionado.historial.length > 0 ? (
                equipoSeleccionado.historial.map((item) => (
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
                    
                    <View style={styles.historialEstadoRow}>
                      <Text style={styles.historialLabel}>Estado: </Text>
                      <View style={[
                        styles.estadoBadgeMini,
                        { 
                          backgroundColor: 
                            item.estado === 'pendiente' ? '#FFA940' :
                            item.estado === 'en_proceso' ? '#1890FF' : '#52C41A'
                        }
                      ]}>
                        <Text style={styles.estadoTextMini}>
                          {item.estado === 'pendiente' ? 'Pendiente' :
                          item.estado === 'en_proceso' ? 'En Proceso' : 'Completado'}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={styles.historialKm}>
                      <Text style={styles.historialLabel}>Kilometraje: </Text>
                      {item.kilometraje ? item.kilometraje.toLocaleString() : 0} km
                    </Text>
                    
                    <Text style={styles.historialDesc}>
                      <Text style={styles.historialLabel}>Descripción: </Text>
                      {item.descripcion}
                    </Text>
                    
                    <Text style={styles.historialLabel}>Repuestos utilizados:</Text>
                    {item.repuestos && item.repuestos.length > 0 ? (
                      item.repuestos.map((repuesto, index) => (
                        <Text key={index} style={styles.historialRepuesto}>
                          • {typeof repuesto === 'string' ? repuesto : repuesto.nombre} 
                          {repuesto.cantidad ? ` (x${repuesto.cantidad})` : ''}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.historialRepuesto}>• No se utilizaron repuestos</Text>
                    )}
                    
                    <Text style={styles.historialMecanico}>
                      <Text style={styles.historialLabel}>Mecánico: </Text>
                      {item.mecanico}
                    </Text>
                    
                    {item.estado !== 'completado' && (
                      <TouchableOpacity 
                        style={styles.irMantenimientoBtn}
                        onPress={() => {
                          setHistorialVisible(false);
                          navigation.navigate('MantencionScreen', { 
                            mantenimientoId: item.id
                          });
                        }}
                      >
                        <Text style={styles.irMantenimientoBtnText}>Ir a este mantenimiento</Text>
                        <Ionicons name="arrow-forward" size={16} color="#1890FF" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistorial}>
                  <Text style={styles.emptyText}>No hay registros de mantenimiento</Text>
                </View>
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
      
      {/* Modal para crear nuevo equipo */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={crearModalVisible}
        onRequestClose={() => setCrearModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Nuevo Equipo</Text>
              <TouchableOpacity onPress={() => setCrearModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formContainer}>
              <Text style={styles.inputLabel}>Número de camión *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 101"
                value={formEquipo.numero}
                onChangeText={(text) => setFormEquipo({...formEquipo, numero: text})}
              />
              
              <Text style={styles.inputLabel}>Modelo</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Volvo FH16"
                value={formEquipo.modelo}
                onChangeText={(text) => setFormEquipo({...formEquipo, modelo: text})}
              />
              
              <Text style={styles.inputLabel}>Patente/Placa *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: ABC-123"
                value={formEquipo.placa}
                onChangeText={(text) => setFormEquipo({...formEquipo, placa: text})}
              />
              
              <Text style={styles.inputLabel}>Año</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 2022"
                keyboardType="numeric"
                value={formEquipo.anio}
                onChangeText={(text) => setFormEquipo({...formEquipo, anio: text})}
              />
              
              <Text style={styles.inputLabel}>Kilometraje actual</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 50000"
                keyboardType="numeric"
                value={formEquipo.kilometraje}
                onChangeText={(text) => setFormEquipo({...formEquipo, kilometraje: text})}
              />
              
              <Text style={styles.inputLabel}>Último mantenimiento en kilometraje</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 45000"
                keyboardType="numeric"
                value={formEquipo.ultimoMantenimientoKm}
                onChangeText={(text) => setFormEquipo({...formEquipo, ultimoMantenimientoKm: text})}
              />
              
              <Text style={styles.inputLabel}>Próximo mantenimiento en kilometraje</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 55000"
                keyboardType="numeric"
                value={formEquipo.proximoMantenimientoKm}
                onChangeText={(text) => setFormEquipo({...formEquipo, proximoMantenimientoKm: text})}
              />
              
              <Text style={styles.inputLabel}>Conductor</Text>
              <Picker
                selectedValue={formEquipo.conductor}
                style={styles.picker}
                onValueChange={(itemValue) => setFormEquipo({...formEquipo, conductor: itemValue})}
              >
                <Picker.Item label="Seleccionar conductor" value="" />
                {conductores.map((conductor) => (
                  <Picker.Item key={conductor.id} label={conductor.nombre} value={conductor.nombre} />
                ))}
              </Picker>
              
              <Text style={styles.inputLabel}>Estado</Text>
              <Picker
                selectedValue={formEquipo.estado}
                style={styles.picker}
                onValueChange={(itemValue) => setFormEquipo({...formEquipo, estado: itemValue})}
              >
                <Picker.Item label="Operativo" value="Operativo" />
                <Picker.Item label="En Mantenimiento" value="En Mantenimiento" />
                <Picker.Item label="Fuera de Servicio" value="Fuera de Servicio" />
              </Picker>
              
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleCrearEquipo}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Guardar Equipo</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Modal para editar equipo */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editarModalVisible}
        onRequestClose={() => setEditarModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Camión #{equipoSeleccionado?.numero}</Text>
              <TouchableOpacity onPress={() => setEditarModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formContainer}>
              <Text style={styles.inputLabel}>Número de camión *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 101"
                value={formEquipo.numero}
                onChangeText={(text) => setFormEquipo({...formEquipo, numero: text})}
              />
              
              <Text style={styles.inputLabel}>Modelo</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Volvo FH16"
                value={formEquipo.modelo}
                onChangeText={(text) => setFormEquipo({...formEquipo, modelo: text})}
              />
              
              <Text style={styles.inputLabel}>Patente/Placa *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: ABC-123"
                value={formEquipo.placa}
                onChangeText={(text) => setFormEquipo({...formEquipo, placa: text})}
              />
              
              <Text style={styles.inputLabel}>Año</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 2022"
                keyboardType="numeric"
                value={formEquipo.anio}
                onChangeText={(text) => setFormEquipo({...formEquipo, anio: text})}
              />
              
              <Text style={styles.inputLabel}>Kilometraje actual</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 50000"
                keyboardType="numeric"
                value={formEquipo.kilometraje}
                onChangeText={(text) => setFormEquipo({...formEquipo, kilometraje: text})}
              />
              
              <Text style={styles.inputLabel}>Último mantenimiento en kilometraje</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 45000"
                keyboardType="numeric"
                value={formEquipo.ultimoMantenimientoKm}
                onChangeText={(text) => setFormEquipo({...formEquipo, ultimoMantenimientoKm: text})}
              />
              
              <Text style={styles.inputLabel}>Próximo mantenimiento en kilometraje</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 55000"
                keyboardType="numeric"
                value={formEquipo.proximoMantenimientoKm}
                onChangeText={(text) => setFormEquipo({...formEquipo, proximoMantenimientoKm: text})}
              />
              
              <Text style={styles.inputLabel}>Conductor</Text>
              <Picker
                selectedValue={formEquipo.conductor}
                style={styles.picker}
                onValueChange={(itemValue) => setFormEquipo({...formEquipo, conductor: itemValue})}
              >
                <Picker.Item label="Seleccionar conductor" value="" />
                {conductores.map((conductor) => (
                  <Picker.Item key={conductor.id} label={conductor.nombre} value={conductor.nombre} />
                ))}
              </Picker>
              
              <Text style={styles.inputLabel}>Estado</Text>
              <Picker
                selectedValue={formEquipo.estado}
                style={styles.picker}
                onValueChange={(itemValue) => setFormEquipo({...formEquipo, estado: itemValue})}
              >
                <Picker.Item label="Operativo" value="Operativo" />
                <Picker.Item label="En Mantenimiento" value="En Mantenimiento" />
                <Picker.Item label="Fuera de Servicio" value="Fuera de Servicio" />
              </Picker>
              
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleEditarEquipo}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Guardar Cambios</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Modal para confirmar eliminación */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={eliminarModalVisible}
        onRequestClose={() => setEliminarModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, styles.deleteModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Eliminar Camión</Text>
              <TouchableOpacity onPress={() => setEliminarModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.deleteConfirmContainer}>
              <Ionicons name="warning" size={60} color="#FF4D4F" style={styles.deleteIcon} />
              <Text style={styles.deleteTitle}>¿Está seguro?</Text>
              <Text style={styles.deleteText}>
                Está a punto de eliminar el Camión #{equipoSeleccionado?.numero}. Esta acción no se puede deshacer.
              </Text>
              
              <View style={styles.deleteButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEliminarModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.deleteButton]}
                  onPress={handleEliminarEquipo}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.deleteButtonText}>Eliminar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = {
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1890FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createButtonText: {
    color: '#FFF',
    fontWeight: '500',
    marginLeft: 6,
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
    paddingBottom: 80, // Para asegurar espacio para el botón flotante
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  equipoNumero: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  equipoModelo: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  equipoHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  estadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  estadoText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  menuButton: {
    padding: 5,
  },
  equipoInfo: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    fontWeight: 'bold',
    width: 140,
    fontSize: 13,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
  },
  equipoActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  actionText: {
    color: '#1890FF',
    marginLeft: 4,
    fontSize: 13,
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
    backgroundColor: '#F5222D',
    borderRadius: 4,
  },
  reloadButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  emptyCreateButton: {
    marginTop: 20,
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
  deleteModalContent: {
    maxHeight: 'auto',
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
  kmActual: {
    fontSize: 14,
    backgroundColor: '#F0F7FF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
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
  picker: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 4,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#1890FF',
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 24,
    marginHorizontal: 16,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#FF4D4F',
  },
  deleteButtonText: {
    color: 'white',
  },
  historialContainer: {
    padding: 16,
  },
  historialItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1890FF',
  },
  historialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historialFecha: {
    fontWeight: 'bold',
  },
  tipoMantenimiento: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tipoText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  historialEstadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  historialLabel: {
    fontWeight: 'bold',
  },
  estadoBadgeMini: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  estadoTextMini: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '500',
  },
  historialKm: {
    marginBottom: 6,
  },
  historialDesc: {
    marginBottom: 10,
  },
  historialRepuesto: {
    marginLeft: 10,
    marginBottom: 4,
    fontSize: 13,
  },
  historialMecanico: {
    marginTop: 6,
    fontSize: 13,
  },
  emptyHistorial: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  deleteConfirmContainer: {
    padding: 20,
    alignItems: 'center',
  },
  deleteIcon: {
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  deleteText: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    lineHeight: 20,
  },
  deleteButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  irMantenimientoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  irMantenimientoBtnText: {
    color: '#1890FF',
    marginRight: 6,
    fontSize: 13,
  }
};
export default EquiposScreen;

