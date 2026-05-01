import { useEffect, useState } from "react";
import { Box, Paper, Container, Tabs, Tab, Snackbar, Alert } from "@mui/material";
import { ContactModule } from "../modules/ContactModule";
import { useOdoo } from "../hooks/useOdoo";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ReceiptIcon from '@mui/icons-material/Receipt';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AssessmentIcon from '@mui/icons-material/Assessment';

export default function PanelApp() {
  const [data, setData] = useState(null);
  const [activeModule, setActiveModule] = useState('contact');
  const [showEnterpriseMessage, setShowEnterpriseMessage] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { customer, searchCustomer, setCustomer } = useOdoo();

  // Detectar theme de Chatwoot
  useEffect(() => {
    const detectChatwootTheme = () => {
      try {
        // Intentar leer variables CSS del padre
        const parentBody = window.parent?.document?.body;
        if (parentBody) {
          // Detectar por clase
          const hasDarkClass = parentBody.classList.contains('dark-mode') || 
                             parentBody.classList.contains('dark');
          const hasLightClass = parentBody.classList.contains('light-mode') || 
                              parentBody.classList.contains('light');
          
          if (hasDarkClass) {
            setIsDarkMode(true);
            return;
          }
          if (hasLightClass) {
            setIsDarkMode(false);
            return;
          }

          // Detectar por variable CSS
          const parentComputedStyle = window.parent.getComputedStyle(parentBody);
          const backgroundColor = parentComputedStyle.getPropertyValue('background-color') || 
                                  parentComputedStyle.getPropertyValue('--bg-color') ||
                                  parentComputedStyle.getPropertyValue('--color-bg');
          
          // Si el fondo es oscuro
          if (backgroundColor) {
            const rgb = backgroundColor.match(/\d+/g);
            if (rgb) {
              const [r, g, b] = rgb.map(Number);
              const brightness = (r * 299 + g * 587 + b * 114) / 1000;
              setIsDarkMode(brightness < 128);
            }
          }
        }

        // Fallback: detectar preferencia del sistema
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(prefersDark);
      } catch (error) {
        console.error('Error detectando theme de Chatwoot:', error);
        // Fallback: usar preferencia del sistema
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(prefersDark);
      }
    };

    detectChatwootTheme();

    // Escuchar cambios en el theme del sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const prefersDark = mediaQuery.matches;
      setIsDarkMode(prefersDark);
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const enterpriseModules = ['lead', 'invoice', 'inventory', 'accounting', 'reports'];

  const handleTabChange = (event, newValue) => {
    if (enterpriseModules.includes(newValue)) {
      setShowEnterpriseMessage(true);
      return;
    }
    setActiveModule(newValue);
  };

  const handleCloseEnterpriseMessage = () => {
    setShowEnterpriseMessage(false);
  };

  useEffect(() => {
    const handler = (event) => {
      console.log("📩 Evento raw:", event.data);
      console.log("📩 Tipo:", typeof event.data);

      let parsedData = event.data;
      if (typeof event.data === "string") {
        try {
          parsedData = JSON.parse(event.data);
          console.log("📩 Evento parseado:", parsedData);
        } catch (e) {
          console.error("Error parsing JSON:", e);
          return;
        }
      }

      setData(parsedData);

      // Buscar cliente en Odoo si hay datos de contacto
      if (parsedData) {
        const phone = parsedData.data?.conversation?.meta?.sender?.phone_number || 
                     parsedData.contact?.phone || 
                     parsedData.phone;
        const email = parsedData.data?.conversation?.meta?.sender?.email || 
                    parsedData.contact?.email || 
                    parsedData.email;
        const name = parsedData.data?.conversation?.meta?.sender?.name || 
                   parsedData.contact?.name || 
                   parsedData.name;
        
        console.log("📞 Phone:", phone);
        console.log("📧 Email:", email);
        console.log("👤 Name:", name);
        
        if (phone || email) {
          searchCustomer(phone, email);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [searchCustomer]);

  const handleCreateCustomer = (newCustomer) => {
    setCustomer(newCustomer);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2, background: isDarkMode ? "#1a1a1a" : "#f5f6f7", minHeight: "100vh" }}>
      <Paper elevation={1} sx={{ p: 2, background: isDarkMode ? "#2d2d2d" : "white" }}>
        {/* Navegación con Tabs */}
        <Box sx={{ mb: 2 }}>
          <Tabs
            value={activeModule}
            onChange={handleTabChange}
            sx={{ borderBottom: "0.5px solid #dee2e6" }}
          >
            <Tab icon={<PersonAddIcon />} label="LEAD" value="lead" />
            <Tab icon={<ShoppingCartIcon />} label="VENTAS" value="contact" />
            <Tab icon={<ReceiptIcon />} label="FACTURACIÓN" value="invoice" />
            <Tab icon={<InventoryIcon />} label="INVENTARIO" value="inventory" />
            <Tab icon={<AccountBalanceIcon />} label="CONTABILIDAD" value="accounting" />
            <Tab icon={<AssessmentIcon />} label="REPORTES" value="reports" />
          </Tabs>
        </Box>

        {/* Contenido del Módulo */}
        <Box sx={{ background: isDarkMode ? "#2d2d2d" : "white", p: 2 }}>
          {activeModule === 'contact' && (
            <ContactModule
              data={data}
              odooCustomer={customer}
              onCreateCustomer={handleCreateCustomer}
              isDarkMode={isDarkMode}
            />
          )}
        </Box>

        {/* Snackbar para mensaje enterprise */}
        <Snackbar
          open={showEnterpriseMessage}
          autoHideDuration={6000}
          onClose={handleCloseEnterpriseMessage}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseEnterpriseMessage} severity="info" sx={{ width: '100%' }}>
            Este módulo está disponible solo en la versión Enterprise. Contáctenos para más información.
          </Alert>
        </Snackbar>
      </Paper>
    </Container>
  );
}
