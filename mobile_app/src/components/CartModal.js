import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';

export default function CartModal({ visible, cart, onClose, onUpdateQty, onCheckout }) {
  const totalPrice = cart.reduce((sum, i) => sum + i.product.price_etb * i.quantity, 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>የግዢ ካርት (Shopping Cart)</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 340 }}>
            {cart.length === 0 ? (
              <Text style={styles.empty}>ካርትዎ ባዶ ነው።</Text>
            ) : (
              cart.map((item) => (
                <View key={item.product.id} style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.product.name}</Text>
                    <Text style={styles.price}>{item.product.price_etb.toLocaleString()} ETB</Text>
                  </View>
                  <View style={styles.qtyBox}>
                    <TouchableOpacity onPress={() => onUpdateQty(item.product.id, -1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity onPress={() => onUpdateQty(item.product.id, 1)} style={[styles.qtyBtn, { backgroundColor: '#fbbf24' }]}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>ጠቅላላ የካርት ዋጋ:</Text>
              <Text style={styles.totalVal}>{totalPrice.toLocaleString()} ETB</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Alert.alert('✅ ትዕዛዝዎ ተመዝግቧል!', 'ሰራተኛችን በቅርቡ ያነጋግርዎታል።');
                onCheckout();
              }}
              disabled={cart.length === 0}
              style={[styles.checkoutBtn, cart.length === 0 && { opacity: 0.4 }]}
            >
              <Text style={styles.checkoutText}>ትዕዛዙን አረጋግጥ (Checkout)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(12,10,9,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f5f5f4', paddingBottom: 10, marginBottom: 8 },
  title: { fontSize: 14, fontWeight: '900', color: '#1c1917' },
  close: { fontSize: 16, fontWeight: '800', color: '#78716c' },
  empty: { textAlign: 'center', paddingVertical: 24, color: '#78716c', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f4' },
  name: { fontSize: 12, fontWeight: '700', color: '#1c1917' },
  price: { fontSize: 11.5, fontWeight: '800', color: '#b45309', marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 26, height: 26, borderRadius: 6, backgroundColor: '#e7e5e4', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontWeight: '900', fontSize: 14 },
  qtyText: { fontWeight: '800', fontSize: 12.5 },
  footer: { paddingTop: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  totalLabel: { fontSize: 13.5, fontWeight: '800', color: '#1c1917' },
  totalVal: { fontSize: 14, fontWeight: '900', color: '#b45309' },
  checkoutBtn: { backgroundColor: '#f59e0b', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  checkoutText: { fontSize: 12.5, fontWeight: '900', color: '#1c1917' },
});
