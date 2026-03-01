import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';

const NavbarFixed = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { currentUser, userData, signInWithGoogle, logout } = useAuth();
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
    navigate('/user-dashboard');
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
            <Link to="/login" onClick={() => setIsMenuOpen(false)}>
              Admin(Hospitals)
            </Link>
          </li>
        </ul>

        <div className="sign-in-container">
          {currentUser ? (
            <div
              className="user-profile-nav"
              style={{ cursor: "pointer" }}
              onClick={handleProfileClick}
              title="Go to Dashboard"
            >
              <img
                src={userPhotoURL || "/images/default-avatar.png"}
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
                {userData?.displayName ||
                  currentUser?.displayName ||
                  currentUser?.email?.split("@")[0] ||
                  "User"}
              </span>
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
