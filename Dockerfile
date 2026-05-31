FROM node:20-alpine
WORKDIR /app

# ---- Frontend ----
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ---- Backend ----
COPY backend/package*.json ./backend/
RUN cd backend && npm ci
COPY backend/ ./backend/
RUN cd backend && npm run build
# postbuild copies frontend/dist → backend/dist/public automatically

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
