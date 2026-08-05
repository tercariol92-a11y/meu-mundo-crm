import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Surface, List, Avatar, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { notificationsService, Notification } from '../../src/mobile/services/notificationsService';
import { COLORS, SPACING, SHADOWS } from '../../src/mobile/theme';
import { Bell, Info, AlertTriangle, CheckCircle } from 'lucide-react-native';

export default function NotificationsScreen() {
  const { userData } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!userData) return;

    const unsub = notificationsService.getNotifications(userData.id, (data) => {
      setNotifications(data);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsub();
  }, [userData]);

  const onRefresh = () => {
    setRefreshing(true);
    // notificationsService logic triggers refresh via snapshot
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={24} color={COLORS.warning} />;
      case 'success': return <CheckCircle size={24} color={COLORS.success} />;
      default: return <Info size={24} color={COLORS.primary} />;
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Surface style={[styles.card, !item.read && styles.unread]} elevation={item.read ? 1 : 2}>
            <View style={styles.iconBox}>
              {getIcon(item.type)}
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>
                {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('pt-BR') : ''}
              </Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </Surface>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell size={48} color={COLORS.gray[200]} />
            <Text style={styles.emptyText}>Nenhuma notificação por aqui</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 20 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    alignItems: 'center',
    gap: 16,
  },
  unread: {
    backgroundColor: COLORS.primary + '05',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  message: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  time: { fontSize: 10, color: COLORS.gray[300], marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  empty: { marginTop: 100, alignItems: 'center', gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 }
});
