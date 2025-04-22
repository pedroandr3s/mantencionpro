import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const LoadingBridge = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData } = location.state || {};

  useEffect(() => {
    if (userData) {
      // Simular un pequeño delay para mostrar la pantalla de carga
      const timer = setTimeout(() => {
        navigate('/mantencionpro', { 
          state: { userData },
          replace: true // Evitar volver a esta pantalla intermedia
        });
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      navigate('/login', { replace: true });
    }
  }, [userData, navigate]);

  return (
    <div style={styles.container}>
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      <p style={styles.text}>Cargando tu perfil...</p>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#FFFFFF'
  },
  text: {
    marginTop: '20px',
    fontSize: '18px',
    color: '#1890FF'
  }
};

export default LoadingBridge;