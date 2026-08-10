export type SimpleNationalSituation = '1' | '2' | '3';

export interface SimpleNationalCompetenceConfig {
  situacaoSimplesNacional?: SimpleNationalSituation;
  situacaoSimplesNacionalCompetencia?: string;
}

export function resolveSimpleNationalSituation(
  config: SimpleNationalCompetenceConfig,
  competenceDate: string,
): SimpleNationalSituation {
  const competenceMonth = String(competenceDate || '').slice(0, 7);
  const configuredMonth = String(config.situacaoSimplesNacionalCompetencia || '').trim();
  const situation = config.situacaoSimplesNacional;

  if (!/^\d{4}-\d{2}$/.test(competenceMonth)) {
    throw new Error('Competência da DPS inválida.');
  }

  if (situation !== '1' && situation !== '2' && situation !== '3') {
    throw new Error(
      `Confirme a situação oficial no Simples Nacional para a competência ${competenceMonth}: 1 Não Optante, 2 MEI ou 3 ME/EPP.`,
    );
  }

  if (configuredMonth !== competenceMonth) {
    throw new Error(
      `A situação do Simples Nacional cadastrada pertence à competência ${configuredMonth || 'não informada'}, mas a DPS usa ${competenceMonth}. Consulte a situação oficial desse mês.`,
    );
  }

  return situation;
}
