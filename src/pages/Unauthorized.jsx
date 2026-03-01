// src/pages/Unauthorized.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './Unauthorized.css';

const Unauthorized = () => {
  return (
    <div className="unauthorized-container">
      <div className="unauthorized-content">
        <div className="unauthorized-icon">🚫</div>
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
        <p className="unauthorized-details">
          This area is restricted to administrators only.
        </p>
        <div className="unauthorized-actions">
          <Link to="/" className="btn-home">
            ← Go to Home
          </Link>
          <Link to="/login" className="btn-login">
            Login as User
          </Link>
          <Link to="/admin-login" className="btn-admin">
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;