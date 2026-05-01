#!/bin/bash

# ================= SCRIPT COMBINADO: CONSTRUIR Y SUBIR BACKEND GO =================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
DOCKER_USERNAME="arielunix"
IMAGE_NAME="odoo-adapater-backend"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"
DATE_TAG=$(date +%Y-%m-%d)

echo -e "${BLUE}🚀 Script Backend Go: Construir y Subir${NC}"
echo "Imagen: ${FULL_IMAGE_NAME}"
echo ""

# ================= CONSTRUIR =================
echo -e "${YELLOW}📦 PARTE 1: Construyendo backend Go...${NC}"
cd backend
docker build -t ${FULL_IMAGE_NAME}:latest .
cd ..
echo -e "${GREEN}✅ Backend Go construido${NC}"
echo ""

# ================= SUBIR =================
echo -e "${YELLOW}📤 PARTE 2: Subiendo a Docker Hub...${NC}"
docker login -u ${DOCKER_USERNAME}

docker tag ${FULL_IMAGE_NAME}:latest ${FULL_IMAGE_NAME}:${DATE_TAG}

docker push ${FULL_IMAGE_NAME}:${DATE_TAG}
docker push ${FULL_IMAGE_NAME}:latest

echo -e "${GREEN}✅ Backend Go subido exitosamente${NC}"
echo "Imágenes:"
echo "  - ${FULL_IMAGE_NAME}:${DATE_TAG}"
echo "  - ${FULL_IMAGE_NAME}:latest"
