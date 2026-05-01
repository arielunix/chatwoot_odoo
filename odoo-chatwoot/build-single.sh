#!/bin/bash

# ================= SCRIPT COMPLETO PARA CONSTRUIR IMAGEN ÚNICA =================
# Este script construye la imagen Docker única que incluye backend y frontend

set -e

echo "🚀 Iniciando construcción de imagen única..."

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor instálalo primero."
    exit 1
fi

# Verificar que existan los archivos necesarios
if [ ! -f "./Dockerfile" ]; then
    echo "❌ Dockerfile no encontrado en la raíz del proyecto."
    exit 1
fi

if [ ! -f "./start.sh" ]; then
    echo "❌ start.sh no encontrado en la raíz del proyecto."
    exit 1
fi

if [ ! -f "./nginx-easypanel.conf" ]; then
    echo "❌ nginx-easypanel.conf no encontrado en la raíz del proyecto."
    exit 1
fi

if [ ! -f "./backend/.env" ]; then
    echo "⚠️  backend/.env no encontrado. Creando archivo de ejemplo..."
    cat > ./backend/.env << EOF
# Backend Environment Variables
ODOO_URL=https://your-odoo-instance.com
ODOO_DB=your_database
ODOO_USERNAME=your_username
ODOO_PASSWORD=your_password
PORT=3001
EOF
    echo "⚠️  Por favor configura backend/.env con tus credenciales de Odoo"
fi

if [ ! -f "./frontend/.env" ]; then
    echo "⚠️  frontend/.env no encontrado. Creando archivo de ejemplo..."
    cat > ./frontend/.env << EOF
# Frontend Environment Variables
VITE_API_URL=http://localhost:3001
EOF
    echo "⚠️  Por favor configura frontend/.env con la URL de tu API"
fi

# Nombre de la imagen
IMAGE_NAME="odoo-chatwoot-single"
IMAGE_TAG="${1:-latest}"

echo "📦 Construyendo imagen: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "⏳ Esto puede tardar varios minutos..."

# Construir la imagen
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

echo "✅ Imagen construida exitosamente!"
echo "📦 Imagen: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "🚀 Para ejecutar el contenedor:"
echo "  docker run -d \\"
echo "    -p 80:80 \\"
echo "    -p 3001:3001 \\"
echo "    --env-file ./backend/.env \\"
echo "    --name odoo-chatwoot \\"
echo "    ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "🌐 Frontend: http://localhost"
echo "🔌 Backend: http://localhost:3001"
echo ""
echo "📋 Para ver logs:"
echo "  docker logs -f odoo-chatwoot"
echo ""
echo "🛑 Para detener:"
echo "  docker stop odoo-chatwoot"
echo "  docker rm odoo-chatwoot"
