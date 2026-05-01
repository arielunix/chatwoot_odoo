#!/bin/bash

# ================= SCRIPT PARA CONSTRUIR IMAGEN BACKEND =================

set -e

echo "🚀 Construyendo imagen del backend..."

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado."
    exit 1
fi

cd backend

IMAGE_NAME="arielunix/odoo-adapater-backend"
TAG="${1:-latest}"

echo "📦 Construyendo: ${IMAGE_NAME}:${TAG}"
docker build -t ${IMAGE_NAME}:${TAG} .

echo "✅ Imagen backend construida: ${IMAGE_NAME}:${TAG}"
