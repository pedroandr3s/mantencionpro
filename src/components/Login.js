import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseApp from '../firebase/credenciales';

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Comprobar si el usuario ya está logueado
    const checkLoginStatus = async () => {
      const userDataJSON = localStorage.getItem('userData');
      if (userDataJSON) {
        console.log("Usuario ya está logueado, redirigiendo...");
        navigate('/mantencionpro');
      }
    };

    checkLoginStatus();
  }, [navigate]);

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Por favor, completa todos los campos");
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Sesión iniciada exitosamente:", user.uid);

      // Obtener datos del usuario desde Firestore
      try {
        const docRef = doc(firestore, `usuarios/${user.uid}`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const userData = docSnap.data();
          console.log("Datos obtenidos desde Firestore:", userData);
          
          // Creamos un objeto completo con toda la información
          const userInfo = {
            uid: user.uid,
            correo: user.email,
            rol: userData.rol
          };
          
          // Guardamos en localStorage y pasamos los datos al siguiente componente
          localStorage.setItem('userData', JSON.stringify(userInfo));
          
          // Navegamos al LoadingBridge con los datos del usuario
          navigate('/loading', { 
            state: { userData: userInfo }
          });
        } else {
          console.error("No se encontró documento del usuario");
          alert("No se encontró información del usuario");
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error al obtener datos de Firestore:", error);
        alert("Error al obtener información del usuario");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      alert("Error: " + error.message);
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !role) {
      alert("Por favor, completa todos los campos");
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Crear el usuario en Firestore
      const userDocRef = doc(firestore, `usuarios/${user.uid}`);
      const userInfo = {
        correo: email,
        rol: role
      };
      
      await setDoc(userDocRef, userInfo);
      
      // Agregar UID para localStorage
      const completeUserInfo = {
        uid: user.uid,
        ...userInfo
      };
      
      // Guardar en localStorage y navegar a MantencionPRO
      localStorage.setItem('userData', JSON.stringify(completeUserInfo));
      console.log("Usuario registrado exitosamente:", completeUserInfo);

      navigate('/mantencionpro', { 
        state: { userData: completeUserInfo }
      });
    } catch (error) {
      console.error("Error al registrar:", error);
      alert("Error: " + error.message);
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.formContainer}>
        <h1 style={styles.title}>MantencionPRO</h1>
        <h2 style={styles.subtitle}>
          {isRegistering ? "Crea una Cuenta" : "Inicia Sesión"}
        </h2>
        
        <TextField
          style={styles.input}
          label="Email"
          variant="outlined"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
        />
        
        <TextField
          style={styles.input}
          label="Contraseña"
          variant="outlined"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
        />
        
        {isRegistering && (
          <FormControl style={styles.input} fullWidth>
            <InputLabel>Rol</InputLabel>
            <Select
              value={role}
              label="Rol"
              onChange={(e) => setRole(e.target.value)}
            >
              <MenuItem value="">Selecciona un rol</MenuItem>
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="mecanico">Mecánico</MenuItem>
              <MenuItem value="conductor">Conductor</MenuItem>
            </Select>
          </FormControl>
        )}
        
        <Button
          style={styles.button}
          variant="contained"
          color="primary"
          onClick={isRegistering ? handleRegister : handleLogin}
          disabled={isLoading}
          fullWidth
        >
          {isLoading ? "Cargando..." : (isRegistering ? "Registrarse" : "Iniciar Sesión")}
        </Button>
        
        <Button
          style={styles.switchButton}
          onClick={() => setIsRegistering(!isRegistering)}
          disabled={isLoading}
        >
          {isRegistering 
            ? "¿Ya tienes cuenta? Inicia sesión" 
            : "¿No tienes cuenta? Regístrate"}
        </Button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px'
  },
  formContainer: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '400px'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1890FF',
    textAlign: 'center',
    marginBottom: '8px'
  },
  subtitle: {
    fontSize: '20px',
    color: '#333',
    textAlign: 'center',
    marginBottom: '32px'
  },
  input: {
    marginBottom: '16px'
  },
  button: {
    padding: '12px',
    backgroundColor: '#1890FF',
    color: 'white',
    borderRadius: '8px',
    marginTop: '8px'
  },
  switchButton: {
    marginTop: '16px',
    color: '#1890FF'
  }
};

export default Login;