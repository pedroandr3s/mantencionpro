import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import firebaseApp from '../firebase/credenciales';

// Initialize Firebase services
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

/**
 * Custom hook to handle forced logouts
 * @returns {Object} Auth state information
 */
const useAuthListener = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // Return cleanup function
    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Listen for forced logout documents when user is authenticated
  useEffect(() => {
    let unsubscribeForcedLogout = null;

    if (currentUser) {
      // Set up listener for forced logout document
      unsubscribeForcedLogout = onSnapshot(
        doc(firestore, 'forcedLogouts', currentUser.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            // If there's a forced logout entry newer than the user's last login
            if (data.timestamp > currentUser.metadata.lastLoginAt) {
              console.log('Forced logout detected:', data.reason);
              // Force sign out
              signOut(auth).then(() => {
                // Redirect to login page or show message
                alert('Tu sesión ha sido cerrada por un administrador');
                window.location.href = '/login'; // Adjust this to your app's login route
              });
            }
          }
        },
        (error) => {
          console.error('Error listening for forced logouts:', error);
        }
      );
    }

    // Cleanup listener
    return () => {
      if (unsubscribeForcedLogout) {
        unsubscribeForcedLogout();
      }
    };
  }, [currentUser]);

  return { currentUser, loading };
};

export default useAuthListener;