'use client';

import React, { useState, useEffect } from 'react';
import { hasEmployeeName } from '../utils/employeeStorage';
import EmployeeSetupModal from './EmployeeSetupModal';
import IdleDetectionModal from './IdleDetectionModal';

interface EmployeeSetupWrapperProps {
  children: React.ReactNode;
}

const EmployeeSetupWrapper: React.FC<EmployeeSetupWrapperProps> = ({ children }) => {
  const [showSetup, setShowSetup] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if employee name exists
    const checkEmployeeName = () => {
      const hasName = hasEmployeeName();
      setShowSetup(!hasName);
      setIsChecking(false);
    };

    checkEmployeeName();
  }, []);

  const handleSetupComplete = (name: string) => {
    setShowSetup(false);
  };

  // Don't render children until we've checked for employee name
  if (isChecking) {
    return null;
  }

  return (
    <>
      {/* First-time setup modal */}
      <EmployeeSetupModal 
        isOpen={showSetup} 
        onComplete={handleSetupComplete} 
      />
      
      {/* Idle detection modal (always rendered after setup) */}
      <IdleDetectionModal
        isEnabled={!showSetup && hasEmployeeName()}
        idleThreshold={5}
        onIdleDetected={() => {
          console.log('User idle detected');
        }}
      />
      
      {/* App content */}
      {children}
    </>
  );
};

export default EmployeeSetupWrapper;

