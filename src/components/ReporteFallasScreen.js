import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
faExclamationTriangle,
faCheckCircle,
faInfoCircle,
faCog,
faTimes,
faTools,
faCarCrash,
faSpinner,
faArrowDown,
faArrowRight,faArrowUp,
faPlus,
faWrench
} from '@fortawesome/free-solid-svg-icons';
import './ReporteFallasScreen.css';

// Firebase imports
import firebaseApp from "../firebase/credenciales";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const ReporteFallasScreen = () => {
const navigate = useNavigate();
const location = useLocation();

// Estados principales
const [titulo, setTitulo] = useState('');
const [descripcion, setDescripcion] = useState('');
const [equipo, setEquipo] = useState('');
const [prioridad, setPrioridad] = useState('media');
const [isLoading, setIsLoading] = useState(false);
const [fallasReportadas, setFallasReportadas] = useState([]);
const [fallasPendientesEnProceso, setFallasPendientesEnProceso] = useState([]);
const [fallasCompletadas, setFallasCompletadas] = useState([]);
const [loadingFallas, setLoadingFallas] = useState(true);
const [userRole, setUserRole] = useState('');
const [userInfo, setUserInfo] = useState(null);
const [equiposDisponibles, setEquiposDisponibles] = useState([]);
const [loadingEquipos, setLoadingEquipos] = useState(true);

// Estados para el modal de atención
const [modalVisible, setModalVisible] = useState(false);
const [fallaSeleccionada, setFallaSeleccionada] = useState(null);
const [nuevoEstado, setNuevoEstado] = useState('en_proceso');
const [comentario, setComentario] = useState('');
const [loadingAtencion, setLoadingAtencion] = useState(false);

// Estados adicionales para el nuevo modal de atención similar a MantencionScreen
const [atencionModalVisible, setAtencionModalVisible] = useState(false);
const [atencionFormData, setAtencionFormData] = useState({
equipo: '',
equipoId: '',
equipoNumero: '',
tipo: 'correctivo',
descripcion: '',
fecha: new Date().toISOString().split('T')[0],
estado: 'en_proceso',
kilometraje: '',
mecanico: '',
repuestos: []
});
const [repuestosDisponibles, setRepuestosDisponibles] = useState([]);
const [repuestosSeleccionados, setRepuestosSeleccionados] = useState([]);
const [modalRepuestosVisible, setModalRepuestosVisible] = useState(false);
const [fallaIdParaMantenimiento, setFallaIdParaMantenimiento] = useState(null);

// Estados para filtrado y ordenación
const [filtroEstado, setFiltroEstado] = useState('todos');
const [ordenarPor, setOrdenarPor] = useState('fecha_desc');
const [busqueda, setBusqueda] = useState('');
const [mostrarFiltros, setMostrarFiltros] = useState(false);
const [filtrosAplicados, setFiltrosAplicados] = useState(false);

// Estado para seguimiento de estadísticas básicas
const [estadisticas, setEstadisticas] = useState({
totalFallas: 0,
fallasPendientes: 0,
fallasEnProceso: 0,
fallasCompletadas: 0,
prioridadAlta: 0,
prioridadMedia: 0,
prioridadBaja: 0
});

// Obtener el rol del usuario
useEffect(() => {
const getUserData = async () => {
try {
const userData = location.state?.userData;

if (userData && userData.rol) {
setUserRole(userData.rol);
setUserInfo(userData);
} else {
// Si no hay datos en location.state, intentar obtener de localStorage
const storedUserData = localStorage.getItem('userData');

if (storedUserData) {
const parsedUserData = JSON.parse(storedUserData);
setUserRole(parsedUserData.rol);
setUserInfo(parsedUserData);
}
}
} catch (error) {
console.error('Error al obtener datos del usuario:', error);
}
};

getUserData();
}, [location.state]);

// Cargar los equipos desde Firebase
const cargarEquipos = async () => {
try {
setLoadingEquipos(true);

// Consultar la colección de equipos
const equiposRef = collection(firestore, 'equipos');

// Primero intentamos con una consulta específica
try {
const qEquipos = query(equiposRef, where('estado', '==', 'Operativo'));
const querySnapshot = await getDocs(qEquipos);

const equipos = [];
querySnapshot.forEach((doc) => {
const equipoData = doc.data();
equipos.push({
id: doc.id,
nombre: `Camión #${equipoData.numero || 'S/N'} - ${equipoData.modelo || ''}`,
numero: equipoData.numero || 'S/N',
modelo: equipoData.modelo || '',
placa: equipoData.placa || '',
estado: equipoData.estado || 'Operativo',
kilometraje: equipoData.kilometraje || 0
});
});

setEquiposDisponibles(equipos);
} catch (queryError) {
console.error('Error en la consulta específica:', queryError);

// Si falla la consulta específica, intentar traer todos los equipos
const snapshotAll = await getDocs(equiposRef);

const equipos = [];
snapshotAll.forEach((doc) => {
const equipoData = doc.data();
// Solo incluir los operativos
if (equipoData.estado === 'Operativo') {
equipos.push({
id: doc.id,
nombre: `Camión #${equipoData.numero || 'S/N'} - ${equipoData.modelo || ''}`,
numero: equipoData.numero || 'S/N',
modelo: equipoData.modelo || '',
placa: equipoData.placa || '',
estado: 'Operativo',
kilometraje: equipoData.kilometraje || 0
});
}
});

setEquiposDisponibles(equipos);
}
} catch (error) {
console.error('Error general al cargar equipos:', error);
alert('Error de conexión. No se pudieron cargar los equipos. ¿Deseas reintentar?');
setEquiposDisponibles([]);
} finally {
setLoadingEquipos(false);
}
};

// Cargar los repuestos desde Firebase
const cargarRepuestos = async () => {
try {
// Consultar la colección de repuestos
const repuestosRef = collection(firestore, 'repuestos');
const querySnapshot = await getDocs(repuestosRef);

const repuestos = [];
querySnapshot.forEach((doc) => {
const repuestoData = doc.data();
// Asegurarse de que haya stock disponible
const stock = repuestoData.stock || repuestoData.cantidad || 0;
repuestos.push({
id: doc.id,
nombre: repuestoData.nombre || 'Repuesto sin nombre',
stock: stock,
precio: repuestoData.precio || 0
});
});

setRepuestosDisponibles(repuestos);
} catch (error) {
console.error('Error al cargar repuestos:', error);
alert('Error de conexión. No se pudieron cargar los repuestos.');
}
};

// Función para reconectar con Firebase
const reconnectFirebase = () => {
cargarEquipos();
cargarFallas();
cargarRepuestos();
};

// Función para categorizar las fallas según su estado
const categorizarFallas = (fallas) => {
const pendientesEnProceso = fallas.filter(falla => 
falla.estado === 'pendiente' || falla.estado === 'en_proceso'
);

const completadas = fallas.filter(falla => 
falla.estado === 'completado'
);

// Actualizar estadísticas
const estadisticasActualizadas = {
totalFallas: fallas.length,
fallasPendientes: fallas.filter(f => f.estado === 'pendiente').length,
fallasEnProceso: fallas.filter(f => f.estado === 'en_proceso').length,
fallasCompletadas: fallas.filter(f => f.estado === 'completado').length,
prioridadAlta: fallas.filter(f => f.prioridad === 'alta').length,
prioridadMedia: fallas.filter(f => f.prioridad === 'media').length,
prioridadBaja: fallas.filter(f => f.prioridad === 'baja').length
};

setEstadisticas(estadisticasActualizadas);
setFallasPendientesEnProceso(pendientesEnProceso);
setFallasCompletadas(completadas);
};

// Función para filtrar y ordenar fallas
const filtrarYOrdenarFallas = (fallas) => {
let fallasFiltradas = [...fallas];

// Aplicar filtro por estado
if (filtroEstado !== 'todos') {
fallasFiltradas = fallasFiltradas.filter(falla => falla.estado === filtroEstado);
}

// Aplicar búsqueda por texto
if (busqueda.trim() !== '') {
const terminoBusqueda = busqueda.toLowerCase().trim();
fallasFiltradas = fallasFiltradas.filter(falla => 
falla.titulo.toLowerCase().includes(terminoBusqueda) || 
falla.descripcion.toLowerCase().includes(terminoBusqueda) ||
falla.equipoNombre.toLowerCase().includes(terminoBusqueda) ||
(falla.numeroTicket && falla.numeroTicket.toString().includes(terminoBusqueda))
);
}

// Aplicar ordenamiento
switch (ordenarPor) {
case 'fecha_asc':
fallasFiltradas.sort((a, b) => {
const fechaA = a.fechaCreacion ? (a.fechaCreacion.toDate ? a.fechaCreacion.toDate() : new Date(a.fechaCreacion)) : new Date(0);
const fechaB = b.fechaCreacion ? (b.fechaCreacion.toDate ? b.fechaCreacion.toDate() : new Date(b.fechaCreacion)) : new Date(0);
return fechaA - fechaB;
});
break;
case 'fecha_desc':
fallasFiltradas.sort((a, b) => {
const fechaA = a.fechaCreacion ? (a.fechaCreacion.toDate ? a.fechaCreacion.toDate() : new Date(a.fechaCreacion)) : new Date(0);
const fechaB = b.fechaCreacion ? (b.fechaCreacion.toDate ? b.fechaCreacion.toDate() : new Date(b.fechaCreacion)) : new Date(0);
return fechaB - fechaA;
});
break;
case 'prioridad':
const prioridadOrden = { 'alta': 1, 'media': 2, 'baja': 3 };
fallasFiltradas.sort((a, b) => {
return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
});
break;
case 'ticket':
fallasFiltradas.sort((a, b) => {
const ticketA = a.numeroTicket || 0;
const ticketB = b.numeroTicket || 0;
return ticketA - ticketB;
});
break;
default:
// Por defecto, ordenar por fecha descendente
fallasFiltradas.sort((a, b) => {
const fechaA = a.fechaCreacion ? (a.fechaCreacion.toDate ? a.fechaCreacion.toDate() : new Date(a.fechaCreacion)) : new Date(0);
const fechaB = b.fechaCreacion ? (b.fechaCreacion.toDate ? b.fechaCreacion.toDate() : new Date(b.fechaCreacion)) : new Date(0);
return fechaB - fechaA;
});
}

return fallasFiltradas;
};

// Cargar las fallas reportadas
const cargarFallas = async () => {
try {
setLoadingFallas(true);
const fallasRef = collection(firestore, 'fallas');
let fallasQuery;

// Si es conductor, mostrar solo sus fallas
if (userRole === 'conductor' && userInfo) {
try {
// Intentar con la consulta indexada
fallasQuery = query(
fallasRef, 
where('usuarioId', '==', userInfo.uid),
orderBy('fechaCreacion', 'desc')
);

const querySnapshot = await getDocs(fallasQuery);
const fallas = [];

querySnapshot.forEach((doc) => {
fallas.push({
id: doc.id,
...doc.data()
});
});

const fallasFiltradas = filtrarYOrdenarFallas(fallas);
setFallasReportadas(fallasFiltradas);
categorizarFallas(fallasFiltradas);
} catch (indexError) {
console.error('Error de índice, usando consulta alternativa:', indexError);

// Si falla por error de índice, usar consulta sin ordenamiento
fallasQuery = query(
fallasRef, 
where('usuarioId', '==', userInfo.uid)
);

const querySnapshot = await getDocs(fallasQuery);
const fallas = [];

querySnapshot.forEach((doc) => {
fallas.push({
id: doc.id,
...doc.data()
});
});

// Ordenar manualmente los resultados
fallas.sort((a, b) => {
// Si no hay fechaCreacion, colocar al final
if (!a.fechaCreacion) return 1;
if (!b.fechaCreacion) return -1;

// Convertir a Date si es necesario
const fechaA = a.fechaCreacion.toDate ? a.fechaCreacion.toDate() : new Date(a.fechaCreacion);
const fechaB = b.fechaCreacion.toDate ? b.fechaCreacion.toDate() : new Date(b.fechaCreacion);

// Ordenar de más reciente a más antiguo
return fechaB - fechaA;
});

const fallasFiltradas = filtrarYOrdenarFallas(fallas);
setFallasReportadas(fallasFiltradas);
categorizarFallas(fallasFiltradas);

// Mostrar alerta para crear el índice solo la primera vez
const indexAlertShown = localStorage.getItem('indexAlertShown');
if (!indexAlertShown) {
alert('Para mejorar el rendimiento, se recomienda crear un índice en Firestore. Por favor, siga el enlace en la consola de desarrollo.');
localStorage.setItem('indexAlertShown', 'true');
}
}
} else {
// Si es admin o mecánico, mostrar todas las fallas
fallasQuery = query(
fallasRef,
orderBy('fechaCreacion', 'desc')
);

const querySnapshot = await getDocs(fallasQuery);
const fallas = [];

querySnapshot.forEach((doc) => {
fallas.push({
id: doc.id,
...doc.data()
});
});

const fallasFiltradas = filtrarYOrdenarFallas(fallas);
setFallasReportadas(fallasFiltradas);
categorizarFallas(fallasFiltradas);
}
} catch (error) {
console.error('Error al cargar fallas:', error);
alert('Error: No se pudieron cargar las fallas reportadas');
} finally {
setLoadingFallas(false);
}
};

// Aplicar filtros y actualizar la lista
const aplicarFiltros = () => {
cargarFallas();
setFiltrosAplicados(true);
};

// Resetear filtros
const resetearFiltros = () => {
setFiltroEstado('todos');
setOrdenarPor('fecha_desc');
setBusqueda('');
setFiltrosAplicados(false);
cargarFallas();
};

// Obtener el último número de ticket
const obtenerUltimoTicket = async () => {
try {
// Consultar directamente la colección de fallas para obtener el ticket más alto
const fallasRef = collection(firestore, 'fallas');
const querySnapshot = await getDocs(fallasRef);

let maxTicket = 0;

// Revisar cada documento para encontrar el número de ticket más alto
querySnapshot.forEach((doc) => {
const fallaData = doc.data();
if (fallaData.numeroTicket && typeof fallaData.numeroTicket === 'number') {
if (fallaData.numeroTicket > maxTicket) {
maxTicket = fallaData.numeroTicket;
}
}
});

console.log('Número de ticket más alto encontrado:', maxTicket);
return maxTicket;
} catch (error) {
console.error('Error al obtener último ticket:', error);
return 0; // Si hay error, comenzar desde 0
}
};

// Cargar datos iniciales
useEffect(() => {
if (userRole) {
cargarFallas();
cargarEquipos();

// Solo cargar repuestos si es admin o mecánico
if (userRole === 'admin' || userRole === 'mecanico') {
cargarRepuestos();
}
}
}, [userRole, userInfo]);

// Efecto para recargar cuando cambian los filtros
useEffect(() => {
if (filtrosAplicados) {
cargarFallas();
}
}, [filtroEstado, ordenarPor, busqueda, filtrosAplicados]);

// Función para reportar una falla
const reportarFalla = async () => {
if (!titulo || !descripcion || !equipo) {
alert('Error: Por favor complete todos los campos');
return;
}

setIsLoading(true);

try {
const currentUser = auth.currentUser;

if (!currentUser) {
alert('Error: Debe iniciar sesión para reportar una falla');
setIsLoading(false);
return;
}

// Obtener datos del equipo seleccionado
const equipoSeleccionado = equiposDisponibles.find(e => e.id === equipo);
if (!equipoSeleccionado) {
alert('Error: Equipo no encontrado');
setIsLoading(false);
return;
}

// Obtener el último número de ticket y generar uno nuevo
const ultimoTicket = await obtenerUltimoTicket();
const nuevoNumeroTicket = ultimoTicket + 1;

// Crear documento en la colección "fallas"
const fallaData = {
numeroTicket: nuevoNumeroTicket,
titulo,
descripcion,
equipoId: equipo,
equipoNombre: equipoSeleccionado.nombre,
equipoNumero: equipoSeleccionado.numero,
prioridad,
estado: 'pendiente',
usuarioId: currentUser.uid,
usuarioEmail: currentUser.email,
usuarioNombre: userInfo?.nombre || currentUser.email,
fechaCreacion: serverTimestamp(),
fechaActualizacion: serverTimestamp(),
historial: [
{
estado: 'pendiente',
fecha: new Date().toISOString(),
usuario: currentUser.email,
comentario: 'Falla reportada'
}
]
};

await addDoc(collection(firestore, 'fallas'), fallaData);

alert(`Éxito: Falla reportada correctamente. Ticket #${nuevoNumeroTicket}`);

// Limpiar el formulario
setTitulo('');
setDescripcion('');
setEquipo('');
setPrioridad('media');

// Recargar las fallas
cargarFallas();
} catch (error) {
console.error('Error al reportar falla:', error);
alert('Error: No se pudo reportar la falla');
} finally {
setIsLoading(false);
}
};

// Función para abrir el modal de atención en el estilo de MantencionScreen
const handleAtenderConMantenimiento = (falla) => {
// Preparar los datos para el formulario de mantenimiento
const datosMantenimiento = {
equipo: falla.equipoNombre || '',
equipoId: falla.equipoId || '',
equipoNumero: falla.equipoNumero || '',
tipo: 'correctivo', // Las fallas siempre generan mantenimientos correctivos
descripcion: `Atención a falla reportada - Ticket #${falla.numeroTicket || 'N/A'}: ${falla.titulo || 'Sin título'}\n\nDescripción original: ${falla.descripcion || 'Sin descripción'}`,
fecha: new Date().toISOString().split('T')[0],
estado: 'en_proceso',
kilometraje: '', // Esto deberá obtenerse del equipo
mecanico: userInfo?.nombre || auth.currentUser?.email || 'Técnico',
fallaId: falla.id, // Referencia a la falla original
repuestos: []
};

// Si el equipo existe, obtener su kilometraje actual
if (falla.equipoId) {
const equipoSeleccionado = equiposDisponibles.find(e => e.id === falla.equipoId);
if (equipoSeleccionado) {
datosMantenimiento.kilometraje = equipoSeleccionado.kilometraje.toString();
}
}

// Guardar la referencia al ID de la falla
setFallaIdParaMantenimiento(falla.id);

// Actualizar el estado del formulario
setAtencionFormData(datosMantenimiento);

// Limpiar repuestos seleccionados
setRepuestosSeleccionados([]);

// Mostrar el modal
setAtencionModalVisible(true);
};

// Función para abrir el modal de atención tradicional
const handleAtender = (falla) => {
setFallaSeleccionada(falla);
setNuevoEstado(falla.estado === 'pendiente' ? 'en_proceso' : 'completado');
setComentario('');
setModalVisible(true);
};

// Función para procesar el mantenimiento y actualizar la falla
const procesarMantenimiento = async () => {
if (!atencionFormData.descripcion) {
alert('Error: Por favor complete la descripción');
return;
}

setIsLoading(true);

try {
const currentUser = auth.currentUser;

if (!currentUser) {
alert('Error: Debe iniciar sesión para atender la falla');
setIsLoading(false);
return;
}

// 1. Crear un nuevo mantenimiento en la colección "mantenimientos"
const mantenimientoData = {
...atencionFormData,
kilometraje: parseInt(atencionFormData.kilometraje) || 0,
repuestos: repuestosSeleccionados,
fechaCreacion: serverTimestamp(),
fechaActualizacion: serverTimestamp(),
usuarioId: currentUser.uid,
usuarioEmail: currentUser.email,
usuarioNombre: userInfo?.nombre || currentUser.email
};

const docRef = await addDoc(collection(firestore, 'mantenimientos'), mantenimientoData);

// 2. Actualizar la falla para cambiarla a estado "en_proceso" o "completado"
if (fallaIdParaMantenimiento) {
const fallaRef = doc(firestore, 'fallas', fallaIdParaMantenimiento);
const fallaDoc = await getDoc(fallaRef);

if (fallaDoc.exists()) {
const fallaData = fallaDoc.data();

// Actualizar el estado de la falla
const nuevoEstadoFalla = atencionFormData.estado === 'completado' ? 'completado' : 'en_proceso';

// Preparar historial
const nuevoHistorial = [
...(fallaData.historial || []),
{
estado: nuevoEstadoFalla,
fecha: new Date().toISOString(),
usuario: currentUser.email,
comentario: `Se generó mantenimiento ${atencionFormData.tipo} - ID: ${docRef.id}`
}
];

await updateDoc(fallaRef, {
estado: nuevoEstadoFalla,
fechaActualizacion: serverTimestamp(),
historial: nuevoHistorial,
tecnicoAsignado: currentUser.email,
tecnicoNombre: userInfo?.nombre || currentUser.email,
mantenimientoId: docRef.id // Referencia al mantenimiento creado
});
}
}

// 3. Si se usaron repuestos, actualizar el inventario
if (repuestosSeleccionados.length > 0) {
for (const repuesto of repuestosSeleccionados) {
const repuestoRef = doc(firestore, 'repuestos', repuesto.id);
const repuestoDoc = await getDoc(repuestoRef);

if (repuestoDoc.exists()) {
const repuestoData = repuestoDoc.data();
const stockActual = repuestoData.stock || repuestoData.cantidad || 0;
const nuevoStock = Math.max(0, stockActual - repuesto.cantidad);

await updateDoc(repuestoRef, {
stock: nuevoStock,
cantidad: nuevoStock,
fechaActualizacion: serverTimestamp()
});
}
}
}

// 4. Actualizar la lista de fallas
cargarFallas();

// 5. Cerrar el modal
setAtencionModalVisible(false);

alert('Éxito: Se ha registrado el mantenimiento y actualizado la falla');
} catch (error) {
console.error('Error al procesar mantenimiento:', error);
alert('Error: No se pudo procesar el mantenimiento. ' + error.message);
} finally {
setIsLoading(false);
}
};

// Función para procesar la atención de la falla (método tradicional)
const procesarAtencion = async () => {
if (!comentario) {
alert('Error: Por favor ingrese un comentario');
return;
}

setLoadingAtencion(true);

try {
const currentUser = auth.currentUser;

if (!currentUser) {
alert('Error: Debe iniciar sesión para atender la falla');
setLoadingAtencion(false);
return;
}

// Preparar historial
const nuevoHistorial = [
...(fallaSeleccionada.historial || []),
{
estado: nuevoEstado,
fecha: new Date().toISOString(),
usuario: currentUser.email,
comentario: comentario
}
];

// Actualizar documento en la colección "fallas"
const fallaRef = doc(firestore, 'fallas', fallaSeleccionada.id);

await updateDoc(fallaRef, {
estado: nuevoEstado,
fechaActualizacion: serverTimestamp(),
historial: nuevoHistorial,
tecnicoAsignado: currentUser.email,
tecnicoNombre: userInfo?.nombre || currentUser.email
});

// Si se completa la falla y hay un equipo asociado, actualizar su estado
if (nuevoEstado === 'completado' && fallaSeleccionada.equipoId) {
const equipoRef = doc(firestore, 'equipos', fallaSeleccionada.equipoId);
// Solo cambiar el estado si está en mantenimiento
const equipoDoc = await getDoc(equipoRef);
if (equipoDoc.exists() && equipoDoc.data().estado === 'En Mantenimiento') {
await updateDoc(equipoRef, {
estado: 'Operativo',
fechaActualizacion: serverTimestamp()
});
}
}

alert(`Éxito: Falla ${nuevoEstado === 'en_proceso' ? 'en proceso' : 'completada'} correctamente`);

// Cerrar modal
setModalVisible(false);

// Recargar las fallas
cargarFallas();
} catch (error) {
console.error('Error al atender falla:', error);
alert('Error: No se pudo actualizar el estado de la falla');
} finally {
setLoadingAtencion(false);
}
};

// Función para exportar las fallas a CSV
const exportarFallasCSV = () => {
try {
// Preparar los datos para exportar
const headers = [
'Ticket',
'Título',
'Equipo',
'Estado',
'Prioridad',
'Fecha Reporte',
'Reportado Por',
'Técnico',
'Descripción'
].join(',');

const fallasData = fallasReportadas.map(falla => {
const fecha = falla.fechaCreacion ? 
(falla.fechaCreacion.toDate ? 
falla.fechaCreacion.toDate().toLocaleDateString() : 
new Date(falla.fechaCreacion).toLocaleDateString()
) : 'N/A';

// Escapar cualquier coma en los textos para evitar problemas con el CSV
const tituloEscapado = falla.titulo ? `"${falla.titulo.replace(/"/g, '""')}"` : '';
const descripcionEscapada = falla.descripcion ? `"${falla.descripcion.replace(/"/g, '""')}"` : '';

return [
falla.numeroTicket || 'N/A',
tituloEscapado,
falla.equipoNombre || 'N/A',
falla.estado || 'N/A',
falla.prioridad || 'N/A',
fecha,
falla.usuarioNombre || falla.usuarioEmail || 'N/A',
falla.tecnicoNombre || falla.tecnicoAsignado || 'Sin asignar',
descripcionEscapada
].join(',');
}).join('\n');

const csvContent = `${headers}\n${fallasData}`;

// Crear un blob y descargar
const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.setAttribute('href', url);
link.setAttribute('download', `fallas_reporte_${new Date().toISOString().slice(0, 10)}.csv`);
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
} catch (error) {
console.error('Error al exportar CSV:', error);
alert('Error al exportar las fallas a CSV');
}
};

// Función para agregar un repuesto a la lista
const handleAddRepuesto = (id, nombre, stockActual) => {
console.log("Agregando repuesto:", id, nombre, stockActual);

// Verificar si ya existe en la lista
const existente = repuestosSeleccionados.find(r => r.id === id);

if (existente) {
// Si ya existe, verificar stock disponible
if (existente.cantidad >= stockActual) {
alert(`¡Atención! No hay suficiente stock de ${nombre}.\nDisponible: ${stockActual} unidades`);
return;
}

// Incrementar cantidad
const nuevosRepuestos = repuestosSeleccionados.map(r => 
r.id === id ? { ...r, cantidad: r.cantidad + 1 } : r
);

setRepuestosSeleccionados(nuevosRepuestos);
} else {
// Si no existe, verificar stock
if (stockActual <= 0) {
alert(`¡Atención! No hay stock disponible de ${nombre}`);
return;
}

// Agregar nuevo con cantidad 1
setRepuestosSeleccionados([
...repuestosSeleccionados,
{ id, nombre, cantidad: 1 }
]);
}
};

// Función para eliminar un repuesto de la lista
const handleRemoveRepuesto = (id) => {
const nuevosRepuestos = repuestosSeleccionados.filter(r => r.id !== id);
setRepuestosSeleccionados(nuevosRepuestos);
};

// Función para obtener color según prioridad
const getPrioridadColor = (prioridad) => {
switch (prioridad) {
case 'alta':
return '#F44336';
case 'media':
return '#FF9800';
case 'baja':
return '#4CAF50';
default:
return '#FF9800';
}
};

// Función para obtener color según estado
const getEstadoColor = (estado) => {
switch (estado) {
case 'pendiente':
return '#FF9800';
case 'en_proceso':
return '#2196F3';
case 'completado':
return '#4CAF50';
case 'cancelado':
return '#9E9E9E';
default:
return '#FF9800';
}
};

// Función para formatear la fecha
const formatearFecha = (timestamp) => {
if (!timestamp) return 'Fecha no disponible';

const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
return fecha.toLocaleDateString('es-ES', {
year: 'numeric',
month: 'short',
day: 'numeric',
hour: '2-digit',
minute: '2-digit'
});
};

// Función para obtener texto del botón según estado
const getTextoBoton = (estado) => {
switch (estado) {
case 'pendiente':
return 'Atender';
case 'en_proceso':
return 'Completar';
case 'completado':
return 'Ver Detalles';
default:
return 'Atender';
}
};

// Componente de tarjeta de falla para reutilización
const FallaCard = ({ falla }) => (
<div className="falla-card">
<div className="falla-header">
<div className="falla-info">
{/* Mostrar número de ticket */}
{(userRole === 'admin' || userRole === 'mecanico') && (
<div className="ticket-badge">
Ticket #{falla.numeroTicket || '?'}
</div>
)}
<h3 className="falla-titulo">{falla.titulo}</h3>
<p className="falla-equipo">{falla.equipoNombre}</p>

{/* Mostrar quién reportó (solo para admin/mecánico) */}
{(userRole === 'admin' || userRole === 'mecanico') && (
<p className="falla-reporter">
Reportado por: {falla.usuarioNombre || falla.usuarioEmail || 'Usuario desconocido'}
</p>
)}
</div>
<div 
className="prioridad-badge"
style={{ backgroundColor: getPrioridadColor(falla.prioridad) }}
>
{falla.prioridad.charAt(0).toUpperCase() + falla.prioridad.slice(1)}
</div>
</div>

<p className="falla-descripcion">{falla.descripcion}</p>

<div className="falla-footer">
<div 
className="estado-badge"
style={{ backgroundColor: getEstadoColor(falla.estado) }}
>
{falla.estado === 'pendiente' ? 'Pendiente' : 
falla.estado === 'en_proceso' ? 'En proceso' :
falla.estado === 'completado' ? 'Completado' : 'Cancelado'}
</div>
<p className="falla-fecha">
{falla.fechaCreacion ? formatearFecha(falla.fechaCreacion) : 'Fecha no disponible'}
</p>
</div>

{falla.tecnicoAsignado && falla.estado !== 'pendiente' && (
<p className="falla-tecnico">
Atendido por: {falla.tecnicoNombre || falla.tecnicoAsignado}
</p>
)}

{(userRole === 'admin' || userRole === 'mecanico') && falla.estado !== 'cancelado' && (
<div className="falla-buttons-container">
{/* Botón para atender con el nuevo sistema de mantenimiento */}
<button 
className="atender-mantenimiento-button"
style={{ backgroundColor: '#1890FF' }}
onClick={() => handleAtenderConMantenimiento(falla)}
disabled={falla.estado === 'completado'}
>
<FontAwesomeIcon icon={faWrench} className="icon-left" />
Atender con Mantenimiento
</button>

{/* Botón tradicional para atender */}
<button 
className="atender-button"
style={{ backgroundColor: getEstadoColor(falla.estado) }}
onClick={() => handleAtender(falla)}
>
{falla.estado === 'pendiente' && <FontAwesomeIcon icon={faCog} className="icon-left" />}
{falla.estado === 'en_proceso' && <FontAwesomeIcon icon={faCheckCircle} className="icon-left" />}
{falla.estado === 'completado' && <FontAwesomeIcon icon={faInfoCircle} className="icon-left" />}
{getTextoBoton(falla.estado)}
</button>
</div>
)}
</div>
);

// Componente Dashboard de estadísticas
const EstadisticasDashboard = () => (
<div className="estadisticas-dashboard">
<h3 className="dashboard-title">Resumen de Fallas</h3>
<div className="estadisticas-grid">
<div className="estadistica-card">
<p className="estadistica-valor">{estadisticas.totalFallas}</p>
<p className="estadistica-titulo">Total Fallas</p>
</div>
<div className="estadistica-card" style={{ backgroundColor: '#FFF3E0' }}>
<p className="estadistica-valor">{estadisticas.fallasPendientes}</p>
<p className="estadistica-titulo">Pendientes</p>
</div>
<div className="estadistica-card" style={{ backgroundColor: '#E3F2FD' }}>
<p className="estadistica-valor">{estadisticas.fallasEnProceso}</p>
<p className="estadistica-titulo">En Proceso</p>
</div>
<div className="estadistica-card" style={{ backgroundColor: '#E8F5E9' }}>
<p className="estadistica-valor">{estadisticas.fallasCompletadas}</p>
<p className="estadistica-titulo">Completadas</p>
</div>
</div>
<div className="estadisticas-prioridad">
<div className="prioridad-barra">
<span 
className="prioridad-segmento alta" 
style={{ 
width: `${estadisticas.totalFallas ? (estadisticas.prioridadAlta / estadisticas.totalFallas * 100) : 0}%`,
backgroundColor: getPrioridadColor('alta')
}}
></span>
<span 
className="prioridad-segmento media" 
style={{ 
width: `${estadisticas.totalFallas ? (estadisticas.prioridadMedia / estadisticas.totalFallas * 100) : 0}%`,
backgroundColor: getPrioridadColor('media')
}}
></span>
<span 
className="prioridad-segmento baja" 
style={{ 
width: `${estadisticas.totalFallas ? (estadisticas.prioridadBaja / estadisticas.totalFallas * 100) : 0}%`,
backgroundColor: getPrioridadColor('baja')
}}
></span>
</div>
<div className="prioridad-leyenda">
<div className="leyenda-item">
<span className="leyenda-color" style={{ backgroundColor: getPrioridadColor('alta') }}></span>
<span className="leyenda-texto">Alta: {estadisticas.prioridadAlta}</span>
</div>
<div className="leyenda-item">
<span className="leyenda-color" style={{ backgroundColor: getPrioridadColor('media') }}></span>
<span className="leyenda-texto">Media: {estadisticas.prioridadMedia}</span>
</div>
<div className="leyenda-item">
<span className="leyenda-color" style={{ backgroundColor: getPrioridadColor('baja') }}></span>
<span className="leyenda-texto">Baja: {estadisticas.prioridadBaja}</span>
</div>
</div>
</div>
</div>
);

// Función para actualizar una falla
const actualizarFallaDirecta = async (fallaId, nuevosDatos) => {
try {
const fallaRef = doc(firestore, 'fallas', fallaId);
await updateDoc(fallaRef, {
...nuevosDatos,
fechaActualizacion: serverTimestamp()
});

cargarFallas();
return true;
} catch (error) {
console.error('Error al actualizar falla:', error);
return false;
}
};

// Función para cancelar una falla
const cancelarFalla = async (fallaId, motivo) => {
if (!motivo) {
alert('Por favor ingrese un motivo para cancelar la falla');
return false;
}

try {
const currentUser = auth.currentUser;
if (!currentUser) {
alert('Error: Debe iniciar sesión para cancelar una falla');
return false;
}

const fallaRef = doc(firestore, 'fallas', fallaId);
const fallaDoc = await getDoc(fallaRef);

if (fallaDoc.exists()) {
const fallaData = fallaDoc.data();

// Verificar si ya está completada
if (fallaData.estado === 'completado') {
alert('Esta falla ya ha sido completada y no puede ser cancelada');
return false;
}

// Preparar historial
const nuevoHistorial = [
...(fallaData.historial || []),
{
estado: 'cancelado',
fecha: new Date().toISOString(),
usuario: currentUser.email,
comentario: `Falla cancelada: ${motivo}`
}
];

await updateDoc(fallaRef, {
estado: 'cancelado',
fechaActualizacion: serverTimestamp(),
historial: nuevoHistorial,
motivoCancelacion: motivo,
usuarioCancelacion: currentUser.email,
nombreUsuarioCancelacion: userInfo?.nombre || currentUser.email
});

cargarFallas();
alert('Falla cancelada correctamente');
return true;
} else {
alert('No se encontró la falla especificada');
return false;
}
} catch (error) {
console.error('Error al cancelar falla:', error);
alert('Error: No se pudo cancelar la falla');
return false;
}
};

// Función para obtener estadísticas por equipo
const obtenerEstadisticasPorEquipo = () => {
const estadisticasEquipo = {};

fallasReportadas.forEach(falla => {
const equipoId = falla.equipoId || 'sin_equipo';
const equipoNombre = falla.equipoNombre || 'Sin equipo asignado';

if (!estadisticasEquipo[equipoId]) {
estadisticasEquipo[equipoId] = {
nombre: equipoNombre,
total: 0,
pendientes: 0,
enProceso: 0,
completadas: 0,
canceladas: 0
};
}

estadisticasEquipo[equipoId].total += 1;

switch (falla.estado) {
case 'pendiente':
estadisticasEquipo[equipoId].pendientes += 1;
break;
case 'en_proceso':
estadisticasEquipo[equipoId].enProceso += 1;
break;
case 'completado':
estadisticasEquipo[equipoId].completadas += 1;
break;
case 'cancelado':
estadisticasEquipo[equipoId].canceladas += 1;
break;
default:
break;
}
});

return Object.values(estadisticasEquipo).sort((a, b) => b.total - a.total);
};

// Componente de Filtros de Búsqueda
const FiltrosBusqueda = () => (
<div className={`filtros-container ${mostrarFiltros ? 'expanded' : ''}`}>
<div className="filtros-header" onClick={() => setMostrarFiltros(!mostrarFiltros)}>
<h3 className="filtros-title">Filtros y Búsqueda</h3>
<button className="toggle-filtros-btn">
<FontAwesomeIcon icon={mostrarFiltros ? faArrowUp : faArrowDown} />
</button>
</div>

{mostrarFiltros && (
<div className="filtros-content">
<div className="filtro-group">
<label className="filtro-label">Estado:</label>
<select
className="filtro-select"
value={filtroEstado}
onChange={(e) => setFiltroEstado(e.target.value)}
>
<option value="todos">Todos los estados</option>
<option value="pendiente">Pendiente</option>
<option value="en_proceso">En proceso</option>
<option value="completado">Completado</option>
<option value="cancelado">Cancelado</option>
</select>
</div>

<div className="filtro-group">
<label className="filtro-label">Ordenar por:</label>
<select
className="filtro-select"
value={ordenarPor}
onChange={(e) => setOrdenarPor(e.target.value)}
>
<option value="fecha_desc">Fecha (Reciente primero)</option>
<option value="fecha_asc">Fecha (Antiguo primero)</option>
<option value="prioridad">Prioridad (Alta primero)</option>
<option value="ticket">Número de Ticket</option>
</select>
</div>

<div className="filtro-group">
<label className="filtro-label">Buscar:</label>
<input
type="text"
className="filtro-input"
placeholder="Buscar por título, descripción o equipo..."
value={busqueda}
onChange={(e) => setBusqueda(e.target.value)}
/>
</div>

<div className="filtros-buttons">
<button 
className="filtro-btn aplicar"
onClick={aplicarFiltros}
>
<FontAwesomeIcon icon={faCheckCircle} className="btn-icon" />
Aplicar Filtros
</button>

<button 
className="filtro-btn reset"
onClick={resetearFiltros}
>
<FontAwesomeIcon icon={faTimes} className="btn-icon" />
Resetear
</button>
</div>
</div>
)}
</div>
);
return (
  <div className="reporte-fallas-container">
    <div className="reporte-fallas-header">
      <h1 className="reporte-fallas-title">
        {userRole === 'conductor' ? 'Reportar Falla' : 'Gestión de Fallas Reportadas'}
      </h1>
      
      {/* Botones de acción para administradores y mecánicos */}
      {(userRole === 'admin' || userRole === 'mecanico') && (
        <div className="header-actions">
          <button 
            className="export-btn"
            onClick={exportarFallasCSV}
            disabled={loadingFallas || fallasReportadas.length === 0}
          >
            <FontAwesomeIcon icon={faArrowDown} className="btn-icon" />
            Exportar CSV
          </button>
        </div>
      )}
    </div>

    {/* Formulario para reportar falla (solo visible para conductores) */}
    {userRole === 'conductor' && (
      <div className="reporte-form-card">
        <div className="form-group">
          <label className="form-label">Título:</label>
          <input
            className="form-input"
            type="text"
            placeholder="Ej: Falla en frenos"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Equipo:</label>
          <div className="select-container">
            {loadingEquipos ? (
              <div className="loading-indicator">
                <FontAwesomeIcon icon={faSpinner} spin />
              </div>
            ) : (
              <select
                className="form-select"
                value={equipo}
                onChange={(e) => setEquipo(e.target.value)}
              >
                <option value="">Seleccione un equipo</option>
                {equiposDisponibles.map((equipoItem) => (
                  <option key={equipoItem.id} value={equipoItem.id}>
                    {equipoItem.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Prioridad:</label>
          <div className="select-container">
            <select
              className="form-select"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Descripción:</label>
          <textarea
            className="form-textarea"
            placeholder="Describa detalladamente la falla observada"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows="4"
          ></textarea>
        </div>

        <button
          className="submit-button"
          onClick={reportarFalla}
          disabled={isLoading}
        >
          {isLoading ? (
            <FontAwesomeIcon icon={faSpinner} spin className="icon-left" />
          ) : (
            <FontAwesomeIcon icon={faExclamationTriangle} className="icon-left" />
          )}
          Reportar Falla
        </button>
      </div>
    )}

    {/* Mostrar dashboard de estadísticas para admin y mecánico */}
    {(userRole === 'admin' || userRole === 'mecanico') && !loadingFallas && (
      <EstadisticasDashboard />
    )}
    
    {/* Filtros y búsqueda para admin y mecánico */}
    {(userRole === 'admin' || userRole === 'mecanico') && (
      <FiltrosBusqueda />
    )}

    {/* Secciones categorizadas de fallas */}
    {loadingFallas ? (
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="loading-text">Cargando fallas...</p>
      </div>
    ) : fallasReportadas.length === 0 ? (
      <div className="empty-state">
        <FontAwesomeIcon icon={faInfoCircle} className="empty-icon" />
        <p className="empty-text">No hay fallas reportadas</p>
      </div>
    ) : (
      <>
        {/* 1. Sección de Fallas Pendientes y En Proceso */}
        <div className="fallas-list-section pendientes-section">
          <h2 className="section-title">Fallas Pendientes o En Proceso</h2>
          
          {fallasPendientesEnProceso.length === 0 ? (
            <div className="empty-state">
              <FontAwesomeIcon icon={faInfoCircle} className="empty-icon" />
              <p className="empty-text">No hay fallas pendientes o en proceso</p>
            </div>
          ) : (
            <div className="fallas-grid">
              {fallasPendientesEnProceso.map((falla) => (
                <FallaCard key={falla.id} falla={falla} />
              ))}
            </div>
          )}
        </div>

        {/* 2. Sección de Fallas Completadas */}
        <div className="fallas-list-section completadas-section">
          <h2 className="section-title">Fallas Completadas</h2>
          
          {fallasCompletadas.length === 0 ? (
            <div className="empty-state">
              <FontAwesomeIcon icon={faInfoCircle} className="empty-icon" />
              <p className="empty-text">No hay fallas completadas</p>
            </div>
          ) : (
            <div className="fallas-grid">
              {fallasCompletadas.map((falla) => (
                <FallaCard key={falla.id} falla={falla} />
              ))}
            </div>
          )}
        </div>
      </>
    )}

    {/* Modal para atender falla (estilo tradicional) */}
    {modalVisible && (
      <div className="modal-backdrop">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">
              {nuevoEstado === 'en_proceso' ? 'Atender Falla' : 'Completar Falla'}
            </h2>
            <button 
              className="close-button" 
              onClick={() => setModalVisible(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          {fallaSeleccionada && (
            <div className="modal-body">
              <div className="falla-details">
                {/* Mostrar número de ticket en el modal */}
                <div className="ticket-badge modal-ticket">
                  Ticket #{fallaSeleccionada.numeroTicket || '?'}
                </div>
                <h3 className="falla-titulo-modal">{fallaSeleccionada.titulo}</h3>
                <p className="falla-equipo-modal">{fallaSeleccionada.equipoNombre}</p>
                <p className="falla-reporter-modal">
                  Reportado por: {fallaSeleccionada.usuarioNombre || fallaSeleccionada.usuarioEmail || 'Usuario desconocido'}
                </p>
                <p className="falla-fecha-modal">
                  Fecha de reporte: {fallaSeleccionada.fechaCreacion ? formatearFecha(fallaSeleccionada.fechaCreacion) : 'Fecha no disponible'}
                </p>
                <div 
                  className="estado-badge modal-estado"
                  style={{ backgroundColor: getEstadoColor(fallaSeleccionada.estado) }}
                >
                  Estado actual: {fallaSeleccionada.estado === 'pendiente' ? 'Pendiente' : 
                                fallaSeleccionada.estado === 'en_proceso' ? 'En proceso' : 'Completado'}
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Actualizar estado a:</label>
                <div className="select-container">
                  <select
                    className="form-select"
                    value={nuevoEstado}
                    onChange={(e) => setNuevoEstado(e.target.value)}
                    disabled={fallaSeleccionada.estado === 'completado'}
                  >
                    {fallaSeleccionada.estado === 'pendiente' && (
                      <option value="en_proceso">En proceso</option>
                    )}
                    {(fallaSeleccionada.estado === 'pendiente' || fallaSeleccionada.estado === 'en_proceso') && (
                      <option value="completado">Completado</option>
                    )}
                    {fallaSeleccionada.estado === 'en_proceso' && (
                      <option value="cancelado">Cancelado</option>
                    )}
                    {fallaSeleccionada.estado === 'completado' && (
                      <option value="completado">Completado</option>
                    )}
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Comentario:</label>
                <textarea
                  className="form-textarea"
                  placeholder="Agregue un comentario sobre la atención realizada"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows="4"
                  disabled={fallaSeleccionada.estado === 'completado'}
                ></textarea>
              </div>
              
              {fallaSeleccionada.historial && fallaSeleccionada.historial.length > 0 && (
                <div className="historial-section">
                  <h4 className="historial-title">Historial de la falla:</h4>
                  <div className="historial-items">
                    {fallaSeleccionada.historial.map((item, index) => (
                      <div 
                        key={index} 
                        className="historial-item"
                        style={{ borderLeftColor: getEstadoColor(item.estado) }}
                      >
                        <div className="historial-header">
                          <span className="historial-fecha">
                            {new Date(item.fecha).toLocaleString()}
                          </span>
                        </div>
                        <p className="historial-usuario">Por: {item.usuario}</p>
                        <p className="historial-comentario">{item.comentario}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {fallaSeleccionada.estado !== 'completado' && (
                <button
                  className="proceso-button"
                  style={{ backgroundColor: getEstadoColor(nuevoEstado) }}
                  onClick={procesarAtencion}
                  disabled={loadingAtencion}
                >
                  {loadingAtencion ? (
                    <FontAwesomeIcon icon={faSpinner} spin className="icon-left" />
                  ) : (
                    <>
                      {nuevoEstado === 'en_proceso' && <FontAwesomeIcon icon={faCog} className="icon-left" />}
                      {nuevoEstado === 'completado' && <FontAwesomeIcon icon={faCheckCircle} className="icon-left" />}
                      {nuevoEstado === 'cancelado' && <FontAwesomeIcon icon={faTimes} className="icon-left" />}
                      {nuevoEstado === 'en_proceso' ? 'Iniciar atención' : 
                      nuevoEstado === 'completado' ? 'Marcar como completado' : 'Cancelar falla'}
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )}
    
    {/* Nuevo Modal para atender falla con mantenimiento (estilo MantencionScreen) */}
    {atencionModalVisible && (
      <div className="modal-backdrop">
        <div className="modal-content mantencion-modal">
          <div className="modal-header">
            <h2 className="modal-title">
              Registrar Mantenimiento para Falla
            </h2>
            <button 
              className="close-button" 
              onClick={() => setAtencionModalVisible(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          <div className="modal-body">
            <div className="form-container">
              {/* Campo de equipo (pre-rellenado y deshabilitado) */}
              <div className="form-group">
                <label className="form-label">Equipo:</label>
                <input
                  type="text"
                  className="form-input"
                  value={atencionFormData.equipo}
                  disabled
                />
              </div>
              
              {/* Tipo de mantenimiento (predeterminado como correctivo) */}
              <div className="form-group">
                <label className="form-label">Tipo de mantenimiento:</label>
                <div className="select-container">
                  <select
                    className="form-select"
                    value={atencionFormData.tipo}
                    onChange={(e) => setAtencionFormData({...atencionFormData, tipo: e.target.value})}
                  >
                    <option value="correctivo">Correctivo</option>
                    <option value="preventivo">Preventivo</option>
                  </select>
                </div>
              </div>
              
              {/* Kilometraje actual */}
              <div className="form-group">
                <label className="form-label">Kilometraje actual:</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Kilometraje actual del equipo"
                  value={atencionFormData.kilometraje}
                  onChange={(e) => setAtencionFormData({...atencionFormData, kilometraje: e.target.value})}
                />
              </div>
              
              {/* Mecánico asignado */}
              <div className="form-group">
                <label className="form-label">Mecánico asignado:</label>
                <input
                  type="text"
                  className="form-input"
                  value={atencionFormData.mecanico}
                  onChange={(e) => setAtencionFormData({...atencionFormData, mecanico: e.target.value})}
                />
              </div>
              
              {/* Descripción */}
              <div className="form-group">
                <label className="form-label">Descripción detallada:</label>
                <textarea
                  className="form-textarea"
                  placeholder="Describa el mantenimiento a realizar"
                  value={atencionFormData.descripcion}
                  onChange={(e) => setAtencionFormData({...atencionFormData, descripcion: e.target.value})}
                  rows="4"
                ></textarea>
              </div>
              
              {/* Estado de mantenimiento */}
              <div className="form-group">
                <label className="form-label">Estado:</label>
                <div className="select-container">
                  <select
                    className="form-select"
                    value={atencionFormData.estado}
                    onChange={(e) => setAtencionFormData({...atencionFormData, estado: e.target.value})}
                  >
                    <option value="en_proceso">En proceso</option>
                    <option value="completado">Completado</option>
                  </select>
                </div>
              </div>
              
              {/* Repuestos */}
              <div className="form-group">
                <label className="form-label">Repuestos e Insumos:</label>
                <div className="repuestos-container">
                  {repuestosSeleccionados.map((repuesto) => (
                    <div key={repuesto.id} className="repuesto-seleccionado">
                      <span className="repuesto-nombre">
                        <strong>{repuesto.nombre}</strong> x{repuesto.cantidad}
                      </span>
                      <button 
                        className="remove-repuesto-btn"
                        onClick={() => handleRemoveRepuesto(repuesto.id)}
                      >
                        <FontAwesomeIcon icon={faTimes} size={16} color="#FF4D4F" />
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    className="agregar-repuesto-btn"
                    onClick={() => setModalRepuestosVisible(true)}
                  >
                    <FontAwesomeIcon icon={faPlus} size={16} color="#1890FF" />
                    <span>Agregar Repuestos</span>
                  </button>
                </div>
              </div>
              
              <button 
                className="submit-button"
                onClick={procesarMantenimiento}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="button-spinner">
                    <FontAwesomeIcon icon={faSpinner} spin />
                  </div>
                ) : (
                  "Registrar Mantenimiento"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    
    {/* Modal para seleccionar repuestos */}
    {modalRepuestosVisible && (
      <div className="modal-backdrop">
        <div className="modal-content repuestos-modal">
          <div className="modal-header">
            <h3 className="modal-title">Seleccionar Repuestos</h3>
            <button 
              className="close-button" 
              onClick={() => setModalRepuestosVisible(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          <div className="repuestos-list">
            {repuestosDisponibles.length > 0 ? (
              repuestosDisponibles.map(item => {
                // Para cada repuesto, calculamos si ya está en la lista
                const repuestoExistente = repuestosSeleccionados.find(r => r.id === item.id);
                const cantidadActual = repuestoExistente ? repuestoExistente.cantidad : 0;
                const stockDisponible = item.stock || 0;
                
                return (
                  <div 
                    key={item.id}
                    className="repuesto-list-item"
                  >
                    <div className="repuesto-info">
                      <p className="repuesto-nombre-lista">{item.nombre}</p>
                      <p className="repuesto-stock" style={{ 
                        color: stockDisponible <= 0 ? '#FF4D4F' : 'inherit' 
                      }}>
                        Stock: {stockDisponible} unidades
                      </p>
                    </div>
                    
                    {/* Control de cantidad */}
                    <div className="cantidad-control">
                      {cantidadActual > 0 && (
                        <button 
                          className="btn-cantidad-menos"
                          onClick={() => {
                            if (cantidadActual === 1) {
                              // Si solo queda 1, eliminamos el repuesto
                              handleRemoveRepuesto(item.id);
                            } else {
                              // Disminuir la cantidad
                              const nuevosRepuestos = repuestosSeleccionados.map(r => 
                                r.id === item.id ? { ...r, cantidad: r.cantidad - 1 } : r
                              );
                              setRepuestosSeleccionados(nuevosRepuestos);
                            }
                          }}
                        >
                          -
                        </button>
                      )}
                      
                      {cantidadActual > 0 && (
                        <div className="cantidad-actual">
                          {cantidadActual}
                        </div>
                      )}
                      
                      <button 
                        className="btn-cantidad-mas"
                        onClick={() => handleAddRepuesto(item.id, item.nombre, stockDisponible)}
                        disabled={stockDisponible <= 0 || cantidadActual >= stockDisponible}
                        style={{
                          backgroundColor: stockDisponible <= 0 ? '#f5f5f5' : '#1890FF',
                          cursor: stockDisponible <= 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-list">
                <p className="empty-text">No hay repuestos disponibles</p>
              </div>
            )}
          </div>
          
          <button 
            className="submit-button"
            onClick={() => setModalRepuestosVisible(false)}
          >
            Confirmar Selección
          </button>
        </div>
      </div>
    )}
    
    {/* Estilos adicionales para los componentes */}
    <style jsx>{`
      /* Estilos generales */
      .reporte-fallas-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      
      .reporte-fallas-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #f0f0f0;
      }
      
      .modal-title {
        margin: 0;
        font-size: 20px;
        color: #1a1a1a;
      }
      
      .close-button {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #999;
      }
      
      .modal-body {
        padding: 20px;
      }
      
      .falla-details {
        margin-bottom: 20px;
      }
      
      .modal-ticket {
        font-size: 14px;
        margin-bottom: 10px;
      }
      
      .falla-titulo-modal {
        margin: 0 0 10px 0;
        font-size: 20px;
        color: #1a1a1a;
      }
      
      .falla-equipo-modal,
      .falla-reporter-modal,
      .falla-fecha-modal {
        margin: 8px 0;
        font-size: 14px;
        color: #666;
      }
      
      .modal-estado {
        display: inline-block;
        margin-top: 10px;
      }
      
      .historial-section {
        margin-top: 20px;
        border-top: 1px solid #f0f0f0;
        padding-top: 20px;
      }
      
      .historial-title {
        margin: 0 0 16px 0;
        font-size: 16px;
        color: #333;
      }
      
      .historial-items {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .historial-item {
        border-left: 4px solid #ccc;
        padding-left: 12px;
        margin-left: 6px;
      }
      
      .historial-fecha {
        font-size: 13px;
        color: #888;
      }
      
      .historial-usuario {
        margin: 4px 0;
        font-size: 13px;
        font-weight: 500;
        color: #555;
      }
      
      .historial-comentario {
        margin: 4px 0 0 0;
        font-size: 14px;
        color: #333;
      }
      
      .proceso-button {
        margin-top: 20px;
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 4px;
        color: white;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      
      /* Estilos para el modal de mantenimiento */
      .mantencion-modal {
        max-width: 650px;
        width: 90%;
      }
      
      /* Estilos para el contenedor de repuestos */
      .repuestos-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
        border: 1px solid #e8e8e8;
        border-radius: 4px;
        padding: 12px;
        background-color: #f9f9f9;
      }
      
      .repuesto-seleccionado {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: white;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid #e8e8e8;
      }
      
      .agregar-repuesto-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background-color: transparent;
        border: 1px dashed #1890FF;
        border-radius: 4px;
        padding: 8px;
        cursor: pointer;
        color: #1890FF;
        font-weight: 500;
        margin-top: 8px;
      }
      
      .remove-repuesto-btn {
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      /* Estilos para el modal de repuestos */
      .repuestos-modal {
        max-width: 500px;
        width: 90%;
      }
      
      .repuestos-list {
        max-height: 350px;
        overflow-y: auto;
        padding: 10px 0;
      }
      
      .repuesto-list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid #e8e8e8;
        border-radius: 4px;
        padding: 12px;
        margin-bottom: 10px;
        background-color: white;
      }
      
      .repuesto-nombre-lista {
        font-weight: bold;
        font-size: 16px;
        margin: 0 0 8px 0;
      }
      
      .repuesto-stock {
        margin: 0;
        font-size: 14px;
      }
      
      .cantidad-control {
        display: flex;
        align-items: center;
        border: 1px solid #e8e8e8;
        border-radius: 4px;
        overflow: hidden;
      }
      
      .btn-cantidad-menos,
      .btn-cantidad-mas {
        background-color: #f5f5f5;
        border: none;
        width: 40px;
        height: 40px;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .btn-cantidad-mas {
        background-color: #1890FF;
        color: white;
      }
      
      .cantidad-actual {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
      }
      
      /* Estilo para el botón de spinner */
      .button-spinner {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      /* Estilos para las secciones categorizadas */
      .fallas-list-section {
        margin-bottom: 30px;
        border: 1px solid #e8e8e8;
        border-radius: 8px;
        padding: 20px;
        background-color: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      
      .section-title {
        margin-top: 0;
        padding-bottom: 10px;
        border-bottom: 2px solid #f0f0f0;
        color: #333;
        font-size: 1.5rem;
      }
      
      /* Estilos específicos para pendientes/en proceso */
      .pendientes-section {
        border-left: 4px solid #FF9800; /* Color naranja para pendientes */
      }
      .pendientes-section .section-title {
        color: #E65100;
      }
      
      /* Estilos específicos para completadas */
      .completadas-section {
        border-left: 4px solid #4CAF50; /* Color verde para completadas */
      }
      .completadas-section .section-title {
        color: #2E7D32;
      }
      
      /* Estilos para el dashboard de estadísticas */
      .estadisticas-dashboard {
        background-color: #fff;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .dashboard-title {
        margin-top: 0;
        margin-bottom: 16px;
        font-size: 20px;
        color: #333;
        border-bottom: 1px solid #f0f0f0;
        padding-bottom: 10px;
      }
      
      .estadisticas-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
      }
      
      .estadistica-card {
        background-color: #f5f5f5;
        border-radius: 8px;
        padding: 16px;
        text-align: center;
      }
      
      .estadistica-valor {
        font-size: 24px;
        font-weight: bold;
        margin: 0 0 8px 0;
        color: #333;
      }
      
      .estadistica-titulo {
        font-size: 14px;
        color: #666;
        margin: 0;
      }
      
      .estadisticas-prioridad {
        margin-top: 15px;
      }
      
      .prioridad-barra {
        display: flex;
        height: 24px;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 10px;
      }
      
      .prioridad-segmento {
        height: 100%;
        transition: width 0.3s ease;
      }
      
      .prioridad-leyenda {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      
      .leyenda-item {
        display: flex;
        align-items: center;
        margin-right: 20px;
        margin-bottom: 5px;
      }
      
      .leyenda-color {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        margin-right: 6px;
      }
      
      .leyenda-texto {
        font-size: 14px;
        color: #666;
      }
      
      /* Estilos para los filtros */
      .filtros-container {
        background-color: #fff;
        border-radius: 8px;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        overflow: hidden;
        transition: max-height 0.3s ease;
      }
      
      .filtros-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        cursor: pointer;
        background-color: #f9f9f9;
        border-bottom: 1px solid #f0f0f0;
      }
      
      .filtros-title {
        margin: 0;
        font-size: 18px;
        color: #333;
      }
      
      .toggle-filtros-btn {
        background: none;
        border: none;
        font-size: 16px;
        color: #1890FF;
        cursor: pointer;
      }
      
      .filtros-content {
        padding: 20px;
      }
      
      .filtro-group {
        margin-bottom: 16px;
      }
      
      .filtro-label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        color: #333;
      }
      
      .filtro-select,
      .filtro-input {
        width: 100%;
        padding: 10px;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        font-size: 15px;
      }
      
      .filtros-buttons {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }
      
      .filtro-btn {
        padding: 10px 16px;
        border: none;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .filtro-btn.aplicar {
        background-color: #1890FF;
        color: white;
      }
      
      .filtro-btn.reset {
        background-color: #f5f5f5;
        color: #666;
      }
      
      .btn-icon {
        font-size: 14px;
      }
      
      /* Media queries para responsividad */
      @media screen and (max-width: 768px) {
        .fallas-grid {
          grid-template-columns: 1fr;
        }
        
        .estadisticas-grid {
          grid-template-columns: 1fr 1fr;
        }
        
        .reporte-form-card {
          padding: 16px;
        }
        
        .section-title {
          font-size: 1.3rem;
        }
        
        .modal-content {
          width: 95%;
        }
      }
      
      @media screen and (max-width: 480px) {
        .estadisticas-grid {
          grid-template-columns: 1fr;
        }
        
        .reporte-fallas-header {
          flex-direction: column;
          align-items: flex-start;
        }
        
        .header-actions {
          margin-top: 10px;
          width: 100%;
        }
        
        .export-btn {
          width: 100%;
          justify-content: center;
        }
        
        .falla-footer {
          flex-direction: column;
          align-items: flex-start;
        }
        
        .estado-badge {
          margin-bottom: 8px;
        }
        
        .filtros-buttons {
          flex-direction: column;
        }
        
        .filtro-btn {
          width: 100%;
          justify-content: center;
        }
      }
    `}</style>
  </div>
);
};

export default ReporteFallasScreen;