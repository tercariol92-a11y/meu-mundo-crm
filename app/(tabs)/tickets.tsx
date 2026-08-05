import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { Text, Surface, Searchbar, Chip, Avatar } from 'react-native-paper';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../src/mobile/api/firebase';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { COLORS, SPACING, SHADOWS } from '../../src/mobile/theme';
import { router } from 'expo-router';
import { Clock, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react-native';

export default function MyTicketsScreen() {
  const { userData } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('todos');

  const filters = [
    { id: 'todos', label: 'Todos' },
    { id: 'aberto', label: 'Abertos' },
    { id: 'em_atendimento', label: 'Em Curso' },
    { id: 'finalizado', label: 'Concluídos' },
    { id: 'aguardando_peca', label: 'Aguardando' }
  ];

  useEffect(() => {
    if (!userData) return;

    setLoading(true);
    const tId = userData.tecnicoId || userData.id;
    const uid = userData.id;
    const email = userData.email;
    const nome = userData.nome;
    const nomeLower = nome.toLowerCase();
    const firstName = nome.split(' ')[0];
    const firstNameLower = firstName.toLowerCase();

    console.log("Tickets: UID do usuário autenticado:", uid);
    console.log("Tickets: Buscando técnico vinculado com técnicoId:", tId);

    // Buscar todos os chamados e filtrar no cliente para garantir flexibilidade total e evitar problemas de índice
    const q = query(
      collection(db, 'chamados')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      console.log("Tickets: Chamados encontrados no snapshot:", snapshot.docs.length);
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      const filtered = allData.filter(t => {
        const matchesTech = 
          t.tecnicoId === tId || 
          t.tecnicoId === uid || 
          t.tecnicoUid === uid || 
          t.tecnicoEmail === email || 
          t.tecnicoNome === nome || 
          t.tecnico?.toLowerCase() === nomeLower;

        return matchesTech;
      });

      console.log("Tickets: Chamados após filtragem:", filtered.length);
      
      // Ordenar por data de atualização (mais recentes primeiro)
      filtered.sort((a, b) => {
        const timeA = a.updatedAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || 0;
        return timeB - timeA;
      });

      const finalTickets = activeFilter === 'todos' 
        ? filtered 
        : filtered.filter(t => t.status === activeFilter);

      setTickets(finalTickets);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error("Tickets onSnapshot error:", error);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsub();
  }, [userData, activeFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    // onSnapshot atualiza automaticamente
    setTimeout(() => setRefreshing(false), 2000);
  };

  const filteredTickets = tickets.filter(t => 
    (t.clienteNome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (t.titulo?.toLowerCase() || t.id.toLowerCase()).includes(searchTerm.toLowerCase())
  );

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'aberto': return { color: COLORS.error, icon: <AlertCircle size={12} color={COLORS.error} /> };
      case 'em_atendimento':
      case 'em atendimento': return { color: COLORS.warning, icon: <Clock size={12} color={COLORS.warning} /> };
      case 'finalizado': 
      case 'concluido': return { color: COLORS.success, icon: <CheckCircle size={12} color={COLORS.success} /> };
      case 'aguardando_peca':
      case 'aguardando peca': return { color: COLORS.secondary, icon: <Clock size={12} color={COLORS.secondary} /> };
      default: return { color: COLORS.secondary, icon: <Clock size={12} color={COLORS.secondary} /> };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Buscar cliente ou chamado..."
          onChangeText={setSearchTerm}
          value={searchTerm}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />
        
        <FlatList
          data={filters}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <Chip
              selected={activeFilter === item.id}
              onPress={() => setActiveFilter(item.id)}
              style={[
                styles.filterChip,
                activeFilter === item.id && { backgroundColor: COLORS.primary }
              ]}
              textStyle={[
                styles.filterText,
                activeFilter === item.id && { color: '#fff' }
              ]}
              showSelectedCheck={false}
            >
              {item.label}
            </Chip>
          )}
        />
      </View>

      <FlatList
        data={filteredTickets}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const config = getStatusConfig(item.status);
          return (
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => router.push(`/ticket/${item.id}`)}
            >
              <Surface style={styles.card} elevation={1}>
                <View style={styles.cardTop}>
                  <View style={styles.clientInfo}>
                    <Avatar.Text 
                      size={32} 
                      label={item.clienteNome?.charAt(0) || '?'} 
                      style={{ backgroundColor: config.color + '20' }}
                      color={config.color}
                    />
                    <View style={styles.clientTextContainer}>
                      <Text style={styles.clientName}>{item.clienteNome || 'Cliente não identificado'}</Text>
                      <Text style={styles.ticketId}>ID: {item.id.substring(0, 8).toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: config.color + '15' }]}>
                    {config.icon}
                    <Text style={[styles.statusText, { color: config.color }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.ticketTitle} numberOfLines={1}>{item.titulo}</Text>
                
                <View style={styles.cardBottom}>
                  <View style={styles.priorityBox}>
                    <View style={[styles.priorityDot, { backgroundColor: item.prioridade === 'critica' ? COLORS.error : COLORS.warning }]} />
                    <Text style={styles.priorityText}>{item.prioridade.toUpperCase()}</Text>
                  </View>
                  <ChevronRight size={20} color={COLORS.gray[300]} />
                </View>
              </Surface>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum chamado vinculado ao seu usuário</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...SHADOWS.small,
  },
  searchBar: {
    marginHorizontal: 20,
    backgroundColor: COLORS.gray[100],
    elevation: 0,
    borderRadius: 16,
    height: 48,
  },
  searchInput: {
    fontSize: 14,
  },
  filterList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 12,
    height: 36,
  },
  filterText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  list: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientTextContainer: {
    maxWidth: 150,
  },
  clientName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  ticketId: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[50],
    paddingTop: 12,
  },
  priorityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  empty: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  }
});
