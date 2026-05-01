#!/bin/bash

# ================= SCRIPT DE DESPLIEGUE DOCKER =================
# Este script construye y despliega el proyecto usando Docker Compose

set -e

echo "🚀 Iniciando despliegue de Odoo-Chatwoot..."

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor instálalo primero."
    exit 1
fi

# Verificar si Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado. Por favor instálalo primero."
    exit 1
fi

# Verificar que existan los archivos .env
if [ ! -f "./backend/.env" ]; then
    echo "⚠️  Archivo backend/.env no encontrado. Creando archivo de ejemplo..."
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
    echo "⚠️  Archivo frontend/.env no encontrado. Creando archivo de ejemplo..."
    cat > ./frontend/.env << EOF
# Frontend Environment Variables
VITE_API_URL=http://localhost:3001
EOF
    echo "⚠️  Por favor configura frontend/.env con la URL de tu API"
fi

# Opciones de despliegue
case "${1:-deploy}" in
    deploy)
        echo "📦 Construyendo imágenes Docker..."
        docker-compose build
        
        echo "🚀 Iniciando contenedores..."
        docker-compose up -d
        
        echo "✅ Despliegue completado!"
        echo "🌐 Frontend: http://localhost"
        echo "🔌 Backend: http://localhost:3001"
        ;;
    
    stop)
        echo "🛑 Deteniendo contenedores..."
        docker-compose down
        echo "✅ Contenedores detenidos"
        ;;
    
    restart)
        echo "🔄 Reiniciando contenedores..."
        docker-compose restart
        echo "✅ Contenedores reiniciados"
        ;;
    
    logs)
        echo "📋 Mostrando logs..."
        docker-compose logs -f
        ;;
    
    clean)
        echo "🧹 Limpiando contenedores e imágenes..."
        docker-compose down -v --rmi all --remove-orphans
        echo "✅ Limpieza completada"
        ;;
    
    *)
        echo "Uso: $0 {deploy|stop|restart|logs|clean}"
        echo ""
        echo "Comandos:"
        echo "  deploy  - Construir e iniciar contenedores"
        echo "  stop    - Detener contenedores"
        echo "  restart - Reiniciar contenedores"
        echo "  logs    - Mostrar logs en tiempo real"
        echo "  clean   - Eliminar contenedores e imágenes"
        exit 1
        ;;
esac
