import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { korchaSdk } from '../sdk/KorchaClient';

export default function QuoteModal({ visible, site, onClose }) {
  const [url, setUrl] = useState('');
  const [specs, setSpecs] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = async () => {
    if (!phone.trim() || !url.trim()) {
      Alert.alert('መረጃ ይጎድላል', 'እባክዎ የእቃውን ሊንክ እና ስልክ ቁጥር ያስገቡ።');
      return;
    }
    try {
      await korchaSdk.sendQuoteOrChat({
        phone: phone.trim(),
        details: specs.trim() || 'China Market Link Request',
        productUrl: url.trim(),
        site: site || 'China Market',
      });
    } catch (_) {}
    Alert.alert('✅ ጥያቄዎ ደርሶናል!', 'ሰራተኛችን ዋጋ አስልቶ በቅርቡ ያሳውቅዎታል።');
    setUrl('');
    setSpecs('');
    setPhone('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>🔗 በሊንክ እዘዝ ({site || 'China Market'})</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>

          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="የእቃው ሊንክ (Product Link)..."
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            value={specs}
            onChangeText={setSpecs}
            placeholder="ብዛት፣ መጠንና ቀለም (Size, Color, Qty)..."
            style={styles.input}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="የመገናኛ ስልክ ቁጥር (Phone)..."
            style={styles.input}
          />

          <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn}>
            <Text style={styles.submitText}>ጥያቄውን ላክ (Submit)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(12,10,9,0.75)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 13, fontWeight: '800', color: '#1c1917' },
  close: { fontSize: 16, fontWeight: '800', color: '#78716c' },
  input: { borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 10, padding: 10, fontSize: 12, marginBottom: 10 },
  submitBtn: { backgroundColor: '#f59e0b', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  submitText: { fontSize: 12.5, fontWeight: '900', color: '#1c1917' },
});
