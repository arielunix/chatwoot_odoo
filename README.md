# 🚀 Chatwoot + Odoo Adapter

Integración moderna entre **Chatwoot** y **Odoo** para centralizar atención al cliente, ventas y facturación en tiempo real.

<img width="1440" height="770" alt="CHATWOOT-ODOO-1-Miniatura" src="https://github.com/user-attachments/assets/be3749a1-46b6-4891-8ae3-34827b61a047" />

---

## 🎥 Demo del proyecto

▶️ Video completo del funcionamiento:

https://www.youtube.com/watch?v=RBTXwxnvu84

---

## 📌 Stack tecnológico

- **Backend:** Go + Fiber  
- **Frontend:** React  
- **ERP:** Odoo  
- **CRM / Atención:** Chatwoot  
- **Comunicación:** REST API + Webhooks  
- **Arquitectura:** Middleware / Microservicio  

---

## ⚙️ Funcionalidades principales

### 👤 Gestión de contactos

- Sincronización automática entre Odoo y Chatwoot  
- Creación automática de contactos desde conversaciones entrantes  
- Actualización bidireccional de información  
- Asociación automática de clientes y conversaciones  

---

### 💼 Módulo comercial

- Generación de cotizaciones desde Chatwoot  
- Relación entre conversaciones y oportunidades de venta  
- Seguimiento del estado comercial en tiempo real  
- Flujo automatizado de atención → venta  

---

### 🧾 Facturación

- Creación de facturas desde cotizaciones en Odoo  
- Consulta del estado de pago:
  - Pendiente
  - Parcial
  - Pagado

- Trazabilidad completa:

```text
Cliente → Conversación → Cotización → Factura
```

---

## 🔄 Flujo de integración

1. El cliente envía un mensaje en Chatwoot  
2. El middleware detecta o crea el contacto en Odoo  
3. Se genera una oportunidad o cotización automáticamente *(en desarrollo)*  
4. La cotización puede convertirse en factura  
5. El estado se sincroniza en Chatwoot y el dashboard  

---

## 🎯 Objetivo del proyecto

Centralizar operaciones comerciales y de soporte en una sola plataforma, eliminando procesos manuales y conectando atención al cliente, ventas y facturación en tiempo real.

---

## 🚀 Beneficios

- Automatización de procesos comerciales  
- Reducción de trabajo manual  
- Visibilidad completa del ciclo del cliente  
- Escalable como SaaS multiempresa  
- Integración flexible mediante APIs y Webhooks  
- Arquitectura desacoplada y fácil de extender  

---

## 📦 Estado actual del proyecto

| Módulo | Estado |
|---|---|
| Integración base con Chatwoot | ✔️ |
| Conexión con Odoo | ✔️ |
| Gestión de contactos | ✔️ |
| Cotizaciones automáticas | ⚙️ En progreso |
| Facturación | ⚙️ En desarrollo |
| Dashboard React | 🚧 En construcción |

---

## 🧠 Próximas mejoras

### 🔄 Integraciones
- Webhooks bidireccionales avanzados  
- Gestión de leads y oportunidades  
- Integración con proyectos y tareas  

### 🤖 Inteligencia Artificial
- Generación automática de:
  - oportunidades
  - cotizaciones
  - respuestas desde el chat
  - resúmenes de conversaciones

### ⚡ Automatización
- Flujo comercial completamente automatizado desde conversaciones  
- Reglas automáticas según etiquetas o mensajes  
- Asignación inteligente de clientes y ventas  

---

## 👥 Comunidad

### Grupo de WhatsApp para desarrollo y soporte

https://chat.whatsapp.com/L0PlKIfGjAC7Ba0IClLe60

---

## 📌 Enfoque del proyecto

Este adaptador busca convertir Chatwoot en una interfaz comercial conectada directamente con Odoo, permitiendo administrar clientes, ventas y facturación desde conversaciones en tiempo real.

---

## ⭐ Tecnologías utilizadas

```text
Go • Fiber • React • Odoo • Chatwoot • Docker • REST API • Webhooks
```
