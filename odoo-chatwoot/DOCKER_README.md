# Docker Deployment Guide - Odoo-Chatwoot

Este proyecto tiene dos opciones de despliegue con Docker:

## 📦 Opción 1: Múltiples Contenedores (Recomendado)

Esta opción usa `docker-compose` para ejecutar el backend y el frontend en contenedores separados. Es la opción más flexible y sigue las mejores prácticas de Docker.

### Estructura
- `backend/Dockerfile` - Contenedor del backend (Node.js + Express)
- `frontend/Dockerfile` - Contenedor del frontend (React + Nginx)
- `docker-compose.yml` - Orquestación de servicios

### Despliegue

```bash
# Dar permisos de ejecución al script
chmod +x deploy.sh

# Desplegar
./deploy.sh deploy

# Ver logs
./deploy.sh logs

# Detener
./deploy.sh stop

# Limpiar
./deploy.sh clean
```

### Puertos
- Frontend: `http://localhost:80`
- Backend: `http://localhost:3001`

## 🐳 Opción 2: Single Container (Para EasyPanel)

Esta opción combina backend y frontend en un solo contenedor. Es útil para plataformas como EasyPanel que limitan el número de contenedores.

### Estructura
- `Dockerfile` - Contenedor único que incluye backend y frontend
- `start.sh` - Script para iniciar ambos servicios
- `nginx-easypanel.conf` - Configuración de nginx

### Despliegue Manual

```bash
# Construir imagen
docker build -t odoo-chatwoot-single .

# Ejecutar contenedor
docker run -d \
  -p 80:80 \
  -p 3001:3001 \
  --env-file ./backend/.env \
  --name odoo-chatwoot \
  odoo-chatwoot-single
```

## 🚀 Subir a Docker Hub

Para subir la imagen a Docker Hub con etiquetas de fecha:

```bash
# Configurar tu usuario en push-to-dockerhub.sh
# Editar: DOCKER_USERNAME="tu-usuario-dockerhub"

# Dar permisos de ejecución
chmod +x push-to-dockerhub.sh

# Loguearse en Docker Hub
docker login

# Subir imagen
./push-to-dockerhub.sh
```

El script creará tres etiquetas:
- `YYYY-MM-DD` - Etiqueta de fecha
- `YYYY-MM-DD-HHMM` - Etiqueta con fecha y hora
- `latest` - Etiqueta para la versión más reciente

### Variables de Entorno

El contenedor único necesita las mismas variables de entorno que el backend:

```env
# Backend Environment Variables
ODOO_URL=https://your-odoo-instance.com
ODOO_DB=your_database
ODOO_USERNAME=your_username
ODOO_PASSWORD=your_password
PORT=3001
```

## 🔧 Configuración

### Backend (.env)
```env
ODOO_URL=https://your-odoo-instance.com
ODOO_DB=your_database
ODOO_USERNAME=your_username
ODOO_PASSWORD=your_password
PORT=3001
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
```

## 📊 Comparación de Opciones

| Característica | Múltiples Contenedores | Single Container |
|----------------|------------------------|------------------|
| Flexibilidad | ✅ Alta | ❌ Baja |
| Escalabilidad | ✅ Independiente | ❌ Conjunta |
| Facilidad de despliegue | ⚠️ Requiere docker-compose | ✅ Simple |
| Compatibilidad EasyPanel | ⚠️ Puede requerir configuración | ✅ Directa |
| Mejores prácticas | ✅ Sigue estándares | ⚠️ No recomendado para producción |

## 🚀 Para EasyPanel

Para desplegar en EasyPanel usando el contenedor único:

1. **Subir el código**: Sube todo el proyecto al servidor
2. **Configurar variables de entorno**: Añade las variables del backend
3. **Usar el Dockerfile único**: EasyPanel detectará automáticamente el Dockerfile en la raíz
4. **Configurar puertos**: Asegúrate de exponer los puertos 80 y 3001

### Configuración de EasyPanel

```yaml
type: docker
dockerfile: ./Dockerfile
ports:
  - "80:80"
  - "3001:3001"
env:
  - ODOO_URL=https://your-odoo-instance.com
  - ODOO_DB=your_database
  - ODOO_USERNAME=your_username
  - ODOO_PASSWORD=your_password
  - PORT=3001
```

## ⚠️ Notas Importantes

- El contenedor único usa nginx como proxy inverso para redirigir las peticiones de API al backend
- Ambos servicios (nginx y node) corren en el mismo contenedor
- Para producción, se recomienda usar la opción de múltiples contenedores
- Asegúrate de configurar correctamente las variables de entorno antes del despliegue

## 🔍 Solución de Problemas

### Frontend no carga
- Verifica que el puerto 80 esté disponible
- Revisa los logs del contenedor: `docker logs odoo-chatwoot`

### Backend no responde
- Verifica las credenciales de Odoo en el .env
- Revisa los logs del backend
- Asegúrate de que el puerto 3001 esté disponible

### Error de conexión
- Verifica que el frontend pueda conectar con el backend
- En el contenedor único, usa `localhost:3001` para la URL de la API
- En múltiples contenedores, usa el nombre del servicio: `http://backend:3001`
