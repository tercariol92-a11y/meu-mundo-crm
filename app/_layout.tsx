import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider, useAuth } from '../src/mobile/context/AuthContext';
import { COLORS } from '../src/mobile/theme';
import { StatusBar } from 'expo-status-bar';

function RootLayoutNav() {
  const { userData, loading } = useAuth();

  if (loading) {
    return null; // Splash screen should be handled here
  }

  return (
    <Stack screenOptions={{ 
      headerStyle: { backgroundColor: COLORS.primary },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
    }}>
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="ticket/[id]" options={{ title: 'Detalhes do Chamado' }} />
      <Stack.Screen name="create" options={{ title: 'Nova Ordem de Serviço' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PaperProvider>
        <StatusBar style="light" />
        <RootLayoutNav />
      </PaperProvider>
    </AuthProvider>
  );
}
