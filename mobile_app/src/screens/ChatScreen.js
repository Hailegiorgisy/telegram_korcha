import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Linking, StyleSheet } from 'react-native';
import { korchaSdk } from '../sdk/KorchaClient';

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'worker',
      text: 'ሰላም! እንኳን ወደ ኮርቻ የደንበኞች አገልግሎት በደህና መጡ። በእጃችን ስላሉ እቃዎች ወይም ስለ ማዘዝ ምን ልርዳዎት?',
    },
  ]);
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');

  const handleSend = async () => {
    if (!text.trim()) return;
    const msg = {
      id: Date.now(),
      sender: 'customer',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, msg]);
    setText('');
    try {
      await korchaSdk.sendQuoteOrChat({
        phone: phone.trim() || '0911000000',
        details: `[Mobile Chat] ${msg.text}`,
      });
    } catch (_) {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>🟢 የኮርቻ ሰራተኛ የደንበኞች አገልግሎት</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://t.me/korcha_support')} style={styles.tgPill}>
            <Text style={styles.tgText}>@korcha_support ↗</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.msgList} contentContainerStyle={{ gap: 8 }}>
          {messages.map((m) => {
            const isMe = m.sender === 'customer';
            return (
              <View key={m.id} style={[styles.bubble, isMe ? styles.meBubble : styles.workerBubble]}>
                <Text style={[styles.msgText, isMe && { color: '#1c1917', fontWeight: '600' }]}>{m.text}</Text>
                {m.time && <Text style={styles.time}>{m.time}</Text>}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="የመገናኛ ስልክ ቁጥርዎ (Phone)..."
            style={styles.phoneInput}
          />
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="ጥያቄዎን ወይም መልዕክትዎን እዚህ ይጻፉ..."
              style={styles.msgInput}
            />
            <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
              <Text style={styles.sendText}>ላክ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#e7e5e4' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f5f5f4', paddingBottom: 8, marginBottom: 8 },
  title: { fontSize: 11.5, fontWeight: '800', color: '#1c1917' },
  tgPill: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  tgText: { fontSize: 10, fontWeight: '800', color: '#78350f' },
  msgList: { flex: 1, marginBottom: 8 },
  bubble: { maxWidth: '82%', padding: 10, borderRadius: 14 },
  meBubble: { alignSelf: 'flex-end', backgroundColor: '#f59e0b' },
  workerBubble: { alignSelf: 'flex-start', backgroundColor: '#f5f5f4', borderWidth: 1, borderColor: '#e7e5e4' },
  msgText: { fontSize: 12, color: '#1c1917', lineHeight: 17 },
  time: { fontSize: 9, color: '#44403c', opacity: 0.7, textAlign: 'right', marginTop: 4 },
  composer: { borderTopWidth: 1, borderTopColor: '#f5f5f4', paddingTop: 8, gap: 6 },
  phoneInput: { borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11.5 },
  inputRow: { flexDirection: 'row', gap: 6 },
  msgInput: { flex: 1, borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  sendBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  sendText: { fontSize: 12, fontWeight: '800', color: '#1c1917' },
});
