'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getEmployeeName } from '../utils/employeeStorage';

interface IdleDetectionModalProps {
  isEnabled: boolean;
  idleThreshold?: number; // minutes
  onIdleDetected?: () => void;
}

export default function IdleDetectionModal({ 
  isEnabled, 
  idleThreshold = 5, 
  onIdleDetected 
}: IdleDetectionModalProps) {
  const [isIdle, setIsIdle] = useState(false);
  const [idleTime, setIdleTime] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(new Date());
  const [employeeName, setEmployeeName] = useState<string | null>(null);

  // Get employee name
  useEffect(() => {
    setEmployeeName(getEmployeeName());
  }, []);

  // Debounced activity handler
  const handleActivity = useCallback(() => {
    if (!isEnabled) return;
    
    setIdleTime(0);
    setIsIdle(false);
    setShowWarning(false);
    setLastActivityTime(new Date());
  }, [isEnabled]);

  // Activity tracking
  useEffect(() => {
    if (!isEnabled) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    let timeoutId: NodeJS.Timeout;

    const debouncedHandler = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleActivity, 100);
    };

    events.forEach(event => {
      document.addEventListener(event, debouncedHandler, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, debouncedHandler);
      });
      clearTimeout(timeoutId);
    };
  }, [isEnabled, handleActivity]);

  // Idle timer
  useEffect(() => {
    if (!isEnabled) return;

    const interval = setInterval(() => {
      setIdleTime(prev => {
        const newTime = prev + 1;
        const thresholdSeconds = idleThreshold * 60;
        
        if (newTime >= thresholdSeconds && !showWarning) {
          setIsIdle(true);
          setShowWarning(true);
          onIdleDetected?.();
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isEnabled, idleThreshold, showWarning, onIdleDetected]);

  // Format duration helper
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle resume work
  const handleResumeWork = () => {
    setIsIdle(false);
    setShowWarning(false);
    setIdleTime(0);
    setLastActivityTime(new Date());
  };

  if (!isEnabled || !showWarning) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-red-900 bg-opacity-70 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl border-4 border-red-500 animate-pulse">
        {/* Warning Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>

        {/* Warning Message */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-red-600 mb-2">⚠️ Productivity Alert</h2>
          <p className="text-gray-700 text-lg mb-4">
            No activity detected for <span className="font-bold text-red-600">{formatDuration(idleTime)}</span> minutes.
          </p>
          <p className="text-gray-600 mb-4">
            You are wasting productive time. Please resume work immediately or your inactivity will be logged.
          </p>
          
          {employeeName && (
            <div className="bg-gray-100 rounded-lg p-3 mb-4">
              <div className="text-sm text-gray-600">Employee: <span className="font-semibold">{employeeName}</span></div>
              <div className="text-sm text-gray-600">Idle for: <span className="font-semibold text-red-600">{formatDuration(idleTime)}</span></div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="text-center">
          <button
            onClick={handleResumeWork}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            I'm Back to Work
          </button>
        </div>

        {/* Auto-dismiss message */}
        <div className="text-center mt-4">
          <p className="text-sm text-gray-500">
            This warning will automatically dismiss when you move your mouse or press any key.
          </p>
        </div>
      </div>
    </div>
  );
}
