FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts/patch-baileys-profile-picture.cjs ./scripts/patch-baileys-profile-picture.cjs
RUN npm ci

COPY . .
RUN test -s server/fiscal/certificates/icp-brasil/2026-07-13/icp-brasil-bundle.pem
RUN npm run build:fiscal

ENV NODE_ENV=production
EXPOSE 3002

CMD ["npm", "run", "start:fiscal"]
