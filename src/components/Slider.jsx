import React, { useState, useEffect } from 'react';
import './Slider.css';

const Slider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    '/images/slide1.jpg',
    '/images/slider2.png',
    '/images/slider3.jpg',
    '/images/slider6.jpg'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <section className="slider" style={{ marginTop: '0', paddingTop: '0' }}>
      <div className="slide-container" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
        {slides.map((slide, index) => (
          <div className="slide" key={index}>
            <img src={slide} alt={`Healthcare ${index + 1}`} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default Slider;