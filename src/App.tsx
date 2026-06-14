import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import NetworkWrapper from './components/NetworkWrapper';
import { VeetaaProvider, useVeetaa } from './context/VeetaaContext';
import WebLayout from './layout/WebLayout';
import Welcome from './views/Welcome';
import LoadingSplash from './components/LoadingSplash';
import Login from './views/Login';
import Signup from './views/Signup';
import EmailOtpVerification from './views/EmailOtpVerification';
import EmailVerified from './views/EmailVerified';
import PasswordReset from './views/PasswordReset';
import PermissionsRequest from './views/PermissionsRequest';
import Home from './views/Home';
import AllStores from './views/AllStores';
import CategoryDetail from './views/CategoryDetail';
import StoreDetail from './views/StoreDetail';
import Checkout from './views/Checkout';
import Confirmation from './views/Confirmation';
import Favorites from './views/Favorites';
import Settings from './views/Settings';
import ProfileEdit from './views/ProfileEdit';
import Help from './views/Help';
import Privacy from './views/Privacy';
import Notifications from './views/Notifications';
import Tracking from './views/Tracking';
import History from './views/History';
import ProductOrderView from './views/ProductOrderView';
import BlockedView from './views/BlockedView';
import VpnBlockedView from './views/VpnBlockedView';
import OutOfZoneView from './views/OutOfZoneView';
import TicketsList from './views/TicketsList';
import TicketNew from './views/TicketNew';
import TicketChat from './views/TicketChat';
import { CategoryID, Store, Product, Language, CartItem } from './types';
import { TRANSLATIONS } from './constants';
import { safeGetItem, safeRemoveItem, safeSetItem } from './lib/storage';

function WelcomePage() {
  const { language, user } = useVeetaa();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && safeGetItem('veetaa_has_seen_welcome')) {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  return (
    <Welcome
      language={language}
      onStart={async () => {
        try {
          // Skip VPN check - just go to home
          safeSetItem('veetaa_has_seen_welcome', '1');
          navigate('/home', { replace: true });
        } catch (error) {
          console.error('Error in onStart:', error);
          safeSetItem('veetaa_has_seen_welcome', '1');
          navigate('/home', { replace: true });
        }
      }}
    />
  );
}

function LoginPage() {
  const { user, language, handleLoginSuccess, handleForgotPassword, pendingEmail, pendingPassword, setPendingEmail, setPendingPassword } = useVeetaa();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string })?.returnTo || '/home';

  useEffect(() => {
    if (user) navigate(returnTo, { replace: true });
  }, [user, navigate, returnTo]);

  return (
    <Login
      language={language}
      onLogin={async (email, authUser) => {
        await handleLoginSuccess(email, authUser);
        navigate(returnTo);
      }}
      onGoToSignup={() => { setPendingEmail(''); setPendingPassword(''); navigate('/signup'); }}
      onForgotPassword={handleForgotPassword}
      initialEmail={pendingEmail || safeGetItem('veetaa_last_email') || ''}
      initialPassword={pendingPassword}
    />
  );
}

function HomePage() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  if (ctx.isBlocked && ctx.user) return <Navigate to="/blocked" replace />;

  return (
    <Home
      language={ctx.language}
      isExplorerMode={false}
      stores={ctx.storesWithProducts}
      categories={ctx.categoriesData}
      onSelectCategory={(id) => navigate(`/category/${id}`)}
      favorites={ctx.favorites}
      onToggleFavorite={ctx.toggleFavorite}
      onToggleExplorer={() => { }}
      onSelectProduct={(p) => navigate(`/store/${p.storeId}/product/${p.id}`)}
      onSelectStore={(s) => navigate(`/store/${s.id}`)}
      onSeeMoreStores={() => navigate('/stores')}
      userLocation={ctx.userLocation}
      loadingLocation={ctx.loadingLocation}
      locationError={ctx.locationError}
      onRefreshLocation={async () => {
        safeRemoveItem('veetaa_manual_city_override');
        await ctx.refreshLocation();
      }}
      deliveryZones={ctx.deliveryZones}
      onSelectCity={(city) => {
        ctx.setUserLocation(city);
        safeSetItem('userLocation', JSON.stringify(city));
        safeSetItem('veetaa_manual_city_override', '1');
      }}
    />
  );
}

function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const ctx = useVeetaa();
  const navigate = useNavigate();
  if (!categoryId) return <Navigate to="/home" replace />;
  const normalizedCategoryId = categoryId.toLowerCase().trim();
  const category = ctx.categoriesData.find((c: { id: string }) => String(c.id).toLowerCase().trim() === normalizedCategoryId);
  // If categories are still loading, avoid redirect loops (shows the category page anyway).
  if (!category && ctx.categoriesData.length > 0) return <Navigate to="/home" replace />;
  return (
    <CategoryDetail
      language={ctx.language}
      category={normalizedCategoryId as CategoryID}
      stores={ctx.storesWithProducts}
      categories={ctx.categoriesData}
      subCategories={ctx.subCategoriesData}
      favorites={ctx.favorites}
      onToggleFavorite={ctx.toggleFavorite}
      onSelectStore={(s) =>
        navigate(`/store/${s.id}`, { state: s.id?.startsWith('sys-') ? { virtualStore: s } : undefined })
      }
    />
  );
}

function StorePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const ctx = useVeetaa();
  const navigate = useNavigate();
  const location = useLocation();
  const [asyncStore, setAsyncStore] = useState<Store | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!storeId || storeId.startsWith('sys-')) return;
    const found = ctx.storesWithProducts.find((s: any) => String(s.id) === String(storeId));
    if (found) {
      setAsyncStore(null);
      setFetching(false);
      return;
    }
    let cancelled = false;
    setFetching(true);
    ctx
      .fetchStoreById(storeId)
      .then((s: any) => {
        if (cancelled) return;
        setAsyncStore(s);
        setFetching(false);
      })
      .catch(() => {
        if (!cancelled) {
          setAsyncStore(null);
          setFetching(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, ctx.storesWithProducts, ctx.fetchStoreById]);

  if (!storeId) return <Navigate to="/home" replace />;

  const virtualStoreFromState = (location.state as any)?.virtualStore;
  const storeFromState =
    virtualStoreFromState && String(virtualStoreFromState.id) === storeId ? (virtualStoreFromState as Store) : null;

  const store =
    storeFromState ||
    ctx.storesWithProducts.find((s: any) => s.id === storeId) ||
    asyncStore ||
    (storeId.startsWith('sys-')
      ? (() => {
        const category = storeId.slice('sys-'.length).toLowerCase().trim() as CategoryID;
        const t = (key: string) => TRANSLATIONS[ctx.language as Language]?.[key] || key;
        const systemStore: Store = {
          id: storeId,
          name: `${t(category)} ${t('expressService')}`,
          category,
          type: 'text-only',
          image: 'https://images.unsplash.com/photo-1596701062351-8c2c14d1fdd0?auto=format&fit=crop&q=80&w=400',
          products: undefined,
        };
        return systemStore;
      })()
      : null);

  if (!store && ctx.initDone && !fetching) return <Navigate to="/home" replace />;
  if (!store) return null;

  return (
    <StoreDetail
      store={store}
      language={ctx.language}
      favorites={ctx.favorites}
      onToggleFavorite={ctx.toggleFavorite}
      onSelectProduct={(p) => navigate(`/store/${storeId}/product/${p.id}`)}
      cartCount={ctx.cart.reduce((s: number, i: CartItem) => s + i.quantity, 0)}
      onViewCart={() => (ctx.user ? navigate('/checkout') : navigate('/login'))}
      onCheckout={(text, image, price) => {
        const customProduct = {
          id: 'custom-' + Date.now(),
          name: text ? (text.length > 20 ? text.slice(0, 20) + '...' : text) : (store.type === 'prescription' ? 'Ordonnance' : 'Commande spéciale'),
          price: price || 20,
          image: Array.isArray(image) ? image[0] : (image || store.image),
          storeId: store.id,
          storeName: store.name,
          category: store.category,
        };
        ctx.addToCart(customProduct as any, 1, text, image);
      }}
      userLocation={ctx.userLocation}
    />
  );
}

function ProductOrderPage() {
  const { storeId, productId } = useParams<{ storeId: string; productId: string }>();
  const ctx = useVeetaa();
  const navigate = useNavigate();
  const location = useLocation();
  const [asyncData, setAsyncData] = useState<{ store: Store | null; product: Product | null }>({ store: null, product: null });
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!storeId || !productId) return;
    const store = ctx.storesWithProducts.find((s: any) => s.id === storeId);
    const productFromState = (location.state as any)?.product;
    const product = productFromState || store?.products?.find((p: any) => p.id === productId);

    if (!store || !product) {
      setFetching(true);
      Promise.all([ctx.fetchStoreById(storeId), ctx.fetchProductById(productId)]).then(([s, p]) => {
        setAsyncData({ store: s as any, product: p as any });
        setFetching(false);
      });
    }
  }, [storeId, productId, ctx.storesWithProducts, ctx.fetchStoreById, ctx.fetchProductById]);

  if (!storeId || !productId) return <Navigate to="/home" replace />;

  const productFromState = (location.state as any)?.product;
  const store = ctx.storesWithProducts.find((s: any) => s.id === storeId) || asyncData.store;
  const product = productFromState || store?.products?.find((p: any) => p.id === productId) || asyncData.product;

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if ((!product || !store) && ctx.initDone && !fetching) return <Navigate to="/home" replace />;
  if (!product || !store) return null;

  const category = ctx.categoriesData.find((c: any) => c.id === store.category) || { id: store.category, name: '', color: '' };
  return (
    <ProductOrderView
      product={product}
      category={category.id as CategoryID}
      language={ctx.language}
      onConfirm={(p, q, note, img) => {
        ctx.addToCart(p, q, note ?? undefined, img ?? undefined);
        navigate(-1);
      }}
    />
  );
}

function CheckoutPage() {
  const ctx = useVeetaa();
  const navigate = useNavigate();

  const uniqueCartStoreIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of ctx.cart) {
      const id = item.storeId ?? item.product?.storeId;
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }, [ctx.cart]);

  const [deliveryStores, setDeliveryStores] = useState<Store[]>([]);

  useEffect(() => {
    if (uniqueCartStoreIds.length === 0) {
      setDeliveryStores([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      /** Toujours charger le magasin depuis l’API pour le checkout : lat/lng, maps_url, barème livraison.
       * La liste `storesWithProducts` est paginée / allégée — un produit « normal » peut référencer un magasin hors page courante ou une ligne incomplète. */
      const results = await Promise.all(
        uniqueCartStoreIds.map(async (rawId) => {
          const id = String(rawId);
          if (id.startsWith('sys-')) {
            const category = id.slice('sys-'.length).toLowerCase().trim() as CategoryID;
            const t = (key: string) => TRANSLATIONS[ctx.language as Language]?.[key] || key;
            return {
              id,
              name: `${t(category)} ${t('expressService')}`,
              category,
              type: 'text-only',
              image: 'https://images.unsplash.com/photo-1596701062351-8c2c14d1fdd0?auto=format&fit=crop&q=80&w=400',
              latitude: 34.26101, // KENITRA_CENTER
              longitude: -6.5802,
              lat: 34.26101,
              lng: -6.5802,
            } as Store;
          }
          try {
            const fromApi = await ctx.fetchStoreById(id);
            if (fromApi) return fromApi;
          } catch {
            /* réseau / annulation */
          }
          const fromList = ctx.storesWithProducts.find((s: Store) => String(s.id) === id);
          return fromList ?? null;
        })
      );
      const resolved = results.filter((x): x is Store => x != null);
      if (!cancelled) setDeliveryStores(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [uniqueCartStoreIds.join('|'), ctx.storesWithProducts, ctx.fetchStoreById, ctx.language]);

  const firstLineStoreId =
    ctx.cart[0]?.storeId ?? ctx.cart[0]?.product?.storeId ?? null;
  const store = firstLineStoreId
    ? deliveryStores.find((s: Store) => s.id === firstLineStoreId) ?? deliveryStores[0] ?? null
    : deliveryStores[0] ?? null;

  const category = store
    ? ctx.categoriesData.find((c: { id: string }) => c.id === store.category)
    : null;
  if (!ctx.user) return <Navigate to="/login" state={{ returnTo: '/checkout' }} replace />;
  return (
    <Checkout
      language={ctx.language}
      user={ctx.user}
      cart={ctx.cart}
      textOrder={ctx.textOrder}
      prescriptionImage={ctx.prescriptionImage}
      total={ctx.cartTotal}
      deliveryFeePerKm={ctx.appSettings.delivery_fee_per_km}
      deliveryBaseFee={
        typeof ctx.appSettings.delivery_base_fee === 'number' ? ctx.appSettings.delivery_base_fee : undefined
      }
      deliveryIncludedKm={
        typeof ctx.appSettings.delivery_included_km === 'number' ? ctx.appSettings.delivery_included_km : undefined
      }
      selectedStore={store ?? null}
      deliveryStores={deliveryStores}
      selectedCategory={(category?.id ?? 'food') as CategoryID}
      onPlaceOrder={async (order) => {
        const id = await ctx.saveOrder(order);
        if (id) navigate('/confirmation');
        else alert(ctx.language === 'ar' ? 'خطأ في إنشاء الطلب' : 'Erreur lors de la création de la commande');
      }}
      onUpdateCartItem={ctx.updateCartItemQuantity}
      onRemoveCartItem={ctx.removeCartItem}
      onBack={() => navigate(-1)}
      userLocation={ctx.userLocation}
      deliveryZone={ctx.appSettings.delivery_zone}
    />
  );
}

function ConfirmationPage() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  if (!ctx.currentOrder) return <Navigate to="/home" replace />;
  return (
    <Confirmation
      language={ctx.language}
      order={ctx.currentOrder}
      onHome={() => navigate('/home')}
      onTrack={() => navigate(`/orders/${ctx.currentOrder!.id}/track`)}
      onRate={ctx.handleRateOrder}
    />
  );
}

function HistoryPage() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return (
    <History
      language={ctx.language}
      orders={ctx.orders}
      onOrderAgain={(o) => {
        const cartItems: import('./types').CartItem[] = (o.items || []).map((item: any) => ({
          product: item.product ?? {
            id: item.product_id ?? 'custom-' + Date.now(),
            name: item.product_name ?? item.product?.name ?? 'Produit',
            price: item.price ?? item.product?.price ?? 0,
            image: item.product?.image ?? '',
            storeId: o.storeId,
            storeName: o.storeName,
          },
          quantity: item.quantity,
          note: item.note,
          image_base64: item.image_base64,
          storeId: o.storeId ?? item.storeId,
          storeName: o.storeName ?? item.storeName,
        }));
        ctx.setCart(cartItems);
        const store = ctx.storesWithProducts.find((s: Store) => s.id === o.storeId);
        if (store) navigate('/checkout');
      }}
      onTrack={(order) => navigate(`/orders/${order.id}/track`)}
    />
  );
}

function TrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return (
    <Tracking
      language={ctx.language}
      orders={ctx.orders}
      trackingOrderId={orderId ?? null}
      onBack={() => navigate('/home')}
    />
  );
}

function SettingsPage() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return (
    <Settings
      language={ctx.language}
      onLanguageChange={ctx.setLanguage}
      user={ctx.user}
      onEditProfile={() => navigate('/settings/profile')}
      onLogout={ctx.handleLogout}
      onHelp={() => navigate('/settings/help')}
      onGoFavorites={() => navigate('/favorites')}
      onNotifications={() => navigate('/settings/notifications')}
      onPrivacy={() => navigate('/settings/privacy')}
    />
  );
}

function AppContent() {
  const ctx = useVeetaa();
  const { language, userLocation } = ctx;
  const navigate = useNavigate();
  return (
    <NetworkWrapper language={language}>
      <Routes>
        {/* Layout unique : la navbar ne se démonte plus à chaque changement de page (plus de « refresh » visuel). */}
        <Route element={<WebLayout />}>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupRoute />} />
          <Route path="/email-otp-verify" element={<EmailOtpVerifyRoute />} />
          <Route path="/email-verified" element={<EmailVerifiedRoute />} />
          <Route path="/permissions" element={<PermissionsRoute />} />
          <Route path="/password-reset" element={<PasswordResetRoute />} />
          <Route path="/blocked" element={<BlockedRoute />} />
          <Route path="/vpn-blocked" element={<VpnBlockedRoute />} />
          <Route
            path="/out-of-zone"
            element={<OutOfZoneView language={language} currentCity={userLocation?.city} onContactSupport={() => navigate('/settings/help')} />}
          />
          <Route path="/home" element={<HomePage />} />
          <Route path="/category/:categoryId" element={<CategoryPage />} />
          <Route path="/stores" element={<AllStoresRoute />} />
          <Route path="/store/:storeId" element={<StorePage />} />
          <Route path="/store/:storeId/product/:productId" element={<ProductOrderPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
          <Route path="/orders" element={<HistoryPage />} />
          <Route path="/orders/:orderId/track" element={<TrackingPage />} />
          <Route path="/favorites" element={<FavoritesRoute />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/profile" element={<ProfileEditRoute />} />
          <Route path="/settings/help" element={<HelpRoute />} />
          <Route path="/settings/privacy" element={<PrivacyRoute />} />
          <Route path="/settings/notifications" element={<NotificationsRoute />} />
          <Route path="/tickets" element={<TicketsListRoute />} />
          <Route path="/tickets/new" element={<TicketNewRoute />} />
          <Route path="/tickets/:id" element={<TicketChatRoute />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </NetworkWrapper>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <VeetaaProvider>
        <AppContent />
      </VeetaaProvider>
    </BrowserRouter>
  );
}

function EmailOtpVerifyRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return (
    <EmailOtpVerification
      language={ctx.language}
      email={ctx.pendingEmail}
      purpose={ctx.pendingOtpPurpose}
      onVerified={ctx.handleEmailOtpVerified}
      onBack={() => navigate(ctx.pendingOtpPurpose === 'password_reset' ? '/login' : '/signup')}
    />
  );
}

function PermissionsRoute() {
  const ctx = useVeetaa();
  return <PermissionsRequest language={ctx.language} onGranted={ctx.handlePermissionsGranted} />;
}

function PasswordResetRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return (
    <PasswordReset
      language={ctx.language}
      phone={ctx.pendingPhone}
      onSuccess={ctx.handlePasswordResetSuccess}
      onBack={() => navigate('/login')}
    />
  );
}

function BlockedRoute() {
  const ctx = useVeetaa();
  if (!ctx.user) return <Navigate to="/" replace />;
  return <BlockedView language={ctx.language} onLogout={ctx.handleLogout} />;
}

function VpnBlockedRoute() {
  const ctx = useVeetaa();
  return <VpnBlockedView language={ctx.language} />;
}

function AllStoresRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return (
    <AllStores
      stores={ctx.storesWithProducts}
      language={ctx.language}
      categories={ctx.categoriesData}
      subCategories={ctx.subCategoriesData}
      onSelectStore={(s) => navigate(`/store/${s.id}`)}
    />
  );
}

function FavoritesRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return (
    <Favorites
      language={ctx.language}
      stores={ctx.storesWithProducts}
      favorites={ctx.favorites}
      onToggleFavorite={ctx.toggleFavorite}
      onSelectStore={(s) => navigate(`/store/${s.id}`)}
    />
  );
}

function ProfileEditRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  if (!ctx.user) return <Navigate to="/settings" replace />;
  return (
    <ProfileEdit
      user={ctx.user}
      language={ctx.language}
      onBack={() => navigate('/settings')}
      onSave={ctx.handleProfileSave}
    />
  );
}

function SignupRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return (
    <Signup
      language={ctx.language}
      onSignup={ctx.handleSignupSuccess}
      onGoToLogin={() => { ctx.setPendingEmail(''); ctx.setPendingPassword(''); navigate('/login'); }}
    />
  );
}

function EmailVerifiedRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return <EmailVerified language={ctx.language} onContinue={() => navigate('/login')} />;
}

function HelpRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return <Help language={ctx.language} onBack={() => navigate('/settings')} />;
}

function PrivacyRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return <Privacy language={ctx.language} onBack={() => navigate('/settings')} />;
}

function NotificationsRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return <Notifications language={ctx.language} onBack={() => navigate('/settings')} />;
}

function TicketsListRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return <TicketsList language={ctx.language} user={ctx.user} onBack={() => navigate('/settings/help')} />;
}

function TicketNewRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return <TicketNew language={ctx.language} user={ctx.user} onBack={() => navigate('/tickets')} />;
}

function TicketChatRoute() {
  const ctx = useVeetaa();
  const navigate = useNavigate();
  return <TicketChat language={ctx.language} user={ctx.user} onBack={() => navigate('/tickets')} />;
}
