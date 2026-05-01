const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Servicio para interactuar con Odoo
export const odooService = {
  // Buscar cliente por teléfono o email
  searchCustomer: async (phone, email) => {
    const response = await fetch(`${API_URL}/odoo/customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, email }),
    });
    return response.json();
  },

  // Crear nuevo cliente
  createCustomer: async (customerData) => {
    const response = await fetch(`${API_URL}/odoo/create-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customerData),
    });
    return response.json();
  },

  // Listar productos
  getProducts: async () => {
    const response = await fetch(`${API_URL}/odoo/products`);
    return response.json();
  },

  // Crear presupuesto
  createQuote: async (partnerId, orderLines, note = "") => {
    const response = await fetch(`${API_URL}/odoo/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partner_id: partnerId,
        order_lines: orderLines,
        note: note,
      }),
    });
    return response.json();
  },

  // Obtener cotizaciones de un cliente
  getQuotes: async (partnerId) => {
    const response = await fetch(`${API_URL}/odoo/quotes/${partnerId}`);
    return response.json();
  },

  // Obtener detalle de cotización
  getQuoteDetail: async (quoteId) => {
    const response = await fetch(`${API_URL}/odoo/quote/${quoteId}`);
    return response.json();
  },

  // Modificar cotización
  updateQuote: async (quoteId, data) => {
    const response = await fetch(`${API_URL}/odoo/quote/${quoteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  // Crear factura desde cotización
  createInvoice: async (quoteId) => {
    const response = await fetch(`${API_URL}/odoo/quote/${quoteId}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return response.json();
  },

  // Verificar si cotización tiene factura
  checkInvoiceStatus: async (quoteId) => {
    const response = await fetch(`${API_URL}/odoo/quote/${quoteId}/invoice-status`);
    return response.json();
  },

  // Obtener detalle de factura
  getInvoiceDetail: async (invoiceId) => {
    const response = await fetch(`${API_URL}/odoo/invoice/${invoiceId}`);
    return response.json();
  },

  // Registrar pago de factura
  registerPayment: async (invoiceId, amount, journalId, paymentMethodId) => {
    const response = await fetch(`${API_URL}/odoo/invoice/${invoiceId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, journal_id: journalId, payment_method_id: paymentMethodId }),
    });
    return response.json();
  },

  // Obtener diarios disponibles
  getJournals: async () => {
    const response = await fetch(`${API_URL}/odoo/journals`);
    return response.json();
  },

  // Obtener métodos de pago disponibles
  getPaymentMethods: async () => {
    const response = await fetch(`${API_URL}/odoo/payment-methods`);
    return response.json();
  },

  // Crear lead
  createLead: async (leadData) => {
    const response = await fetch(`${API_URL}/odoo/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadData),
    });
    return response.json();
  },

  // Listar leads
  getLeads: async () => {
    const response = await fetch(`${API_URL}/odoo/leads`);
    return response.json();
  },
};
