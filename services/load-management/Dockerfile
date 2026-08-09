# BC Charge Load-Management service
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# Dev deps needed for tsc build
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production \
    HEALTH_PORT=3001 \
    PRICING_API_PORT=3003 \
    DEEP_LINK_STORE_PATH=/app/data/deep-link-tokens.json \
    BILLING_EXPORT_DIR=/app/exports

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data /app/exports

EXPOSE 3001 3003

CMD ["node", "dist/index.js"]