import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { INITIAL_PRODUCTS } from './src/data/products';
import { korchaSdk } from './src/sdk/KorchaClient';
import ShopScreen from './src/screens/ShopScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProductZoomModal from './src/components/ProductZoomModal';
import DirectOrderModal from './src/components/DirectOrderModal';
import CartModal from './src/components/CartModal';
import QuoteModal from './src/components/QuoteModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [zoomState, setZoomState] = useState({ product: null, photoIdx: 0 });
  const [directOrderProduct, setDirectOrderProduct] = useState(null);
  const [quoteVisible, setQuoteVisible] = useState(false);

  // Load persisted cart & live backend products via Korcha SDK
  useEffect(() => {
    AsyncStorage.getItem('korcha_cart')
      .then((raw) => {
        if (raw) setCart(JSON.parse(raw));
      })
      .catch(() => {});

    korchaSdk
      .getShelfProducts()
      .then((remote) => {
        if (remote.length > 0) {
          setProducts((prev) => {
            const ids = new Set(remote.map((p) => p.id));
            return remote.concat(prev.filter((p) => !ids.has(p.id)));
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('korcha_cart', JSON.stringify(cart)).catch(() => {});
  }, [cart]);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, quantity: 1 }];
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const updateCartQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product.id === id) {
            const q = i.quantity + delta;
            return q > 0 ? { ...i, quantity: q } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  const totalCartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const totalCartPrice = cart.reduce((s, i) => s + i.product.price_etb * i.quantity, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>K</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>KORCHA (ኮርቻ)</Text>
              <Text style={styles.brandSub}>የውጭ ገበያ እቃ አቅራቢ</Text>
            </View>
          </View>

          {totalCartCount > 0 && (
            <TouchableOpacity onPress={() => setIsCartOpen(true)} style={styles.headerCartBtn}>
              <Text style={styles.headerCartText}>🛒 {totalCartCount}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Navigation Tabs */}
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => setActiveTab('home')}
            style={[styles.navBtn, activeTab === 'home' && styles.navBtnActive]}
          >
            <Text style={[styles.navText, activeTab === 'home' && styles.navTextActive]}>🛍️ መደርደሪያ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('tracker')}
            style={[styles.navBtn, activeTab === 'tracker' && styles.navBtnActive]}
          >
            <Text style={[styles.navText, activeTab === 'tracker' && styles.navTextActive]}>📦 ትዕዛዞች</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('support')}
            style={[styles.navBtn, activeTab === 'support' && styles.navBtnActive]}
          >
            <Text style={[styles.navText, activeTab === 'support' && styles.navTextActive]}>💬 መልዕክት</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Screen */}
      <View style={{ flex: 1 }}>
        {activeTab === 'home' && (
          <ShopScreen
            products={products}
            onZoom={(product, photoIdx) => setZoomState({ product, photoIdx })}
            onAddToCart={addToCart}
            onDirectOrder={(product) => setDirectOrderProduct(product)}
            onOpenChinaQuote={() => setQuoteVisible(true)}
          />
        )}
        {activeTab === 'tracker' && <OrdersScreen />}
        {activeTab === 'support' && <ChatScreen />}
      </View>

      {/* Floating Cart Bar */}
      {totalCartCount > 0 && !isCartOpen && (
        <TouchableOpacity onPress={() => setIsCartOpen(true)} style={styles.floatingCart}>
          <Text style={styles.floatingCartLabel}>🛒 የግዢ ካርት ({totalCartCount} እቃዎች)</Text>
          <Text style={styles.floatingCartPrice}>{totalCartPrice.toLocaleString()} ETB →</Text>
        </TouchableOpacity>
      )}

      {/* Modals */}
      <ProductZoomModal
        product={zoomState.product}
        initialIdx={zoomState.photoIdx}
        onClose={() => setZoomState({ product: null, photoIdx: 0 })}
        onAddToCart={addToCart}
        onDirectOrder={(p) => setDirectOrderProduct(p)}
      />

      <DirectOrderModal
        product={directOrderProduct}
        onClose={() => setDirectOrderProduct(null)}
      />

      <CartModal
        visible={isCartOpen}
        cart={cart}
        onClose={() => setIsCartOpen(false)}
        onUpdateQty={updateCartQty}
        onCheckout={() => {
          setCart([]);
          setIsCartOpen(false);
        }}
      />

      <QuoteModal
        visible={quoteVisible}
        site="China Market"
        onClose={() => setQuoteVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f4' },
  header: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e7e5e4', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 16, fontWeight: '900', color: '#1c1917' },
  brandTitle: { fontSize: 14, fontWeight: '900', color: '#1c1917' },
  brandSub: { fontSize: 10, color: '#78716c', fontWeight: '600' },
  headerCartBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  headerCartText: { fontSize: 12, fontWeight: '900', color: '#1c1917' },
  navRow: { flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f4' },
  navBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: '#f5f5f4', alignItems: 'center' },
  navBtnActive: { backgroundColor: '#f59e0b' },
  navText: { fontSize: 11.5, fontWeight: '700', color: '#44403c' },
  navTextActive: { color: '#1c1917', fontWeight: '900' },
  floatingCart: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    backgroundColor: '#1c1917',
    padding: 13,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    elevation: 6,
  },
  floatingCartLabel: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  floatingCartPrice: { color: '#fbbf24', fontSize: 12.5, fontWeight: '900' },
});
