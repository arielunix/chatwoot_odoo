#!/bin/bash

# ================= SCRIPT PARA SUBIR A DOCKER HUB =================
# Autor: Ariel
# Este script construye y sube la imagen a Docker Hub con etiquetas de fecha

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

# Generar etiqueta de fecha (YYYY-MM-DD)
DATE_TAG=$(date +%Y-%m-%d)

# Etiqueta latest
LATEST_TAG="latest"

# Nombre completo de la imagen
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"

echo -e "${BLUE}🚀 Subiendo imagen Docker a Docker Hub${NC}"
echo "================================================"
echo "Usuario Docker Hub: ${DOCKER_USERNAME}"
echo "Email: ${DOCKER_EMAIL}"
echo "Imagen: ${FULL_IMAGE_NAME}"
echo "================================================"
echo ""

# Verificar que Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker no está corriendo${NC}"
    exit 1
fi

# Verificar que la imagen local existe
if ! docker images odoo-chatwoot-single:latest | grep -q odoo-chatwoot-single; then
    echo -e "${RED}❌ Error: La imagen local odoo-chatwoot-single:latest no existe${NC}"
    echo "   Primero construye la imagen con: ./build-single.sh"
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
docker tag odoo-chatwoot-single:latest ${FULL_IMAGE_NAME}:${DATE_TAG}
docker tag odoo-chatwoot-single:latest ${FULL_IMAGE_NAME}:${LATEST_TAG}

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
