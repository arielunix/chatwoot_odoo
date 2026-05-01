#!/bin/bash

# ================= SCRIPT COMBINADO: CONSTRUIR Y SUBIR =================
# Autor: Ariel
# Este script construye la imagen y la sube a Docker Hub con etiquetas de fecha

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
DOCKER_USERNAME="arielunix"
DOCKER_EMAIL="arielunix@gmail.com"
IMAGE_NAME="odoo-adapater"
LOCAL_IMAGE_NAME="odoo-chatwoot-single"

# Generar etiqueta de fecha (YYYY-MM-DD)
DATE_TAG=$(date +%Y-%m-%d)

# Etiqueta latest
LATEST_TAG="latest"

# Nombre completo de la imagen
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"

echo -e "${BLUE}🚀 Script Combinado: Construir y Subir a Docker Hub${NC}"
echo "================================================"
echo "Usuario Docker Hub: ${DOCKER_USERNAME}"
echo "Email: ${DOCKER_EMAIL}"
echo "Imagen local: ${LOCAL_IMAGE_NAME}"
echo "Imagen remota: ${FULL_IMAGE_NAME}"
echo "================================================"
echo ""

# ================= PARTE 1: CONSTRUIR IMAGEN =================
echo -e "${YELLOW}📦 PARTE 1: Construyendo imagen Docker...${NC}"
echo ""

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado. Por favor instálalo primero.${NC}"
    exit 1
fi

# Verificar que existan los archivos necesarios
if [ ! -f "./Dockerfile" ]; then
    echo -e "${RED}❌ Dockerfile no encontrado en la raíz del proyecto.${NC}"
    exit 1
fi

if [ ! -f "./start.sh" ]; then
    echo -e "${RED}❌ start.sh no encontrado en la raíz del proyecto.${NC}"
    exit 1
fi

if [ ! -f "./nginx-easypanel.conf" ]; then
    echo -e "${RED}❌ nginx-easypanel.conf no encontrado en la raíz del proyecto.${NC}"
    exit 1
fi

if [ ! -f "./backend/.env" ]; then
    echo -e "${YELLOW}⚠️  backend/.env no encontrado. Creando archivo de ejemplo...${NC}"
    cat > ./backend/.env << EOF
# Backend Environment Variables
ODOO_URL=https://your-odoo-instance.com
ODOO_DB=your_database
ODOO_USERNAME=your_username
ODOO_PASSWORD=your_password
PORT=3001
EOF
    echo -e "${YELLOW}⚠️  Por favor configura backend/.env con tus credenciales de Odoo${NC}"
fi

if [ ! -f "./frontend/.env" ]; then
    echo -e "${YELLOW}⚠️  frontend/.env no encontrado. Creando archivo de ejemplo...${NC}"
    cat > ./frontend/.env << EOF
# Frontend Environment Variables
VITE_API_URL=http://localhost:3001
EOF
    echo -e "${YELLOW}⚠️  Por favor configura frontend/.env con la URL de tu API${NC}"
fi

echo -e "${YELLOW}🔨 Construyendo imagen: ${LOCAL_IMAGE_NAME}:${LATEST_TAG}${NC}"
echo -e "${YELLOW}⏳ Esto puede tardar varios minutos...${NC}"
echo ""

# Construir la imagen
docker build -t ${LOCAL_IMAGE_NAME}:${LATEST_TAG} .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Imagen construida exitosamente!${NC}"
else
    echo -e "${RED}❌ Error al construir la imagen${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}📦 Imagen: ${LOCAL_IMAGE_NAME}:${LATEST_TAG}${NC}"
echo ""

# ================= PARTE 2: SUBIR A DOCKER HUB =================
echo -e "${YELLOW}📤 PARTE 2: Subiendo a Docker Hub...${NC}"
echo ""

# Verificar que Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker no está corriendo${NC}"
    exit 1
fi

# Login a Docker Hub
echo -e "${YELLOW}🔐 Iniciando sesión en Docker Hub...${NC}"
echo "   Usuario: ${DOCKER_USERNAME}"
echo ""

# Intentar login
if docker login -u ${DOCKER_USERNAME}; then
    echo -e "${GREEN}✅ Login exitoso${NC}"
    echo ""
else
    echo -e "${RED}❌ Error al iniciar sesión en Docker Hub${NC}"
    exit 1
fi

# Taggear la imagen con las etiquetas
echo -e "${YELLOW}🏷️  Taggeando imagen con etiquetas...${NC}"
docker tag ${LOCAL_IMAGE_NAME}:${LATEST_TAG} ${FULL_IMAGE_NAME}:${DATE_TAG}
docker tag ${LOCAL_IMAGE_NAME}:${LATEST_TAG} ${FULL_IMAGE_NAME}:${LATEST_TAG}

# Subir las imágenes
echo -e "${YELLOW}📤 Subiendo imagen con etiqueta de fecha (${DATE_TAG})...${NC}"
docker push ${FULL_IMAGE_NAME}:${DATE_TAG}

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Imagen ${DATE_TAG} subida exitosamente${NC}"
else
    echo -e "${RED}❌ Error al subir la imagen ${DATE_TAG}${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📤 Subiendo imagen con etiqueta latest...${NC}"
docker push ${FULL_IMAGE_NAME}:${LATEST_TAG}

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Imagen latest subida exitosamente${NC}"
else
    echo -e "${RED}❌ Error al subir la imagen latest${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 ¡Proceso completado exitosamente!${NC}"
echo ""
echo "Imágenes subidas:"
echo -e "${BLUE}  - ${FULL_IMAGE_NAME}:${DATE_TAG}${NC}"
echo -e "${BLUE}  - ${FULL_IMAGE_NAME}:${LATEST_TAG}${NC}"
echo ""
echo "Tu imagen está disponible en:"
echo -e "${BLUE}  https://hub.docker.com/r/${FULL_IMAGE_NAME}${NC}"
echo ""
echo "Para descargar la imagen:"
echo "  docker pull ${FULL_IMAGE_NAME}:${DATE_TAG}"
echo ""
echo "Para ejecutar el contenedor:"
echo "  docker run -d \\"
echo "    -p 80:80 \\"
echo "    -p 3001:3001 \\"
echo "    --env-file ./backend/.env \\"
echo "    --name odoo-adapater \\"
echo "    ${FULL_IMAGE_NAME}:${DATE_TAG}"
