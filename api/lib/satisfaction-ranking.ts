export const MIN_AVALIACOES_RANKING = 10;
export const META_VOLUME_RANKING = 30;
export const META_COBERTURA_RANKING = 51;

export type SatisfactionReviewForRanking = {
  nota: number;
  atendenteId?: string;
  atendente?: string;
  tecnicoId?: string;
  tecnico?: string;
};

export type SatisfactionRankEntry = {
  id: string;
  nome: string;
  totalAvaliacoes: number;
  media: number;
  avaliacoesPositivas: number;
  avaliacoesNeutras: number;
  avaliacoesNegativas: number;
  notasCinco: number;
  percentualPositivas: number;
  score: number;
  atendimentosWhatsapp: number;
  chamadosExternos: number;
  totalAtendimentos: number;
  percentualCobertura: number;
  avaliacoesNecessarias: number;
  faltamAvaliacoes: number;
  elegivelRanking: boolean;
  status: 'META_ATINGIDA' | 'EM_QUALIFICACAO';
};

export type SatisfactionAttendanceForRanking = {
  id?: string;
  nome?: string;
  total: number;
  atendimentosWhatsapp?: number;
  chamadosExternos?: number;
};

const normalizedKey = (id: string | undefined, name: string | undefined) =>
  String(name || id || '').trim().toLocaleLowerCase('pt-BR');

export function calculateSatisfactionRanking(
  reviews: SatisfactionReviewForRanking[],
  role: 'atendente' | 'tecnico',
  attendances: SatisfactionAttendanceForRanking[] = [],
): SatisfactionRankEntry[] {
  const attendanceTotals = new Map<string, { total: number; whatsapp: number; externos: number }>();
  const grouped = new Map<string, { id: string; nome: string; notas: number[] }>();
  for (const attendance of attendances) {
    const key = normalizedKey(attendance.id, attendance.nome);
    if (!key) continue;
    const currentTotals = attendanceTotals.get(key) || { total: 0, whatsapp: 0, externos: 0 };
    currentTotals.total += Math.max(0, Number(attendance.total) || 0);
    currentTotals.whatsapp += Math.max(0, Number(attendance.atendimentosWhatsapp) || 0);
    currentTotals.externos += Math.max(0, Number(attendance.chamadosExternos) || 0);
    attendanceTotals.set(key, currentTotals);
    if (!grouped.has(key) && String(attendance.nome || '').trim()) {
      grouped.set(key, { id: String(attendance.id || key), nome: String(attendance.nome).trim(), notas: [] });
    }
  }
  for (const review of reviews) {
    const id = role === 'atendente' ? review.atendenteId : review.tecnicoId;
    const nome = String(role === 'atendente' ? review.atendente : review.tecnico || '').trim();
    const key = normalizedKey(id, nome);
    const nota = Number(review.nota);
    if (!key || !nome || !Number.isFinite(nota) || nota < 1 || nota > 5) continue;
    const current = grouped.get(key) || { id: String(id || key), nome, notas: [] };
    current.notas.push(nota);
    grouped.set(key, current);
  }

  return [...grouped.values()].map(person => {
    const total = person.notas.length;
    const positivas = person.notas.filter(nota => nota >= 4).length;
    const neutras = person.notas.filter(nota => nota === 3).length;
    const negativas = person.notas.filter(nota => nota <= 2).length;
    const media = total ? person.notas.reduce((sum, nota) => sum + nota, 0) / total : 0;
    const positividade = total ? positivas / total : 0;
    const taxaNegativas = total ? negativas / total : 0;
    const scoreBase = (media / 5 * 0.5) + (Math.min(total / META_VOLUME_RANKING, 1) * 0.3) + (positividade * 0.2);
    const score = Math.max(0, Math.min(100, scoreBase * 100 - taxaNegativas * 15));
    // Reviews created before attendance coverage was introduced remain measurable.
    // Whenever completed-attendance data exists, it becomes the official denominator.
    const attendance = attendanceTotals.get(normalizedKey(person.id, person.nome)) || { total: 0, whatsapp: 0, externos: 0 };
    const totalAtendimentos = Math.max(total, attendance.total);
    const avaliacoesNecessarias = Math.ceil(totalAtendimentos * (META_COBERTURA_RANKING / 100));
    const percentualCobertura = totalAtendimentos ? Math.min(100, total / totalAtendimentos * 100) : 0;
    const faltamAvaliacoes = Math.max(0, MIN_AVALIACOES_RANKING - total, avaliacoesNecessarias - total);
    const elegivelRanking = total >= MIN_AVALIACOES_RANKING && percentualCobertura >= META_COBERTURA_RANKING;
    return {
      id: person.id,
      nome: person.nome,
      totalAvaliacoes: total,
      media: Number(media.toFixed(2)),
      avaliacoesPositivas: positivas,
      avaliacoesNeutras: neutras,
      avaliacoesNegativas: negativas,
      notasCinco: person.notas.filter(nota => nota === 5).length,
      percentualPositivas: Number((positividade * 100).toFixed(1)),
      score: Number(score.toFixed(1)),
      atendimentosWhatsapp: attendance.whatsapp,
      chamadosExternos: attendance.externos,
      totalAtendimentos,
      percentualCobertura: Number(percentualCobertura.toFixed(1)),
      avaliacoesNecessarias: Math.max(MIN_AVALIACOES_RANKING, avaliacoesNecessarias),
      faltamAvaliacoes,
      elegivelRanking,
      status: (elegivelRanking ? 'META_ATINGIDA' : 'EM_QUALIFICACAO') as SatisfactionRankEntry['status'],
    };
  }).sort((a, b) =>
    Number(b.elegivelRanking) - Number(a.elegivelRanking) ||
    b.score - a.score ||
    b.totalAvaliacoes - a.totalAvaliacoes ||
    b.media - a.media ||
    b.notasCinco - a.notasCinco ||
    a.avaliacoesNegativas - b.avaliacoesNegativas ||
    a.nome.localeCompare(b.nome, 'pt-BR')
  );
}
