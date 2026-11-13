import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

export default function ProductCard({ product, onZoom, onAddToCart, onDirectOrder }) {
  const photos = product.photos && product.photos.length > 0 ? product.photos : [product.photo_url];
  const [photoIdx, setPhotoIdx] = useState(0);

  const handleNext = () => setPhotoIdx((prev) => (prev + 1) % photos.length);
  const handlePrev = () => setPhotoIdx((prev) => (prev - 1 + photos.length) % photos.length);

  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => onZoom(product, photoIdx)} style={styles.imageBox}>
        <Image source={{ uri: photos[photoIdx] || product.photo_url }} style={styles.image} resizeMode="cover" />

        {product.is_bestseller && (
          <View style={styles.bestsellerBadge}>
            <Text style={styles.bestsellerText}>ተወዳጅ</Text>
          </View>
        )}

        <View style={styles.zoomBadge}>
          <Text style={styles.zoomBadgeText}>🔍 {photoIdx + 1}/{photos.length}</Text>
        </View>

        {photos.length > 1 && (
          <>
            <TouchableOpacity onPress={handlePrev} style={[styles.arrowBtn, { left: 4 }]}>
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={[styles.arrowBtn, { right: 4 }]}>
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.body}>
        <TouchableOpacity onPress={() => onZoom(product, photoIdx)}>
          <Text style={styles.title} numberOfLines={2}>{product.name}</Text>
          {product.size ? (
            <Text style={styles.size}>
              መጠን: <Text style={styles.sizeBold}>{product.size}</Text>
            </Text>
          ) : null}
          {product.description ? (
            <Text style={styles.desc} numberOfLines={1}>{product.description}</Text>
          ) : null}
        </TouchableOpacity>

        <View style={styles.footer}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{Number(product.price_etb).toLocaleString()} ETB</Text>
            <Text style={styles.inStock}>በእጃችን ያለ</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => onAddToCart(product)} style={styles.cartBtn}>
              <Text style={styles.cartBtnText}>+ ካርት</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDirectOrder(product)} style={styles.orderBtn}>
              <Text style={styles.orderBtnText}>እዘዝ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    overflow: 'hidden',
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  imageBox: {
    height: 112,
    backgroundColor: '#f5f5f4',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  bestsellerBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestsellerText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1c1917',
  },
  zoomBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(28, 25, 23, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  zoomBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
  },
  arrowBtn: {
    position: 'absolute',
    top: '45%',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(28, 25, 23, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
  body: {
    padding: 8,
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1c1917',
    lineHeight: 15,
  },
  size: {
    fontSize: 9.5,
    color: '#78716c',
    marginTop: 2,
  },
  sizeBold: {
    fontWeight: '700',
    color: '#44403c',
  },
  desc: {
    fontSize: 9.5,
    color: '#78716c',
    marginTop: 2,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
    paddingTop: 6,
    marginTop: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  price: {
    fontSize: 12,
    fontWeight: '900',
    color: '#b45309',
  },
  inStock: {
    fontSize: 9,
    fontWeight: '700',
    color: '#065f46',
  },
  actions: {
    flexDirection: 'row',
    gap: 5,
  },
  cartBtn: {
    flex: 1,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  cartBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#78350f',
  },
  orderBtn: {
    flex: 1,
    backgroundColor: '#f59e0b',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  orderBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1c1917',
  },
});
