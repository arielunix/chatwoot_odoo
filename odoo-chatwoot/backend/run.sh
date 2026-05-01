#!/bin/bash

# Script para ejecutar el backend de Go

cd "$(dirname "$0")"

echo "🚀 Iniciando backend de Go..."

# Verificar si existe el binario
if [ ! -f "./main" ]; then
    echo "📦 Construyendo el backend..."
    go build -o main ./cmd/server
fi

# Ejecutar el backend
./main
