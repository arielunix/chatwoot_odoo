package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"odoo-backend/internal/config"
)

type ChatwootService struct {
	config *config.Config
}

func NewChatwootService(cfg *config.Config) *ChatwootService {
	return &ChatwootService{
		config: cfg,
	}
}

// SendMessage sends a message to Chatwoot
func (s *ChatwootService) SendMessage(conversationID int, content, messageType string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/v1/accounts/%s/conversations/%d/messages",
		s.config.ChatwootURL, s.config.ChatwootAccountID, conversationID)
	
	payload := map[string]interface{}{
		"content":      content,
		"message_type": messageType,
		"private":      false,
	}
	
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api_access_token", s.config.ChatwootToken)
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Chatwoot Error: %d", resp.StatusCode)
	}
	
	var result map[string]interface{}
	err = json.Unmarshal(body, &result)
	if err != nil {
		return nil, err
	}
	
	return result, nil
}

// SendMessageWithFile sends a message with file attachment to Chatwoot
func (s *ChatwootService) SendMessageWithFile(conversationID int, content, messageType string, fileData []byte, filename string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/v1/accounts/%s/conversations/%d/messages",
		s.config.ChatwootURL, s.config.ChatwootAccountID, conversationID)
	
	// Create multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	
	// Add content field
	writer.WriteField("content", content)
	
	// Add message_type field
	writer.WriteField("message_type", messageType)
	
	// Add file
	part, err := writer.CreateFormFile("attachments[]", filename)
	if err != nil {
		return nil, err
	}
	_, err = part.Write(fileData)
	if err != nil {
		return nil, err
	}
	
	err = writer.Close()
	if err != nil {
		return nil, err
	}
	
	// Create request
	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("api_access_token", s.config.ChatwootToken)
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Chatwoot Error: %d", resp.StatusCode)
	}
	
	var result map[string]interface{}
	err = json.Unmarshal(respBody, &result)
	if err != nil {
		return nil, err
	}
	
	return result, nil
}
