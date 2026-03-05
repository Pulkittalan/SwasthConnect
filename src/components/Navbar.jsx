import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';

const NavbarFixed = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { currentUser, userData, hospitalData, doctorData, userType, signInWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

  const [imagesLoaded, setImagesLoaded] = useState({});

  const handleImageLoad = (id) => {
    setImagesLoaded(prev => ({ ...prev, [id]: true }));
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    
    setIsSigningIn(true);
    
    try {
      await signInWithGoogle();
      // After successful sign in, navigate to user dashboard
      navigate('/user-dashboard');
    } catch (error) {
      console.error("Sign in failed:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleProfileClick = () => {
    // Redirect to appropriate dashboard based on user type
    if (userType === 'hospital' && hospitalData) {
      navigate(`/dashboard/${localStorage.getItem('hospitalId')}`);
    } else if (userType === 'doctor' && doctorData) {
      navigate('/doctor-dashboard');
    } else if (userType === 'admin') {
      navigate('/admin-dashboard');
    } else {
      navigate('/user-dashboard');
    }
    setIsMenuOpen(false);
  };

  const handleAdminButtonClick = () => {
    // If user is already logged in as hospital/doctor/admin, go to their dashboard
    if (currentUser) {
      if (userType === 'hospital' && hospitalData) {
        navigate(`/dashboard/${localStorage.getItem('hospitalId')}`);
      } else if (userType === 'doctor' && doctorData) {
        navigate('/doctor-dashboard');
      } else if (userType === 'admin') {
        navigate('/admin-dashboard');
      } else {
        // Regular user, still go to login page to choose hospital/doctor login
        navigate('/login');
      }
    } else {
      // Not logged in, go to login page
      navigate('/login');
    }
    setIsMenuOpen(false);
  };

  useEffect(() => {
    // Force load critical images immediately
    const forceLoadImages = () => {
      const criticalImages = document.querySelectorAll('.critical');
      criticalImages.forEach(img => {
        if (img.complete) return;
        
        // Create a new image to force load
        const tempImg = new Image();
        tempImg.src = img.src;
        tempImg.onload = () => {
          console.log('Forced load:', img.src);
        };
      });
    };

    // Run after component mounts
    setTimeout(forceLoadImages, 100);
  }, []);

  // Get user display name based on user type
  const getUserDisplayName = () => {
    if (userType === 'hospital' && hospitalData) {
      return hospitalData.name || 'Hospital';
    } else if (userType === 'doctor' && doctorData) {
      return doctorData.name || 'Doctor';
    } else if (userData?.displayName || currentUser?.displayName) {
      return userData?.displayName || currentUser?.displayName;
    } else if (currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    return 'User';
  };

  // Get user avatar based on user type
  const getUserAvatar = () => {
    if (userType === 'hospital' && hospitalData?.logo_url) {
      return hospitalData.logo_url;
    } else if (userType === 'doctor' && doctorData?.photo_url) {
      return doctorData.photo_url;
    } else if (currentUser?.photoURL) {
      return currentUser.photoURL;
    }
    return '/images/default-avatar.png';
  };

  // Safe photoURL access
  const userPhotoURL = currentUser ? currentUser.photoURL : null;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <img
          src="/images/logo.png"
          alt="Logo"
          className="logo critical"
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          width="90"
          height="90"
          style={{ contentVisibility: "auto" }}
          onLoad={() => {
            handleImageLoad("logo");
            console.log("Logo loaded eagerly");
          }}
          onError={(e) => {
            e.target.src = "/images/default-logo.png";
            e.target.className += " loaded";
          }}
        />
        <div className="logo-title">SwasthConnect</div>

        <div
          className={`hamburger ${isMenuOpen ? "active" : ""}`}
          onClick={toggleMenu}
        >
          <span></span>
          <span></span>
          <span></span>
        </div>

        <ul className={`nav-links ${isMenuOpen ? "show" : ""}`}>
          <li>
            <Link to="/blood-bank" onClick={() => setIsMenuOpen(false)}>
              Blood Donation
            </Link>
          </li>
          <li>
            <Link to="/govt-schemes" onClick={() => setIsMenuOpen(false)}>
              Govt. schemes
            </Link>
          </li>
          <li>
            <Link to="/find-hospitals" onClick={() => setIsMenuOpen(false)}>
              Find Hospitals
            </Link>
          </li>
          <li>
            <Link to="/financial-aid" onClick={() => setIsMenuOpen(false)}>
              Financial Aid
            </Link>
          </li>
          <li>
            <Link to="/telemedicine" onClick={() => setIsMenuOpen(false)}>
              Telemedicine
            </Link>
          </li>
          <li>
            <button 
              onClick={handleAdminButtonClick}
              className="nav-link-button"
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
                fontFamily: 'inherit'
              }}
            >
              {currentUser && (userType === 'hospital' || userType === 'doctor' || userType === 'admin') 
                ? 'My Dashboard' 
                : 'Admin(Hospitals)'}
            </button>
          </li>
        </ul>

        <div className="sign-in-container">
          {currentUser ? (
            <div
              className="user-profile-nav"
              style={{ cursor: "pointer" }}
              onClick={handleProfileClick}
              title={`Go to ${userType === 'hospital' ? 'Hospital' : userType === 'doctor' ? 'Doctor' : 'User'} Dashboard`}
            >
              <img
                src={getUserAvatar()}
                alt="Profile"
                className="nav-user-avatar critical"
                loading="eager"
                fetchPriority="high"
                width="40"
                height="40"
                onLoad={() => handleImageLoad("avatar")}
                onError={(e) => {
                  e.target.src = "/images/default-avatar.png";
                  e.target.className += " loaded";
                }}
              />
              <span className="nav-user-name">
                {getUserDisplayName()}
              </span>
              {userType && (
                <span className="user-type-badge" style={{
                  fontSize: '10px',
                  padding: '2px 5px',
                  borderRadius: '3px',
                  background: userType === 'hospital' ? '#0d9488' : 
                               userType === 'doctor' ? '#7c3aed' : 
                               userType === 'admin' ? '#9c27b0' : '#666',
                  color: 'white',
                  marginLeft: '5px'
                }}>
                  {userType === 'hospital' ? '🏥' : 
                   userType === 'doctor' ? '👨‍⚕️' : 
                   userType === 'admin' ? '👑' : '👤'}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                className="logout-btn-nav"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              className="google-btn"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
            >
              <img
                src="/images/google.png"
                alt="Google Logo"
                className="critical"
                loading="eager"
                fetchPriority="high"
                width="20"
                height="20"
                onLoad={() => handleImageLoad("google")}
                onError={(e) => {
                  e.target.src = "/images/default-icon.png";
                  e.target.className += " loaded";
                }}
              />
              <span>{isSigningIn ? "Signing in..." : "Sign in"}</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavbarFixed;