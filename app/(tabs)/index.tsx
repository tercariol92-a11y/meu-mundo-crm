import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Surface, Card, Avatar, IconButton } from 'react-native-paper';
import { useAuth } from '../../src/mobile/context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/mobile/api/firebase';
import { COLORS, SPACING, SHADOWS } from '../../src/mobile/theme';
import { Wrench, Clock, CheckCircle, AlertCircle } from 'lucide-react-native';

export default function DashboardScreen() {
  const { userData } = useAuth();
  const [stats, setStats] = useState({ 
    aberto: 0, 
    em_atendimento: 0, 
    aguardando_peca: 0, 
    finalizado: 0 
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!userData) return;
    
    setLoading(true);
    // Filtrar pelo tecnicoId (ID do documento na coleção tecnicos)
    // Se não tiver, tenta pelo id do usuário (uid), mas o correto no CRM é o Id do Técnico
    const tId = userData.tecnicoId || userData.id;
    const uid = userData.id;
    const email = userData.email;
    const nome = userData.nome;
    const nomeLower = nome.toLowerCase();
    const firstName = nome.split(' ')[0];
    const firstNameLower = firstName.toLowerCase();

    console.log("Dashboard: UID do usuário autenticado:", uid);
    console.log("Dashboard: Buscando estatísticas para tecnicoId:", tId);

    const q = query(collection(db, 'chamados'));

    const unsub = onSnapshot(q, (snapshot) => {
      console.log("Dashboard: Chamados encontrados no snapshot:", snapshot.docs.length);
      const counts: any = { aberto: 0, em_atendimento: 0, aguardando_peca: 0, finalizado: 0 };
      
      snapshot.docs.forEach(doc => {
        const t = doc.data() as any;
        
        // Filtragem no cliente
        const matchesTech = 
          t.tecnicoId === tId || 
          t.tecnicoId === uid || 
          t.tecnicoUid === uid || 
          t.tecnicoEmail === email || 
          t.tecnicoNome === nome || 
          t.tecnico?.toLowerCase() === nomeLower;

        if (!matchesTech) return;

        const s = t.status;
        // Normalizar status para as keys do estado
        let statusKey = s;
        if (s === 'em atendimento') statusKey = 'em_atendimento';
        if (s === 'aguardando peca') statusKey = 'aguardando_peca';
        if (s === 'concluido' || s === 'finalizado') statusKey = 'finalizado';
        
        if (counts[statusKey] !== undefined) {
          counts[statusKey]++;
        }
      });
      console.log("Dashboard: Calculated counts", counts);
      setStats(counts);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error("Dashboard onSnapshot error:", error);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsub();
  }, [userData]);

  const onRefresh = () => {
    setRefreshing(true);
    // O onSnapshot já vai atualizar automaticamente, mas o refreshing dá o feedback visual
    setTimeout(() => setRefreshing(false), 2000);
  };

  const totalTickets = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcome}>Olá, Técnico</Text>
          <Text style={styles.name} numberOfLines={1}>{userData?.nome}</Text>
        </View>
        <Avatar.Icon size={48} icon="account" style={{ backgroundColor: COLORS.primary }} />
      </View>

      <View style={styles.statsGrid}>
        <StatCard 
          title="Em Aberto" 
          value={stats.aberto} 
          icon={<AlertCircle color={COLORS.error} size={24} />} 
          color={COLORS.error} 
        />
        <StatCard 
          title="Em Curso" 
          value={stats.em_atendimento} 
          icon={<Clock color={COLORS.warning} size={24} />} 
          color={COLORS.warning} 
        />
        <StatCard 
          title="Concluídos" 
          value={stats.finalizado} 
          icon={<CheckCircle color={COLORS.success} size={24} />} 
          color={COLORS.success} 
        />
        <StatCard 
          title="Pendente Peça" 
          value={stats.aguardando_peca} 
          icon={<Wrench color={COLORS.secondary} size={24} />} 
          color={COLORS.secondary} 
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo do Atendimento</Text>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total atribuído</Text>
              <Text style={styles.summaryValue}>{totalTickets}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Eficiência Técnica</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                {totalTickets > 0 ? Math.round((stats.finalizado / totalTickets) * 100) : 0}%
              </Text>
            </View>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <Surface style={styles.statCard} elevation={1}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 24,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...SHADOWS.small,
  },
  welcome: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statsGrid: {
    padding: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '47%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 4,
  },
  section: {
    padding: 24,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: '#fff',
    ...SHADOWS.small,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray[100],
  }
});
