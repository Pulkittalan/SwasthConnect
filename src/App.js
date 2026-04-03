import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom'; // Use HashRouter for GitHub Pages
import Home from './pages/Home';
import LoadingPage from './pages/LoadingPage';
import Login from './pages/login/Login';
import HospitalDashboard from './pages/hospital_dashboard/HospitalDashboard';
import BedManagement from './pages/bedmanagement/BedManagement';
import UserDashboard from './pages/UserDashboard/UserDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Telemedicine from './pages/Telemedicine/Telemedicine'
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminLogin from './pages/admin/AdminLogin';
import Unauthorized from './pages/Unauthorized';
import HospitalProtectedRoute from './components/HospitalProtectedRoute';
// Add these imports at the top
import HospitalDoctorDashboard from './pages/doctor_dashboard/HospitalDoctorDashboard';
import IndependentDoctorDashboard from './pages/doctor_dashboard/IndependentDoctorDashboard';

import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/user-dashboard"
            element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          {/* Add Doctor Dashboard Route */}
          

          <Route
            path="/hospital-doctor-dashboard"
            element={
              <ProtectedRoute>
                <HospitalDoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/independent-doctor-dashboard"
            element={
              <ProtectedRoute>
                <IndependentDoctorDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/telemedicine" element={<Telemedicine />} />
          <Route path="/loading" element={<LoadingPage />} />
          <Route path="/login" element={<Login />} />

          {/* ADD THIS UNAUTHORIZED ROUTE */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route path="/admin-login" element={<AdminLogin />} />
          {/* Admin Routes (Double Protected) */}
          <Route
            path="/admin-dashboard"
            element={
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/dashboard/:hospitalId"
            element={
              <HospitalProtectedRoute>
                <HospitalDashboard />
              </HospitalProtectedRoute>
            }
          />
          <Route path="/bed-management" element={<BedManagement />} />

          {/* Add more routes as needed */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;