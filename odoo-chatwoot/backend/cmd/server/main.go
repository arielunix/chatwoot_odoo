package main

import (
	"log"
	"odoo-backend/internal/config"
	"odoo-backend/internal/handlers"
	"odoo-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize services
	odooService := services.NewOdooService(cfg)
	chatwootService := services.NewChatwootService(cfg)

	// Initialize handlers
	odooHandler := handlers.NewOdooHandler(odooService)
	chatwootHandler := handlers.NewChatwootHandler(chatwootService)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Odoo Backend",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// Health check
	app.Get("/health", odooHandler.Health)

	// Odoo routes
	app.Post("/odoo/customer", odooHandler.SearchCustomer)
	app.Post("/odoo/customer/create", odooHandler.CreateCustomer)
	app.Post("/odoo/search-customer", odooHandler.SearchCustomerForPanel)
	app.Post("/odoo/create-customer", odooHandler.CreateCustomerForPanel)
	app.Get("/odoo/products", odooHandler.GetProducts)
	app.Post("/odoo/quote", odooHandler.CreateQuote)
	app.Get("/odoo/quotes/:partner_id", odooHandler.GetQuotesByPartner)
	app.Get("/odoo/quote/:id/pdf", odooHandler.GetQuotePDF)
	app.Get("/odoo/quote/:id", odooHandler.GetQuoteDetail)
	app.Put("/odoo/quote/:id", odooHandler.UpdateQuote)
	app.Post("/odoo/quote/:id/invoice", odooHandler.CreateInvoiceFromQuote)
	app.Get("/odoo/quote/:id/invoice-status", odooHandler.GetInvoiceStatus)
	app.Get("/odoo/invoice/:id", odooHandler.GetInvoiceDetail)
	app.Get("/odoo/payment-methods", odooHandler.GetPaymentMethods)
	app.Get("/odoo/journals", odooHandler.GetJournals)
	app.Post("/odoo/invoice/:id/pay", odooHandler.PayInvoice)
	app.Post("/odoo/lead", odooHandler.CreateLead)
	app.Get("/odoo/leads", odooHandler.GetLeads)
	app.Get("/odoo/invoice/:id/pdf", odooHandler.GetInvoicePDF)

	// Chatwoot routes
	app.Post("/chatwoot/send-message", chatwootHandler.SendMessage)
	app.Post("/chatwoot/send-message-with-file", chatwootHandler.SendMessageWithFile)

	// Start server
	log.Printf("🚀 Server starting on port %s", cfg.Port)
	log.Fatal(app.Listen(":" + cfg.Port))
}
