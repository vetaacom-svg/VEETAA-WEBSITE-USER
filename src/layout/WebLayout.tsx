import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { ShoppingCart, User, Bell, Menu, X, Trash2, ChevronRight } from 'lucide-react';
import { useVeetaa } from '../context/VeetaaContext';
import Footer from './Footer';
import logoImage from '../../logo.png';

const NAV_ITEMS = [
  { key: 'home', path: '/home' },
  { key: 'stores', path: '/stores' },
  { key: 'orders', path: '/orders' },
] as const;

export default function WebLayout() {
  const { user, cart, t, notification, removeCartItem, isAuthLoading } = useVeetaa();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartHoverOpen, setCartHoverOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
      lastScrollY.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isAuthPage = ['/login', '/signup', '/email-otp-verify', '/email-verified', '/permissions', '/password-reset'].some(
    (p) => location.pathname === p
  );
  const isWelcome = location.pathname === '/';
  const hideHeader = isAuthPage || isWelcome || location.pathname === '/blocked' || location.pathname === '/vpn-blocked' || location.pathname === '/confirmation';

  if (hideHeader) return <Outlet />;

  const cartCount = cart.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  const cartTotal = cart.reduce((sum: number, item: any) => sum + (item.product?.price || 0) * (item.quantity || 0), 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8f9fa' }}>
      {/* Toast notification */}
      {notification && (
        <div className="veetaa-toast animate-premium">
          <div className="veetaa-toast-icon">
            <Bell size={18} />
          </div>
          <div>
            <p className="veetaa-toast-title font-black text-[10px] tracking-widest">{notification.title}</p>
            <p className="veetaa-toast-body text-sm font-bold">{notification.body}</p>
          </div>
        </div>
      )}

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <div style={{
        position: 'fixed',
        top: scrolled ? '10px' : '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        width: '94%',
        maxWidth: '1200px',
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 16px',
          height: '56px',
          borderRadius: '16px',
          background: 'rgba(15, 15, 20, 0.6)',
          backdropFilter: 'blur(20px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: scrolled
            ? '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset'
            : '0 4px 24px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.04) inset',
          transition: 'box-shadow 0.35s ease',
        }}>
          {/* LEFT: Logo + Name */}
          <Link
            to="/home"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <img
              src={logoImage}
              alt="Veetaa"
              style={{
                height: '32px',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
            <span style={{
              color: '#ffffff',
              fontSize: '17px',
              fontWeight: 700,
              letterSpacing: '-0.3px',
              fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
            }}>
              Veetaa
            </span>
          </Link>

          {/* RIGHT: Nav Links + Profile (Desktop) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          className="vt-nav-desktop-group"
          >
            {NAV_ITEMS.map(({ key, path }) => (
              <NavLink
                key={key}
                to={path}
                end={key === 'home'}
                style={({ isActive }) => ({
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)',
                  fontSize: '14px',
                  fontWeight: 500,
                  padding: '8px 16px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  fontFamily: "'Inter', sans-serif",
                  letterSpacing: '-0.1px',
                  whiteSpace: 'nowrap',
                })}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  if (!el.classList.contains('active')) {
                    el.style.color = 'rgba(255,255,255,0.85)';
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  if (!el.classList.contains('active')) {
                    el.style.color = 'rgba(255,255,255,0.5)';
                  }
                }}
              >
                {t(key)}
              </NavLink>
            ))}

            {/* Cart button (only when items exist) */}
            {cartCount > 0 && (
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => setCartHoverOpen(true)}
                onMouseLeave={() => setCartHoverOpen(false)}
              >
                <button
                  onClick={() => navigate(user ? '/checkout' : '/login')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#ea580c',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ShoppingCart size={18} />
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: '#fff',
                    color: '#0f0f14',
                    fontSize: '10px',
                    fontWeight: 800,
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>{cartCount}</span>
                </button>

                {/* Cart hover dropdown */}
                {cartHoverOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '300px',
                    background: '#fff',
                    borderRadius: '14px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                    border: '1px solid rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                    zIndex: 120,
                  }}>
                    <div style={{ padding: '16px', background: '#f8f9fa', borderBottom: '1px solid #eee' }}>
                      <p style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>Résumé du panier</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <p style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{cartTotal} DH</p>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{cartCount} articles</p>
                      </div>
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '8px' }}>
                      {cart.map((item: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', gap: '10px', padding: '8px', borderRadius: '10px', alignItems: 'center' }}>
                          <img src={item.product?.image} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} alt="" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product?.name}</p>
                            <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>{item.quantity} × {item.product?.price} DH</p>
                          </div>
                          <button onClick={() => removeCartItem(idx)} style={{ padding: '6px', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '12px', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        onClick={() => navigate('/checkout')}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: '#0f172a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Commander <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div style={{
              width: '1px',
              height: '24px',
              background: 'rgba(255,255,255,0.1)',
              margin: '0 4px',
            }}
            className="vt-nav-divider"
            />

            {/* Profile / Login */}
            {user ? (
              <Link
                to="/settings"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ea580c';
                  e.currentTarget.style.borderColor = '#ea580c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                <User size={18} />
              </Link>
            ) : isAuthLoading ? (
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.08)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ) : (
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.95)',
                  color: '#0f0f14',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: "'Inter', sans-serif",
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.1px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.transform = 'scale(1.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {t('login')}
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="vt-nav-mobile-toggle"
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div style={{
            marginTop: '8px',
            borderRadius: '14px',
            background: 'rgba(15, 15, 20, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
          }}>
            {NAV_ITEMS.map(({ key, path }) => (
              <NavLink
                key={key}
                to={path}
                end={key === 'home'}
                onClick={() => setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)',
                  fontSize: '15px',
                  fontWeight: 500,
                  padding: '12px 16px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  fontFamily: "'Inter', sans-serif",
                  display: 'block',
                })}
              >
                {t(key)}
              </NavLink>
            ))}

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

            {user ? (
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 500,
                  padding: '12px 16px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <User size={18} />
                {t('settings') || 'Profil'}
              </Link>
            ) : isAuthLoading ? null : (
              <button
                onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.95)',
                  color: '#0f0f14',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  marginTop: '4px',
                }}
              >
                {t('login')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Spacer for fixed navbar */}
      <div style={{ height: '88px' }} />

      {/* Main content */}
      <main className="veetaa-container flex-1 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      {!location.pathname.startsWith('/tickets') && !location.pathname.startsWith('/store/') && location.pathname !== '/checkout' && !location.pathname.endsWith('/track') && <Footer />}

      {/* Floating cart FAB (mobile) */}
      {cartCount > 0 && !['/checkout', '/confirmation'].includes(location.pathname) && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 50,
        }}>
          <button
            onClick={() => navigate(user ? '/checkout' : '/login')}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#ea580c',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(234, 88, 12, 0.4)',
              position: 'relative',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <ShoppingCart size={24} />
            <span style={{
              position: 'absolute',
              top: '-6px',
              left: '-6px',
              background: '#0f172a',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 800,
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid #fff',
            }}>{cartCount}</span>
          </button>
        </div>
      )}

      {/* Responsive CSS */}
      <style>{`
        .vt-nav-desktop-group {
          display: flex !important;
        }
        .vt-nav-mobile-toggle {
          display: none !important;
        }
        .vt-nav-divider {
          display: block !important;
        }
        @media (max-width: 768px) {
          .vt-nav-desktop-group {
            display: none !important;
          }
          .vt-nav-mobile-toggle {
            display: flex !important;
          }
          .vt-nav-divider {
            display: none !important;
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
