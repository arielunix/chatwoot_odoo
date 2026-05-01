# ================= BACKEND DOCKERFILE =================
FROM node:18-alpine

WORKDIR /app

# Copiar package.json y package-lock.json primero para mejor caché
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Exponer puerto
EXPOSE 3001

# Comando de inicio
CMD ["npm", "start"]
