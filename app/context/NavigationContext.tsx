'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface NavigationContextType {
  onExportClick: () => void;
  setOnExportClick: (callback: () => void) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [onExportClick, setOnExportClick] = useState<() => void>(() => {});

  return (
    <NavigationContext.Provider value={{
      onExportClick,
      setOnExportClick
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
