import React, { useState, useEffect } from 'react';

const LoadingAnimation = ({ message = "Loading files..." }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = Date.now();
    const duration = 2000; // 2 seconds to count from 0 to 100
    
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      
      setCount(Math.floor(progress));
      
      if (progress >= 100) {
        clearInterval(timer);
      }
    }, 20); // Update every 20ms for smooth animation
    
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg border border-gray-600">
      <div className="text-center mb-4">
        <div className="text-6xl font-bold text-blue-400 mb-2">
          {count}%
        </div>
        <div className="w-64 bg-gray-700 rounded-full h-2 mb-4">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-100 ease-out"
            style={{ width: `${count}%` }}
          ></div>
        </div>
        <p className="text-gray-300 text-lg">{message}</p>
      </div>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  );
};

export default LoadingAnimation;