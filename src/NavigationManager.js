// NavigationManager.js
// Este componente controla la navegación entre pantallas y previene errores de DOM

import React, { createContext, useContext, useRef, useState } from 'react';

// Crear contexto para gestión de navegación
const NavigationContext = createContext();

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation debe ser usado dentro de un NavigationProvider');
  }
  return context;
};

export function NavigationProvider({ children }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef(null);
  
  // Función segura para navegar entre rutas
  const navigateSafe = (navigation, route, params = {}) => {
    if (isNavigating) return false;
    
    try {
      // Marcar que estamos navegando para bloquear interacciones
      setIsNavigating(true);
      
      // Limpiar timeout previo si existe
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Usar setTimeout para permitir que React complete cualquier actualización pendiente
      timeoutRef.current = setTimeout(() => {
        try {
          if (navigation) {
            if (typeof navigation.navigate === 'function') {
              navigation.navigate(route, params);
            } else if (typeof navigation.goBack === 'function' && route === 'goBack') {
              navigation.goBack();
            } else {
              console.error("Método de navegación no disponible");
            }
          } else {
            console.error("Objeto navigation no disponible");
          }
          
          // Reset después de un tiempo para permitir la transición
          setTimeout(() => {
            setIsNavigating(false);
          }, 500); // Esperar 500ms antes de permitir nueva navegación
        } catch (error) {
          console.error("Error durante navegación:", error);
          setIsNavigating(false);
        }
      }, 50); // Pequeño retraso antes de navegación
      
      return true;
    } catch (error) {
      console.error("Error preparando navegación:", error);
      setIsNavigating(false);
      return false;
    }
  };
  
  // Exponer el contexto
  const value = {
    isNavigating,
    navigateSafe
  };
  
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

// HOC para envolver componentes y protegerlos durante la navegación
export function withNavigationProtection(Component) {
  return function WrappedComponent(props) {
    const { isNavigating } = useNavigation();
    
    // Si estamos navegando, mostrar un componente vacío o un loader
    if (isNavigating) {
      return (
        <div className="navigation-transition" 
             style={{ 
               position: 'fixed', 
               top: 0, 
               left: 0, 
               right: 0, 
               bottom: 0, 
               backgroundColor: 'rgba(255,255,255,0.7)',
               display: 'flex',
               justifyContent: 'center',
               alignItems: 'center',
               zIndex: 9999
             }}>
          <div className="loading-spinner" 
               style={{
                 width: '50px',
                 height: '50px',
                 border: '5px solid #f3f3f3',
                 borderTop: '5px solid #3498db',
                 borderRadius: '50%',
                 animation: 'spin 1s linear infinite'
               }}></div>
        </div>
      );
    }
    
    // Si no estamos navegando, renderizar normalmente
    return <Component {...props} />;
  };
}

// Clase auxiliar para navegación imperativa
export class NavigationHelper {
  static instance = null;
  
  static getInstance() {
    if (!NavigationHelper.instance) {
      NavigationHelper.instance = new NavigationHelper();
    }
    return NavigationHelper.instance;
  }
  
  initialize(navigation) {
    this.navigation = navigation;
    this.isNavigating = false;
    this.timeoutId = null;
  }
  
  // Método para navegar de forma segura
  navigate(route, params = {}) {
    if (this.isNavigating) return false;
    
    try {
      this.isNavigating = true;
      
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      
      // Desacoplar la navegación del ciclo de renderizado actual
      this.timeoutId = setTimeout(() => {
        if (this.navigation) {
          if (typeof this.navigation.navigate === 'function') {
            this.navigation.navigate(route, params);
          } else {
            console.error("Método de navegación no disponible");
          }
        }
        
        // Restablecer el estado después de un tiempo
        setTimeout(() => {
          this.isNavigating = false;
        }, 500);
      }, 50);
      
      return true;
    } catch (error) {
      console.error("Error en NavigationHelper:", error);
      this.isNavigating = false;
      return false;
    }
  }
  
  goBack() {
    if (this.isNavigating) return false;
    
    try {
      this.isNavigating = true;
      
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      
      this.timeoutId = setTimeout(() => {
        if (this.navigation && typeof this.navigation.goBack === 'function') {
          this.navigation.goBack();
        }
        
        setTimeout(() => {
          this.isNavigating = false;
        }, 500);
      }, 50);
      
      return true;
    } catch (error) {
      console.error("Error en NavigationHelper.goBack:", error);
      this.isNavigating = false;
      return false;
    }
  }
}

// Crear un estilo para la animación de loading spinner
const createSpinnerStyle = () => {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
};

// Ejecutar una vez
if (typeof window !== 'undefined') {
  createSpinnerStyle();
}

export default NavigationHelper.getInstance();