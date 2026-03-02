import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const AdminProtectedRoute = ({ children }) => {
  const { currentUser, isAdmin, loading } = useAuth();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const verifyAdmin = async () => {
      if (!currentUser) {
        setCheckingAdmin(false);
        return;
      }

      try {
        // Double-check in Firestore for security
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        if (!adminDoc.exists()) {
          // If not in Firestore but isAdmin is true, something's wrong
          setCheckingAdmin(false);
          return;
        }
      } catch (error) {
        console.error('Admin verification error:', error);
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (currentUser) {
      verifyAdmin();
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
    return <Navigate to="/admin-login" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

export default AdminProtectedRoute;