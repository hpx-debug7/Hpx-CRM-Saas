'use client';

import React, { useState, useEffect } from 'react';
import { 
  getActiveWorkSession, 
  startWorkSession, 
  endWorkSession 
} from '../utils/employeeStorage';
import type { WorkSession } from '../types/shared';

interface WorkSessionTrackerProps {
  leadId: string;
  leadName: string;
  compact?: boolean;
}

const WorkSessionTracker: React.FC<WorkSessionTrackerProps> = ({
  leadId,
  leadName,
  compact = false
}) => {
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Load active session on mount
  useEffect(() => {
    const session = getActiveWorkSession(leadId);
    setActiveSession(session);
    
    if (session) {
      // Calculate initial elapsed time
      const startTime = new Date(session.startTime).getTime();
      const now = Date.now();
      setElapsedTime(Math.floor((now - startTime) / 1000));
    }
  }, [leadId]);

  // Update elapsed time every second when session is active
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // Format duration as HH:MM:SS or MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // Format duration in minutes as "2h 30m" or "45m"
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } else {
      return `${mins}m`;
    }
  };

  // Start tracking
  const handleStart = async () => {
    setIsLoading(true);
    try {
      const session = startWorkSession(leadId, leadName);
      setActiveSession(session);
      setElapsedTime(0);
      
      // Success notification could be added here
      console.log(`Started tracking work on ${leadName}`);
    } catch (error) {
      console.error('Error starting work session:', error);
      alert('Failed to start tracking. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Stop tracking
  const handleStop = async () => {
    if (!activeSession) return;

    setIsLoading(true);
    try {
      const updatedSession = endWorkSession(activeSession.id);
      
      if (updatedSession && updatedSession.duration) {
        const durationText = formatDuration(updatedSession.duration);
        console.log(`Stopped tracking. Total time: ${durationText}`);
        
        // Optional: Prompt to add activity note
        // This could be implemented by showing a modal with ActivityLogger
      }
      
      setActiveSession(null);
      setElapsedTime(0);
    } catch (error) {
      console.error('Error stopping work session:', error);
      alert('Failed to stop tracking. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`border border-gray-200 rounded-lg ${compact ? 'p-3' : 'p-4'} bg-white`}>
      {/* Session Status Indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {activeSession ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className={`text-green-700 font-medium ${compact ? 'text-sm' : 'text-base'}`}>
                Tracking time
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span className={`text-gray-600 ${compact ? 'text-sm' : 'text-base'}`}>
                Not tracking time
              </span>
            </>
          )}
        </div>
      </div>

      {/* Timer Display */}
      {activeSession && (
        <div className={`text-center mb-4 ${compact ? 'my-2' : 'my-4'}`}>
          <div className={`font-mono font-bold text-purple-600 ${compact ? 'text-2xl' : 'text-3xl'}`}>
            {formatTime(elapsedTime)}
          </div>
        </div>
      )}

      {/* Action Button */}
      {activeSession ? (
        <button
          onClick={handleStop}
          disabled={isLoading}
          className={`w-full bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${compact ? 'py-1.5 text-sm' : 'py-2'}`}
        >
          <span>⏹</span>
          {isLoading ? 'Stopping...' : 'Stop Tracking'}
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={isLoading}
          className={`w-full bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${compact ? 'py-1.5 text-sm' : 'py-2'}`}
        >
          <span>▶</span>
          {isLoading ? 'Starting...' : 'Start Tracking'}
        </button>
      )}
    </div>
  );
};

export default WorkSessionTracker;

