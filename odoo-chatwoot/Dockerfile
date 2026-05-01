# ================= SINGLE CONTAINER DOCKERFILE PARA EASYPANEL =================
# Este Dockerfile combina backend y frontend en un solo contenedor

FROM node:20-alpine

WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache nginx

# Copiar archivos del backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

COPY backend/ ./backend/

# Copiar archivos del frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/

# Build del frontend
RUN cd frontend && npm run build

# Configurar nginx para Alpine
RUN mkdir -p /etc/nginx/conf.d
COPY nginx-easypanel.conf /etc/nginx/conf.d/default.conf

# Copiar build de frontend a nginx
RUN cp -r frontend/dist /usr/share/nginx/html

# Exponer puertos
EXPOSE 80 3001

# Script de inicio
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
