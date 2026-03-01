import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoadingPage.css';

const LoadingPage = () => {
  const [percentage, setPercentage] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setPercentage(prev => {
        if (prev < 100) {
          return prev + 1;
        } else {
          clearInterval(interval);
          return 100;
        }
      });
    }, 17);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (percentage === 100) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [percentage, navigate]);

  return (
    <div className="loading-page">
      <div className="loading-container">
        <div className="loading-text" id="loadingText">
          Loading... {percentage}%
        </div>
        <div className="bridge"></div>
        <div className={`person ${percentage === 100 ? 'stop-animation' : ''}`}></div>
        <div className="heart"></div>
      </div>
    </div>
  );
};

export default LoadingPage;