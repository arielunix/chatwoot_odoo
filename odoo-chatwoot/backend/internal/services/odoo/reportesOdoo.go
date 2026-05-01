package odoo

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"odoo-backend/internal/config"
	"strings"
)

type ReportService struct {
	config *config.Config
}

func NewReportService(cfg *config.Config) *ReportService {
	return &ReportService{
		config: cfg,
	}
}

// authenticateSession authenticates with Odoo using JSON-RPC and returns session ID
func (s *ReportService) authenticateSession() (string, error) {
	authPayload := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "call",
		"params": map[string]interface{}{
			"db":       s.config.OdooDB,
			"login":    s.config.OdooUser,
			"password": s.config.OdooPassSimple,
		},
	}
	
	jsonData, err := json.Marshal(authPayload)
	if err != nil {
		return "", err
	}
	
	url := fmt.Sprintf("%s/web/session/authenticate", s.config.OdooURL)
	req, err := http.NewRequest("POST", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	
	// Extract session_id from cookies
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "session_id" {
			return cookie.Value, nil
		}
	}
	
	// Try to extract from JSON response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err == nil {
		if resultObj, ok := result["result"].(map[string]interface{}); ok {
			if sessionID, ok := resultObj["session_id"].(string); ok {
				return sessionID, nil
			}
		}
	}
	
	return "", fmt.Errorf("could not extract session_id from response")
}

// GetQuotePDF generates and retrieves a PDF for a sale order (quote) using session authentication
func (s *ReportService) GetQuotePDF(quoteID int) ([]byte, error) {
	sessionID, err := s.authenticateSession()
	if err != nil {
		return nil, fmt.Errorf("failed to authenticate: %v", err)
	}
	
	reportURL := fmt.Sprintf("%s/report/pdf/sale.report_saleorder/%d", s.config.OdooURL, quoteID)
	
	req, err := http.NewRequest("GET", reportURL, nil)
	if err != nil {
		return nil, err
	}
	
	// Set session cookie
	req.Header.Set("Cookie", fmt.Sprintf("session_id=%s", sessionID))
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Odoo Report Error: %d - %s", resp.StatusCode, string(body))
	}
	
	pdfData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	// Check if we got HTML (login page) instead of PDF
	if strings.HasPrefix(string(pdfData), "<!DOCTYPE") || strings.HasPrefix(string(pdfData), "<html") {
		return nil, fmt.Errorf("Authentication failed - got HTML instead of PDF")
	}
	
	return pdfData, nil
}

// GetQuoteReference gets the reference number for a quote
func (s *ReportService) GetQuoteReference(quoteID int) (string, error) {
	// For now, return a default format
	return fmt.Sprintf("S%05d", quoteID), nil
}

// GetInvoicePDF generates and retrieves a PDF for an invoice using session authentication
func (s *ReportService) GetInvoicePDF(invoiceID int) ([]byte, error) {
	sessionID, err := s.authenticateSession()
	if err != nil {
		return nil, fmt.Errorf("failed to authenticate: %v", err)
	}
	
	reportURL := fmt.Sprintf("%s/report/pdf/account.report_invoice/%d", s.config.OdooURL, invoiceID)
	
	req, err := http.NewRequest("GET", reportURL, nil)
	if err != nil {
		return nil, err
	}
	
	// Set session cookie
	req.Header.Set("Cookie", fmt.Sprintf("session_id=%s", sessionID))
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Odoo Report Error: %d - %s", resp.StatusCode, string(body))
	}
	
	pdfData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	// Check if we got HTML (login page) instead of PDF
	if strings.HasPrefix(string(pdfData), "<!DOCTYPE") || strings.HasPrefix(string(pdfData), "<html") {
		return nil, fmt.Errorf("Authentication failed - got HTML instead of PDF")
	}
	
	return pdfData, nil
}
