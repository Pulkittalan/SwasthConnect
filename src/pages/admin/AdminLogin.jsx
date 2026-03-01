// src/pages/admin/AdminLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
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
      // Simple admin login for now - you can add admin validation later
      await signInWithEmailAndPassword(auth, email, password);
      
      // Store admin flag in localStorage (temporary solution)
      localStorage.setItem('isAdmin', 'true');
      
      // Redirect to admin dashboard
      navigate('/admin-dashboard');

    } catch (error) {
      console.error('Admin login error:', error);
      
      let errorMessage = 'Login failed. Please check credentials.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Admin account not found.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      }
      
      setError(errorMessage);
      alert('❌ ' + errorMessage);
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
              placeholder="admin@example.com"
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
              ⚠️ <strong>Warning:</strong> This area is restricted to authorized personnel only.
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