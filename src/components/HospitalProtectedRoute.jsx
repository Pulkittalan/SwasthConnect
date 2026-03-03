import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const HospitalProtectedRoute = ({ children }) => {
  const { userType, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  if (userType !== 'hospital') {
    return <Navigate to="/login" />;
  }

  return children;
};

export default HospitalProtectedRoute;