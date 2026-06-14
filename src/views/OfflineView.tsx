
import React, { useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface OfflineViewProps {
    language: Language;
    onRetry: () => Promise<void>;
}

const OfflineView: React.FC<OfflineViewProps> = ({ language, onRetry }) => {
    const [isRetrying, setIsRetrying] = useState(false);
    const t = (key: string) => TRANSLATIONS[language][key] || key;

    const handleRetry = async () => {
        setIsRetrying(true);
        // Minimum loading time for visual feedback
        const minLoading = new Promise(resolve => setTimeout(resolve, 1500));
        await Promise.all([onRetry(), minLoading]);
        setIsRetrying(false);
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{ marginBottom: '32px', position: 'relative' }}>
                <div style={{
                    width: '96px',
                    height: '96px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 10
                }}>
                    {isRetrying ? (
                        <div style={{
                            width: '48px',
                            height: '48px',
                            border: '4px solid #f1f5f9',
                            borderTop: '4px solid #ea580c',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }} />
                    ) : (
                        <WifiOff size={48} color="#94a3b8" />
                    )}
                </div>
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#f1f5f9',
                    borderRadius: '50%',
                    opacity: 0.2
                }} />
            </div>

            <h1 style={{
                fontSize: '24px',
                fontWeight: '900',
                color: '#1e293b',
                marginBottom: '12px',
                letterSpacing: '-0.025em'
            }}>
                {isRetrying ? t('loading') : t('offlineTitle')}
            </h1>

            <p style={{
                color: '#64748b',
                fontWeight: '500',
                marginBottom: '40px',
                maxWidth: '240px',
                lineHeight: '1.5'
            }}>
                {t('offlineMessage')}
            </p>

            <button
                onClick={handleRetry}
                disabled={isRetrying}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    padding: '16px 32px',
                    borderRadius: '16px',
                    fontWeight: '900',
                    fontSize: '18px',
                    border: 'none',
                    cursor: isRetrying ? 'not-allowed' : 'pointer',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    width: '100%',
                    maxWidth: '280px',
                    opacity: isRetrying ? 0.7 : 1,
                    transition: 'all 0.2s ease'
                }}
            >
                <RefreshCw size={20} className={isRetrying ? 'animate-spin' : ''} style={{ animation: isRetrying ? 'spin 1.5s linear infinite' : 'none' }} />
                {isRetrying ? t('loading') : t('retry')}
            </button>

            <div style={{
                marginTop: '48px',
                fontSize: '10px',
                fontWeight: '900',
                color: '#cbd5e1',
                textTransform: 'uppercase',
                letterSpacing: '0.2em'
            }}>
                Veetaa Delivery
            </div>
        </div>
    );
};

export default OfflineView;
