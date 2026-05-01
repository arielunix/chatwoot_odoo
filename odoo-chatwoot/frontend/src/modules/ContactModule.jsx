import {
  Box, Typography, Button, Divider, Alert,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog,
  DialogTitle, DialogContent, DialogActions,
  TextField, Chip, TableFooter,
  Select, MenuItem, FormControl, InputLabel,
  IconButton, Tooltip, Avatar, Fab, InputAdornment,
  Snackbar, CircularProgress, LinearProgress
} from "@mui/material";

import { useOdoo } from "../hooks/useOdoo";
import { useState, useEffect, useMemo } from "react";
import { API_URL } from "../constants/api";
import { generateAndSendQuotePDF } from "../services/envioPdfChatwoot";

import VisibilityIcon from '@mui/icons-material/Visibility';
import ReceiptIcon from '@mui/icons-material/Receipt';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import SendIcon from '@mui/icons-material/Send';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

export default function ContactModule({ data, odooCustomer, onCreateCustomer, isDarkMode = false, odooLoading }) {

  const {
    getQuotes, getQuoteDetail, updateQuote,
    createInvoice, checkInvoiceStatus,
    getInvoiceDetail, registerPayment,
    getJournals, getPaymentMethods,
    getProducts, createQuote, createCustomer
  } = useOdoo();

  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const [quotes, setQuotes] = useState([]);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [editState, setEditState] = useState("");
  const [invoiceMessage, setInvoiceMessage] = useState(null);
  const [invoiceSeverity, setInvoiceSeverity] = useState("success");
  const [invoiceStatusMap, setInvoiceStatusMap] = useState({});
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [journals, setJournals] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedJournalId, setSelectedJournalId] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [, setContactLabel] = useState("VENTAS");
  const [cartDialogOpen, setCartDialogOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [quoteFilter, setQuoteFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [paymentStateFilter, setPaymentStateFilter] = useState("all");
  const [showCustomerAlert, setShowCustomerAlert] = useState(true);
  const [chatwootSnackbar, setChatwootSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [sendingPdf, setSendingPdf] = useState(false);
  const [loadingCustomerSearch, setLoadingCustomerSearch] = useState(false);
  const [loadingQuotesList, setLoadingQuotesList] = useState(false);
  const [customerSearched, setCustomerSearched] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  useEffect(() => {
    if (odooCustomer && showCustomerAlert) {
      const timer = setTimeout(() => {
        setShowCustomerAlert(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    
    // Mostrar alerta de cliente no encontrado solo cuando la búsqueda automática ha terminado
    if (!odooCustomer && !odooLoading && !customerSearched) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomerSearched(true);
    }
  }, [odooCustomer, showCustomerAlert, odooLoading, customerSearched]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const matchesSearch =
        q.name.toLowerCase().includes(quoteFilter.toLowerCase()) ||
        q.id.toString().includes(quoteFilter);

      const matchesState =
        stateFilter === "all" || q.state === stateFilter;

      const paymentState = invoiceStatusMap[q.id]?.paymentState;
      const matchesPaymentState = paymentStateFilter === "all" || 
                                 (paymentStateFilter === "none" && !invoiceStatusMap[q.id]) ||
                                 paymentState === paymentStateFilter;

      return matchesSearch && matchesState && matchesPaymentState;
    });
  }, [quotes, quoteFilter, stateFilter, paymentStateFilter, invoiceStatusMap]);

  const filteredTotal = useMemo(() => {
    return filteredQuotes.reduce(
      (sum, q) => sum + (q.amount_total || 0),
      0
    );
  }, [filteredQuotes]);

  useEffect(() => {
    const loadQuotes = async () => {
      if (!odooCustomer?.id) return;

      setLoadingQuotesList(true);
      try {
        const quotesData = await getQuotes(odooCustomer.id);
        setQuotes(quotesData || []);
        
        // Verificar estado de factura para cada cotización
        const statusMap = {};
        await Promise.all(
          quotesData.map(async (quote) => {
            const invoiceStatus = await checkInvoiceStatus(quote.id);
            if (invoiceStatus.hasInvoice && invoiceStatus.invoiceIds && invoiceStatus.invoiceIds.length > 0) {
              const invoiceId = invoiceStatus.invoiceIds[0];
              statusMap[quote.id] = {
                hasInvoice: true,
                invoiceId: invoiceId,
                paymentState: invoiceStatus.paymentState || 'not_paid'
              };
            }
          })
        );
        setInvoiceStatusMap(statusMap);
      } catch (err) {
        console.error("Error cargando cotizaciones:", err);
      } finally {
        setLoadingQuotesList(false);
      }
    };

    // Carga diferida con debounce
    const timer = setTimeout(() => {
      loadQuotes();
    }, 500);

    return () => clearTimeout(timer);
  }, [odooCustomer?.id, getQuotes, checkInvoiceStatus]);

  const handleViewQuote = async (id) => {
    try {
      const detail = await getQuoteDetail(id);
      setSelectedQuote(detail);
      setEditNote(stripHtml(detail?.note));
      setEditState(detail?.state);
      setEditMode(false);
      setQuoteDialogOpen(true);
    } catch (err) {
      console.error("Error obteniendo detalle:", err);
    }
  };

  const handleEditQuote = async () => {
    try {
      await updateQuote(selectedQuote.id, {
        note: editNote,
        state: editState
      });
      setQuoteDialogOpen(false);
      // Recargar cotizaciones
      const quotesData = await getQuotes(odooCustomer.id);
      setQuotes(quotesData || []);
    } catch (err) {
      console.error("Error actualizando cotización:", err);
    }
  };

  const handleCreateCustomer = async () => {
    setLoadingCustomerSearch(true);
    setChatwootSnackbar({ open: true, message: 'Buscando cliente en Odoo...', severity: 'info' });

    try {
      const result = await createCustomer({
        name: data?.data?.conversation?.meta?.sender?.name || 
              data?.name || data?.contact?.name || "",
        phone: data?.data?.conversation?.meta?.sender?.phone_number || 
               data?.phone || data?.contact?.phone || "",
        email: data?.data?.conversation?.meta?.sender?.email || 
               data?.email || data?.contact?.email || "",
      });
      if (result.success) {
        setChatwootSnackbar({ open: true, message: '✅ Cliente encontrado en Odoo', severity: 'success' });
        onCreateCustomer(result.customer);
      }
    } catch (err) {
      console.error("Error creando cliente:", err);
      setChatwootSnackbar({ open: true, message: '❌ Error al buscar cliente en Odoo: ' + err.message, severity: 'error' });
    } finally {
      setLoadingCustomerSearch(false);
    }
  };

  const handleCreateInvoice = async (quoteId) => {
    setCreatingInvoice(true);
    setChatwootSnackbar({ open: true, message: 'Creando factura desde cotización...', severity: 'info' });

    try {
      const result = await createInvoice(quoteId);
      if (result.success) {
        setInvoiceMessage("Factura creada exitosamente");
        setInvoiceSeverity("success");
        setChatwootSnackbar({ open: true, message: '✅ Factura creada exitosamente', severity: 'success' });
        setInvoiceStatusMap(prev => ({ 
          ...prev, 
          [quoteId]: { 
            invoiceId: result.invoiceId, 
            paymentState: 'not_paid' 
          } 
        }));
        const quotesData = await getQuotes(odooCustomer.id);
        setQuotes(quotesData || []);
        // Cerrar modal de cotización
        setQuoteDialogOpen(false);
        setTimeout(() => setInvoiceMessage(null), 3000);
      }
    } catch (err) {
      console.error("Error creando factura:", err);
      setInvoiceMessage("Error al crear factura: " + err.message);
      setInvoiceSeverity("error");
      setChatwootSnackbar({ open: true, message: '❌ Error al crear factura: ' + err.message, severity: 'error' });
      setTimeout(() => setInvoiceMessage(null), 5000);
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleViewInvoice = async (invoiceId) => {
    try {
      const invoiceDetail = await getInvoiceDetail(invoiceId);
      setSelectedInvoice(invoiceDetail);
      setPaymentAmount(invoiceDetail.amount_residual || "");
      
      try {
        const journalsData = await getJournals();
        setJournals(journalsData.journals || []);
        if (journalsData.journals && journalsData.journals.length > 0) {
          setSelectedJournalId(journalsData.journals[0].id);
        }
        
        const paymentMethodsData = await getPaymentMethods();
        setPaymentMethods(paymentMethodsData.methods || []);
        if (paymentMethodsData.methods && paymentMethodsData.methods.length > 0) {
          setSelectedPaymentMethodId(paymentMethodsData.methods[0].id);
        }
      } catch (err) {
        console.error("Error cargando diarios o métodos de pago:", err);
      }
      
      setInvoiceDialogOpen(true);
    } catch (err) {
      console.error("❌ Error obteniendo detalle de factura:", err);
    }
  };

  const handleRegisterPayment = async () => {
    if (!selectedInvoice || !paymentAmount || !selectedJournalId || !selectedPaymentMethodId) return;

    try {
      const result = await registerPayment(
        selectedInvoice.id,
        parseFloat(paymentAmount),
        parseInt(selectedJournalId),
        parseInt(selectedPaymentMethodId)
      );
      if (result.success) {
        setInvoiceMessage("Pago registrado exitosamente");
        setInvoiceSeverity("success");
        setContactLabel("VENTAS - PAGO REALIZADO");
        const invoiceDetail = await getInvoiceDetail(selectedInvoice.id);
        setSelectedInvoice(invoiceDetail);
        setPaymentAmount(invoiceDetail.amount_residual || "");

        // Actualizar estado de pago en invoiceStatusMap
        const quoteId = Object.keys(invoiceStatusMap).find(key =>
          invoiceStatusMap[key].invoiceId === selectedInvoice.id
        );
        if (quoteId) {
          setInvoiceStatusMap(prev => ({
            ...prev,
            [quoteId]: {
              ...prev[quoteId],
              paymentState: invoiceDetail.payment_state || 'not_paid'
            }
          }));
        }

        setTimeout(() => setInvoiceMessage(null), 3000);
      }
    } catch (err) {
      console.error("❌ Error registrando pago:", err);
      setInvoiceMessage("Error al registrar pago: " + err.message);
      setInvoiceSeverity("error");
      setTimeout(() => setInvoiceMessage(null), 5000);
    }
  };

  const formatQuotationMessage = (quote) => {
    const stateLabel = quote.state === 'sale' ? 'Confirmado' :
                       quote.state === 'sent' ? 'Enviado' :
                       quote.state === 'draft' ? 'Borrador' :
                       quote.state === 'cancel' ? 'Cancelado' : quote.state;

    let message = `📄 *COTIZACIÓN #${quote.id}*\n`;
    message += `${'═'.repeat(25)}\n\n`;

    // Información general
    message += `📋 *Referencia:* ${quote.name}\n`;
    message += `📅 *Fecha:* ${quote.date_order ? new Date(quote.date_order).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}\n`;
    message += `📊 *Estado:* ${stateLabel}\n`;
    if (quote.validity_date) {
      message += `⏰ *Válida hasta:* ${new Date(quote.validity_date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    }
    message += `\n`;

    // Información del cliente
    if (quote.partner_id && quote.partner_id[1]) {
      message += `👤 *Cliente:* ${quote.partner_id[1]}\n`;
    }
    if (quote.user_id && quote.user_id[1]) {
      message += `👨‍💼 *Vendedor:* ${quote.user_id[1]}\n`;
    }
    message += `\n`;

    // Detalle de productos
    if (quote.order_lines && quote.order_lines.length > 0) {
      message += `📦 *DETALLE DE PRODUCTOS*\n`;
      message += `${'─'.repeat(25)}\n\n`;

      quote.order_lines.forEach((line, index) => {
        message += `${index + 1}. *${stripHtml(line.name || 'Sin nombre')}*\n`;
        message += `   ${'─'.repeat(25)}\n`;
        message += `   📊 Cantidad: ${line.product_uom_qty || 1} ${line.product_uom || 'u.'}\n`;
        message += `   💵 Precio unit.: $${line.price_unit ? line.price_unit.toFixed(2) : '0.00'}\n`;
        if (line.discount && line.discount > 0) {
          message += `   🏷️ Descuento: ${line.discount}%\n`;
        }
        message += `   💰 Subtotal: $${line.price_subtotal ? line.price_subtotal.toFixed(2) : '0.00'}\n`;
        if (line.price_tax) {
          message += `   📎 Impuestos: $${line.price_tax.toFixed(2)}\n`;
        }
        message += `   📦 Total línea: $${line.price_total ? line.price_total.toFixed(2) : '0.00'}\n\n`;
      });
    }

    // Notas
    if (quote.note) {
      message += `📝 *NOTAS Y CONDICIONES*\n`;
      message += `${'─'.repeat(25)}\n`;
      message += `${stripHtml(quote.note)}\n\n`;
    }

    // Términos de pago
    if (quote.payment_term_id && quote.payment_term_id[1]) {
      message += `� *Términos de pago:* ${quote.payment_term_id[1]}\n\n`;
    }

    // Resumen de totales
    message += `💵 *RESUMEN FINANCIERO*\n`;
    message += `${'═'.repeat(25)}\n`;
    message += `📊 Base imponible: $${quote.amount_untaxed ? quote.amount_untaxed.toFixed(2) : '0.00'}\n`;
    if (quote.amount_tax) {
      message += `📎 Impuestos: $${quote.amount_tax.toFixed(2)}\n`;
    }
    if (quote.amount_discount && quote.amount_discount > 0) {
      message += `🏷️ Descuentos: $${quote.amount_discount.toFixed(2)}\n`;
    }
    message += `💰 *TOTAL: $${quote.amount_total ? quote.amount_total.toFixed(2) : '0.00'}*\n\n`;

    // Pie de mensaje
    message += `🏢 ${quote.company_id && quote.company_id[1] ? quote.company_id[1] : 'Nuestra Empresa'}\n`;
    message += `📞 Para más información, contáctanos.\n`;

    return message;
  };

  const handleSendQuoteToChatwoot = async (quote) => {
    if (!data?.data?.conversation?.id) {
      setChatwootSnackbar({ open: true, message: 'No hay conversación de Chatwoot asociada a este contacto', severity: 'error' });
      return;
    }

    try {
      // Obtener detalle completo de la cotización con sus líneas de productos
      const quoteDetail = await getQuoteDetail(quote.id);
      const message = formatQuotationMessage(quoteDetail);
      const conversationId = data.data.conversation.id;

      const response = await fetch(
        `${API_URL}/chatwoot/send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: conversationId,
            content: message,
            messageType: 'outgoing'
          })
        }
      );

      if (response.ok) {
        setChatwootSnackbar({ open: true, message: 'Cotización enviada exitosamente a Chatwoot', severity: 'success' });

        // Actualizar estado de la cotización a 'sent' en Odoo
        try {
          await updateQuote(quote.id, { state: 'sent' });
          // Recargar cotizaciones para reflejar el cambio
          const quotesData = await getQuotes(odooCustomer.id);
          setQuotes(quotesData || []);
        } catch (err) {
          console.error("Error actualizando estado de cotización:", err);
        }
      } else {
        const errorData = await response.json();
        console.error("Error enviando a Chatwoot:", errorData);
        setChatwootSnackbar({ open: true, message: 'Error al enviar cotización a Chatwoot: ' + (errorData.message || response.statusText), severity: 'error' });
      }
    } catch (err) {
      console.error("Error enviando cotización a Chatwoot:", err);
      setChatwootSnackbar({ open: true, message: 'Error al enviar cotización a Chatwoot: ' + err.message, severity: 'error' });
    }
  };

  const handleSendQuotePDF = async (quote) => {
    if (!data?.data?.conversation?.id) {
      setChatwootSnackbar({ open: true, message: 'No hay conversación de Chatwoot asociada a este contacto', severity: 'error' });
      return;
    }

    // Mostrar estado de carga inmediatamente
    setSendingPdf(true);
    setChatwootSnackbar({ open: true, message: 'Generando PDF y enviando a Chatwoot...', severity: 'info' });

    // Timeout para evitar esperas infinitas
    const timeout = setTimeout(() => {
      setSendingPdf(false);
      setChatwootSnackbar({ open: true, message: 'Tiempo de espera agotado. Inténtalo de nuevo.', severity: 'warning' });
    }, 30000); // 30 segundos timeout

    try {
      // Obtener detalle completo de la cotización con sus líneas de productos
      const quoteDetail = await getQuoteDetail(quote.id);
      const conversationId = data.data.conversation.id;

      // Generar y enviar PDF de forma asíncrona no bloqueante
      const result = await Promise.race([
        generateAndSendQuotePDF(quoteDetail, conversationId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 30000)
        )
      ]);

      clearTimeout(timeout);

      if (result.success) {
        setChatwootSnackbar({ open: true, message: '✅ PDF enviado exitosamente a Chatwoot', severity: 'success' });

        // Actualizar estado de la cotización a 'sent' en Odoo
        try {
          await updateQuote(quote.id, { state: 'sent' });
          // Recargar cotizaciones para reflejar el cambio
          const quotesData = await getQuotes(odooCustomer.id);
          setQuotes(quotesData || []);
        } catch (err) {
          console.error("Error actualizando estado de cotización:", err);
        }
      } else {
        setChatwootSnackbar({ open: true, message: '❌ Error al enviar PDF a Chatwoot: ' + result.error, severity: 'error' });
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error("Error enviando PDF a Chatwoot:", err);
      setChatwootSnackbar({ open: true, message: '❌ Error al enviar PDF a Chatwoot: ' + err.message, severity: 'error' });
    } finally {
      setSendingPdf(false);
    }
  };

  const handleOpenCartDialog = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData || []);
      setCartDialogOpen(true);
    } catch (err) {
      console.error("Error cargando productos:", err);
    }
  };

  const handleAddToCart = (product) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.product_id === product.id 
          ? { ...item, product_uom_qty: item.product_uom_qty + 1, price_subtotal: (item.product_uom_qty + 1) * item.price_unit }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        product_uom_qty: 1,
        price_unit: product.list_price || 0,
        price_subtotal: product.list_price || 0,
        product_uom: product.uom_id || 1
      }]);
    }
  };

  const handleRemoveFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const handleUpdateCartQty = (productId, qty) => {
    if (qty <= 0) {
      handleRemoveFromCart(productId);
    } else {
      setCart(cart.map(item => 
        item.product_id === productId 
          ? { ...item, product_uom_qty: qty, price_subtotal: qty * item.price_unit }
          : item
      ));
    }
  };

  const handleUpdateCartPrice = (productId, price) => {
    setCart(cart.map(item => 
      item.product_id === productId 
        ? { ...item, price_unit: price, price_subtotal: price * item.product_uom_qty }
        : item
    ));
  };

  const handleCreateQuoteFromCart = async () => {
    if (!odooCustomer?.id || cart.length === 0) return;
    
    try {
      const orderLines = cart.map(item => ({
        product_id: item.product_id,
        product_uom_qty: item.product_uom_qty,
        price_unit: item.price_unit,
        product_uom: item.product_uom || 1,
        name: item.name
      }));
      
      const result = await createQuote(odooCustomer.id, orderLines, quoteNote);
      if (result.success) {
        setCart([]);
        setQuoteNote("");
        setCartDialogOpen(false);
        const quotesData = await getQuotes(odooCustomer.id);
        setQuotes(quotesData || []);
      }
    } catch (err) {
      console.error("Error creando cotización:", err);
    }
  };

  return (
    <Box>

      {/* Progress bar for PDF sending and loading operations */}
      {(sendingPdf || loadingCustomerSearch || loadingQuotesList || creatingInvoice) && (
        <Box sx={{ width: '100%', mb: 2 }}>
          <LinearProgress />
          <Typography variant="caption" sx={{ color: isDarkMode ? '#aaa' : '#666', mt: 1 }}>
            {sendingPdf ? 'Generando PDF y enviando a Chatwoot...' :
             loadingCustomerSearch ? 'Buscando cliente en Odoo...' :
             loadingQuotesList ? 'Cargando cotizaciones...' :
             creatingInvoice ? 'Creando factura desde cotización...' : ''}
          </Typography>
        </Box>
      )}

      {/* HEADER */}
      <Box sx={{ mb: 2 }}>
        {odooCustomer && (
          <Tooltip title="Nueva Cotización">
            <Fab
              color="primary"
              onClick={handleOpenCartDialog}
              size="medium"
              sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 1000
              }}
            >
              <AddShoppingCartIcon />
            </Fab>
          </Tooltip>
        )}
      </Box>

      <Divider />

      {/* ALERTAS */}
      <Box sx={{ mb: 2 }}>
        {showCustomerAlert && odooCustomer ? (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setShowCustomerAlert(false)}>
            Cliente encontrado en Odoo
          </Alert>
        ) : showCustomerAlert && !odooCustomer && customerSearched ? (
          <Alert 
            severity="warning" 
            sx={{ mb: 2 }} 
            onClose={() => setShowCustomerAlert(false)}
            action={
              <Button 
                color="inherit" 
                size="small"
                onClick={handleCreateCustomer}
                disabled={loadingCustomerSearch}
                startIcon={loadingCustomerSearch ? <CircularProgress size={16} /> : null}
              >
                {loadingCustomerSearch ? "Buscando..." : "Crear Cliente"}
              </Button>
            }
          >
            Cliente no encontrado en Odoo
          </Alert>
        ) : null}
        
        {odooCustomer && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 1.5,
              background: isDarkMode ? "#3d3d3d" : "#f8f9fa",
              borderRadius: 2,
              border: isDarkMode ? "1px solid #555" : "1px solid #e9ecef"
            }}
          >
            <Avatar 
              sx={{ bgcolor: "#2c3e50", width: 32, height: 32 }}
              src={data?.contact?.thumbnail || data?.data?.conversation?.meta?.sender?.thumbnail}
            >
              {!(data?.contact?.thumbnail || data?.data?.conversation?.meta?.sender?.thumbnail) && <PersonIcon fontSize="small" />}
            </Avatar>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography sx={{ fontWeight: 600, color: isDarkMode ? "#fff" : "#2c3e50", lineHeight: 1.2 }}>
                {odooCustomer.name || "Sin nombre"}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <PhoneIcon sx={{ fontSize: 14, color: isDarkMode ? "#aaa" : "#6c757d" }} />
                <Typography variant="caption" sx={{ color: isDarkMode ? "#aaa" : "#6c757d" }}>
                  {odooCustomer.phone || "Sin teléfono"}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* COTIZACIONES */}
      {odooCustomer && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ mb: 2 }}>
            {invoiceMessage && (
              <Alert 
                severity={invoiceSeverity} 
                sx={{ mb: 2, fontSize: 13 }}
                onClose={() => setInvoiceMessage(null)}
              >
                {invoiceMessage}
              </Alert>
            )}

            {/* BUSCADOR */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
              <Typography variant="h6" color={isDarkMode ? "#ffffff" : "#2c3e50"} sx={{ fontSize: 16, fontWeight: 700 }}>
                Cotizaciones del Cliente
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Buscar cotización..."
                  value={quoteFilter}
                  onChange={(e) => setQuoteFilter(e.target.value)}
                  sx={{
                    width: 220,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: isDarkMode ? '#3d3d3d' : '#f9f9f9'
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: isDarkMode ? '#555' : '#ddd'
                    }
                  }}
                  InputProps={{
                    sx: { fontSize: 13, color: isDarkMode ? '#fff' : '#000' },
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: isDarkMode ? '#aaa' : '#666' }} />
                      </InputAdornment>
                    ),
                    endAdornment: quoteFilter && (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setQuoteFilter('')}
                          sx={{ color: isDarkMode ? '#aaa' : '#666' }}
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel sx={{ fontSize: 12, color: isDarkMode ? '#aaa' : '#000' }}>Estado</InputLabel>
                  <Select
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    label="Estado"
                    sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000', backgroundColor: isDarkMode ? '#3d3d3d' : '#fff' }}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="draft">Borrador</MenuItem>
                    <MenuItem value="sent">Enviado</MenuItem>
                    <MenuItem value="sale">Confirmado</MenuItem>
                    <MenuItem value="cancel">Cancelado</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel sx={{ fontSize: 12, color: isDarkMode ? '#aaa' : '#000' }}>Estado Factura</InputLabel>
                  <Select
                    value={paymentStateFilter}
                    onChange={(e) => setPaymentStateFilter(e.target.value)}
                    label="Estado Factura"
                    sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000', backgroundColor: isDarkMode ? '#3d3d3d' : '#fff' }}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="paid">Pagado</MenuItem>
                    <MenuItem value="partial">Parcial</MenuItem>
                    <MenuItem value="not_paid">No pagado</MenuItem>
                    <MenuItem value="none">Sin factura</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {loadingQuotesList ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color={isDarkMode ? "#aaa" : "#6c757d"} sx={{ fontSize: 13 }}>
                  Cargando cotizaciones...
                </Typography>
              </Box>
            ) : quotes.length === 0 ? (
              <Alert severity="info" sx={{ fontSize: 13 }}>
                No hay cotizaciones pendientes para este cliente
              </Alert>
            ) : (
              <TableContainer component={Paper} sx={{ background: isDarkMode ? '#3d3d3d' : 'white' }}>
                <Table sx={{ minWidth: 650 }} size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>ID</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>Nombre</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>Fecha</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>Estado</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>Total</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>Estado Pago</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredQuotes.map((quote) => (
                      <TableRow key={quote.id} sx={{ '&:hover': { backgroundColor: isDarkMode ? '#4d4d4d' : '#f5f5f5' } }}>
                        <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>{quote.id}</TableCell>
                        <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>{quote.name}</TableCell>
                        <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>
                          {quote.date_order ? new Date(quote.date_order).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>
                          <Chip
                            label={quote.state === 'sale' ? 'Confirmado' : 
                                   quote.state === 'sent' ? 'Enviado' : 
                                   quote.state === 'draft' ? 'Borrador' : 
                                   quote.state === 'cancel' ? 'Cancelado' : quote.state}
                            size="small"
                            sx={{
                              fontSize: 10,
                              backgroundColor: 
                                quote.state === 'sale' ? '#d1fae5' :
                                quote.state === 'sent' ? '#bfdbfe' :
                                quote.state === 'draft' ? '#fef3c7' :
                                quote.state === 'cancel' ? '#fee2e2' : '#f3f4f6',
                              color: 
                                quote.state === 'sale' ? '#065f46' :
                                quote.state === 'sent' ? '#1e40af' :
                                quote.state === 'draft' ? '#92400e' :
                                quote.state === 'cancel' ? '#991b1b' : '#374151',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>
                          ${quote.amount_total ? quote.amount_total.toFixed(2) : '0.00'}
                        </TableCell>
                        <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>
                          {invoiceStatusMap[quote.id] ? (
                            <Chip
                              label={invoiceStatusMap[quote.id].paymentState === 'paid' ? 'Pagado' : 
                                     invoiceStatusMap[quote.id].paymentState === 'partial' ? 'Parcial' : 
                                     'No pagado'}
                              size="small"
                              sx={{
                                fontSize: 11,
                                backgroundColor: 
                                  invoiceStatusMap[quote.id].paymentState === 'paid' ? '#d1fae5' :
                                  invoiceStatusMap[quote.id].paymentState === 'partial' ? '#fef3c7' :
                                  isDarkMode ? '#4d4d4d' : '#f3f4f6',
                                color: 
                                  invoiceStatusMap[quote.id].paymentState === 'paid' ? '#065f46' :
                                  invoiceStatusMap[quote.id].paymentState === 'partial' ? '#92400e' :
                                  isDarkMode ? '#ccc' : '#374151',
                              }}
                            />
                          ) : (
                            <Chip
                              label="Por facturar"
                              size="small"
                              sx={{
                                fontSize: 11,
                                backgroundColor: isDarkMode ? '#4d4d4d' : '#f3f4f6',
                                color: isDarkMode ? '#ccc' : '#374151',
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: 13, textAlign: 'right', color: isDarkMode ? '#ccc' : '#000' }}>
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <Tooltip title="Ver cotización">
                              <IconButton
                                size="small"
                                onClick={() => handleViewQuote(quote.id)}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Enviar a Chatwoot">
                              <IconButton
                                size="small"
                                color="info"
                                onClick={() => handleSendQuoteToChatwoot(quote)}
                              >
                                <SendIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Enviar PDF a Chatwoot">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleSendQuotePDF(quote)}
                                disabled={sendingPdf}
                              >
                                {sendingPdf ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <PictureAsPdfIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            {!invoiceStatusMap[quote.id] ? (
                              <Tooltip title="Crear factura">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleCreateInvoice(quote.id)}
                                  disabled={creatingInvoice}
                                >
                                  {creatingInvoice ? <CircularProgress size={16} /> : <ReceiptIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Ver factura">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleViewInvoice(invoiceStatusMap[quote.id].invoiceId)}
                                >
                                  <DescriptionIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} sx={{ fontSize: 13, fontWeight: 'bold', py: 1, color: isDarkMode ? '#fff' : '#000' }}>
                        Total General:
                      </TableCell>
                      <TableCell sx={{ fontSize: 13, fontWeight: 'bold', py: 1, color: isDarkMode ? '#fff' : '#000' }}>
                        ${filteredTotal.toFixed(2)}
                      </TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            )}
          </Box>
        </>
      )}

      {/* MODAL DETALLE COTIZACIÓN */}
      <Dialog open={quoteDialogOpen} onClose={() => setQuoteDialogOpen(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { background: isDarkMode ? '#2d2d2d' : 'white' } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#fff' : '#000' }}>
              Detalle de Cotización
            </Typography>
            <Button onClick={() => setEditMode(!editMode)} size="small" sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000' }}>
              {editMode ? 'Cancelar Edición' : 'Editar'}
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedQuote && (
            <Box>
              {/* Header de la cotización */}
              <Paper sx={{ p: 2, mb: 2, background: isDarkMode ? '#3d3d3d' : '#f8f9fa' }}>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>
                  {selectedQuote.name}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 12 }}>ID</Typography>
                    <Typography variant="body2" fontWeight="500" sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000' }}>{selectedQuote.id}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 12 }}>Fecha</Typography>
                    <Typography variant="body2" fontWeight="500" sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000' }}>
                      {selectedQuote.date_order ? new Date(selectedQuote.date_order).toLocaleDateString() : '-'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 12 }}>Estado</Typography>
                    <Typography variant="body2" fontWeight="500" sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000' }}>
                      {selectedQuote.state === 'sale' ? 'Confirmado' : selectedQuote.state === 'sent' ? 'Enviado' : selectedQuote.state === 'draft' ? 'Borrador' : selectedQuote.state === 'cancel' ? 'Cancelado' : selectedQuote.state || 'Borrador'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 12 }}>Total</Typography>
                    <Typography variant="body2" fontWeight="bold" sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#2c3e50' }}>
                      ${selectedQuote.amount_total ? selectedQuote.amount_total.toFixed(2) : '0.00'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Nota */}
              <Paper sx={{ p: 2, mb: 2, background: isDarkMode ? '#3d3d3d' : 'white' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, fontSize: 14, color: isDarkMode ? '#fff' : '#000' }}>
                  Nota
                </Typography>
                {editMode ? (
                  <TextField 
                    fullWidth 
                    multiline 
                    rows={3} 
                    value={editNote} 
                    onChange={(e) => setEditNote(e.target.value)} 
                    size="small" 
                    InputProps={{ 
                      sx: { fontSize: 13, color: isDarkMode ? '#fff' : '#000' },
                      notched: false
                    }} 
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: isDarkMode ? '#4d4d4d' : '#fff'
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: isDarkMode ? '#555' : '#ddd'
                      }
                    }}
                  />
                ) : (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: 13, color: isDarkMode ? '#ccc' : '#555' }}>
                    {stripHtml(selectedQuote.note) || 'Sin nota'}
                  </Typography>
                )}
              </Paper>

              {/* Estado */}
              {editMode && (
                <Paper sx={{ p: 2, mb: 2, background: isDarkMode ? '#3d3d3d' : 'white' }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, fontSize: 14, color: isDarkMode ? '#fff' : '#000' }}>
                    Cambiar Estado
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {[
                      { value: 'draft', label: 'Borrador', bg: '#fef3c7', color: '#92400e' },
                      { value: 'sent', label: 'Enviado', bg: '#bfdbfe', color: '#1e40af' },
                      { value: 'sale', label: 'Confirmado', bg: '#d1fae5', color: '#065f46' },
                      { value: 'cancel', label: 'Cancelado', bg: '#fee2e2', color: '#991b1b' },
                    ].map((state) => (
                      <Box key={state.value} onClick={() => setEditState(state.value)} sx={{ px: 2, py: 0.75, borderRadius: 1, cursor: 'pointer', display: 'inline-block', fontSize: 13, fontWeight: editState === state.value ? 600 : 400, backgroundColor: editState === state.value ? state.bg : isDarkMode ? '#4d4d4d' : '#f3f4f6', color: editState === state.value ? state.color : isDarkMode ? '#ccc' : '#374151', border: editState === state.value ? `2px solid ${state.color}` : '1px solid #e5e7eb', transition: 'all 0.2s', '&:hover': { backgroundColor: state.bg, color: state.color, }, }}>
                        {state.label}
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Productos */}
              <Paper sx={{ p: 2, mb: 2, background: isDarkMode ? '#3d3d3d' : 'white' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontSize: 14, fontWeight: 700, color: isDarkMode ? '#fff' : '#000' }}>
                  Productos
                </Typography>
                {selectedQuote.order_lines && selectedQuote.order_lines.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>Producto</TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>Cantidad</TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>Unidad</TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>Precio</TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }} align="right">Subtotal</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedQuote.order_lines.map((line, index) => (
                          <TableRow key={index} sx={{ '&:hover': { backgroundColor: isDarkMode ? '#4d4d4d' : '#f5f5f5' } }}>
                            <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>{line.name || line.product_id}</TableCell>
                            <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>{line.product_uom_qty || 0}</TableCell>
                            <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>{line.product_uom || '-'}</TableCell>
                            <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>${(line.price_unit || 0).toFixed(2)}</TableCell>
                            <TableCell sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }} align="right">${(line.price_subtotal || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 13 }}>
                    No hay productos en esta cotización
                  </Typography>
                )}
              </Paper>

              {/* Desglose de Impuestos */}
              <Paper sx={{ p: 2, background: isDarkMode ? '#3d3d3d' : '#f8f9fa' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, fontSize: 14, color: isDarkMode ? '#fff' : '#000' }}>
                  Desglose de Impuestos
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>Subtotal:</Typography>
                    <Typography variant="body2" fontWeight="500" sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000' }}>
                      ${selectedQuote.amount_untaxed ? selectedQuote.amount_untaxed.toFixed(2) : '0.00'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontSize: 13, color: isDarkMode ? '#ccc' : '#000' }}>IVA (13%):</Typography>
                    <Typography variant="body2" fontWeight="500" sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000' }}>
                      ${selectedQuote.amount_tax ? selectedQuote.amount_tax.toFixed(2) : '0.00'}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000' }}>Total:</Typography>
                    <Typography variant="body2" fontWeight="bold" color="#2c3e50" sx={{ fontSize: 13 }}>
                      ${selectedQuote.amount_total ? selectedQuote.amount_total.toFixed(2) : '0.00'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setQuoteDialogOpen(false)} sx={{ fontSize: 13 }}>
            Cerrar
          </Button>
          {editMode && (
            <Button onClick={handleEditQuote} variant="contained" color="primary" sx={{ fontSize: 13 }}>
              Guardar Cambios
            </Button>
          )}
          {!editMode && selectedQuote?.state === 'sale' && invoiceStatusMap[selectedQuote.id]?.hasInvoice && (
            <Button onClick={() => handleViewInvoice(invoiceStatusMap[selectedQuote.id].invoiceId)} variant="contained" color="warning" sx={{ fontSize: 13 }}>
              Ver Factura
            </Button>
          )}
          {!editMode && selectedQuote?.state === 'draft' && !invoiceStatusMap[selectedQuote.id]?.hasInvoice && (
            <Button 
              onClick={() => handleCreateInvoice(selectedQuote.id)} 
              variant="contained" 
              color="success" 
              sx={{ fontSize: 13 }}
              disabled={creatingInvoice}
              startIcon={creatingInvoice ? <CircularProgress size={16} /> : null}
            >
              {creatingInvoice ? "Creando factura..." : "Crear Factura"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* MODAL FACTURA */}
      <Dialog open={invoiceDialogOpen} onClose={() => setInvoiceDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { background: isDarkMode ? '#2d2d2d' : 'white' } }}>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontSize: 18, color: isDarkMode ? '#fff' : '#000' }}>Detalle de Factura</Typography>
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2, mt: 2 }}>
              <Box>
                <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 14 }}>Número</Typography>
                <Typography variant="body1" sx={{ fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>{selectedInvoice.name}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 14 }}>Fecha</Typography>
                <Typography variant="body1" sx={{ fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>
                  {selectedInvoice.invoice_date ? new Date(selectedInvoice.invoice_date).toLocaleDateString() : '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 14 }}>Estado</Typography>
                <Typography variant="body1" sx={{ fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>{selectedInvoice.state}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 14 }}>Estado de Pago</Typography>
                <Typography variant="body1" sx={{ fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>
                  {selectedInvoice.payment_state === 'paid' ? 'Pagado' : 
                   selectedInvoice.payment_state === 'partial' ? 'Parcial' : 
                   selectedInvoice.payment_state === 'not_paid' ? 'No pagado' : selectedInvoice.payment_state}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 14 }}>Origen</Typography>
                <Typography variant="body1" sx={{ fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>{selectedInvoice.invoice_origin}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 14 }}>Base Imponible</Typography>
                <Typography variant="body1" sx={{ fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>${selectedInvoice.amount_untaxed?.toFixed(2) || '0.00'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 14 }}>Impuestos</Typography>
                <Typography variant="body1" sx={{ fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>${selectedInvoice.amount_tax?.toFixed(2) || '0.00'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 14 }}>Total</Typography>
                <Typography variant="body1" sx={{ fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>${selectedInvoice.amount_total?.toFixed(2) || '0.00'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color={isDarkMode ? '#aaa' : '#6c757d'} sx={{ fontSize: 14 }}>Saldo Pendiente</Typography>
                <Typography variant="body1" fontWeight="bold" color={selectedInvoice.amount_residual > 0 ? 'error' : 'success'} sx={{ fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>
                  ${selectedInvoice.amount_residual?.toFixed(2) || '0.00'}
                </Typography>
              </Box>
            </Box>
            
           
            {selectedInvoice.amount_residual > 0 && (
              <Box sx={{ mt: 3, p: 2, background: isDarkMode ? '#3d3d3d' : '#f8f9fa', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontSize: 14, fontWeight: 700, color: isDarkMode ? '#fff' : '#000' }}>
                  Registrar Pago
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ fontSize: 12, color: isDarkMode ? '#aaa' : '#6c757d', mb: 0.5, display: 'block' }}>
                      Monto a Pagar
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={selectedInvoice.amount_residual?.toFixed(2)}
                      InputProps={{
                        sx: { fontSize: 13, color: isDarkMode ? '#fff' : '#000' },
                        startAdornment: <Typography sx={{ mr: 1, color: isDarkMode ? '#aaa' : '#666' }}>$</Typography>
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: isDarkMode ? '#4d4d4d' : '#fff'
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: isDarkMode ? '#555' : '#ddd'
                        }
                      }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ fontSize: 12, color: isDarkMode ? '#aaa' : '#6c757d', mb: 0.5, display: 'block' }}>
                      Diario
                    </Typography>
                    <FormControl fullWidth size="small">
                      <Select
                        value={selectedJournalId}
                        onChange={(e) => setSelectedJournalId(e.target.value)}
                        displayEmpty
                        sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000', backgroundColor: isDarkMode ? '#4d4d4d' : '#fff' }}
                      >
                        <MenuItem value="" disabled>Seleccionar diario...</MenuItem>
                        {journals.map((journal) => (
                          <MenuItem key={journal.id} value={journal.id} sx={{ fontSize: 13 }}>
                            {journal.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ fontSize: 12, color: isDarkMode ? '#aaa' : '#6c757d', mb: 0.5, display: 'block' }}>
                      Método de Pago
                    </Typography>
                    <FormControl fullWidth size="small">
                      <Select
                        value={selectedPaymentMethodId}
                        onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                        displayEmpty
                        sx={{ fontSize: 13, color: isDarkMode ? '#fff' : '#000', backgroundColor: isDarkMode ? '#4d4d4d' : '#fff' }}
                      >
                        <MenuItem value="" disabled>Seleccionar método...</MenuItem>
                        {paymentMethods.map((method) => (
                          <MenuItem key={method.id} value={method.id} sx={{ fontSize: 13 }}>
                            {method.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              </Box>)}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setInvoiceDialogOpen(false)} sx={{ fontSize: 13 }}>
            Cerrar
          </Button>
          {selectedInvoice && selectedInvoice.amount_residual > 0 && (
            <Button
              onClick={handleRegisterPayment}
              variant="contained"
              color="success"
              sx={{ fontSize: 13 }}
              disabled={!paymentAmount || !selectedJournalId || !selectedPaymentMethodId}
            >
              Registrar Pago
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* MODAL CARRITO */}
      <Dialog open={cartDialogOpen} onClose={() => setCartDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>
            Nueva Cotización
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {/* PRODUCTOS */}
            <Box>
              <Typography sx={{ mb: 1, fontSize: 14, fontWeight: 700 }}>
                Productos
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar producto..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                sx={{ mb: 2 }}
                InputProps={{ sx: { fontSize: 13 } }}
              />
              <Box sx={{ maxHeight: 420, overflowY: 'auto', pr: 1 }}>
                {products
                  .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                  .map((product) => (
                    <Box
                      key={product.id}
                      onClick={() => handleAddToCart(product)}
                      sx={{
                        p: 1.5,
                        border: '1px solid #e5e7eb',
                        borderRadius: 2,
                        mb: 1,
                        cursor: 'pointer',
                        transition: '0.2s',
                        '&:hover': {
                          backgroundColor: isDarkMode ? '#4d4d4d' : '#f1f5f9',
                          transform: 'scale(1.01)'
                        }
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        {product.name}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                        ${product.list_price?.toFixed(2) || '0.00'}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            </Box>

            {/* CARRITO */}
            <Box>
              <Typography sx={{ mb: 1, fontSize: 14, fontWeight: 700 }}>
                Carrito ({cart.length})
              </Typography>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                placeholder="Nota..."
                value={quoteNote}
                onChange={(e) => setQuoteNote(e.target.value)}
                sx={{ mb: 2 }}
                InputProps={{ sx: { fontSize: 13 } }}
              />
              <Box sx={{ maxHeight: 420, overflowY: 'auto', pr: 1 }}>
                {cart.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>
                      🛒 Carrito vacío
                    </Typography>
                  </Box>
                ) : (
                  cart.map((item) => (
                    <Box
                      key={item.product_id}
                      sx={{
                        p: 1.5,
                        border: '1px solid #e5e7eb',
                        borderRadius: 2,
                        mb: 1
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                          {item.name}
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => handleRemoveFromCart(item.product_id)}
                          sx={{ fontSize: 11, color: 'error.main' }}
                        >
                          ✕
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Button
                            size="small"
                            onClick={() => handleUpdateCartQty(item.product_id, item.product_uom_qty - 1)}
                            sx={{ minWidth: 28 }}
                          >
                            -
                          </Button>
                          <TextField
                            size="small"
                            type="number"
                            value={item.product_uom_qty}
                            onChange={(e) => handleUpdateCartQty(item.product_id, parseFloat(e.target.value) || 0)}
                            sx={{ width: 60 }}
                            inputProps={{ style: { textAlign: 'center', fontSize: 13 } }}
                          />
                          <Button
                            size="small"
                            onClick={() => handleUpdateCartQty(item.product_id, item.product_uom_qty + 1)}
                            sx={{ minWidth: 28 }}
                          >
                            +
                          </Button>
                        </Box>
                        <TextField
                          size="small"
                          type="number"
                          value={item.price_unit}
                          onChange={(e) => handleUpdateCartPrice(item.product_id, parseFloat(e.target.value) || 0)}
                          sx={{ width: 90 }}
                          inputProps={{ style: { fontSize: 13 } }}
                        />
                      </Box>
                      <Box
                        sx={{
                          mt: 1,
                          pt: 1,
                          borderTop: '1px solid #e5e7eb',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}
                      >
                        <Typography sx={{ fontSize: 12 }}>
                          Subtotal
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                          ${(item.price_subtotal || 0).toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
              {cart.length > 0 && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 2,
                    background: isDarkMode ? '#3d3d3d' : '#f8fafc',
                    border: isDarkMode ? '1px solid #555' : '1px solid #e5e7eb'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14, color: isDarkMode ? '#fff' : '#000' }}>
                      Total
                    </Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: isDarkMode ? '#fff' : '#000' }}>
                      ${cart.reduce((sum, item) => sum + (item.price_subtotal || 0), 0).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCartDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateQuoteFromCart}
            disabled={cart.length === 0}
          >
            Crear Cotización
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={chatwootSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setChatwootSnackbar({ ...chatwootSnackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setChatwootSnackbar({ ...chatwootSnackbar, open: false })}
          severity={chatwootSnackbar.severity}
          sx={{ width: '100%' }}
        >
          {chatwootSnackbar.message}
        </Alert>
      </Snackbar>

    </Box>
  );
};

/* ================= COMPONENTES AUXILIARES ================= */




