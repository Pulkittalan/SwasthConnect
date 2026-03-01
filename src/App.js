import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
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
import DoctorDashboard from './pages/doctor_dashboard/DoctorDashboard';


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
            path="/doctor-dashboard"
            element={
              <ProtectedRoute>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route path="/telemedicine" element={<Telemedicine />} />
          <Route path="/loading" element={<LoadingPage />} />
          <Route path="/login" element={<Login />} />

          <Route path="/admin-login" element={<AdminLogin />} />
          {/* Admin Routes (Double Protected) */}
        <Route path="/admin-dashboard" element={
          <AdminProtectedRoute>
            <AdminDashboard />
          </AdminProtectedRoute>
        } />
          <Route
            path="/dashboard/:hospitalId"
            element={<HospitalDashboard />}
          />
          <Route path="/bed-management" element={<BedManagement />} />

          {/* Add more routes as needed */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;