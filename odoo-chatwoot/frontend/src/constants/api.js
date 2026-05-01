export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const MODULES = {
  CONTACTO: "contacto",
  VENTAS: "ventas",
  LEADS: "leads",
};

export const QUOTE_STATES = {
  draft: { bg: "#e9ecef", text: "#495057", label: "Borrador" },
  sent: { bg: "#cfe2ff", text: "#084298", label: "Enviado" },
  sale: { bg: "#d1e7dd", text: "#0f5132", label: "Orden de Venta" },
  done: { bg: "#d1e7dd", text: "#0f5132", label: "Bloqueado" },
  cancel: { bg: "#f8d7da", text: "#842029", label: "Cancelado" },
};

export const CHATWOOT_CONFIG = {
  BASE_URL: import.meta.env.VITE_CHATWOOT_URL,
  ACCOUNT_ID: import.meta.env.VITE_CHATWOOT_ACCOUNT_ID,
  API_ACCESS_TOKEN: import.meta.env.VITE_CHATWOOT_API_TOKEN,
};
