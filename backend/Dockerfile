FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---

FROM node:22-alpine AS runtime

RUN addgroup -S gridnode && adduser -S gridnode -G gridnode

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --frozen-lockfile

COPY --from=builder /app/dist ./dist

USER gridnode

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
