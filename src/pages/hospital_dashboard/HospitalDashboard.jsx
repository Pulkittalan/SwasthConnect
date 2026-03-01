import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import './HospitalDashboard.css';

const HospitalDashboard = () => {
  const { hospitalId } = useParams();
  const navigate = useNavigate();
  const [hospitalData, setHospitalData] = useState(null);
  const [bedData, setBedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');
  const [logoError, setLogoError] = useState(false);
  const [floatingLogoError, setFloatingLogoError] = useState(false);
  const [loadingLogoError, setLoadingLogoError] = useState(false);

  // Logo URLs - Change these to your actual logo paths
  const logoUrl = './logo.png'; // Place logo.png in public folder
  const fallbackLogoText = 'SS'; // Swasthya Setu initials

  useEffect(() => {
    const fetchHospitalData = async () => {
      try {
        const docRef = doc(db, 'hospitals', hospitalId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setHospitalData(data);
          setBedData(data.bedData || {});
        }
      } catch (error) {
        console.error('Error fetching hospital data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHospitalData();
  }, [hospitalId]);

  const handleLogoClick = () => {
    navigate('/');
  };

  const generateEncryptedBedUrl = () => {
    if (!hospitalData) return '#';
    
    const currentHospitalId = hospitalId || hospitalData.id || hospitalData.hospitalId;
    
    if (!currentHospitalId) {
      console.error('No hospital ID available');
      return '#';
    }
    
    const timestamp = Date.now();
    const dataToEncrypt = JSON.stringify({
      hospitalId: currentHospitalId,
      hospitalName: hospitalData.name,
      timestamp,
      bedData: bedData
    });
    
    const encrypted = btoa(encodeURIComponent(dataToEncrypt));
    
    return `/bed-management?token=${encrypted}&h=${currentHospitalId}&t=${timestamp}`;
  };

  const calculateBedStats = () => {
    let total = 0;
    let available = 0;
    
    Object.values(bedData).forEach(category => {
      total += category.totalBeds || 0;
      available += category.availableBeds || 0;
    });
    
    return { total, available, occupied: total - available };
  };

  const getUtilizationColor = (total, occupied) => {
    const utilization = total > 0 ? (occupied / total) * 100 : 0;
    if (utilization >= 80) return 'utilization-high';
    if (utilization >= 50) return 'utilization-medium';
    return 'utilization-low';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'icu': '🫀',
      'general': '🛌',
      'pediatric': '👶',
      'maternity': '🤰',
      'emergency': '🚨',
      'surgical': '🔪',
      'psychiatric': '🧠',
      'isolation': '🦠',
      'recovery': '💤',
      'ccu': '❤️',
      'cardiac': '💓',
      'orthopedic': '🦴',
      'neurology': '🧠',
      'oncology': '🎗️',
      'burn': '🔥'
    };
    
    return icons[category.toLowerCase()] || '🛏️';
  };

  const getStatusLabel = (available) => {
    if (available > 10) return { label: 'High', color: '#10b981' };
    if (available > 5) return { label: 'Moderate', color: '#f59e0b' };
    if (available > 0) return { label: 'Low', color: '#ef4444' };
    return { label: 'Full', color: '#dc2626' };
  };

  const { total, available, occupied } = calculateBedStats();

  // Logo Component for reuse
  const LogoComponent = ({ isFloating = false, isLarge = false, onError = null }) => {
    const width = isLarge ? '80px' : (isFloating ? '80px' : '60px');
    const height = isLarge ? '80px' : (isFloating ? '80px' : '60px');
    const hasError = isFloating ? floatingLogoError : (isLarge ? loadingLogoError : logoError);
    const errorHandler = isFloating ? setFloatingLogoError : (isLarge ? setLoadingLogoError : setLogoError);

    const handleClick = () => {
      handleLogoClick();
    };

    const handleImageError = (e) => {
      errorHandler(true);
      e.target.style.display = 'none';
      if (onError) onError();
    };

    return (
      <div 
        className={isFloating ? 'floating-logo' : (isLarge ? 'loading-logo-image' : 'logo-image')}
        onClick={handleClick}
        style={{ 
          width, 
          height,
          cursor: 'pointer'
        }}
      >
        {hasError ? (
          <div 
            className="logo-fallback"
            style={{ width: '100%', height: '100%' }}
          >
            {fallbackLogoText}
          </div>
        ) : (
          <img 
            src={logoUrl}
            alt="Swasthya Setu Logo"
            style={{ 
              width: '100%', 
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover'
            }}
            onError={handleImageError}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-logo">
          <LogoComponent isLarge={true} />
          <div style={{
            fontSize: '2.5em',
            background: 'linear-gradient(135deg, #0d9488, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: '800',
            letterSpacing: '-1px',
            textAlign: 'center',
            marginTop: '10px'
          }}>
            Swasthya Setu
          </div>
          <p style={{ color: '#64748b', marginTop: '5px', textAlign: 'center' }}>Connecting Healthcare...</p>
        </div>
        <div className="loading-spinner"></div>
        <p style={{ color: '#64748b', fontSize: '1.1em', marginTop: '20px' }}>Loading hospital dashboard...</p>
      </div>
    );
  }

  return (
    <div className="hospital-dashboard">
      {/* Floating Background Elements */}
      <div className="floating-elements">
        <div className="floating-element">⚕️</div>
        <div className="floating-element">🩺</div>
        <div className="floating-element">❤️</div>
        <div className="floating-element">🛏️</div>
        <div className="floating-element">💊</div>
      </div>

      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-logo" onClick={handleLogoClick}>
            <LogoComponent />
            <div className="logo-text">
              <h1>Swasthya Setu</h1>
              <span>Healthcare Bridge System</span>
            </div>
          </div>
          
          <h1 style={{ marginTop: '10px' }}>🏥 {hospitalData?.name || 'Hospital Dashboard'}</h1>
          <p>📍 {hospitalData?.address || 'No address available'}</p>
          <p>📞 {hospitalData?.contact || 'No contact available'}</p>
          
          <div className="hospital-badge">
            <span style={{ fontSize: '1.2em' }}>🏥</span>
            <span>Hospital ID: {hospitalId}</span>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Statistics Cards */}
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-card-icon">🛏️</div>
            <h3>Total Beds</h3>
            <p>{total}</p>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">✅</div>
            <h3>Available Beds</h3>
            <p>{available}</p>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">⏳</div>
            <h3>Occupied Beds</h3>
            <p>{occupied}</p>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">📊</div>
            <h3>Utilization Rate</h3>
            <p>{total > 0 ? Math.round((occupied / total) * 100) : 0}%</p>
            <div className="utilization-progress">
              <div 
                className={`utilization-fill ${getUtilizationColor(total, occupied)}`}
                style={{ width: `${total > 0 ? (occupied / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className="action-section">
          <button 
            className="edit-beds-btn"
            onClick={() => window.open(generateEncryptedBedUrl(), '_blank')}
          >
            <span style={{ fontSize: '1.2em' }}>✏️</span>
            <span>Edit Beds Management</span>
          </button>
          
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <span>📋</span>
              <span>Table View</span>
            </button>
            <button 
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              <span>🃏</span>
              <span>Cards View</span>
            </button>
          </div>
        </div>

        {/* Hospital Details & Bed Categories */}
        <div className="hospital-details-section">
          {/* Hospital Info Card */}
          <div className="hospital-info-card">
            <h2>🏥 Hospital Details</h2>
            <div className="info-grid">
              <div className="info-item">
                <strong>Hospital ID</strong>
                <span style={{ fontSize: '1.1em', fontWeight: '600', color: '#0d9488' }}>{hospitalId}</span>
              </div>
              <div className="info-item">
                <strong>Email Address</strong>
                <span>{hospitalData?.email || 'N/A'}</span>
              </div>
              <div className="info-item">
                <strong>Emergency Contact</strong>
                <span style={{ color: '#ef4444', fontWeight: '600' }}>
                  {hospitalData?.emergencyContact || hospitalData?.contact || 'N/A'}
                </span>
              </div>
              <div className="info-item">
                <strong>Status</strong>
                <span style={{
                  color: '#10b981',
                  fontWeight: '600',
                  background: '#d1fae5',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.9em'
                }}>
                  🟢 Operational
                </span>
              </div>
            </div>
          </div>

          {/* Bed Categories Card */}
          <div className="bed-summary-card">
            <div className="card-header">
              <h2>
                <span>🛏️</span>
                <span>Bed Categories</span>
              </h2>
              <div className="category-count">
                {Object.keys(bedData).length} Categories
              </div>
            </div>

            {Object.keys(bedData).length > 0 ? (
              viewMode === 'table' ? (
                <div className="table-container">
                  <table className="bed-categories-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Total</th>
                        <th>Available</th>
                        <th>Occupied</th>
                        <th>Utilization</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(bedData).map(([category, data], index) => {
                        const totalBeds = data.totalBeds || 0;
                        const availableBeds = data.availableBeds || 0;
                        const occupiedBeds = totalBeds - availableBeds;
                        const utilization = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
                        const status = getStatusLabel(availableBeds);
                        
                        return (
                          <tr key={category}>
                            <td>
                              <span className="bed-category-icon" style={{ '--delay': index }}>
                                {getCategoryIcon(category)}
                              </span>
                              <span>{category}</span>
                            </td>
                            <td>
                              <span className="status-badge status-total">
                                {totalBeds}
                              </span>
                            </td>
                            <td>
                              <span className="status-badge status-available">
                                {availableBeds}
                              </span>
                            </td>
                            <td>
                              <span className="status-badge status-occupied">
                                {occupiedBeds}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: '600', color: '#1e293b' }}>
                                {Math.round(utilization)}%
                              </div>
                              <div className="utilization-progress">
                                <div 
                                  className={`utilization-fill ${getUtilizationColor(totalBeds, occupiedBeds)}`}
                                  style={{ width: `${utilization}%` }}
                                />
                              </div>
                            </td>
                            <td>
                              <span 
                                className="status-badge"
                                style={{
                                  background: `${status.color}15`,
                                  color: status.color,
                                  border: `1px solid ${status.color}30`
                                }}
                              >
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bed-cards-view">
                  {Object.entries(bedData).map(([category, data], index) => {
                    const totalBeds = data.totalBeds || 0;
                    const availableBeds = data.availableBeds || 0;
                    const occupiedBeds = totalBeds - availableBeds;
                    const utilization = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;
                    const status = getStatusLabel(availableBeds);
                    
                    return (
                      <div key={category} className="bed-category-card" style={{ animationDelay: `${index * 0.1}s` }}>
                        <div className="bed-category-header">
                          <h4>
                            <span className="bed-category-icon" style={{ '--delay': index }}>
                              {getCategoryIcon(category)}
                            </span>
                            {category}
                          </h4>
                          <span style={{
                            fontSize: '0.85em',
                            padding: '6px 15px',
                            borderRadius: '15px',
                            background: `${status.color}15`,
                            color: status.color,
                            fontWeight: '600',
                            border: `1px solid ${status.color}30`
                          }}>
                            {status.label} Availability
                          </span>
                        </div>
                        
                        <div className="bed-stats-grid">
                          <div className="stat-item">
                            <div className="label">Total</div>
                            <div className="value" style={{ color: '#1e40af' }}>{totalBeds}</div>
                          </div>
                          <div className="stat-item">
                            <div className="label">Available</div>
                            <div className="value" style={{ color: '#10b981' }}>{availableBeds}</div>
                          </div>
                          <div className="stat-item">
                            <div className="label">Occupied</div>
                            <div className="value" style={{ color: '#ef4444' }}>{occupiedBeds}</div>
                          </div>
                        </div>
                        
                        <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.9em', color: '#64748b', fontWeight: '500' }}>Utilization:</span>
                            <span style={{ fontWeight: '700', color: '#1e293b' }}>
                              {Math.round(utilization)}%
                            </span>
                          </div>
                          <div className="utilization-progress">
                            <div 
                              className={`utilization-fill ${getUtilizationColor(totalBeds, occupiedBeds)}`}
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🛏️</div>
                <h3>No Bed Data Available</h3>
                <p>Start by adding bed categories and their availability to manage hospital resources effectively.</p>
                <button 
                  className="edit-beds-btn"
                  onClick={() => window.open(generateEncryptedBedUrl(), '_blank')}
                  style={{ padding: '15px 40px', fontSize: '16px' }}
                >
                  <span>➕</span>
                  <span>Add Bed Categories</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Logo */}
      <LogoComponent isFloating={true} />
    </div>
  );
};

export default HospitalDashboard;