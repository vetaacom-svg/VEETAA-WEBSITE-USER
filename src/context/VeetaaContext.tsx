import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { LocationProvider, useLocation } from './LocationContext';
import { CatalogProvider, useCatalog } from './CatalogContext';
import { CartProvider, useCart } from './CartContext';
import { TRANSLATIONS } from '../constants';

const VeetaaContext = createContext<any>(null);

// Stabilize the context by flattening the dependency tree
const VeetaaFacilitator: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const location = useLocation();
  const catalog = useCatalog();
  const cart = useCart();

  const t = (key: string) => TRANSLATIONS[auth.language]?.[key] || key;

  const value = useMemo(() => {
    return {
      ...auth,
      ...location,
      ...catalog,
      ...cart,
      t,
      initDone: !catalog.loadingCatalog,
    };
  }, [
    auth.user, auth.isAuthLoading, auth.language, auth.isBlocked, auth.pendingEmail, auth.setPendingEmail, auth.setPendingPassword, auth.handleLogout, auth.handleLoginSuccess, auth.handleForgotPassword, auth.handleSignupSuccess, auth.handleEmailOtpVerified, auth.handlePasswordResetSuccess, auth.handleProfileSave, auth.handlePermissionsGranted, auth.setLanguage,
    location.userLocation, location.appSettings, location.isOutOfZone, location.refreshLocation, location.setUserLocation,
    catalog.storesData, catalog.categoriesData, catalog.loadingCatalog, catalog.fetchStoreById, catalog.fetchProductById, catalog.loadMoreStores,
    cart.cart, cart.setCart, cart.favorites, cart.toggleFavorite, cart.orders, cart.setOrders, cart.addToCart, cart.updateCartItemQuantity, cart.removeCartItem, cart.cartTotal, cart.textOrder, cart.prescriptionImage, cart.currentOrder, cart.saveOrder, cart.handleRateOrder
  ]);

  return <VeetaaContext.Provider value={value}>{children}</VeetaaContext.Provider>;
};

export const VeetaaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <LocationProvider>
        <ContextBroker>
          {children}
        </ContextBroker>
      </LocationProvider>
    </AuthProvider>
  );
};

// Orchestrates the dependency-heavy providers (Catalog needs Auth.language, Cart needs Auth.user.id)
const ContextBroker: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { language, user } = useAuth();
  return (
    <CatalogProvider language={language}>
      <CartProvider userId={user?.id || null}>
        <VeetaaFacilitator>
          {children}
        </VeetaaFacilitator>
      </CartProvider>
    </CatalogProvider>
  );
};

export const useVeetaa = () => {
  const ctx = useContext(VeetaaContext);
  if (!ctx) {
    if (import.meta.env.DEV) {
      console.error('%c❌ [VEETAA] Context is NULL! Make sure you are within VeetaaProvider', 'color: red; font-weight: bold;');
    }
    throw new Error('useVeetaa must be used within VeetaaProvider');
  }
  return ctx;
};
