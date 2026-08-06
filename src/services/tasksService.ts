import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  setDoc,
  serverTimestamp,
  Timestamp
} from './resilientFirestoreClient';
import { db } from '../firebase';
import { 
  Tarefa, 
  ModeloTarefa, 
  TarefaHistoricoDiario, 
  PontuacaoUsuario, 
  TarefaLog,
  AutoTaskTrigger,
  ChecklistItem,
  TaskStatus
} from '../types';
import type { ProductivityMetrics } from '../types';

export const POINT_VALUES = {
  CONCLUIR_TAREFA: 10,
  CONCLUIR_ANTES_PRAZO: 5,
  CHECKLIST_COMPLETO: 5,
  ATRASO: -10,
  TAREFA_VENCIDA: -20,
  CRIAR_PROPOSTA: 20,
  FECHAR_VENDA: 50,
  RESPONDER_CHAMADO: 15,
  ATUALIZAR_CRM: 5
};

const priorityWeight = (priority?: string) => priority === 'Alta' ? 1.35 : priority === 'Baixa' ? 0.85 : 1;

export function calculateProductivityMetrics(tasks: Tarefa[], funcionarioId: string, now = new Date()): ProductivityMetrics {
  const today = now.toISOString().slice(0, 10);
  const scoped = tasks.filter(task => task.funcionarioId === funcionarioId && task.dataInicial <= today);
  const totalWeight = scoped.reduce((sum, task) => sum + priorityWeight(task.prioridade), 0);
  let earnedWeight = 0;
  let checklistDone = 0;
  let checklistTotal = 0;
  let points = 0;
  const completionMinutes: number[] = [];

  scoped.forEach(task => {
    const weight = priorityWeight(task.prioridade);
    const progress = Math.max(0, Math.min(100, task.percentualConcluido || 0));
    earnedWeight += weight * progress / 100;
    checklistDone += task.checklist?.filter(item => item.concluido).length || 0;
    checklistTotal += task.checklist?.length || 0;
    if (task.status === 'Concluída') {
      points += POINT_VALUES.CONCLUIR_TAREFA;
      if (task.concluidoEm && task.dataFinal && task.concluidoEm.slice(0, 10) <= task.dataFinal) points += POINT_VALUES.CONCLUIR_ANTES_PRAZO;
      if (task.checklist?.length && task.checklist.every(item => item.concluido)) points += POINT_VALUES.CHECKLIST_COMPLETO;
      if (task.createdAt && task.concluidoEm) {
        const duration = (new Date(task.concluidoEm).getTime() - new Date(task.createdAt).getTime()) / 60000;
        if (Number.isFinite(duration) && duration >= 0) completionMinutes.push(duration);
      }
    } else if (task.dataFinal < today) {
      points += POINT_VALUES.TAREFA_VENCIDA;
    }
  });

  const concluidas = scoped.filter(task => task.status === 'Concluída').length;
  const atrasadas = scoped.filter(task => task.status !== 'Concluída' && task.status !== 'Cancelada' && task.dataFinal < today).length;
  const pendentes = scoped.filter(task => task.status === 'Pendente' || task.status === 'Em andamento').length;
  const completionScore = totalWeight ? earnedWeight / totalWeight * 100 : 100;
  const checklistPercentual = checklistTotal ? checklistDone / checklistTotal * 100 : completionScore;
  const overduePenalty = scoped.length ? Math.min(45, atrasadas / scoped.length * 100) : 0;
  const score = Math.round(Math.max(0, Math.min(100, completionScore * .7 + checklistPercentual * .3 - overduePenalty)));
  const faltamParaVerde = score >= 90 ? 0 : Math.max(1, Math.ceil((90 - score) / Math.max(8, 100 / Math.max(1, scoped.length))));
  const mensagem = atrasadas > 0 ? `Você possui ${atrasadas} tarefa${atrasadas > 1 ? 's' : ''} vencida${atrasadas > 1 ? 's' : ''}.` : score >= 90 ? 'Excelente trabalho. Continue assim.' : score >= 70 ? `Faltam apenas ${faltamParaVerde} tarefa${faltamParaVerde > 1 ? 's' : ''} para entrar no nível Verde.` : 'Você está abaixo da meta. Priorize as tarefas mais importantes.';
  const averageMinutes = completionMinutes.length ? Math.round(completionMinutes.reduce((a, b) => a + b, 0) / completionMinutes.length) : 0;

  return {
    funcionarioId, score, nivel: score >= 90 ? 'Excelente' : score >= 70 ? 'Atenção' : 'Baixa produtividade',
    total: scoped.length, concluidas, pendentes, atrasadas, checklistPercentual: Math.round(checklistPercentual), pontos: points,
    horasProdutivas: Math.round(completionMinutes.reduce((a, b) => a + b, 0) / 60 * 10) / 10,
    tempoMedioConclusaoMinutos: averageMinutes, faltamParaVerde, mensagem
  };
}

class TasksService {
  private collectionName = 'tarefas';
  private templatesCollection = 'modelos_tarefas';
  private historyCollection = 'historico_tarefas';
  private scoresCollection = 'pontuacao_tarefas';
  private logsCollection = 'logs_tarefas';

  // Format date helper (YYYY-MM-DD)
  private getTodayFormatted(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Calculate task percentage completion
  private calculatePercentage(task: Partial<Tarefa>): number {
    if (task.status === 'Concluída') return 100;
    if (task.status === 'Cancelada') return 0;

    if (task.tipo === 'checklist' && task.checklist && task.checklist.length > 0) {
      const done = task.checklist.filter(i => i.concluido).length;
      return Math.round((done / task.checklist.length) * 100);
    }

    if (task.tipo === 'quantidade' && task.metaQuantidade && task.metaQuantidade > 0) {
      const rel = task.realizadoQuantidade || 0;
      return Math.min(100, Math.round((rel / task.metaQuantidade) * 100));
    }

    if (task.tipo === 'financeiro' && task.metaFinanceira && task.metaFinanceira > 0) {
      const rel = task.realizadoFinanceiro || 0;
      return Math.min(100, Math.round((rel / task.metaFinanceira) * 100));
    }

    if (task.tipo === 'automatica' && task.metaQuantidade && task.metaQuantidade > 0) {
      const rel = task.realizadoQuantidade || 0;
      return Math.min(100, Math.round((rel / task.metaQuantidade) * 100));
    }

    return task.status === 'Em andamento' ? 50 : 0;
  }

  // Real-time subscribe to tasks
  subscribeTasks(callback: (tasks: Tarefa[]) => void) {
    const q = query(collection(db, this.collectionName));
    return onSnapshot(q, (snapshot) => {
      const tasks: Tarefa[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        tasks.push({
          id: docSnap.id,
          ...data
        } as Tarefa);
      });
      callback(tasks);
    }, (error) => {
      console.error("Error listening to tasks:", error);
    });
  }

  // Get tasks list once
  async getTasks(): Promise<Tarefa[]> {
    try {
      const snapshot = await getDocs(collection(db, this.collectionName));
      return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Tarefa));
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return [];
    }
  }

  // Create Task
  async createTask(taskData: Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'percentualConcluido'>): Promise<string> {
    const percentualConcluido = this.calculatePercentage({
      tipo: taskData.tipo,
      status: taskData.status,
      checklist: taskData.checklist,
      metaQuantidade: taskData.metaQuantidade,
      realizadoQuantidade: taskData.realizadoQuantidade,
      metaFinanceira: taskData.metaFinanceira,
      realizadoFinanceiro: taskData.realizadoFinanceiro
    });

    const docData = {
      ...taskData,
      realizadoQuantidade: taskData.realizadoQuantidade || 0,
      realizadoFinanceiro: taskData.realizadoFinanceiro || 0,
      checklist: taskData.checklist || [],
      percentualConcluido,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, this.collectionName), docData);

    // Log Activity
    await this.logActivity(docRef.id, taskData.titulo, taskData.criadoPorId || 'system', taskData.criadoPorNome || 'Sistema', 'criacao', `Tarefa criada para ${taskData.funcionarioNome || 'colaborador'}`);

    // Update Daily History
    await this.updateDailyHistoryForUser(taskData.funcionarioId, taskData.funcionarioNome || '');

    return docRef.id;
  }

  // Update Task
  async updateTask(id: string, updates: Partial<Tarefa>, userExecutingId?: string, userExecutingName?: string): Promise<void> {
    const taskRef = doc(db, this.collectionName, id);
    const snap = await getDoc(taskRef);
    if (!snap.exists()) return;

    const currentTask = snap.data() as Tarefa;
    const mergedTask = { ...currentTask, ...updates };

    let newStatus = updates.status || currentTask.status;
    let percentual = this.calculatePercentage(mergedTask);

    if (percentual === 100 && newStatus !== 'Concluída') {
      newStatus = 'Concluída';
    }

    const payload: any = {
      ...updates,
      status: newStatus,
      percentualConcluido: percentual,
      updatedAt: new Date().toISOString()
    };

    if (newStatus === 'Concluída' && currentTask.status !== 'Concluída') {
      payload.concluidoEm = new Date().toISOString();
      // Award points
      if (currentTask.funcionarioId) {
        await this.addPointsToUser(currentTask.funcionarioId, currentTask.funcionarioNome || 'Colaborador', 'tarefa', POINT_VALUES.CONCLUIR_TAREFA);
      }
    }

    await updateDoc(taskRef, payload);

    // Log
    await this.logActivity(id, mergedTask.titulo, userExecutingId || 'system', userExecutingName || 'Sistema', 'edicao', 'Tarefa atualizada');

    // Update Daily History
    await this.updateDailyHistoryForUser(mergedTask.funcionarioId, mergedTask.funcionarioNome || '');
  }

  // Delete Task
  async deleteTask(id: string, userExecutingId?: string, userExecutingName?: string): Promise<void> {
    const taskRef = doc(db, this.collectionName, id);
    const snap = await getDoc(taskRef);
    if (snap.exists()) {
      const taskData = snap.data() as Tarefa;
      await deleteDoc(taskRef);
      await this.logActivity(id, taskData.titulo, userExecutingId || 'system', userExecutingName || 'Sistema', 'exclusao', 'Tarefa excluída');
      await this.updateDailyHistoryForUser(taskData.funcionarioId, taskData.funcionarioNome || '');
    }
  }

  // Duplicate Task
  async duplicateTask(id: string, userExecutingId?: string, userExecutingName?: string): Promise<string> {
    const taskRef = doc(db, this.collectionName, id);
    const snap = await getDoc(taskRef);
    if (!snap.exists()) throw new Error("Tarefa não encontrada para duplicação.");

    const taskData = snap.data() as Tarefa;
    
    // Reset status and progress for duplicated task
    const duplicatedData: Omit<Tarefa, 'id' | 'createdAt' | 'updatedAt' | 'percentualConcluido'> = {
      titulo: `${taskData.titulo} (Cópia)`,
      descricao: taskData.descricao || '',
      funcionarioId: taskData.funcionarioId,
      funcionarioNome: taskData.funcionarioNome || '',
      funcionarioFoto: taskData.funcionarioFoto || '',
      equipe: taskData.equipe || '',
      tipo: taskData.tipo,
      tipoAutomatico: taskData.tipoAutomatico,
      prioridade: taskData.prioridade,
      dataInicial: this.getTodayFormatted(),
      dataFinal: taskData.dataFinal,
      horario: taskData.horario,
      repeticao: taskData.repeticao,
      diasEspecificos: taskData.diasEspecificos,
      checklist: (taskData.checklist || []).map(i => ({ ...i, concluido: false, concluidoEm: undefined })),
      metaQuantidade: taskData.metaQuantidade,
      realizadoQuantidade: 0,
      metaFinanceira: taskData.metaFinanceira,
      realizadoFinanceiro: 0,
      status: 'Pendente',
      criadoPorId: userExecutingId,
      criadoPorNome: userExecutingName
    };

    return await this.createTask(duplicatedData);
  }

  // Toggle Checklist Item
  async toggleChecklistItem(taskId: string, itemId: string, completed: boolean, userExecutingId: string, userExecutingName: string): Promise<void> {
    const taskRef = doc(db, this.collectionName, taskId);
    const snap = await getDoc(taskRef);
    if (!snap.exists()) return;

    const task = snap.data() as Tarefa;
    const checklist = (task.checklist || []).map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          concluido: completed,
          concluidoEm: completed ? new Date().toISOString() : undefined
        };
      }
      return item;
    });

    const updatedTaskData = { ...task, checklist };
    const percentual = this.calculatePercentage(updatedTaskData);
    const isNowFinished = percentual === 100;
    const newStatus: TaskStatus = isNowFinished ? 'Concluída' : (percentual > 0 ? 'Em andamento' : 'Pendente');

    const updates: any = {
      checklist,
      percentualConcluido: percentual,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    if (isNowFinished && task.status !== 'Concluída') {
      updates.concluidoEm = new Date().toISOString();
      await this.addPointsToUser(task.funcionarioId, task.funcionarioNome || 'Colaborador', 'tarefa', POINT_VALUES.CONCLUIR_TAREFA);
    }

    await updateDoc(taskRef, updates);
    await this.logActivity(taskId, task.titulo, userExecutingId, userExecutingName, 'item_checklist', `Item do checklist ${completed ? 'marcado' : 'desmarcado'}`);
    await this.updateDailyHistoryForUser(task.funcionarioId, task.funcionarioNome || '');
  }

  // Update Task Quantity Progress
  async updateTaskQuantityProgress(taskId: string, realizado: number, userExecutingId: string, userExecutingName: string): Promise<void> {
    const taskRef = doc(db, this.collectionName, taskId);
    const snap = await getDoc(taskRef);
    if (!snap.exists()) return;

    const task = snap.data() as Tarefa;
    const updatedTaskData = { ...task, realizadoQuantidade: realizado };
    const percentual = this.calculatePercentage(updatedTaskData);
    const isNowFinished = percentual === 100;
    const newStatus: TaskStatus = isNowFinished ? 'Concluída' : (realizado > 0 ? 'Em andamento' : 'Pendente');

    const updates: any = {
      realizadoQuantidade: realizado,
      percentualConcluido: percentual,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    if (isNowFinished && task.status !== 'Concluída') {
      updates.concluidoEm = new Date().toISOString();
      await this.addPointsToUser(task.funcionarioId, task.funcionarioNome || 'Colaborador', 'tarefa', POINT_VALUES.CONCLUIR_TAREFA);
    }

    await updateDoc(taskRef, updates);
    await this.logActivity(taskId, task.titulo, userExecutingId, userExecutingName, 'progresso_meta', `Progresso alterado para ${realizado}/${task.metaQuantidade || 0}`);
    await this.updateDailyHistoryForUser(task.funcionarioId, task.funcionarioNome || '');
  }

  // Update Task Financial Progress
  async updateTaskFinancialProgress(taskId: string, realizado: number, userExecutingId: string, userExecutingName: string): Promise<void> {
    const taskRef = doc(db, this.collectionName, taskId);
    const snap = await getDoc(taskRef);
    if (!snap.exists()) return;

    const task = snap.data() as Tarefa;
    const updatedTaskData = { ...task, realizadoFinanceiro: realizado };
    const percentual = this.calculatePercentage(updatedTaskData);
    const isNowFinished = percentual === 100;
    const newStatus: TaskStatus = isNowFinished ? 'Concluída' : (realizado > 0 ? 'Em andamento' : 'Pendente');

    const updates: any = {
      realizadoFinanceiro: realizado,
      percentualConcluido: percentual,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    if (isNowFinished && task.status !== 'Concluída') {
      updates.concluidoEm = new Date().toISOString();
      await this.addPointsToUser(task.funcionarioId, task.funcionarioNome || 'Colaborador', 'tarefa', POINT_VALUES.CONCLUIR_TAREFA);
    }

    await updateDoc(taskRef, updates);
    await this.logActivity(taskId, task.titulo, userExecutingId, userExecutingName, 'progresso_meta', `Progresso financeiro alterado para R$ ${realizado}`);
    await this.updateDailyHistoryForUser(task.funcionarioId, task.funcionarioNome || '');
  }

  // AUTOMATIC CRM TRIGGERS PROCESSOR
  async processAutomaticTasksTrigger(triggerType: AutoTaskTrigger, userId: string, amount: number = 1): Promise<void> {
    try {
      if (!userId) return;

      // Also award action points for the CRM action
      if (triggerType === 'criar_proposta') {
        await this.addPointsToUser(userId, 'Colaborador', 'proposta', POINT_VALUES.CRIAR_PROPOSTA);
      } else if (triggerType === 'fechar_venda') {
        await this.addPointsToUser(userId, 'Colaborador', 'venda', POINT_VALUES.FECHAR_VENDA);
      } else if (triggerType === 'abrir_chamado') {
        await this.addPointsToUser(userId, 'Colaborador', 'chamado', POINT_VALUES.RESPONDER_CHAMADO);
      } else if (triggerType === 'emitir_nf') {
        await this.addPointsToUser(userId, 'Colaborador', 'crm', POINT_VALUES.ATUALIZAR_CRM);
      }

      // Query active automatic tasks for this user
      const q = query(
        collection(db, this.collectionName),
        where('funcionarioId', '==', userId),
        where('tipo', '==', 'automatica'),
        where('tipoAutomatico', '==', triggerType)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      for (const docSnap of snapshot.docs) {
        const task = { id: docSnap.id, ...docSnap.data() } as Tarefa;
        if (task.status === 'Concluída' || task.status === 'Cancelada') continue;

        let newRealizado = (task.realizadoQuantidade || 0) + amount;
        let newRealizadoFin = (task.realizadoFinanceiro || 0);

        if (task.metaFinanceira && task.metaFinanceira > 0) {
          newRealizadoFin += amount;
        }

        const updatedTask = {
          ...task,
          realizadoQuantidade: newRealizado,
          realizadoFinanceiro: newRealizadoFin
        };

        const percentual = this.calculatePercentage(updatedTask);
        const isFinished = percentual === 100;
        const newStatus: TaskStatus = isFinished ? 'Concluída' : 'Em andamento';

        const payload: any = {
          realizadoQuantidade: newRealizado,
          realizadoFinanceiro: newRealizadoFin,
          percentualConcluido: percentual,
          status: newStatus,
          updatedAt: new Date().toISOString()
        };

        if (isFinished && (task.status as string) !== 'Concluída') {
          payload.concluidoEm = new Date().toISOString();
          await this.addPointsToUser(userId, task.funcionarioNome || 'Colaborador', 'tarefa', POINT_VALUES.CONCLUIR_TAREFA);
        }

        await updateDoc(doc(db, this.collectionName, task.id), payload);
        await this.logActivity(task.id, task.titulo, userId, task.funcionarioNome || 'Automação', 'automatica_trigger', `Gatilho automático "${triggerType}" atualizou tarefa.`);
        await this.updateDailyHistoryForUser(userId, task.funcionarioNome || '');
      }
    } catch (error) {
      console.error("Error processing automatic tasks trigger:", error);
    }
  }

  // ADD POINTS & RANKING
  async addPointsToUser(userId: string, userName: string, actionType: 'tarefa' | 'proposta' | 'venda' | 'chamado' | 'crm', points: number): Promise<void> {
    try {
      if (!userId) return;
      const docRef = doc(db, this.scoresCollection, userId);
      const snap = await getDoc(docRef);

      const todayStr = this.getTodayFormatted();

      if (snap.exists()) {
        const data = snap.data() as PontuacaoUsuario;
        const updatedToday = (data.updatedAt || '').startsWith(todayStr);

        const pontosHoje = updatedToday ? (data.pontosHoje || 0) + points : points;
        const pontosTotais = (data.pontosTotais || 0) + points;
        const pontosSemana = (data.pontosSemana || 0) + points;
        const pontosMes = (data.pontosMes || 0) + points;

        const payload: Partial<PontuacaoUsuario> = {
          funcionarioId: userId,
          funcionarioNome: userName || data.funcionarioNome || 'Colaborador',
          pontosTotais,
          pontosHoje,
          pontosSemana,
          pontosMes,
          tarefasConcluidasHoje: (updatedToday ? data.tarefasConcluidasHoje || 0 : 0) + (actionType === 'tarefa' ? 1 : 0),
          propostasCriadasHoje: (updatedToday ? data.propostasCriadasHoje || 0 : 0) + (actionType === 'proposta' ? 1 : 0),
          vendasFechadasHoje: (updatedToday ? data.vendasFechadasHoje || 0 : 0) + (actionType === 'venda' ? 1 : 0),
          chamadosRespondidosHoje: (updatedToday ? data.chamadosRespondidosHoje || 0 : 0) + (actionType === 'chamado' ? 1 : 0),
          crmAtualizacoesHoje: (updatedToday ? data.crmAtualizacoesHoje || 0 : 0) + (actionType === 'crm' ? 1 : 0),
          updatedAt: new Date().toISOString()
        };

        await updateDoc(docRef, payload);
      } else {
        const newScore: PontuacaoUsuario = {
          id: userId,
          funcionarioId: userId,
          funcionarioNome: userName || 'Colaborador',
          pontosTotais: points,
          pontosHoje: points,
          pontosSemana: points,
          pontosMes: points,
          tarefasConcluidasHoje: actionType === 'tarefa' ? 1 : 0,
          propostasCriadasHoje: actionType === 'proposta' ? 1 : 0,
          vendasFechadasHoje: actionType === 'venda' ? 1 : 0,
          chamadosRespondidosHoje: actionType === 'chamado' ? 1 : 0,
          crmAtualizacoesHoje: actionType === 'crm' ? 1 : 0,
          updatedAt: new Date().toISOString()
        };

        await setDoc(docRef, newScore);
      }
    } catch (error) {
      console.error("Error adding points to user:", error);
    }
  }

  // Subscribe Rankings
  subscribeScores(callback: (scores: PontuacaoUsuario[]) => void) {
    const q = query(collection(db, this.scoresCollection));
    return onSnapshot(q, (snapshot) => {
      const scores: PontuacaoUsuario[] = [];
      snapshot.forEach((docSnap) => {
        scores.push({
          id: docSnap.id,
          ...docSnap.data()
        } as PontuacaoUsuario);
      });
      // Sort descending by pontosHoje
      scores.sort((a, b) => (b.pontosHoje || 0) - (a.pontosHoje || 0));
      scores.forEach((s, idx) => { s.posicaoRanking = idx + 1; });
      callback(scores);
    });
  }

  // Update Daily History Summary
  async updateDailyHistoryForUser(userId: string, userName: string): Promise<void> {
    try {
      if (!userId) return;
      const todayStr = this.getTodayFormatted();
      const histId = `${userId}_${todayStr}`;

      const q = query(collection(db, this.collectionName), where('funcionarioId', '==', userId));
      const snapshot = await getDocs(q);

      const allTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Tarefa));
      
      // Filter tasks active for today
      const todayTasks = allTasks.filter(t => {
        return t.dataInicial <= todayStr && t.dataFinal >= todayStr;
      });

      const totalTarefas = todayTasks.length;
      const concluidas = todayTasks.filter(t => t.status === 'Concluída').length;
      const pendentes = todayTasks.filter(t => t.status === 'Pendente' || t.status === 'Em andamento').length;
      const atrasadas = todayTasks.filter(t => (t.status === 'Pendente' || t.status === 'Em andamento') && t.dataFinal < todayStr).length;

      const percentualConcluido = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;

      // Get user points today
      let pontosDoDia = 0;
      const scoreDoc = await getDoc(doc(db, this.scoresCollection, userId));
      if (scoreDoc.exists()) {
        pontosDoDia = scoreDoc.data().pontosHoje || 0;
      }

      const histData: TarefaHistoricoDiario = {
        id: histId,
        funcionarioId: userId,
        funcionarioNome: userName || 'Colaborador',
        data: todayStr,
        totalTarefas,
        concluidas,
        pendentes,
        atrasadas,
        percentualConcluido,
        pontosDoDia,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, this.historyCollection, histId), histData);
    } catch (error) {
      console.error("Error updating daily history for user:", error);
    }
  }

  // Get Employee Daily History (e.g. 31/07 - 100%, 30/07 - 90%, etc.)
  async getEmployeeHistory(userId: string): Promise<TarefaHistoricoDiario[]> {
    try {
      const q = query(
        collection(db, this.historyCollection),
        where('funcionarioId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TarefaHistoricoDiario));
      return list.sort((a, b) => b.data.localeCompare(a.data));
    } catch (error) {
      console.error("Error getting employee history:", error);
      return [];
    }
  }

  // Log Activity
  private async logActivity(tarefaId: string, tarefaTitulo: string, usuarioId: string, usuarioNome: string, acao: TarefaLog['acao'], detalhes: string) {
    try {
      const logData: Omit<TarefaLog, 'id'> = {
        tarefaId,
        tarefaTitulo: tarefaTitulo || 'Tarefa',
        usuarioId: usuarioId || 'system',
        usuarioNome: usuarioNome || 'Sistema',
        acao,
        detalhes,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, this.logsCollection), logData);
    } catch (e) {
      console.error("Error logging task activity:", e);
    }
  }

  // TASK TEMPLATES CRUD
  async getTaskTemplates(): Promise<ModeloTarefa[]> {
    try {
      const snapshot = await getDocs(collection(db, this.templatesCollection));
      return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as ModeloTarefa));
    } catch (e) {
      console.error("Error getting task templates:", e);
      return [];
    }
  }

  async createTaskTemplate(template: Omit<ModeloTarefa, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docData = {
      ...template,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const ref = await addDoc(collection(db, this.templatesCollection), docData);
    return ref.id;
  }

  async deleteTaskTemplate(id: string): Promise<void> {
    await deleteDoc(doc(db, this.templatesCollection, id));
  }
}

export const tasksService = new TasksService();
