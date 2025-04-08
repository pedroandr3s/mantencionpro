import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import firebaseApp from "../firebase/credenciales";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  serverTimestamp 
} from "firebase/firestore";

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

const Login = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('');
  const [isRegistrando, setIsRegistrando] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Verificar si el usuario ya está autenticado al cargar el componente
  useEffect(() => {
    console.log("Verificando autenticación...");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoading(true);
        try {
          console.log("Usuario autenticado, obteniendo datos de Firestore...");
          // Obtener información del usuario desde Firestore
          const docRef = doc(firestore, `usuarios/${user.uid}`);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const userData = docSnap.data();
            console.log("Datos de usuario obtenidos:", userData);
            
            // Verificamos que el rol exista en el documento
            if (!userData.rol) {
              console.error("Error: El documento de usuario no contiene un rol");
              Alert.alert("Error", "No se pudo determinar tu rol de usuario");
              setIsLoading(false);
              return;
            }
            
            // Guardar información del usuario en AsyncStorage con el rol correcto
            const userInfo = {
              uid: user.uid,
              correo: user.email,
              rol: userData.rol // Aseguramos que el rol se guarda correctamente
            };
            
            console.log("Guardando datos en AsyncStorage:", userInfo);
            
            // Primero guardamos en AsyncStorage y LUEGO navegamos
            await AsyncStorage.setItem('userData', JSON.stringify(userInfo));
            
            // Agregamos un pequeño retraso para asegurar que AsyncStorage haya terminado
            setTimeout(() => {
              // Navegar a la pantalla principal CON los datos actualizados
              navigation.reset({
                index: 0,
                routes: [{ 
                  name: 'MantencionPRO',
                  params: { userData: userInfo } // Pasar los datos como parámetro explícito
                }],
              });
            }, 300);
          } else {
            console.error("Error: El documento del usuario no existe en Firestore");
            
            // Si el usuario está autenticado pero no tiene datos en Firestore,
            // mostramos un error y no continuamos con la navegación
            Alert.alert("Error", "No se encontró información de tu usuario");
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error al obtener datos del usuario:', error);
          setError('Ocurrió un error al iniciar sesión: ' + error.message);
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [navigation]);

  const registrarUsuario = async () => {
    if (!email || !password || !rol) {
      setError('Por favor, completa todos los campos, incluyendo el rol');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Registrando nuevo usuario...");
      
      // 1. Crear usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        email, 
        password
      );
      
      const user = userCredential.user;
      console.log("Usuario creado en Authentication:", user.uid);
      
      // 2. Crear documento en la colección "usuarios" de Firestore
      try {
        const userDocRef = doc(firestore, 'usuarios', user.uid);
        
        // Datos a guardar en Firestore
        const userData = {
          correo: email,
          rol: rol,
          createdAt: serverTimestamp()
        };
        
        console.log("Guardando datos en Firestore:", userData);
        
        // Usar setDoc para guardar en Firestore (con un ID específico)
        await setDoc(userDocRef, userData);
        console.log("Documento creado en Firestore para el usuario:", user.uid);
        
        // 3. Guardar en AsyncStorage
        const userInfo = {
          uid: user.uid,
          correo: email,
          rol: rol
        };
        
        await AsyncStorage.setItem('userData', JSON.stringify(userInfo));
        console.log("Datos guardados en AsyncStorage");
        
        // Navegar explícitamente a MantencionPRO con los datos correctos
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ 
              name: 'MantencionPRO',
              params: { userData: userInfo }
            }],
          });
          setIsLoading(false);
        }, 300);
      } catch (firestoreError) {
        console.error("Error al guardar en Firestore:", firestoreError);
        Alert.alert(
          "Advertencia", 
          "Se creó la cuenta pero hubo un problema al guardar tu información. Intenta iniciar sesión nuevamente."
        );
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error al registrar:', error.message);
      
      let errorMessage = 'Error al registrar usuario';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Este correo ya está en uso';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Correo electrónico inválido';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const iniciarSesion = async () => {
    if (!email || !password) {
      setError('Por favor, completa todos los campos');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Iniciando sesión...");
      await signInWithEmailAndPassword(auth, email, password);
      // El manejo de la sesión y la navegación ahora ocurre en el useEffect
    } catch (error) {
      console.error('Error al iniciar sesión:', error.message);
      
      let errorMessage = 'Error al iniciar sesión';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Correo o contraseña incorrectos';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Correo electrónico inválido';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos fallidos. Intenta más tarde';
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (isRegistrando) {
      registrarUsuario();
    } else {
      iniciarSesion();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>{isRegistrando ? 'Regístrate' : 'Inicia sesión'}</Text>
          
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo electrónico:</Text>
            <TextInput
              style={styles.input}
              placeholder="correo@ejemplo.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña:</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
          
          {isRegistrando && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Rol:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={rol}
                  onValueChange={(itemValue) => setRol(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar rol" value="" />
                  <Picker.Item label="Administrador" value="admin" />
                  <Picker.Item label="Mecánico" value="mecanico" />
                  <Picker.Item label="Conductor" value="conductor" />
                </Picker>
              </View>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRegistrando ? 'Registrar' : 'Iniciar sesión'}
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setIsRegistrando(!isRegistrando)}
            disabled={isLoading}
          >
            <Text style={styles.toggleButtonText}>
              {isRegistrando ? 'Ya tengo una cuenta' : 'Quiero registrarme'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
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
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#1890FF',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
  }
});

export default Login;