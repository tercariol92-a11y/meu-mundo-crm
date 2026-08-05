import React, { createContext, useContext, useState, useEffect } from 'react';
import { Cliente, Usuario, Lead, Proposta, Tecnico, Produto, EquipamentoCliente, Chamado, Meta, Conversation, AgendaComercial, MotivoPerda, ContaPagar, ContratoRecorrente } from '../types';
import { databaseService, OperationType, handleFirestoreError, mapDoc } from '../services/databaseService';
import { collection, onSnapshot } from '../services/resilientFirestoreClient';
import { db, auth, onAuthStateChanged } from '../firebase';

interface GlobalDataContextType {
  clientes: Cliente[];
  usuarios: Usuario[];
  leads: Lead[];
  propostas: Proposta[];
  tecnicos: Tecnico[];
  produtos: Produto[];
  equipamentos: EquipamentoCliente[];
  chamados: Chamado[];
  metas: Meta[];
  conversations: Conversation[];
  agendaComercial: AgendaComercial[];
  motivosPerda: MotivoPerda[];
  contasPagar: ContaPagar[];
  contratos: ContratoRecorrente[];
  loading: boolean;
  refreshData: (collectionName?: string) => Promise<void>;
}

const GlobalDataContext = createContext<GlobalDataContextType | undefined>(undefined);

export function GlobalDataProvider({ children }: { children: React.ReactNode }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoCliente[]>([]);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agendaComercial, setAgendaComercial] = useState<AgendaComercial[]>([]);
  const [motivosPerda, setMotivosPerda] = useState<MotivoPerda[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [contratos, setContratos] = useState<ContratoRecorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
      } else {
        setCurrentUser(null);
        // Clear all state immediately when user signs out or is unauthenticated
        setClientes([]);
        setUsuarios([]);
        setLeads([]);
        setPropostas([]);
        setTecnicos([]);
        setProdutos([]);
        setEquipamentos([]);
        setChamados([]);
        setMetas([]);
        setConversations([]);
        setAgendaComercial([]);
        setMotivosPerda([]);
        setContasPagar([]);
        setContratos([]);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setLoading(true);

    const unsubClientes = onSnapshot(collection(db, 'clientes'), (snap) => {
      setClientes(snap.docs.map(doc => mapDoc(doc) as Cliente));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clientes');
    });

    const unsubUsuarios = onSnapshot(collection(db, 'usuarios'), (snap) => {
      setUsuarios(snap.docs.map(doc => mapDoc(doc) as Usuario));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'usuarios');
    });

    const unsubLeads = onSnapshot(collection(db, 'leads'), (snap) => {
      setLeads(snap.docs.map(doc => mapDoc(doc) as Lead));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
    });

    const unsubPropostas = onSnapshot(collection(db, 'propostas'), (snap) => {
      setPropostas(snap.docs.map(doc => mapDoc(doc) as Proposta));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'propostas');
    });

    const unsubTecnicos = onSnapshot(collection(db, 'tecnicos'), (snap) => {
      setTecnicos(snap.docs.map(doc => mapDoc(doc) as Tecnico));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tecnicos');
    });

    const unsubEquipamentos = onSnapshot(collection(db, 'equipamentos_cliente'), (snap) => {
      setEquipamentos(snap.docs.map(doc => mapDoc(doc) as EquipamentoCliente));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'equipamentos_cliente');
    });

    const unsubChamados = onSnapshot(collection(db, 'chamados'), (snap) => {
      setChamados(snap.docs.map(doc => mapDoc(doc) as Chamado));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chamados');
    });

    const unsubMetas = onSnapshot(collection(db, 'metas'), (snap) => {
      setMetas(snap.docs.map(doc => mapDoc(doc) as Meta));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'metas');
    });

    const unsubConversations = onSnapshot(collection(db, 'conversations'), (snap) => {
      setConversations(snap.docs.map(doc => mapDoc(doc) as Conversation));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
    });

    const unsubAgenda = onSnapshot(collection(db, 'agenda_comercial'), (snap) => {
      setAgendaComercial(snap.docs.map(doc => mapDoc(doc) as AgendaComercial));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'agenda_comercial');
    });

    const unsubMotivos = onSnapshot(collection(db, 'motivos_perda'), (snap) => {
      setMotivosPerda(snap.docs.map(doc => mapDoc(doc) as MotivoPerda));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'motivos_perda');
    });

    const unsubContas = onSnapshot(collection(db, 'contas_pagar'), (snap) => {
      setContasPagar(snap.docs.map(doc => mapDoc(doc) as ContaPagar));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contas_pagar');
    });

    const unsubContratos = onSnapshot(collection(db, 'contratos'), (snap) => {
      setContratos(snap.docs.map(doc => mapDoc(doc) as ContratoRecorrente));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contratos');
    });

    const unsubProdutos = onSnapshot(collection(db, 'produtos'), (snap) => {
      setProdutos(snap.docs.map(doc => mapDoc(doc) as Produto));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'produtos');
      setLoading(false);
    });

    return () => {
      unsubClientes();
      unsubUsuarios();
      unsubLeads();
      unsubPropostas();
      unsubTecnicos();
      unsubEquipamentos();
      unsubChamados();
      unsubMetas();
      unsubConversations();
      unsubAgenda();
      unsubMotivos();
      unsubContas();
      unsubContratos();
      unsubProdutos();
    };
  }, [currentUser]);

  const allowedPropostas = React.useMemo(() => {
    if (!currentUser) return [];

    const profile = usuarios.find(u => u.id === currentUser.uid);
    if (!profile) {
      const isAdminEmail = currentUser.email === 'Tercariol92@gmail.com' || currentUser.email === 'jefferson@mundotechsolucoes.com.br';
      if (isAdminEmail) return propostas;
      return propostas;
    }

    const isAdmin = profile.role === 'admin' || profile.roles?.includes('admin');
    if (isAdmin) {
      return propostas;
    }

    const canViewOthers = profile.permissions?.viewOthersOrcamentos ?? false;
    if (canViewOthers) {
      return propostas;
    }

    return propostas.filter(p => p.vendedorId === currentUser.uid || (p as any).createdBy === currentUser.uid || (p as any).usuarioId === currentUser.uid);
  }, [propostas, usuarios, currentUser]);

  const refreshData = async (collectionName?: string) => {
    // Snapshots handle refresh
  };

  return (
    <GlobalDataContext.Provider value={{ 
      clientes, 
      usuarios, 
      leads, 
      propostas: allowedPropostas, 
      tecnicos, 
      produtos, 
      equipamentos,
      chamados,
      metas,
      conversations,
      agendaComercial,
      motivosPerda,
      contasPagar,
      contratos,
      loading,
      refreshData 
    }}>
      {children}
    </GlobalDataContext.Provider>
  );
}

export function useGlobalData() {
  const context = useContext(GlobalDataContext);
  if (context === undefined) {
    throw new Error('useGlobalData must be used within a GlobalDataProvider');
  }
  return context;
}
