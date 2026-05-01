#!/bin/bash

# ================= SCRIPT PARA SUBIR FRONTEND A DOCKER HUB =================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
DOCKER_USERNAME="arielunix"
IMAGE_NAME="odoo-adapater-frontend"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"

# Generar etiqueta de fecha
DATE_TAG=$(date +%Y-%m-%d)

echo -e "${BLUE}🚀 Subiendo frontend a Docker Hub${NC}"
echo "Imagen: ${FULL_IMAGE_NAME}"
echo ""

# Login
echo -e "${YELLOW}🔐 Login Docker Hub...${NC}"
docker login -u ${DOCKER_USERNAME}

# Taggear
echo -e "${YELLOW}🏷️  Taggeando...${NC}"
docker tag ${FULL_IMAGE_NAME}:latest ${FULL_IMAGE_NAME}:${DATE_TAG}

# Subir
echo -e "${YELLOW}📤 Subiendo...${NC}"
docker push ${FULL_IMAGE_NAME}:${DATE_TAG}
docker push ${FULL_IMAGE_NAME}:latest

echo -e "${GREEN}✅ Frontend subido exitosamente${NC}"
echo "Imágenes:"
echo "  - ${FULL_IMAGE_NAME}:${DATE_TAG}"
echo "  - ${FULL_IMAGE_NAME}:latest"
