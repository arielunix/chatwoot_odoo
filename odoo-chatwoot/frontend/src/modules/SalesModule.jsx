import { useState, useEffect } from "react";
import { Box, Typography, TextField, Alert, Button as MuiButton, Divider, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";
import { useOdoo } from "../hooks/useOdoo";

function ccyFormat(num) {
  return `${num.toFixed(2)}`;
}

function priceRow(qty, unit) {
  return qty * unit;
}

function subtotal(items) {
  return items.map(({ price }) => price).reduce((sum, i) => sum + i, 0);
}

export const SalesModule = ({ odooCustomer }) => {
  const { getProducts, createQuote } = useOdoo();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [note, setNote] = useState("");
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [quoteCreated, setQuoteCreated] = useState(null);

  // Búsqueda asíncrona de productos
  useEffect(() => {
    const searchProducts = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const result = await getProducts();
        const filtered = (result || []).filter(p =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error("Error buscando productos:", err);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, getProducts]);

  const addProductToCart = (product) => {
    const existing = cart.find(p => p.id === product.id);
    if (existing) {
      setCart(cart.map(p =>
        p.id === product.id ? { ...p, qty: p.qty + 1 } : p
      ));
    } else {
      setCart([...cart, { 
        ...product, 
        qty: 1,
        customPrice: product.price || 0,
        customDescription: product.name || ""
      }]);
    }
    setSearchTerm("");
    setSearchResults([]);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateCartItem = (index, field, value) => {
    setCart(cart.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleCreateQuote = async () => {
    if (!odooCustomer?.id) {
      alert("Necesitas crear un cliente en Odoo primero");
      return;
    }

    if (cart.length === 0) {
      alert("Agrega al menos un producto al carrito");
      return;
    }

    setCreatingQuote(true);
    try {
      const orderLines = cart.map(p => ({
        product_id: p.id,
        qty: p.qty,
        price: p.customPrice || p.price || 0,
        name: p.customDescription || p.name || "",
      }));

      console.log("📝 Enviando presupuesto con nota:", note);
      console.log("📝 OrderLines:", orderLines);

      const result = await createQuote(odooCustomer.id, orderLines, note);
      console.log("✅ Resultado:", result);
      
      if (result.success) {
        setQuoteCreated(result.id);
        setCart([]);
        setNote("");
      }
    } catch (err) {
      console.error("Error creando presupuesto:", err);
      alert("Error al crear presupuesto");
    } finally {
      setCreatingQuote(false);
    }
  };


  return (
    <Box>
      {!odooCustomer && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Necesitas crear un cliente en Odoo primero para gestionar ventas
        </Alert>
      )}

      {quoteCreated && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Presupuesto creado exitosamente (ID: {quoteCreated})
        </Alert>
      )}

      {/* Búsqueda de Productos */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
          Buscar Producto
        </Typography>
        <TextField
          fullWidth
          placeholder="Escribe para buscar productos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={searchLoading}
          size="small"
        />
        
        {/* Resultados de búsqueda */}
        {searchResults.length > 0 && (
          <Card sx={{ mt: 2 }}>
            <CardContent sx={{ p: 1 }}>
              {searchResults.map((product) => (
                <Box
                  key={product.id}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    p: 1,
                    borderBottom: "1px solid #dee2e6",
                    "&:last-child": { borderBottom: "none" }
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {product.name}
                    </Typography>
                    <Typography variant="caption" color="#6c757d">
                      {product.code || "Sin código"} • ${product.price?.toFixed(2) || "0.00"}
                    </Typography>
                  </Box>
                  <MuiButton
                    onClick={() => addProductToCart(product)}
                    size="small"
                    variant="contained"
                  >
                    +
                  </MuiButton>
                </Box>
              ))}
            </CardContent>
          </Card>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Carrito de Compras */}
      <Box>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
          Carrito ({cart.length} productos)
        </Typography>
        
        {cart.length === 0 ? (
          <Alert severity="info">
            El carrito está vacío. Busca productos para agregar.
          </Alert>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Tabla de productos */}
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 700 }} aria-label="spanning table">
                <TableHead>
                  <TableRow>
                    <TableCell align="center" colSpan={3}>
                      Detalles
                    </TableCell>
                    <TableCell align="right">Precio</TableCell>
                    <TableCell align="right">Acción</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Descripción</TableCell>
                    <TableCell align="right">Cant.</TableCell>
                    <TableCell align="right">Unit.</TableCell>
                    <TableCell align="right">Sum</TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          fullWidth
                          value={item.customDescription}
                          onChange={(e) => updateCartItem(index, "customDescription", e.target.value)}
                          size="small"
                          multiline
                          rows={1}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateCartItem(index, "qty", parseInt(e.target.value) || 1)}
                          size="small"
                          inputProps={{ min: 1, style: { textAlign: 'right' } }}
                          sx={{ width: 80 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          value={item.customPrice}
                          onChange={(e) => updateCartItem(index, "customPrice", parseFloat(e.target.value) || 0)}
                          size="small"
                          inputProps={{ step: 0.01, min: 0, style: { textAlign: 'right' } }}
                          sx={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        ${ccyFormat(priceRow(item.qty, item.customPrice || item.price || 0))}
                      </TableCell>
                      <TableCell align="right">
                        <MuiButton
                          onClick={() => removeFromCart(index)}
                          color="error"
                          size="small"
                        >
                          ×
                        </MuiButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell rowSpan={2} />
                    <TableCell colSpan={2}>Subtotal</TableCell>
                    <TableCell align="right">${ccyFormat(subtotal(cart.map(p => ({ price: priceRow(p.qty, p.customPrice || p.price || 0) }))))}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell align="right">${ccyFormat(subtotal(cart.map(p => ({ price: priceRow(p.qty, p.customPrice || p.price || 0) }))))}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Campo de nota */}
            <TextField
              fullWidth
              label="Nota (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Agrega una nota para el cliente..."
              multiline
              rows={3}
              size="small"
            />

            {/* Botón de crear presupuesto */}
            <MuiButton
              onClick={handleCreateQuote}
              disabled={creatingQuote}
              variant="contained"
              color="primary"
              size="large"
              fullWidth
            >
              {creatingQuote ? "Creando..." : "Crear Presupuesto"}
            </MuiButton>
          </Box>
        )}
      </Box>
    </Box>
  );
};
