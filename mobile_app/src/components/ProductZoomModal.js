import React, { useState, useEffect } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export default function ProductZoomModal({ product, initialIdx = 0, onClose, onAddToCart, onDirectOrder }) {
  const [photoIdx, setPhotoIdx] = useState(initialIdx);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setPhotoIdx(initialIdx);
    setScale(1);
  }, [product, initialIdx]);

  if (!product) return null;

  const photos = product.photos && product.photos.length > 0 ? product.photos : [product.photo_url];
  const currentPhoto = photos[photoIdx] || product.photo_url;

  return (
    <Modal visible={Boolean(product)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{product.name}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.imageContainer}>
            <Image
              source={{ uri: currentPhoto }}
              style={[styles.image, { transform: [{ scale }] }]}
              resizeMode="contain"
            />

            {photos.length > 1 && (
              <>
                <TouchableOpacity
                  onPress={() => { setPhotoIdx((photoIdx - 1 + photos.length) % photos.length); setScale(1); }}
                  style={[styles.navBtn, { left: 8 }]}
                >
                  <Text style={styles.navBtnText}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setPhotoIdx((photoIdx + 1) % photos.length); setScale(1); }}
                  style={[styles.navBtn, { right: 8 }]}
                >
                  <Text style={styles.navBtnText}>›</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.zoomControls}>
              <TouchableOpacity
                onPress={() => setScale((s) => Math.max(1, s - 0.5))}
                disabled={scale <= 1}
                style={[styles.zoomBtn, scale <= 1 && { opacity: 0.4 }]}
              >
                <Text style={styles.zoomBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.zoomBadge}>
                <Text style={styles.zoomBtnText}>{scale}x</Text>
              </View>
              <TouchableOpacity
                onPress={() => setScale((s) => Math.min(3, s + 0.5))}
                disabled={scale >= 3}
                style={[styles.zoomBtn, scale >= 3 && { opacity: 0.4 }]}
              >
                <Text style={styles.zoomBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {photos.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
              {photos.map((thumb, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => { setPhotoIdx(idx); setScale(1); }}
                  style={[styles.thumbBox, idx === photoIdx && styles.thumbActive]}
                >
                  <Image source={{ uri: thumb }} style={styles.thumbImg} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.detailsRow}>
            <Text style={styles.price}>{Number(product.price_etb).toLocaleString()} ETB</Text>
            {product.size ? (
              <Text style={styles.size}>
                መጠን: <Text style={{ fontWeight: '800' }}>{product.size}</Text>
              </Text>
            ) : null}
          </View>

          {product.description ? (
            <View style={styles.descBox}>
              <Text style={styles.descText}>{product.description}</Text>
            </View>
          ) : null}

          <View style={styles.ctaRow}>
            <TouchableOpacity
              onPress={() => { onAddToCart(product); onClose(); }}
              style={styles.cartBtn}
            >
              <Text style={styles.cartBtnText}>+ ወደ ካርት ጨምር</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { onClose(); onDirectOrder(product); }}
              style={styles.orderBtn}
            >
              <Text style={styles.orderBtnText}>በቀጥታ እዘዝ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 10, 9, 0.88)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
    paddingBottom: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1c1917',
    flex: 1,
    marginRight: 8,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontWeight: '800',
    color: '#44403c',
  },
  imageContainer: {
    aspectRatio: 1,
    backgroundColor: '#f5f5f4',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  navBtn: {
    position: 'absolute',
    top: '46%',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(28, 25, 23, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  zoomControls: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(28, 25, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBadge: {
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(28, 25, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  thumbStrip: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  thumbBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e7e5e4',
    marginRight: 6,
    overflow: 'hidden',
    opacity: 0.65,
  },
  thumbActive: {
    borderColor: '#f59e0b',
    opacity: 1,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 15,
    fontWeight: '900',
    color: '#b45309',
  },
  size: {
    fontSize: 11,
    color: '#57534e',
  },
  descBox: {
    backgroundColor: '#fafaf9',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    marginBottom: 12,
  },
  descText: {
    fontSize: 11.5,
    color: '#44403c',
    lineHeight: 17,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cartBtn: {
    flex: 1,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  cartBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#78350f',
  },
  orderBtn: {
    flex: 1,
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  orderBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1c1917',
  },
});
