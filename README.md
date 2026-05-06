# chatwoot Odoo
Adaptador de odoo mas chatwoot

🚀 Odoo + Chatwoot Adapter (Fiber + React)

Middleware e interfaz para integrar Odoo ERP con Chatwoot, centralizando la gestión de contactos, ventas y facturación en un solo flujo operativo.

Este proyecto actúa como una capa de integración entre sistemas comerciales y de atención al cliente, permitiendo automatización y sincronización de datos en tiempo real.

📌 Stack tecnológico
Backend: Go + Fiber
Frontend: React
ERP: Odoo
API: REST + Webhooks
Arquitectura: Microservicio / Middleware
⚙️ Características principales
👤 Gestión de contactos
Sincronización automática entre Odoo y Chatwoot
Creación de contactos desde conversaciones entrantes
Actualización de datos en ambos sistemas (en desarrollo)
💼 Módulo de ventas
Generación de cotizaciones desde Chatwoot
Asociación de conversaciones con oportunidades de venta
Seguimiento del estado comercial en tiempo real
🧾 Facturación
Creación de facturas en Odoo desde cotizaciones
Consulta de estado de pagos (pendiente, parcial, pagado)
Trazabilidad completa cliente → venta → factura
🔄 Flujo de integración
Cliente envía mensaje en Chatwoot
El middleware detecta o crea el contacto en Odoo
Se genera oportunidad o cotización automáticamente
Se puede convertir en factura desde Odoo
Estado se refleja en Chatwoot / dashboard React
🧠 Arquitectura
Chatwoot ↔ Middleware (Go Fiber) ↔ Odoo ERP
                         ↓
                    React Dashboard
🎯 Objetivo del proyecto

Centralizar la operación comercial y de soporte en un solo sistema, eliminando procesos manuales y conectando ventas, atención al cliente y facturación en tiempo real.

🚀 Beneficios
Automatización de procesos comerciales
Reducción de carga operativa manual
Visibilidad completa del ciclo del cliente
Escalable para SaaS multiempresa
Integración flexible mediante APIs
📦 Estado del proyecto
✔️ Integración base Chatwoot
✔️ Conexión con Odoo
⚙️ Módulo de ventas en evolución
⚙️ Facturación en progreso
🚧 Dashboard React en desarrollo
📌 Próximas mejoras
Webhooks avanzados bidireccionales
Desarrollo de modulo Leads 
Tareas 
proyectos
IA generacion de oportunidades,cotizaciones desde el chat automatico

