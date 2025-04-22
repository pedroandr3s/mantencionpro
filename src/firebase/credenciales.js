// Importamos la función para inicializar la aplicación de Firebase
import { initializeApp } from "firebase/app";

// Añade aquí tus credenciales
const firebaseConfig = {
  apiKey: "AIzaSyAjeTrKvlqidhzX6fDrT7Pi6DvmLfYrkCs",
  authDomain: "mecanico-808a8.firebaseapp.com",
  projectId: "mecanico-808a8",
  storageBucket: "mecanico-808a8.firebasestorage.app",
  messagingSenderId: "1097329627016",
  appId: "1:1097329627016:web:cac85e02fb22ae9b58743d",
  measurementId: "G-WLCNFCMXVW"
};

// Inicializamos la aplicación y la guardamos en firebaseApp
const firebaseApp = initializeApp(firebaseConfig);
// Exportamos firebaseApp para poder utilizarla en cualquier lugar de la aplicación
export default firebaseApp;
