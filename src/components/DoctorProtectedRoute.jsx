import React from 'react';
import { Navigate } from 'react-router-dom';

const DoctorProtectedRoute = ({ children }) => {
  // In a real app, check if user is authenticated AND has doctor role
  const isAuthenticated = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole'); // 'doctor', 'patient', 'admin'
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (userRole !== 'doctor') {
    return <Navigate to="/user-dashboard" replace />;
  }
  
  return children;
};

export default DoctorProtectedRoute;