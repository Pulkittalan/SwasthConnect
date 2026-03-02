// src/pages/admin/AdminLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import './AdminLogin.css';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Check if admin document already exists in Firestore
      const adminDocRef = doc(db, 'admins', user.uid);
      const adminDoc = await getDoc(adminDocRef);
      
      if (!adminDoc.exists()) {
        // Auto-create admin document in Firestore
        await setDoc(adminDocRef, {
          email: user.email,
          name: user.email.split('@')[0], // Extract name from email
          role: 'admin',
          uid: user.uid,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          createdBy: 'auto-login',
          status: 'active'
        });
        console.log('✅ Admin document auto-created in Firestore');
      } else {
        // Update last login for existing admin
        await setDoc(adminDocRef, {
          lastLogin: serverTimestamp()
        }, { merge: true });
      }
      
      // Store admin session
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('adminEmail', email);
      localStorage.setItem('adminUid', user.uid);
      
      // Redirect to admin dashboard
      navigate('/admin-dashboard');

    } catch (error) {
      console.error('Admin login error:', error);
      
      let errorMessage = 'Login failed. Please check credentials.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Admin account not found. Please create an account first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Check your internet connection.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <h1>🔐 Admin Login</h1>
          <p>Restricted Access - Admins Only</p>
        </div>

        <form className="admin-login-form" onSubmit={handleLogin}>
          {error && (
            <div className="admin-error-message">
              ⚠️ {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Admin Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@swasthconnect.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="admin-login-btn"
            disabled={loading}
          >
            {loading ? '🔐 Authenticating...' : '🔓 Login as Admin'}
          </button>

          <div className="admin-login-footer">
            <p>
              ⚠️ <strong>Note:</strong> Admin document will be auto-created in Firestore upon first login.
            </p>
            <button 
              type="button" 
              className="back-to-main"
              onClick={() => navigate('/')}
            >
              ← Back to Main Site
            </button>
            <button 
              type="button" 
              className="back-to-user-login"
              onClick={() => navigate('/login')}
            >
              ← User Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;