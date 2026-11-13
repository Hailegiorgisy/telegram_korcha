import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { MARKETPLACES, CHINA_STORE_LINKS, THREE_REGIONS } from '../data/products';
import ProductCard from '../components/ProductCard';

export default function ShopScreen({ products, onZoom, onAddToCart, onDirectOrder, onOpenChinaQuote }) {
  const [selectedRegion, setSelectedRegion] = useState('USA');
  const [regionCategory, setRegionCategory] = useState('All');

  const activeRegion = THREE_REGIONS.find((r) => r.id === selectedRegion) || THREE_REGIONS[0];

  const filteredProducts = products.filter((p) => {
    if ((p.country || '').toUpperCase() !== selectedRegion.toUpperCase()) return false;
    if (regionCategory === 'All' || regionCategory === 'Available') return true;
    if (regionCategory === 'Most Sales') return Boolean(p.is_bestseller);
    return p.category && p.category.toLowerCase() === regionCategory.toLowerCase();
  });

  const openUrl = (url) => Linking.openURL(url).catch(() => {});

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* 1. Compact 3 Marketplaces Strip */}
      <View style={styles.card}>
        <View style={styles.stripHeader}>
          <Text style={styles.stripTitle}>ዓለም አቀፍ ገበያዎች (Global Marketplaces)</Text>
          <Text style={styles.stripSub}>መተግበሪያውን ያውርዱ</Text>
        </View>
        <View style={styles.marketGrid}>
          {MARKETPLACES.map((m) => (
            <View key={m.id} style={styles.marketBox}>
              <Text style={[styles.marketName, { color: m.color }]}>{m.name}</Text>
              <View style={styles.storeRow}>
                <TouchableOpacity onPress={() => openUrl(m.androidUrl)} style={styles.storeChip}>
                  <Text style={styles.storeChipText}>Play ▶</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openUrl(m.iosUrl)} style={styles.storeChip}>
                  <Text style={styles.storeChipText}>iOS</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 2. China Market Box (Links to Pinduoduo Play Store & App Store) */}
      <View style={[styles.card, { borderColor: '#fecaca' }]}>
        <View style={styles.chinaTop}>
          <View style={styles.chinaTitleRow}>
            <Text style={{ fontSize: 15 }}>🇨🇳</Text>
            <Text style={styles.chinaTitle}>የቻይና ገበያ (China Market)</Text>
            <View style={styles.factoryBadge}>
              <Text style={styles.factoryText}>የፋብሪካ ዋጋ</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onOpenChinaQuote}>
            <Text style={styles.chinaLink}>ከቻይና እዘዝ →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chinaLinksRow}>
          <Text style={styles.chinaPrompt}>መተግበሪያውን ለማውረድ፡</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => openUrl(CHINA_STORE_LINKS.androidUrl)} style={styles.playBtn}>
              <Text style={styles.btnWhiteText}>Play Store ▶</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openUrl(CHINA_STORE_LINKS.iosUrl)} style={styles.iosBtn}>
              <Text style={styles.btnWhiteText}>App Store</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 3. Three Regional Marts Shelf */}
      <View style={styles.card}>
        <View style={styles.shelfHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.shelfTitle}>✨ በእጃችን ያሉ ዕቃዎች (In-Stock Shelves)</Text>
            <Text style={styles.shelfSub}>በአዲስ አበባ በእጃችን ያሉ ዝግጁ እቃዎች — ወዲያውኑ ማዘዝ ይችላሉ</Text>
          </View>
          <View style={styles.deliveryBadge}>
            <Text style={styles.deliveryText}>1-2 ቀን</Text>
          </View>
        </View>

        <View style={styles.regionTabs}>
          {THREE_REGIONS.map((r) => {
            const active = r.id === selectedRegion;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => {
                  setSelectedRegion(r.id);
                  setRegionCategory('All');
                }}
                style={[styles.regionTab, active && styles.regionTabActive]}
              >
                <Text style={{ fontSize: 15 }}>{r.flag}</Text>
                <Text style={[styles.regionName, active && { color: '#1c1917' }]} numberOfLines={1}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {activeRegion.categories.map((cat) => {
            const active = regionCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setRegionCategory(cat)}
                style={[styles.catPill, active && styles.catPillActive]}
              >
                <Text style={[styles.catText, active && { color: '#ffffff' }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {filteredProducts.length > 0 ? (
          <View style={styles.grid}>
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onZoom={onZoom}
                onAddToCart={onAddToCart}
                onDirectOrder={onDirectOrder}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 24 }}>📦</Text>
            <Text style={styles.emptyText}>በዚህ መደርደሪያ ላይ ዕቃ የለም። ሌላ ከፈለጉ ይምረጡ</Text>
            <TouchableOpacity onPress={() => setRegionCategory('All')} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>ሁሉንም እቃዎች እይ</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 90, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#e7e5e4' },
  stripHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  stripTitle: { fontSize: 10, fontWeight: '700', color: '#78716c' },
  stripSub: { fontSize: 10, fontWeight: '700', color: '#b45309' },
  marketGrid: { flexDirection: 'row', gap: 6 },
  marketBox: { flex: 1, backgroundColor: '#fafaf9', borderRadius: 8, padding: 6, borderWidth: 1, borderColor: '#e7e5e4', alignItems: 'center' },
  marketName: { fontSize: 11, fontWeight: '900', marginBottom: 4 },
  storeRow: { flexDirection: 'row', gap: 4 },
  storeChip: { backgroundColor: '#e7e5e4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  storeChipText: { fontSize: 8.5, fontWeight: '800', color: '#1c1917' },
  chinaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  chinaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chinaTitle: { fontSize: 12, fontWeight: '900', color: '#1c1917' },
  factoryBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  factoryText: { fontSize: 8.5, fontWeight: '800', color: '#991b1b' },
  chinaLink: { fontSize: 10, fontWeight: '800', color: '#b45309' },
  chinaLinksRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef2f2', padding: 8, borderRadius: 10 },
  chinaPrompt: { fontSize: 10, fontWeight: '700', color: '#44403c' },
  playBtn: { backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  iosBtn: { backgroundColor: '#1c1917', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  btnWhiteText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
  shelfHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f5f5f4', paddingBottom: 8, marginBottom: 8 },
  shelfTitle: { fontSize: 12.5, fontWeight: '900', color: '#1c1917' },
  shelfSub: { fontSize: 10, color: '#78716c', marginTop: 2 },
  deliveryBadge: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  deliveryText: { fontSize: 10, fontWeight: '800', color: '#065f46' },
  regionTabs: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  regionTab: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1, borderColor: '#e7e5e4', backgroundColor: '#fafaf9', alignItems: 'center' },
  regionTabActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  regionName: { fontSize: 10.5, fontWeight: '800', color: '#44403c', marginTop: 2 },
  catScroll: { flexDirection: 'row', marginBottom: 10 },
  catPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: '#f5f5f4', borderWidth: 1, borderColor: '#e7e5e4', marginRight: 6 },
  catPillActive: { backgroundColor: '#d97706', borderColor: '#d97706' },
  catText: { fontSize: 10, fontWeight: '700', color: '#44403c' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  emptyBox: { padding: 24, backgroundColor: '#fafaf9', borderRadius: 14, borderWidth: 1, borderColor: '#e7e5e4', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 12, fontWeight: '700', color: '#44403c', textAlign: 'center' },
  resetBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  resetBtnText: { fontSize: 10.5, fontWeight: '800', color: '#1c1917' },
});
