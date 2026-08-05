import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Surface, Button, TextInput, Avatar, List, Divider, ActivityIndicator, IconButton } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, onSnapshot, collection, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/mobile/api/firebase';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { ticketsService } from '../../src/mobile/services/ticketsService';
import { COLORS, SPACING, SHADOWS } from '../../src/mobile/theme';
import { Camera, Send, History, FileText, CheckCircle2, Clock, AlertCircle, Wrench } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userData } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    if (!id) return;

    setLoading(true);

    // 1. Ouvir ticket
    const unsubTicket = onSnapshot(doc(db, 'chamados', id), (snapshot) => {
      if (snapshot.exists()) {
        setTicket({ id: snapshot.id, ...snapshot.data() });
      } else {
        Alert.alert('Erro', 'Chamado não encontrado.');
        router.back();
      }
      setLoading(false);
    }, (error) => {
      console.error("Ticket Snapshot Error:", error);
      setLoading(false);
    });

    // 2. Ouvir comentários (Subcoleção)
    const qComments = query(
      collection(db, 'chamados', id, 'messages'),
      orderBy('createdAt', 'desc')
    );
    const unsubComments = onSnapshot(qComments, (snapshot) => {
      setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Comments Snapshot Error:", error);
    });

    // 3. Ouvir anexos
    const qAttachments = query(
      collection(db, 'documentos'),
      where('ticketId', '==', id),
      orderBy('createdAt', 'desc')
    );
    const unsubAttachments = onSnapshot(qAttachments, (snapshot) => {
      setAttachments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Attachments Snapshot Error:", error);
    });

    return () => {
      unsubTicket();
      unsubComments();
      unsubAttachments();
    };
  }, [id]);

  const handleUpdateStatus = async (status: string) => {
    if (!userData || !id) return;
    try {
      await ticketsService.updateStatus(id, status, userData.nome);
      setShowStatusModal(false);
      Alert.alert('Sucesso', 'Status atualizado!');
    } catch (error) {
      console.error("Update Status Error:", error);
      Alert.alert('Erro', 'Falha ao atualizar status.');
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !userData || !id) return;
    setSending(true);
    try {
      await ticketsService.addComment(id, userData.id, userData.nome, newComment);
      setNewComment('');
    } catch (error) {
      console.error("Add Comment Error:", error);
      Alert.alert('Erro', 'Falha ao enviar comentário.');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].uri && id && userData) {
      setUploading(true);
      try {
        await ticketsService.uploadPhoto(id, result.assets[0].uri, userData.nome);
        Alert.alert('Sucesso', 'Foto anexada!');
      } catch (error) {
        console.error("Upload Photo Error:", error);
        Alert.alert('Erro', 'Falha no upload.');
      } finally {
        setUploading(false);
      }
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberto': return 'ABERTO';
      case 'em_atendimento':
      case 'em atendimento': return 'EM ATENDIMENTO';
      case 'aguardando_peca':
      case 'aguardando peca': return 'AGUARDANDO PEÇA';
      case 'finalizado':
      case 'concluido': return 'FINALIZADO';
      default: return status?.toUpperCase() || '...';
    }
  };

  if (loading || !ticket) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Surface style={styles.headerCard} elevation={2}>
          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientLabel}>CLIENTE</Text>
              <Text style={styles.clientName} numberOfLines={2}>{ticket.clienteNome || 'Cliente não identificado'}</Text>
            </View>
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{getStatusLabel(ticket.status)}</Text>
            </View>
          </View>

          <Text style={styles.titulo}>{ticket.titulo}</Text>
          {ticket.descricao ? <Text style={styles.descricao}>{ticket.descricao}</Text> : null}

          {ticket.equipamentoNome && (
            <View style={styles.equipmentInfo}>
              <Wrench size={16} color={COLORS.textSecondary} />
              <Text style={styles.equipmentText}>{ticket.equipamentoNome} {ticket.numeroSerie ? `(S/N: ${ticket.numeroSerie})` : ''}</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Prioridade</Text>
              <Text style={[styles.metaValue, { 
                color: ticket.prioridade === 'critica' || ticket.prioridade === 'alta' ? COLORS.error : 
                       ticket.prioridade === 'media' ? COLORS.warning : COLORS.success 
              }]}>
                {(ticket.prioridade || 'Média').toUpperCase()}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Data de Abertura</Text>
              <Text style={styles.metaValue}>
                {ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleDateString('pt-BR') : '...'}
              </Text>
            </View>
          </View>
        </Surface>

        <View style={styles.actionRow}>
          <Button 
            mode="contained" 
            onPress={() => setShowStatusModal(true)}
            style={styles.actionBtn}
            icon="update"
            buttonColor={COLORS.primary}
          >
            Status
          </Button>
          <Button 
            mode="outlined" 
            onPress={pickImage}
            style={styles.actionBtn}
            icon="camera"
            loading={uploading}
            textColor={COLORS.primary}
          >
            Foto
          </Button>
        </View>

        <List.Section>
          <List.Subheader style={styles.sectionHeader}>Comentários e Histórico</List.Subheader>
          {comments.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum comentário ainda.</Text>
          ) : (
            comments.map((msg) => (
              <View key={msg.id} style={[
                styles.msgContainer,
                msg.type === 'status_change' && styles.statusChangeMsg
              ]}>
                <View style={styles.msgHeader}>
                  <Text style={styles.msgUser}>{msg.userName}</Text>
                  <Text style={styles.msgTime}>
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}
                  </Text>
                </View>
                <Text style={[
                  styles.msgBody,
                  msg.type === 'status_change' && styles.statusChangeText
                ]}>
                  {msg.message}
                </Text>
              </View>
            ))
          )}
        </List.Section>

        <List.Section>
          <List.Subheader style={styles.sectionHeader}>Anexos e Fotos</List.Subheader>
          {attachments.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma foto anexada.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentList}>
              {attachments.map((file) => (
                <Surface key={file.id} style={styles.fileCard} elevation={1}>
                  {file.tipo?.startsWith('image') ? (
                    <Image source={{ uri: file.url }} style={styles.fileImage} />
                  ) : (
                    <View style={styles.filePlaceholder}>
                      <FileText size={32} color={COLORS.primary} />
                    </View>
                  )}
                </Surface>
              ))}
            </ScrollView>
          )}
        </List.Section>
      </ScrollView>

      <Surface style={styles.inputArea} elevation={4}>
        <TextInput
          placeholder="Comentário técnico..."
          value={newComment}
          onChangeText={setNewComment}
          mode="flat"
          style={styles.input}
          multiline
          dense
        />
        <IconButton 
          icon="send" 
          mode="contained" 
          containerColor={COLORS.primary} 
          iconColor="#fff" 
          onPress={handleSendComment}
          disabled={sending || !newComment.trim()}
        />
      </Surface>

      <Modal visible={showStatusModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Surface style={styles.modalContent} elevation={5}>
            <Text style={styles.modalTitle}>Alterar Status</Text>
            <Divider style={styles.divider} />
            
            <StatusOption label="Em Atendimento" value="em_atendimento" onPress={handleUpdateStatus} icon={<Clock size={20} color={COLORS.warning} />} />
            <StatusOption label="Aguardando Peça" value="aguardando_peca" onPress={handleUpdateStatus} icon={<AlertCircle size={20} color={COLORS.secondary} />} />
            <StatusOption label="Finalizado / Concluído" value="finalizado" onPress={handleUpdateStatus} icon={<CheckCircle2 size={20} color={COLORS.success} />} />
            
            <Button mode="text" onPress={() => setShowStatusModal(false)} textColor={COLORS.error} style={{ marginTop: 10 }}>
              Fechar
            </Button>
          </Surface>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function StatusOption({ label, value, onPress, icon }: any) {
  return (
    <TouchableOpacity style={styles.statusOption} onPress={() => onPress(value)}>
      {icon}
      <Text style={styles.statusOptionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 100 },
  headerCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  clientLabel: { fontSize: 10, fontWeight: '900', color: COLORS.textSecondary, letterSpacing: 1 },
  clientName: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  statusBox: { backgroundColor: COLORS.primary + '10', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: 'bold', color: COLORS.primary },
  titulo: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginTop: 16 },
  descricao: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, lineHeight: 20 },
  equipmentInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: COLORS.gray[100], padding: 10, borderRadius: 8 },
  equipmentText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  metaRow: { flexDirection: 'row', marginTop: 24, gap: 32 },
  metaItem: { gap: 4 },
  metaLabel: { fontSize: 10, color: COLORS.gray[400], fontWeight: 'bold', textTransform: 'uppercase' },
  metaValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  actionRow: { flexDirection: 'row', padding: 20, gap: 12 },
  actionBtn: { flex: 1, borderRadius: 12 },
  sectionHeader: { fontWeight: 'bold', fontSize: 16, color: COLORS.text, marginHorizontal: 20, marginTop: 10 },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 14, marginVertical: 20, fontStyle: 'italic' },
  msgContainer: { padding: 16, backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 12, borderRadius: 20, ...SHADOWS.small },
  statusChangeMsg: { backgroundColor: COLORS.gray[100], borderWidth: 1, borderColor: COLORS.gray[200], elevation: 0, shadowOpacity: 0 },
  statusChangeText: { fontStyle: 'italic', color: COLORS.textSecondary },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  msgUser: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary },
  msgTime: { fontSize: 10, color: COLORS.textSecondary },
  msgBody: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  attachmentList: { paddingHorizontal: 20, gap: 12, paddingBottom: 20 },
  fileCard: { width: 120, height: 120, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff' },
  fileImage: { width: '100%', height: '100%' },
  filePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  inputArea: { backgroundColor: '#fff', padding: 12, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.gray[100] },
  input: { flex: 1, backgroundColor: 'transparent', height: 45 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', width: '100%', borderRadius: 24, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  divider: { marginBottom: 16 },
  statusOption: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderRadius: 12, marginBottom: 8 },
  statusOptionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.text }
});
