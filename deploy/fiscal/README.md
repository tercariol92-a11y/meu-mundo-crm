# Serviço fiscal independente

Configuração preparada para um novo serviço `meu-mundo-fiscal`. Não reutilizar o serviço, domínio, volume ou variáveis do WhatsApp.

- Build: `npm ci && npm run build:fiscal`
- Start: `npm run start:fiscal`
- Healthcheck: `/health`
- Volume privado exclusivo: `/data/fiscal-private`
- `FISCAL_CERTIFICATE_STORAGE_PATH=/data/fiscal-private`
- `FISCAL_CERTIFICATE_ENCRYPTION_KEY`: chave Base64 de 32 bytes, exclusiva do cofre A1 e mantida somente nas variáveis protegidas do serviço fiscal.
- Variáveis: copiar somente os nomes de `.env.fiscal.example`
- Rede: expor domínio exclusivo; permitir as rotas internas somente pelo proxy autenticado do CRM.

Produção permanece bloqueada por `FISCAL_ENVIRONMENT=producao_restrita` e `FISCAL_PRODUCTION_ENABLED=false`.
