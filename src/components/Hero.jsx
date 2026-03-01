import React from 'react';
import './Hero.css';

const Hero = () => {
  const callEmergency = () => {
    window.location.href = "tel:112";
  };

  return (
    <>
      <section className="banner">
        <button className="sos-button" onClick={callEmergency}>
          🚨 Emergency SOS
        </button>
        <div className="banner-content">
          <h2>Find Healthcare Services Near You</h2>
          <div className="search-bar">
            <input type="text" placeholder="Search hospitals, treatments..." />
            <button className="search-btn">
              <img src="/images/search.png" alt="Search" className="search-icon" />
            </button>
          </div>  
        </div>
      </section>

      <section id="home" className="hero">
        <div className="hero-content">
          <h1>Welcome to SwasthConnect</h1>
          <p>Your one-stop solution for accessible healthcare services.</p>
          <h2>Explore Services</h2>
        </div>
        <div className="hero-image">
          <img src="/images/helcare.jpeg" alt="Healthcare" />
        </div>
      </section>
    </>
  );
};

export default Hero;