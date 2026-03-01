import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/firebase';
import { 
  doc, 
  updateDoc, 
  getDoc
} from 'firebase/firestore';
import './BedManagement.css';

// Import PNG images
import availableBedImage from './not_available_bed-removebg-preview.png';
import icuOccupiedImage from './bluebed-removebg-preview.png';
import generalOccupiedImage from './gerybed-removebg-preview.png';
import emergencyOccupiedImage from './redbed-removebg-preview.png';
import surgicalOccupiedImage from './greenbed-removebg-preview.png';

const BedManagement = () => {
  const navigate = useNavigate();
  
  // States
  const [selectedCategory, setSelectedCategory] = useState('');
  const [totalBeds, setTotalBeds] = useState('');
  const [availableBeds, setAvailableBeds] = useState('');
  const [bedData, setBedData] = useState({});
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [showBedSelection, setShowBedSelection] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  
  // Bed images mapping
  const bedImages = {
    available: availableBedImage,
    ICU: icuOccupiedImage,
    'General Ward': generalOccupiedImage,
    Emergency: emergencyOccupiedImage,
    Surgical: surgicalOccupiedImage
  };

  // Get logged-in hospital from localStorage
  useEffect(() => {
    const loadLoggedInHospital = async () => {
      try {
        setLoading(true);
        
        // Get hospital ID from localStorage (set during login)
        const loggedInHospitalId = localStorage.getItem('hospitalId');
        const loggedInHospitalName = localStorage.getItem('hospitalName');
        
        if (!loggedInHospitalId) {
          showNotification('No hospital session found. Please login again.', 'error');
          setTimeout(() => {
            navigate('/login');
          }, 2000);
          return;
        }
        
        console.log('Loading hospital data for ID:', loggedInHospitalId);
        
        // Load hospital data from Firebase
        const docRef = doc(db, 'hospitals', loggedInHospitalId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Set hospital information
          setHospitalName(data.name || loggedInHospitalName || '');
          setHospitalId(loggedInHospitalId);
          
          // Load bed data from the bedData field
          const bedDataFromFirebase = data.bedData || {};
          
          // Ensure all categories exist in bedData
          const defaultBedData = {
            ICU: { totalBeds: 0, availableBeds: 0 },
            'General Ward': { totalBeds: 0, availableBeds: 0 },
            Emergency: { totalBeds: 0, availableBeds: 0 },
            Surgical: { totalBeds: 0, availableBeds: 0 }
          };
          
          // Merge existing data with default structure
          const mergedBedData = {
            ...defaultBedData,
            ...bedDataFromFirebase
          };
          
          setBedData(mergedBedData);
          setIsEditing(true);
          
          if (initialLoad) {
            showNotification(`Loaded ${data.name} bed data`, 'success');
            setInitialLoad(false);
          }
        } else {
          showNotification('Hospital data not found in database', 'error');
        }
      } catch (error) {
        console.error('Error loading hospital data:', error);
        showNotification('Error loading hospital data', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadLoggedInHospital();
  }, [initialLoad, navigate]); // Empty dependency array - only run once on mount

  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  };

  // Select category for bed configuration
  const selectCategory = (category) => {
    setSelectedCategory(category);
    setShowBedSelection(true);
    
    // Load existing bed data if available
    if (bedData[category]) {
      setTotalBeds(bedData[category].totalBeds.toString());
      setAvailableBeds(bedData[category].availableBeds.toString());
    } else {
      setTotalBeds('');
      setAvailableBeds('');
    }
  };

  // Update hospital bed data in Firebase
  const updateHospitalBedData = async (updatedBedData) => {
    try {
      if (!hospitalId) {
        showNotification('No hospital selected', 'error');
        return false;
      }

      const hospitalRef = doc(db, 'hospitals', hospitalId);
      
      // Prepare update data
      const updateData = {
        bedData: updatedBedData,
        lastUpdated: new Date().toISOString()
      };
      
      await updateDoc(hospitalRef, updateData);
      return true;
    } catch (error) {
      console.error('Error updating bed data:', error);
      return false;
    }
  };

  // Submit bed data for a category
  const submitBedData = async () => {
    if (!hospitalName.trim()) {
      showNotification('Hospital data not loaded properly!', 'warning');
      return;
    }

    const total = parseInt(totalBeds) || 0;
    const available = parseInt(availableBeds) || 0;

    if (total <= 0) {
      showNotification('Total beds must be greater than 0!', 'warning');
      return;
    }

    if (available > total) {
      showNotification('Available beds cannot be more than total beds!', 'warning');
      return;
    }

    try {
      setLoading(true);
      
      // Update local state
      const newBedData = {
        ...bedData,
        [selectedCategory]: {
          totalBeds: total,
          availableBeds: available,
          lastUpdated: new Date().toISOString()
        }
      };

      setBedData(newBedData);
      
      // Update in Firebase
      const success = await updateHospitalBedData(newBedData);
      
      if (success) {
        showNotification(`✅ ${selectedCategory} beds saved successfully!`, 'success');
      } else {
        showNotification('Error saving bed data', 'error');
      }
      
      // Reset form
      setShowBedSelection(false);
      setSelectedCategory('');
      setTotalBeds('');
      setAvailableBeds('');
      
    } catch (error) {
      console.error('Error submitting bed data:', error);
      showNotification('Error saving bed data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle bed status when clicked
  const toggleBedStatus = async (category, bedIndex) => {
    if (!hospitalId) {
      showNotification('Hospital data not loaded!', 'warning');
      return;
    }

    const categoryData = bedData[category];
    if (!categoryData || categoryData.totalBeds === 0) {
      showNotification(`No ${category} beds configured!`, 'warning');
      return;
    }

    try {
      setLoading(true);
      
      const newBedData = { ...bedData };
      const newCategoryData = { ...categoryData };
      
      // Check if clicked bed is available or occupied
      const currentAvailableCount = newCategoryData.availableBeds || 0;
      const isAvailable = bedIndex < currentAvailableCount;
      
      let newAvailableCount;
      if (isAvailable) {
        // Change from available to occupied
        newAvailableCount = Math.max(0, currentAvailableCount - 1);
      } else {
        // Change from occupied to available
        newAvailableCount = Math.min(newCategoryData.totalBeds, currentAvailableCount + 1);
      }
      
      newCategoryData.availableBeds = newAvailableCount;
      newCategoryData.lastUpdated = new Date().toISOString();
      
      newBedData[category] = newCategoryData;
      setBedData(newBedData);
      
      // Update in Firebase
      const success = await updateHospitalBedData(newBedData);
      
      if (success) {
        const bedNumber = bedIndex + 1;
        if (isAvailable) {
          showNotification(`🛏️ ${category} Bed #${bedNumber} marked as occupied`, 'info');
        } else {
          showNotification(`🛏️ ${category} Bed #${bedNumber} marked as available`, 'success');
        }
      }
      
    } catch (error) {
      console.error('Error toggling bed status:', error);
      showNotification('Error updating bed status', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Show all beds (main rendering function)
  const showAllBeds = () => {
    const categories = ['ICU', 'General Ward', 'Emergency', 'Surgical'];
    
    // Check if we have any beds configured
    const hasBeds = categories.some(category => {
      const categoryData = bedData[category];
      return categoryData && categoryData.totalBeds > 0;
    });

    if (!hasBeds) {
      return (
        <div className="no-beds">
          <div className="empty-state-icon">🛏️</div>
          <h3>No Beds Configured</h3>
          <p>Configure beds by selecting a category on the right</p>
        </div>
      );
    }

    return categories.map(category => {
      const categoryData = bedData[category];
      if (!categoryData || categoryData.totalBeds === 0) return null;

      const occupiedBeds = categoryData.totalBeds - (categoryData.availableBeds || 0);
      const availableBeds = categoryData.availableBeds || 0;

      return (
        <React.Fragment key={category}>
          <div className="category-title" id={`title-${category}`}>
            <h2>{category} Beds</h2>
            <div className="category-stats">
              <span className="stat-total">Total: {categoryData.totalBeds}</span>
              <span className="stat-available">Available: {availableBeds}</span>
              <span className="stat-occupied">Occupied: {occupiedBeds}</span>
            </div>
          </div>
          
          <div className="beds-row">
            {Array.from({ length: categoryData.totalBeds }).map((_, index) => {
              const isAvailable = index < availableBeds;
              return (
                <div
                  key={`${category}-${index}`}
                  className={`bed ${isAvailable ? 'available' : 'occupied'}`}
                  style={{
                    backgroundImage: `url(${isAvailable ? bedImages.available : bedImages[category]})`
                  }}
                  data-status={isAvailable ? 'available' : 'occupied'}
                  onClick={() => toggleBedStatus(category, index)}
                  title={`${category} Bed ${index + 1} - ${isAvailable ? 'Available' : 'Occupied'}`}
                >
                  <div className="bed-number">{index + 1}</div>
                  <div className="bed-status-indicator">
                    {isAvailable ? '✓' : '✗'}
                  </div>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      );
    });
  };

  // Calculate total statistics
  const calculateStats = () => {
    let total = 0;
    let available = 0;
    let occupied = 0;
    
    Object.values(bedData).forEach(category => {
      total += category.totalBeds || 0;
      available += category.availableBeds || 0;
      occupied += (category.totalBeds - (category.availableBeds || 0)) || 0;
    });
    
    return { total, available, occupied };
  };

  const stats = calculateStats();

  if (loading && initialLoad) {
    return (
      <div className="loading-overlay" style={{background: 'rgba(255, 255, 255, 0.9)'}}>
        <div className="loading-spinner"></div>
        <p>Loading hospital bed data...</p>
      </div>
    );
  }

  return (
    <div className="bed-management">
      {/* Notification Component */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-content">{notification.message}</div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && !initialLoad && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Updating bed data...</p>
        </div>
      )}

      <button
        className="edit-link"
        onClick={() => navigate(`/dashboard/${hospitalId}`)}
      >
        ← Back to Dashboard
      </button>

      <div className="container">
        {/* Left side - Beds display */}
        <div className="beds-container" id="bedStatus">
          {showAllBeds()}
        </div>

        {/* Right side - Controls */}
        <div className="filter-box">
          <div className="filter-header">
            <h2>🏥 Hospital Bed Management</h2>
            <div className="overall-stats">
              <div className="overall-stat">
                <span className="stat-label">Total Beds</span>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="overall-stat">
                <span className="stat-label">Available</span>
                <span className="stat-value available-stat">
                  {stats.available}
                </span>
              </div>
              <div className="overall-stat">
                <span className="stat-label">Occupied</span>
                <span className="stat-value occupied-stat">
                  {stats.occupied}
                </span>
              </div>
            </div>
          </div>

          {/* Hospital Info - Display only, no selection */}
          <div className="hospital-info-card">
            <h3>
              <span className="section-icon">🏥</span>
              Current Hospital
            </h3>
            <div className="hospital-details">
              <p>
                <strong>Name:</strong> {hospitalName}
              </p>
              <p>
                <strong>Hospital ID:</strong> {hospitalId}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span style={{ color: "#28a745", fontWeight: "bold" }}>
                  Active
                </span>
              </p>
            </div>
          </div>

          <div className="category-section">
            <h3>
              <span className="section-icon">📋</span>
              Configure Beds by Category
            </h3>
            <p className="section-description">
              Select a category to configure or update bed counts
            </p>
            <div className="category-buttons">
              {["ICU", "General Ward", "Emergency", "Surgical"].map(
                (category) => (
                  <button
                    key={category}
                    onClick={() => selectCategory(category)}
                    className={`category-btn ${selectedCategory === category ? "active" : ""}`}
                    disabled={loading}
                  >
                    <span className="btn-icon">
                      {category === "ICU"
                        ? "💙"
                        : category === "General Ward"
                          ? "🩺"
                          : category === "Emergency"
                            ? "🚨"
                            : "💚"}
                    </span>
                    {category}
                    {bedData[category]?.totalBeds > 0 && (
                      <span className="bed-count-badge">
                        {bedData[category].totalBeds}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
          </div>

          {showBedSelection && (
            <div className="bed-configuration">
              <div className="config-header">
                <h3>
                  <span className="section-icon">⚙️</span>
                  Configure {selectedCategory} Beds
                </h3>
                {bedData[selectedCategory]?.lastUpdated && (
                  <p className="last-updated">
                    Last updated:{" "}
                    {new Date(
                      bedData[selectedCategory].lastUpdated,
                    ).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="config-inputs">
                <div className="input-group">
                  <label htmlFor="totalBeds">
                    <span className="label-icon">🛏️</span>
                    Total Beds
                  </label>
                  <input
                    id="totalBeds"
                    type="number"
                    value={totalBeds}
                    onChange={(e) => setTotalBeds(e.target.value)}
                    min="0"
                    className="config-input"
                    disabled={loading}
                  />
                  <div className="input-hint">
                    Total number of {selectedCategory} beds in the hospital
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="availableBeds">
                    <span className="label-icon">✅</span>
                    Available Beds
                  </label>
                  <input
                    id="availableBeds"
                    type="number"
                    value={availableBeds}
                    onChange={(e) => setAvailableBeds(e.target.value)}
                    min="0"
                    max={totalBeds}
                    className="config-input"
                    disabled={loading}
                  />
                  <div className="input-hint">
                    Currently available beds (cannot exceed total beds)
                  </div>
                </div>

                {totalBeds && availableBeds && (
                  <div className="bed-preview">
                    <div className="preview-stats">
                      <span className="preview-stat">
                        <span className="preview-label">Will be occupied:</span>
                        <span className="preview-value">
                          {totalBeds - availableBeds}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="action-buttons">
                <button
                  onClick={() => {
                    setShowBedSelection(false);
                    setSelectedCategory("");
                  }}
                  className="cancel-btn"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={submitBedData}
                  className="submit-btn"
                  disabled={!hospitalName.trim() || !totalBeds || loading}
                >
                  {loading ? (
                    <>
                      <span className="loading-btn-spinner"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="btn-icon">💾</span>
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {isEditing && stats.total > 0 && (
            <div className="current-stats">
              <h3>
                <span className="section-icon">📊</span>
                Current Bed Statistics
              </h3>
              <div className="stats-grid">
                {["ICU", "General Ward", "Emergency", "Surgical"].map(
                  (category) => {
                    const data = bedData[category];
                    if (!data || data.totalBeds === 0) return null;

                    const available = data.availableBeds || 0;
                    const occupied = data.totalBeds - available;

                    return (
                      <div key={category} className="stat-card">
                        <div className="stat-card-header">
                          <span className="category-icon">
                            {category === "ICU"
                              ? "💙"
                              : category === "General Ward"
                                ? "🩺"
                                : category === "Emergency"
                                  ? "🚨"
                                  : "💚"}
                          </span>
                          <span className="category-name">{category}</span>
                        </div>
                        <div className="stat-card-body">
                          <div className="stat-item">
                            <span>Total</span>
                            <span className="stat-value">{data.totalBeds}</span>
                          </div>
                          <div className="stat-item">
                            <span>Available</span>
                            <span className="stat-value available">
                              {available}
                            </span>
                          </div>
                          <div className="stat-item">
                            <span>Occupied</span>
                            <span className="stat-value occupied">
                              {occupied}
                            </span>
                          </div>
                          <div className="occupancy-rate">
                            <div className="occupancy-bar">
                              <div
                                className="occupancy-fill"
                                style={{
                                  width: `${(occupied / data.totalBeds) * 100}%`,
                                  backgroundColor:
                                    occupied > 0 ? "#ef4444" : "#10b981",
                                }}
                              ></div>
                            </div>
                            <span className="occupancy-text">
                              {Math.round((occupied / data.totalBeds) * 100)}%
                              Occupied
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BedManagement;
