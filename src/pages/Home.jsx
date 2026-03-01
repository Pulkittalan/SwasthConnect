import React from 'react';
import Navbar from '../components/Navbar';
import Slider from '../components/Slider';
import Hero from '../components/Hero';
import Services from '../components/Services';
import VideoSection from '../components/VideoSection';
import Contact from '../components/Contact';
import Footer from '../components/Footer';
import './Home.css';

const Home = () => {
  return (
    <div className="home-page">
      <Navbar />
      <Slider />
      <Hero />
      <Services />
      <VideoSection />
      <Contact />
      <Footer />
    </div>
  );
};

export default Home;
