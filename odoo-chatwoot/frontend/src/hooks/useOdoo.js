import { useState, useCallback } from "react";
import { odooService } from "../services/odooService";

export const useOdoo = () => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Buscar cliente
  const searchCustomer = useCallback(async (phone, email) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.searchCustomer(phone, email);
      if (result.success && result.data && result.data.length > 0) {
        setCustomer(result.data[0]);
      } else {
        setCustomer(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear cliente
  const createCustomer = useCallback(async (customerData) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.createCustomer(customerData);
      if (result.success) {
        setCustomer(result.customer);
        return result;
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener productos
  const getProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.getProducts();
      if (result.success) {
        return result.products;
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear presupuesto
  const createQuote = useCallback(async (partnerId, orderLines, note = "") => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.createQuote(partnerId, orderLines, note);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener cotizaciones
  const getQuotes = useCallback(async (partnerId) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.getQuotes(partnerId);
      if (result.success) {
        return result.quotes;
      }
      return [];
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener detalle de cotización
  const getQuoteDetail = useCallback(async (quoteId) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.getQuoteDetail(quoteId);
      if (result.success) {
        return result.quote;
      }
      return null;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Modificar cotización
  const updateQuote = useCallback(async (quoteId, data) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.updateQuote(quoteId, data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear factura desde cotización
  const createInvoice = useCallback(async (quoteId) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.createInvoice(quoteId);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Verificar si cotización tiene factura
  const checkInvoiceStatus = useCallback(async (quoteId) => {
    try {
      const result = await odooService.checkInvoiceStatus(quoteId);
      return result;
    } catch (err) {
      console.error("Error verificando estado de factura:", err);
      return { hasInvoice: false };
    }
  }, []);

  // Obtener detalle de factura
  const getInvoiceDetail = useCallback(async (invoiceId) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.getInvoiceDetail(invoiceId);
      if (result.success) {
        return result.invoice;
      }
      return null;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Registrar pago de factura
  const registerPayment = useCallback(async (invoiceId, amount, journalId, paymentMethodId) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.registerPayment(invoiceId, amount, journalId, paymentMethodId);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener diarios disponibles
  const getJournals = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.getJournals();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener métodos de pago disponibles
  const getPaymentMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await odooService.getPaymentMethods();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    customer,
    loading,
    error,
    searchCustomer,
    createCustomer,
    getProducts,
    createQuote,
    getQuotes,
    getQuoteDetail,
    updateQuote,
    createInvoice,
    checkInvoiceStatus,
    getInvoiceDetail,
    registerPayment,
    getJournals,
    getPaymentMethods,
    setCustomer,
  };
};
