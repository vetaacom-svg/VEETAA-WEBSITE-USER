import React, { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { CatalogProvider } from './CatalogContext';
import { LocationProvider } from './LocationContext';
import { CartProvider } from './CartContext';

const CombinedProviders: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { language, user } = useAuth();
  return (
    <LocationProvider>
      <CatalogProvider language={language}>
        <CartProvider userId={user?.id || null}>
          {children}
        </CartProvider>
      </CatalogProvider>
    </LocationProvider>
  );
};

export const VeetaaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <CombinedProviders>
        {children}
      </CombinedProviders>
    </AuthProvider>
  );
};
