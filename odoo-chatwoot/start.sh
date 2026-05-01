#!/bin/sh

# ================= START SCRIPT PARA SINGLE CONTAINER =================
# Inicia nginx (frontend) y el backend en el mismo contenedor

# Iniciar backend en segundo plano
cd /app/backend && node server.js &

# Iniciar nginx (frontend)
nginx -g 'daemon off;'
