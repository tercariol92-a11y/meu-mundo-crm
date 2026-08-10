# Serviço fiscal independente

Configuração preparada para um novo serviço `meu-mundo-fiscal`. Não reutilizar o serviço, domínio, volume ou variáveis do WhatsApp.

- Build: `npm ci && npm run build:fiscal`
- Start: `npm run start:fiscal`
- Healthcheck: `/health`
- Volume privado exclusivo: `/data/fiscal-private`
- Variáveis: copiar somente os nomes de `.env.fiscal.example`
- Rede: expor domínio exclusivo; permitir as rotas internas somente pelo proxy autenticado do CRM.

Produção permanece bloqueada por `FISCAL_ENVIRONMENT=producao_restrita` e `FISCAL_PRODUCTION_ENABLED=false`.
