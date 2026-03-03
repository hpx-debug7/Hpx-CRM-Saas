'use client';

import React, { useState, useEffect, useRef } from 'react';
import { setEmployeeName } from '../utils/employeeStorage';

interface EmployeeSetupModalProps {
  isOpen: boolean;
  onComplete: (name: string) => void;
}

const EmployeeSetupModal: React.FC<EmployeeSetupModalProps> = ({
  isOpen,
  onComplete
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on name input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError('Please enter your name');
      return;
    }

    // Save employee name
    setEmployeeName(trimmedName);
    
    // Call completion callback
    onComplete(trimmedName);
    
    // Reset form
    setName('');
    setError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg p-8 w-full max-w-md mx-4 shadow-xl"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Welcome! Let's set up your work tracker
          </h2>
          <p className="text-gray-600">
            Enter your name to start tracking your work. This will be used to identify your activities and work sessions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="Enter your full name"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-black placeholder:text-gray-400"
              aria-label="Employee name"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Start Tracking
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmployeeSetupModal;

