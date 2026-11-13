import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { korchaSdk } from '../sdk/KorchaClient';

export default function OrdersScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTrack = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const found = await korchaSdk.trackOrder(code);
      setResult(found || { notFound: true, code: code.trim() });
    } catch (_) {
      setResult({ notFound: true, code: code.trim() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>📦 የትዕዛዝ ሁኔታ መከታተያ (Track Order)</Text>
        <View style={styles.row}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="የኮድ ቁጥር (ምሳሌ፡ KC-123456)..."
            autoCapitalize="characters"
            style={styles.input}
          />
          <TouchableOpacity onPress={handleTrack} style={styles.btn}>
            <Text style={styles.btnText}>{loading ? '...' : 'ፈልግ'}</Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View style={styles.resultBox}>
            {result.notFound ? (
              <Text style={styles.notFound}>⚠️ ምንም የተገኘ ትዕዛዝ የለም ({result.code})።</Text>
            ) : (
              <>
                <Text style={styles.resLine}>🏷️ ኮድ: {result.ticket_code || result.code}</Text>
                <Text style={styles.resLine}>📊 ሁኔታ: {result.status || 'በግምገማ ላይ'}</Text>
                <Text style={styles.note}>ዕቃዎ የደረሰበትን ቦታ ሰራተኛችን ያሳውቅዎታል።</Text>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e7e5e4' },
  title: { fontSize: 13.5, fontWeight: '800', color: '#1c1917', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12 },
  btn: { backgroundColor: '#f59e0b', paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  btnText: { fontSize: 12, fontWeight: '800', color: '#1c1917' },
  resultBox: { marginTop: 12, padding: 12, backgroundColor: '#fafaf9', borderRadius: 10, borderWidth: 1, borderColor: '#e7e5e4' },
  notFound: { fontSize: 12, fontWeight: '700', color: '#92400e' },
  resLine: { fontSize: 12, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  note: { fontSize: 10.5, color: '#78716c', marginTop: 4 },
});
