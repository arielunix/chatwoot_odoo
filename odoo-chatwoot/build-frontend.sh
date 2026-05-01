#!/bin/bash

# ================= SCRIPT PARA CONSTRUIR IMAGEN FRONTEND =================

set -e

echo "🚀 Construyendo imagen del frontend..."

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado."
    exit 1
fi

cd frontend

IMAGE_NAME="arielunix/odoo-adapater-frontend"
TAG="${1:-latest}"

echo "📦 Construyendo: ${IMAGE_NAME}:${TAG}"
docker build -t ${IMAGE_NAME}:${TAG} .

echo "✅ Imagen frontend construida: ${IMAGE_NAME}:${TAG}"
