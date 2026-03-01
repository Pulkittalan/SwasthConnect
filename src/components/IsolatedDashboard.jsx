import React, { useEffect } from 'react';
import './IsolatedDashboard.css';

const IsolatedDashboard = ({ children }) => {
  // Prevent styles from leaking
  useEffect(() => {
    // Add isolation class to body
    document.body.classList.add('dashboard-is-active');
    
    return () => {
      document.body.classList.remove('dashboard-is-active');
    };
  }, []);

  return (
    <div id="dashboard-isolation-wrapper">
      <div className="dashboard-isolation-container">
        {children}
      </div>
    </div>
  );
};

export default IsolatedDashboard;