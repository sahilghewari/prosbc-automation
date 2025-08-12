import React, { useState, useEffect } from 'react';

const InlineLoadingAnimation = ({ 
  message = "Loading...", 
  isActive = true, 
  minDuration = 1000, // Minimum time to show animation
  onComplete = null 
}) => {
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState('connecting'); // connecting, loading, finalizing

  useEffect(() => {
    if (!isActive) {
      // If not active, reset and potentially call completion
      setCount(0);
      setPhase('connecting');
      return;
    }

    let startTime = Date.now();
    let animationId;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      // Phase 1: Quick connection phase (0-20%)
      if (elapsed < 500) {
        setPhase('connecting');
        const progress = Math.min((elapsed / 500) * 20, 20);
        setCount(Math.floor(progress));
      }
      // Phase 2: Loading phase (20-85%) - slower progression
      else if (elapsed < minDuration * 0.8) {
        setPhase('loading');
        const phaseElapsed = elapsed - 500;
        const phaseDuration = (minDuration * 0.8) - 500;
        const progress = 20 + Math.min((phaseElapsed / phaseDuration) * 65, 65);
        setCount(Math.floor(progress));
      }
      // Phase 3: Finalizing phase (85-95%) - very slow
      else if (elapsed < minDuration) {
        setPhase('finalizing');
        const phaseElapsed = elapsed - (minDuration * 0.8);
        const phaseDuration = minDuration - (minDuration * 0.8);
        const progress = 85 + Math.min((phaseElapsed / phaseDuration) * 10, 10);
        setCount(Math.floor(progress));
      }
      // Phase 4: Complete (95-100%) - only when backend is done
      else if (!isActive) {
        setPhase('completing');
        if (count < 100) {
          setCount(prev => Math.min(prev + 2, 100));
        }
        if (count >= 100 && onComplete) {
          onComplete();
          return;
        }
      }

      if (isActive || count < 100) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, minDuration, count, onComplete]);

  // Complete the animation when backend finishes
  useEffect(() => {
    if (!isActive && count < 100) {
      const completeTimer = setInterval(() => {
        setCount(prev => {
          if (prev >= 100) {
            clearInterval(completeTimer);
            if (onComplete) onComplete();
            return 100;
          }
          return Math.min(prev + 3, 100);
        });
      }, 50);

      return () => clearInterval(completeTimer);
    }
  }, [isActive, count, onComplete]);

  const getPhaseMessage = () => {
    switch (phase) {
      case 'connecting':
        return 'Connecting to ProSBC...';
      case 'loading':
        return message;
      case 'finalizing':
        return 'Processing response...';
      case 'completing':
        return 'Finishing up...';
      default:
        return message;
    }
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'connecting':
        return 'text-yellow-400';
      case 'loading':
        return 'text-blue-400';
      case 'finalizing':
        return 'text-purple-400';
      case 'completing':
        return 'text-green-400';
      default:
        return 'text-blue-400';
    }
  };

  if (!isActive && count === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gray-800 rounded-lg border border-gray-600">
      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${getPhaseColor()} mb-2`}>
          {count}%
        </div>
        <div className="w-56 bg-gray-700 rounded-full h-2 mb-4">
          <div 
            className={`h-2 rounded-full transition-all duration-200 ease-out ${
              phase === 'connecting' ? 'bg-yellow-500' :
              phase === 'loading' ? 'bg-blue-500' :
              phase === 'finalizing' ? 'bg-purple-500' :
              'bg-green-500'
            }`}
            style={{ width: `${count}%` }}
          ></div>
        </div>
        <p className={`text-sm ${getPhaseColor()}`}>{getPhaseMessage()}</p>
      </div>
      
      {/* Animated dots */}
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full animate-bounce ${
              phase === 'connecting' ? 'bg-yellow-400' :
              phase === 'loading' ? 'bg-blue-400' :
              phase === 'finalizing' ? 'bg-purple-400' :
              'bg-green-400'
            }`}
            style={{ animationDelay: `${i * 0.1}s` }}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default InlineLoadingAnimation;
