export const MIN_AVALIACOES_RANKING = 10;
export const META_VOLUME_RANKING = 30;

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
  elegivelRanking: boolean;
  status: 'META_ATINGIDA' | 'EM_QUALIFICACAO';
};

const normalizedKey = (id: string | undefined, name: string | undefined) =>
  String(id || name || '').trim().toLocaleLowerCase('pt-BR');

export function calculateSatisfactionRanking(
  reviews: SatisfactionReviewForRanking[],
  role: 'atendente' | 'tecnico',
): SatisfactionRankEntry[] {
  const grouped = new Map<string, { id: string; nome: string; notas: number[] }>();
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
    const media = person.notas.reduce((sum, nota) => sum + nota, 0) / total;
    const positividade = positivas / total;
    const taxaNegativas = negativas / total;
    const scoreBase = (media / 5 * 0.5) + (Math.min(total / META_VOLUME_RANKING, 1) * 0.3) + (positividade * 0.2);
    const score = Math.max(0, Math.min(100, scoreBase * 100 - taxaNegativas * 15));
    const elegivelRanking = total >= MIN_AVALIACOES_RANKING;
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
