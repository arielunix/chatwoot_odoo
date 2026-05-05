# ================= FRONTEND DOCKERFILE =================
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json primero para mejor caché
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Build del proyecto
RUN npm run build

# Production stage
FROM nginx:alpine

# Copiar el build al directorio de nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración personalizada de nginx
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Definir variable de entorno por defecto
ENV BACKEND_URL=https://odooapi.tulogica.com

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
