package handlers

import (
	"odoo-backend/internal/services"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

type OdooHandler struct {
	odooService *services.OdooService
}

func NewOdooHandler(odooService *services.OdooService) *OdooHandler {
	return &OdooHandler{
		odooService: odooService,
	}
}

// SearchCustomer searches for a customer by phone
func (h *OdooHandler) SearchCustomer(c *fiber.Ctx) error {
	type Request struct {
		Phone string `json:"phone"`
	}
	
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "phone requerido"})
	}
	
	if req.Phone == "" {
		return c.Status(400).JSON(fiber.Map{"error": "phone requerido"})
	}
	
	partners, err := h.odooService.SearchCustomer(req.Phone)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"count":   len(partners),
		"data":    partners,
	})
}

// CreateCustomer creates a new customer
func (h *OdooHandler) CreateCustomer(c *fiber.Ctx) error {
	type Request struct {
		Name  string `json:"name"`
		Phone string `json:"phone"`
		Email string `json:"email"`
	}
	
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	
	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name requerido"})
	}
	
	id, err := h.odooService.CreateCustomer(req.Name, req.Phone, req.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{
		"success": true,
		"id":      id,
	})
}

// SearchCustomerForPanel searches for a customer (for panel)
func (h *OdooHandler) SearchCustomerForPanel(c *fiber.Ctx) error {
	type Request struct {
		Phone string `json:"phone"`
		Email string `json:"email"`
	}
	
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	
	if req.Phone == "" && req.Email == "" {
		return c.JSON(fiber.Map{"found": false, "customer": nil})
	}
	
	// Use SearchCustomer which handles phone
	if req.Phone != "" {
		partners, err := h.odooService.SearchCustomer(req.Phone)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		
		if len(partners) > 0 {
			return c.JSON(fiber.Map{"found": true, "customer": partners[0]})
		}
	}
	
	return c.JSON(fiber.Map{"found": false, "customer": nil})
}

// CreateCustomerForPanel creates a customer (for panel)
func (h *OdooHandler) CreateCustomerForPanel(c *fiber.Ctx) error {
	type Request struct {
		Name  string `json:"name"`
		Phone string `json:"phone"`
		Email string `json:"email"`
	}
	
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	
	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name requerido"})
	}
	
	id, err := h.odooService.CreateCustomer(req.Name, req.Phone, req.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{
		"success":  true,
		"id":       id,
		"customer": fiber.Map{"id": id, "name": req.Name, "phone": req.Phone, "email": req.Email},
	})
}

// GetProducts retrieves products
func (h *OdooHandler) GetProducts(c *fiber.Ctx) error {
	products, err := h.odooService.GetProducts()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "products": products})
}

// CreateQuote creates a sale order
func (h *OdooHandler) CreateQuote(c *fiber.Ctx) error {
	type OrderLine struct {
		ProductID     int     `json:"product_id"`
		Name          string  `json:"name"`
		ProductUOMQty int     `json:"product_uom_qty"`
		PriceUnit     float64 `json:"price_unit"`
		ProductUOM    int     `json:"product_uom"`
	}
	
	type Request struct {
		PartnerID  int         `json:"partner_id"`
		OrderLines []OrderLine `json:"order_lines"`
		Note       string      `json:"note"`
	}
	
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	
	if req.PartnerID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "partner_id requerido"})
	}
	
	// Convert order lines
	lines := make([]services.OrderLine, len(req.OrderLines))
	for i, line := range req.OrderLines {
		lines[i] = services.OrderLine{
			ProductID:     line.ProductID,
			Name:          line.Name,
			ProductUOMQty: line.ProductUOMQty,
			PriceUnit:     line.PriceUnit,
			ProductUOM:    line.ProductUOM,
		}
	}
	
	id, err := h.odooService.CreateQuote(req.PartnerID, lines, req.Note)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "id": id})
}

// GetQuotesByPartner retrieves quotes for a partner
func (h *OdooHandler) GetQuotesByPartner(c *fiber.Ctx) error {
	partnerID, err := strconv.Atoi(c.Params("partner_id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid partner_id"})
	}
	
	quotes, err := h.odooService.GetQuotesByPartner(partnerID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "quotes": quotes})
}

// GetQuoteDetail retrieves quote detail
func (h *OdooHandler) GetQuoteDetail(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	
	quote, err := h.odooService.GetQuoteDetail(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "quote": quote})
}

// UpdateQuote updates a quote
func (h *OdooHandler) UpdateQuote(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	
	var data map[string]interface{}
	if err := c.BodyParser(&data); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	
	err = h.odooService.UpdateQuote(id, data)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true})
}

// CreateInvoiceFromQuote creates an invoice from a quote
func (h *OdooHandler) CreateInvoiceFromQuote(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	
	invoiceID, err := h.odooService.CreateInvoiceFromQuote(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "invoice_id": invoiceID})
}

// GetInvoiceStatus retrieves invoice status
func (h *OdooHandler) GetInvoiceStatus(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	
	hasInvoice, paymentState, err := h.odooService.GetInvoiceStatus(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{
		"has_invoice":   hasInvoice,
		"payment_state": paymentState,
	})
}

// GetInvoiceDetail retrieves invoice detail
func (h *OdooHandler) GetInvoiceDetail(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	
	invoice, err := h.odooService.GetInvoiceDetail(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "invoice": invoice})
}

// GetPaymentMethods retrieves payment methods
func (h *OdooHandler) GetPaymentMethods(c *fiber.Ctx) error {
	methods, err := h.odooService.GetPaymentMethods()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "methods": methods})
}

// GetJournals retrieves journals
func (h *OdooHandler) GetJournals(c *fiber.Ctx) error {
	journals, err := h.odooService.GetJournals()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "journals": journals})
}

// PayInvoice pays an invoice
func (h *OdooHandler) PayInvoice(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id"})
	}
	
	type Request struct {
		JournalID       int     `json:"journal_id"`
		PaymentMethodID int     `json:"payment_method_id"`
		Amount          float64 `json:"amount"`
	}
	
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	
	err = h.odooService.PayInvoice(id, req.JournalID, req.PaymentMethodID, req.Amount)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true})
}

// CreateLead creates a lead
func (h *OdooHandler) CreateLead(c *fiber.Ctx) error {
	type Request struct {
		Name  string `json:"name"`
		Phone string `json:"phone"`
		Email string `json:"email"`
	}
	
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	
	id, err := h.odooService.CreateLead(req.Name, req.Phone, req.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "id": id})
}

// GetLeads retrieves leads
func (h *OdooHandler) GetLeads(c *fiber.Ctx) error {
	leads, err := h.odooService.GetLeads()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "count": len(leads), "leads": leads})
}

// Health checks if the service is healthy
func (h *OdooHandler) Health(c *fiber.Ctx) error {
	_, err := h.odooService.GetUID()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"ok": false, "error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"ok": true})
}
