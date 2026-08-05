import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Surface, Text, HelperText, Portal, Modal, List } from 'react-native-paper';
import { useAuth } from '../src/mobile/context/AuthContext';
import { db } from '../src/mobile/api/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { COLORS, SPACING } from '../src/mobile/theme';
import { router } from 'expo-router';
import { Wrench, User, FileText, AlertTriangle } from 'lucide-react-native';

export default function CreateTicketScreen() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clienteNome: '',
    titulo: '',
    descricao: '',
    prioridade: 'media'
  });

  const handleSubmit = async () => {
    if (!form.clienteNome || !form.titulo || !form.descricao) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'chamados'), {
        ...form,
        status: 'aberto',
        tecnicoId: userData?.id,
        tecnicoUid: userData?.id,
        tecnicoNome: userData?.nome,
        tecnicoEmail: userData?.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      Alert.alert('Sucesso', 'Chamado aberto com sucesso!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Falha ao salvar o chamado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Surface style={styles.formCard} elevation={2}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Informações do Cliente</Text>
          </View>
          <TextInput
            label="Nome do Cliente"
            value={form.clienteNome}
            onChangeText={t => setForm({ ...form, clienteNome: t })}
            mode="outlined"
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Detalhes do Serviço</Text>
          </View>
          <TextInput
            label="Título da O.S."
            value={form.titulo}
            onChangeText={t => setForm({ ...form, titulo: t })}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Descrição do Problema"
            value={form.descricao}
            onChangeText={t => setForm({ ...form, descricao: t })}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Prioridade</Text>
          </View>
          <View style={styles.priorityGroup}>
            {['baixa', 'media', 'alta', 'critica'].map(p => (
              <Button
                key={p}
                mode={form.prioridade === p ? 'contained' : 'outlined'}
                onPress={() => setForm({ ...form, prioridade: p })}
                style={styles.priorityBtn}
                labelStyle={{ fontSize: 10 }}
              >
                {p.toUpperCase()}
              </Button>
            ))}
          </View>
        </View>

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitBtn}
          contentStyle={{ height: 50 }}
        >
          Abrir Ordem de Serviço
        </Button>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20 },
  formCard: { backgroundColor: '#fff', padding: 20, borderRadius: 24 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  input: { marginBottom: 12, backgroundColor: '#fff' },
  priorityGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priorityBtn: { flex: 1, minWidth: 80 },
  submitBtn: { marginTop: 12, borderRadius: 12, backgroundColor: COLORS.primary }
});
