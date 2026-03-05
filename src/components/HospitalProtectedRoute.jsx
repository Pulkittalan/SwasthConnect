import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const HospitalProtectedRoute = ({ children }) => {
  const { userType, loading, currentUser, hospitalData } = useAuth();
  const [isValidHospital, setIsValidHospital] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkHospitalSession = async () => {
      // Check if there's a hospital session in localStorage
      const storedHospitalId = localStorage.getItem('hospitalId');
      const storedUserType = localStorage.getItem('userType');
      
      if (storedHospitalId && storedUserType === 'hospital') {
        // If we have stored hospital data but no userType in context yet,
        // wait for auth to load
        if (!userType && loading) {
          return; // Still loading, wait
        }
        
        // If context has userType, use that
        if (userType === 'hospital') {
          setIsValidHospital(true);
        } else if (currentUser && !userType) {
          // If we have a currentUser but no userType, we might need to wait
          // This can happen during initialization
          return;
        } else {
          // No valid hospital session
          setIsValidHospital(false);
        }
      } else {
        setIsValidHospital(false);
      }
      
      setChecking(false);
    };

    checkHospitalSession();
  }, [userType, loading, currentUser]);

  // Show loading while checking
  if (loading || checking) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        <div className="loading-spinner" style={{
          width: '50px',
          height: '50px',
          border: '5px solid #f3f3f3',
          borderTop: '5px solid #0d9488',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>Verifying hospital session...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Check if user is a hospital (either from context or localStorage)
  const isHospital = userType === 'hospital' || 
                    (localStorage.getItem('userType') === 'hospital' && 
                     localStorage.getItem('hospitalId'));

  if (!isHospital) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default HospitalProtectedRoute;