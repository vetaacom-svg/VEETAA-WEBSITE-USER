import React, { useState, useEffect, useRef, ReactNode } from 'react';
import OfflineView from '../views/OfflineView';
import { Language } from '../types';

interface NetworkWrapperProps {
  children: ReactNode;
  language: Language;
}

const PING_TIMEOUT_MS = 5000;

const checkPing = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), PING_TIMEOUT_MS);
    // Same-origin probe avoids Brave Shields false negatives on third-party domains.
    fetch('/', { cache: 'no-store', method: 'HEAD' })
      .then(() => {
        clearTimeout(timer);
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
  });
};

const NetworkWrapper: React.FC<NetworkWrapperProps> = ({ children, language }) => {
  const [isOffline, setIsOffline] = useState(false);
  const isOfflineRef = useRef(false);
  const failedChecksRef = useRef(0);
  isOfflineRef.current = isOffline;

  const performCheck = async () => {
    if (!window.navigator.onLine) {
      failedChecksRef.current = 0;
      setIsOffline(true);
      return;
    }
    const hasInternet = await checkPing();
    if (hasInternet) {
      failedChecksRef.current = 0;
      setIsOffline(false);
      return;
    }
    failedChecksRef.current += 1;
    if (failedChecksRef.current >= 2) setIsOffline(true);
  };

  useEffect(() => {
    const handleOnline = () => performCheck();
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    performCheck();
    const interval = setInterval(() => {
      if (!window.navigator.onLine || isOfflineRef.current) performCheck();
    }, 5000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOffline) {
    return <OfflineView language={language} onRetry={performCheck} />;
  }
  return <>{children}</>;
};

export default NetworkWrapper;
