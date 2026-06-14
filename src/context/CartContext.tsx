import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { insertOrderRow, updateOrderRatings } from '../data/repos/ordersRepo';
import { CartItem, Product, Order } from '../types';
import { safeGetItem, safeRemoveItem, safeSetItem } from '../lib/storage';

interface CartContextValue {
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  addToCart: (product: Product, quantity: number, note?: string, image?: string | string[]) => Promise<void>;
  updateCartItemQuantity: (index: number, quantity: number) => void;
  removeCartItem: (index: number) => void;
  cartTotal: number;
  textOrder?: string;
  prescriptionImage?: string;
  currentOrder: Order | null;
  saveOrder: (orderDetails: any) => Promise<string | null>;
  handleRateOrder: (orderId: string, storeRating: number, driverRating: number) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{ children: ReactNode; userId: string | null }> = ({ children, userId }) => {
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [textOrder, setTextOrder] = useState('');
  const [prescriptionImage, setPrescriptionImage] = useState<string | undefined>();

  useEffect(() => {
    const savedFavs = safeGetItem('veetaa_favorites');
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch { }
    }
    const savedCart = safeGetItem('veetaa_cart');
    if (savedCart) {
      try { setCartState(JSON.parse(savedCart)); } catch { }
    }
  }, []);

  // Sync with Cloud when userId is available
  useEffect(() => {
    if (!userId) {
      setOrders([]);
      return;
    }

    const syncWithCloud = async () => {
      const { fetchOrdersByUserId, fetchFavorites } = await import('../lib/database');
      const [dbOrders, dbFavs] = await Promise.all([
        fetchOrdersByUserId(userId),
        fetchFavorites(userId)
      ]);
      setOrders(dbOrders);
      setFavorites(dbFavs);
    };

    syncWithCloud();
  }, [userId]);

  const setCart = useCallback((cart: CartItem[]) => {
    setCartState(cart);
    safeSetItem('veetaa_cart', JSON.stringify(cart));
  }, []);

  const addToCart = useCallback(async (product: Product, quantity: number, note?: string, image?: string | string[]) => {
    setCartState(prev => {
      const next = [
        ...prev,
        {
          product,
          quantity,
          note,
          image_base64: Array.isArray(image) ? (image[0] || undefined) : (image || undefined),
          storeId: product.storeId,
          storeName: product.storeName,
        },
      ];
      safeSetItem('veetaa_cart', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateCartItemQuantity = useCallback((index: number, quantity: number) => {
    setCartState(prev => {
      const next = [...prev];
      if (quantity <= 0) next.splice(index, 1);
      else {
        next[index] = { ...next[index], quantity };
      }
      safeSetItem('veetaa_cart', JSON.stringify(next));
      return next;
    });
  }, []);

  const removeCartItem = useCallback((index: number) => {
    setCartState(prev => {
      const next = [...prev];
      next.splice(index, 1);
      safeSetItem('veetaa_cart', JSON.stringify(next));
      return next;
    });
  }, []);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0), [cart]);

  const toggleFavorite = useCallback(async (id: string) => {
    let isAdding = false;
    setFavorites(prev => {
      isAdding = !prev.includes(id);
      const next = isAdding ? [...prev, id] : prev.filter(f => f !== id);
      safeSetItem('veetaa_favorites', JSON.stringify(next));
      return next;
    });

    if (userId) {
      const { addFavorite, removeFavorite } = await import('../lib/database');
      if (isAdding) await addFavorite(userId, id);
      else await removeFavorite(userId, id);
    }
  }, [userId]);

  const saveOrder = useCallback(async (order: any) => {
    try {
      // Map frontend camelCase to database snake_case columns
      const dbOrder = {
        user_id: userId,
        store_id: order.storeId,
        customer_name: order.customerName,
        phone: order.phone,
        delivery_lat: order.location?.lat,
        delivery_lng: order.location?.lng,
        total_products: order.total,
        delivery_fee: order.deliveryFee,
        total_final: order.totalFinal ?? ((order.total || 0) + (order.deliveryFee || 0)),
        status: 'pending',
        payment_method: order.paymentMethod,
        payment_receipt_base64: order.paymentReceiptImage,
        prescription_base64: order.prescriptionImage,
        text_order_notes: order.textOrder,
        category_name: order.category,
        store_name: order.storeName,
        items: order.items,
        delivery_note: order.delivery_note
      };

      const { data, error } = await insertOrderRow(dbOrder);
      
      if (error) throw error;
      
      const newOrder = data as any;
      const orderId = String(newOrder.id);
      setCurrentOrder({ ...order, id: orderId });
      setOrders(prev => [{ ...order, id: orderId }, ...prev]);
      setCartState([]);
      safeRemoveItem('veetaa_cart');
      return newOrder.id;
    } catch (err) {
      console.error('Order Error:', err);
      return null;
    }
  }, [userId]);

  const handleRateOrder = useCallback(async (orderId: string, storeRating: number, driverRating: number) => {
      await updateOrderRatings(orderId, storeRating, driverRating);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, storeRating, driverRating } : o));
  }, []);

  const value = useMemo(() => ({
    cart,
    setCart,
    favorites,
    toggleFavorite,
    orders,
    setOrders,
    addToCart,
    updateCartItemQuantity,
    removeCartItem,
    cartTotal,
    textOrder,
    prescriptionImage,
    currentOrder,
    saveOrder,
    handleRateOrder
  }), [cart, favorites, toggleFavorite, orders, addToCart, updateCartItemQuantity, removeCartItem, cartTotal, setCart, currentOrder, textOrder, prescriptionImage, saveOrder, handleRateOrder]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
