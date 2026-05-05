import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

// ================= HELPERS =================
const stripHtml = (html) => {
  if (!html) return '';
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

const formatCurrency = (value) => `$${(value || 0).toFixed(2)}`;

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const loadImageAsBase64 = async (url) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

// Logo de TuLogica - usar desde carpeta public
const LOGO_PATH = '/tulogica_logo_fondo_blanco_v6.png';

// ================= ESTADO BADGE =================
const getStateConfig = (state) => {
  switch (state) {
    case 'sale':
      return { label: 'Confirmado', color: [40, 167, 69] };
    case 'sent':
      return { label: 'Enviado', color: [0, 123, 255] };
    case 'draft':
      return { label: 'Borrador', color: [108, 117, 125] };
    case 'cancel':
      return { label: 'Cancelado', color: [220, 53, 69] };
    default:
      return { label: state || '-', color: [120, 120, 120] };
  }
};

// ================= PDF =================
export const generateQuotePDF = async (quote) => {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // eslint-disable-next-line no-useless-assignment
  let y = 0;

  const colors = {
  primary: [15, 42, 74],        // Azul oscuro corporativo (#0F2A4A)
  secondary: [41, 98, 155],     // Azul medio elegante
  light: [245, 248, 252],       // Fondo suave
  border: [220, 226, 234],      // Bordes suaves
  text: [40, 40, 40],
};

  // ================= HEADER =================
  try {
    const logo = await loadImageAsBase64(LOGO_PATH);
    doc.addImage(logo, 'PNG', margin, 3, 50, 20);
  } catch { /* empty */ }

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Cotización', pageWidth - margin, 20, { align: 'right' });

  // ================= BADGE =================
  const state = getStateConfig(quote.state);

  // Badge con fondo de color
  doc.setFillColor(...state.color);
  doc.roundedRect(pageWidth - 60, 25, 45, 10, 3, 3, 'F');

  // Texto del estado en blanco
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(state.label, pageWidth - 37.5, 31, { align: 'center' });

  // ================= INFO =================
  y = 45;

  const info = [
    ['Referencia:', quote.name || '-'],
    ['Número:', quote.id || '-'],
    ['Fecha:', formatDate(quote.date_order)],
    ['Validez:', formatDate(quote.validity_date)],
  ];

  autoTable(doc, {
    startY: y,
    body: info,
    theme: 'plain',
    styles: { fontSize: 9, textColor: colors.text },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  // ================= CLIENTE =================
  if (quote.partner_id) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente', margin, y);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.partner_id[1], margin, y + 5);

    y += 12;
  }

  // ================= COLORES PROFESIONALES =================


// ================= TABLA =================
const rows = quote.order_lines?.map((l, i) => {
  const subtotal = l.price_subtotal || 0;
  const tax = l.price_tax || 0;
  const total = l.price_total || (subtotal + tax);
  return [
    i + 1,
    stripHtml(l.name),
    l.product_uom_qty,
    formatCurrency(l.price_unit),
    l.discount && l.discount > 0 ? `${l.discount}%` : '—',
    formatCurrency(subtotal),
    formatCurrency(tax),
    formatCurrency(total),
  ];
}) || [];

autoTable(doc, {
  startY: y,
  head: [['#', 'Producto', 'Cant.', 'Precio Unit.', 'Desc.', 'Subtotal', 'Impuestos', 'Total']],
  body: rows,
  theme: 'grid',

  headStyles: {
    fillColor: colors.primary,
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    fontSize: 8,
    halign: 'center',
    valign: 'middle',
  },

  styles: {
    fontSize: 7.5,
    cellPadding: 3,
    textColor: colors.text,
    lineColor: colors.border,
    lineWidth: 0.2,
  },

  alternateRowStyles: {
    fillColor: colors.light,
  },

  columnStyles: {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 'auto' },
    2: { cellWidth: 16, halign: 'right' },
    
    3: { cellWidth: 26, halign: 'right' },
    4: { cellWidth: 16, halign: 'center' },
    5: { cellWidth: 26, halign: 'right' },
    6: { cellWidth: 22, halign: 'right' },
    7: { 
      cellWidth: 28, 
      halign: 'right', 
      fontStyle: 'bold',
      textColor: colors.primary
    },
  },

  didDrawPage: (data) => {
    // Línea separadora elegante arriba de la tabla
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.line(15, data.settings.startY - 5, pageWidth - 15, data.settings.startY - 5);
  }
});

y = doc.lastAutoTable.finalY + 12;


// ================= BLOQUE DE TOTALES (ESTILO EMPRESARIAL) =================
const totals = [
  ['Subtotal', formatCurrency(quote.amount_untaxed)],
  ['Impuestos', formatCurrency(quote.amount_tax)],
  ['TOTAL', formatCurrency(quote.amount_total)],
];

autoTable(doc, {
  startY: y,
  body: totals,
  theme: 'plain',

  styles: {
    fontSize: 10,
    cellPadding: 4,
    textColor: colors.text,
  },

  columnStyles: {
    0: { 
      fontStyle: 'bold', 
      cellWidth: 40 
    },
    1: { 
      halign: 'right', 
      fontStyle: 'bold',
      cellWidth: 40
    },
  },

  tableWidth: 90,
  margin: { left: pageWidth - 105 },

  didParseCell: (data) => {
    // 🔥 Resaltar TOTAL final
    if (data.row.index === totals.length - 1) {
      data.cell.styles.fillColor = colors.primary;
      data.cell.styles.textColor = [255, 255, 255];
      data.cell.styles.fontSize = 12;
      data.cell.styles.fontStyle = 'bold';
    }
  },

  didDrawCell: (data) => {
    // Línea superior para separar TOTAL
    if (data.row.index === totals.length - 1) {
      doc.setDrawColor(...colors.primary);
      doc.setLineWidth(0.8);
      doc.line(
        data.cell.x,
        data.cell.y,
        data.cell.x + data.cell.width,
        data.cell.y
      );
    }
  }
});
  // ================= QR =================
  const qrData = JSON.stringify({
    ref: quote.name,
    id: quote.id,
    total: quote.amount_total
  });

  try {
    const qr = await QRCode.toDataURL(qrData);
    doc.addImage(qr, 'PNG', margin, pageHeight - 55, 35, 35);
  } catch { /* empty */ }

  // ================= FOOTER =================
  doc.setDrawColor(...colors.border);
  doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

  doc.setFontSize(8);
  doc.setTextColor(120);

  doc.text(
    quote.company_id?.[1] || 'Empresa TULOGICA - https://tulogica.com',
    margin,
    pageHeight - 15
  );

  doc.text(
    'Documento generado automáticamente',
    pageWidth - margin,
    pageHeight - 15,
    { align: 'right' }
  );

  return doc;
};

// ================= CHATWOOT PDF =================
export const sendPDFToChatwoot = async (quoteId, conversationId) => {
  const API_URL = import.meta.env.VITE_API_URL || 'https://odooapi.tulogica.com';

  // Fetch PDF from Odoo backend
  const pdfResponse = await fetch(`${API_URL}/odoo/quote/${quoteId}/pdf`);
  
  if (!pdfResponse.ok) {
    throw new Error('Error al obtener PDF de Odoo');
  }

  // Extract filename from Content-Disposition header
  const contentDisposition = pdfResponse.headers.get('Content-Disposition');
  let filename = `cotizacion_${quoteId}.pdf`;
  
  if (contentDisposition) {
    const match = contentDisposition.match(/filename=([^;]+)/);
    if (match) {
      filename = match[1].replace(/"/g, '');
    }
  }

  const pdfBlob = await pdfResponse.blob();
  const formData = new FormData();

  formData.append('conversationId', conversationId);
  formData.append('content', 'Adjunto tu cotización 📄');
  formData.append('messageType', 'outgoing');
  formData.append('attachments[]', pdfBlob, filename);

  const res = await fetch(
    `${API_URL}/chatwoot/send-message-with-file`,
    {
      method: 'POST',
      body: formData,
    }
  );

  return res.ok;
};

// ================= FUNCIÓN PRINCIPAL =================
export const generateAndSendQuotePDF = async (quote, conversationId) => {
  try {
    const result = await sendPDFToChatwoot(quote.id, conversationId);
    return result ? { success: true } : { success: false, error: 'Error al enviar PDF' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};