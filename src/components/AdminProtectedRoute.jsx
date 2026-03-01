// src/components/AdminProtectedRoute.jsx
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const AdminProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!currentUser) {
        setCheckingAdmin(false);
        return;
      }

      try {
        // Check multiple ways admin could be stored
        let adminCheck = false;
        
        // 1. Check in admin_emails collection
        try {
          const adminEmailDoc = await getDoc(doc(db, 'admin_emails', currentUser.email));
          if (adminEmailDoc.exists()) {
            adminCheck = true;
          }
        } catch (error) {
          console.log('admin_emails collection not found or error:', error);
        }
        
        // 2. Check in admins collection by UID
        if (!adminCheck) {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
            if (adminDoc.exists()) {
              adminCheck = true;
            }
          } catch (error) {
            console.log('admins collection not found or error:', error);
          }
        }
        
        // 3. Check in system settings (fallback)
        if (!adminCheck) {
          try {
            const settingsDoc = await getDoc(doc(db, 'system', 'admin_settings'));
            if (settingsDoc.exists()) {
              const adminEmails = settingsDoc.data()?.adminEmails || [];
              if (adminEmails.includes(currentUser.email)) {
                adminCheck = true;
              }
            }
          } catch (error) {
            console.log('system settings not found or error:', error);
          }
        }
        
        setIsAdmin(adminCheck);
        
      } catch (error) {
        console.error('Admin check error:', error);
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (currentUser) {
      checkAdminStatus();
    } else {
      setCheckingAdmin(false);
    }
  }, [currentUser]);

  if (loading || checkingAdmin) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        background: '#f5f7fa'
      }}>
        <div className="spinner" style={{
          width: '50px',
          height: '50px',
          border: '5px solid #f3f3f3',
          borderTop: '5px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '20px', color: '#666' }}>
          {checkingAdmin ? 'Verifying admin access...' : 'Loading...'}
        </p>
      </div>
    );
  }

  if (!currentUser) {
    // Redirect to admin login with return URL
    return <Navigate to="/admin-login" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

export default AdminProtectedRoute;