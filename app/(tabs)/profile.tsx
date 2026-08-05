import React from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, Surface, Avatar, Button, List, Divider } from 'react-native-paper';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { COLORS, SPACING, SHADOWS } from '../../src/mobile/theme';
import { router } from 'expo-router';
import { LogOut, User, Shield, Phone, Mail, Building2 } from 'lucide-react-native';

export default function ProfileScreen() {
  const { userData, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Deseja realmente sair da aplicação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        }},
      ]
    );
  };

  if (!userData) {
    console.log("Profile: User data not found. Possible auth issue or missing user record.");
    return (
      <View style={styles.centered}>
        <Avatar.Icon size={80} icon="account-off" style={{ backgroundColor: COLORS.gray[200] }} />
        <Text style={styles.errorTitle}>Usuário não encontrado</Text>
        <Text style={styles.errorText}>Certifique-se de que seu perfil está configurado no sistema.</Text>
        <Button mode="contained" onPress={() => signOut()} style={styles.retryBtn}>
          Sair e tentar novamente
        </Button>
      </View>
    );
  }

  console.log("Profile: Renderizando perfil para UID:", userData.id);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Surface style={styles.avatarSurface} elevation={4}>
          <Avatar.Text size={100} label={userData.nome.charAt(0)} style={{ backgroundColor: COLORS.primary }} />
        </Surface>
        <Text style={styles.name}>{userData.nome}</Text>
        <Text style={styles.role}>{userData.role.toUpperCase()}</Text>
      </View>

      <Surface style={styles.infoCard} elevation={1}>
        <List.Item
          title="E-mail"
          description={userData.email}
          left={() => <List.Icon icon="email" />}
          titleStyle={styles.listTitle}
        />
        <Divider />
        <List.Item
          title="Empresa"
          description="Mundo Tech Service"
          left={() => <List.Icon icon="office-building" />}
          titleStyle={styles.listTitle}
        />
        <Divider />
        <List.Item
          title="Departamento"
          description="Manutenção Externa"
          left={() => <List.Icon icon="account-wrench" />}
          titleStyle={styles.listTitle}
        />
      </Surface>

      <View style={styles.actions}>
        <Button 
          mode="contained" 
          onPress={handleLogout} 
          style={styles.logoutBtn}
          buttonColor={COLORS.error}
          icon="logout"
        >
          Sair da Conta
        </Button>
        <Text style={styles.footerText}>Mundo Tech Service App • v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { alignItems: 'center', padding: 40, backgroundColor: '#fff', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, ...SHADOWS.small },
  avatarSurface: { borderRadius: 60, marginBottom: 16 },
  name: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  role: { fontSize: 12, fontWeight: '900', color: COLORS.textSecondary, marginTop: 4, letterSpacing: 1 },
  infoCard: { margin: 20, backgroundColor: '#fff', borderRadius: 24, padding: 8 },
  listTitle: { fontWeight: 'bold' },
  actions: { padding: 20, alignItems: 'center' },
  logoutBtn: { width: '100%', borderRadius: 12, height: 48, justifyContent: 'center' },
  footerText: { marginTop: 24, color: COLORS.gray[300], fontSize: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, color: COLORS.text },
  errorText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  retryBtn: { borderRadius: 12 }
});
