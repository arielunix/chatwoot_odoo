package handlers

import (
	"fmt"
	"io"
	"odoo-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

type ChatwootHandler struct {
	chatwootService *services.ChatwootService
}

func NewChatwootHandler(chatwootService *services.ChatwootService) *ChatwootHandler {
	return &ChatwootHandler{
		chatwootService: chatwootService,
	}
}

// SendMessage sends a message to Chatwoot
func (h *ChatwootHandler) SendMessage(c *fiber.Ctx) error {
	type Request struct {
		ConversationID int    `json:"conversationId"`
		Content        string `json:"content"`
		MessageType    string `json:"messageType"`
	}
	
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	
	if req.ConversationID == 0 || req.Content == "" {
		return c.Status(400).JSON(fiber.Map{"error": "conversationId y content son requeridos"})
	}
	
	messageType := req.MessageType
	if messageType == "" {
		messageType = "outgoing"
	}
	
	result, err := h.chatwootService.SendMessage(req.ConversationID, req.Content, messageType)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "data": result})
}

// SendMessageWithFile sends a message with file attachment to Chatwoot
func (h *ChatwootHandler) SendMessageWithFile(c *fiber.Ctx) error {
	// Get form data
	conversationID := c.FormValue("conversationId")
	content := c.FormValue("content")
	messageType := c.FormValue("messageType")
	
	if conversationID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "conversationId es requerido"})
	}
	
	if content == "" {
		content = "Adjunto tu archivo 📎"
	}
	
	if messageType == "" {
		messageType = "outgoing"
	}
	
	// Get file
	file, err := c.FormFile("attachments[]")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "archivo es requerido"})
	}
	
	// Open file
	fileHeader, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer fileHeader.Close()
	
	// Read file data
	fileData, err := io.ReadAll(fileHeader)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	// Parse conversationID
	var convID int
	_, err = fmt.Sscanf(conversationID, "%d", &convID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid conversationId"})
	}
	
	// Send to Chatwoot
	result, err := h.chatwootService.SendMessageWithFile(convID, content, messageType, fileData, file.Filename)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	return c.JSON(fiber.Map{"success": true, "data": result})
}
