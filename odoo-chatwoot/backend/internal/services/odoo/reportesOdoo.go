package odoo

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"odoo-backend/internal/config"
	"odoo-backend/internal/utils"
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
	fmt.Printf("GetQuotePDF: Starting for quote ID %d\n", quoteID)
	
	sessionID, err := s.authenticateSession()
	if err != nil {
		fmt.Printf("GetQuotePDF: Authentication failed: %v\n", err)
		return nil, fmt.Errorf("failed to authenticate: %v", err)
	}
	
	fmt.Printf("GetQuotePDF: Session ID obtained: %s\n", sessionID)
	
	reportURL := fmt.Sprintf("%s/report/pdf/sale.report_saleorder/%d", s.config.OdooURL, quoteID)
	fmt.Printf("GetQuotePDF: Report URL: %s\n", reportURL)
	
	req, err := http.NewRequest("GET", reportURL, nil)
	if err != nil {
		fmt.Printf("GetQuotePDF: Failed to create request: %v\n", err)
		return nil, err
	}
	
	// Set session cookie
	req.Header.Set("Cookie", fmt.Sprintf("session_id=%s", sessionID))
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("GetQuotePDF: Request failed: %v\n", err)
		return nil, err
	}
	defer resp.Body.Close()
	
	fmt.Printf("GetQuotePDF: Response status: %d\n", resp.StatusCode)
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("GetQuotePDF: Odoo returned error: %d - %s\n", resp.StatusCode, string(body))
		return nil, fmt.Errorf("Odoo Report Error: %d - %s", resp.StatusCode, string(body))
	}
	
	pdfData, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("GetQuotePDF: Failed to read response body: %v\n", err)
		return nil, err
	}
	
	fmt.Printf("GetQuotePDF: PDF data size: %d bytes\n", len(pdfData))
	
	// Check if we got HTML (login page) instead of PDF
	if strings.HasPrefix(string(pdfData), "<!DOCTYPE") || strings.HasPrefix(string(pdfData), "<html") {
		fmt.Printf("GetQuotePDF: Got HTML instead of PDF (authentication failed)\n")
		return nil, fmt.Errorf("Authentication failed - got HTML instead of PDF")
	}
	
	fmt.Printf("GetQuotePDF: PDF retrieved successfully\n")
	return pdfData, nil
}

// GetQuoteReference gets the reference number for a quote
func (s *ReportService) GetQuoteReference(quoteID int) (string, error) {
	// Authenticate to get UID using XML-RPC (which works)
	uid, err := utils.Authenticate(s.config.OdooURL, s.config.OdooDB, s.config.OdooUser, s.config.OdooPass)
	if err != nil {
		return "", err
	}
	
	// Get the quote's name (reference) using XML-RPC
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>sale.order</string></value></param>
    <param><value><string>read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array><data><value><int>%d</int></value></data></array></value>
          </data>
        </array>
      </value>
    </param>
    <param>
      <value>
        <struct>
          <member>
            <name>fields</name>
            <value>
              <array>
                <data>
                  <value><string>name</string></value>
                </data>
              </array>
            </value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, quoteID)
	
	response, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return "", err
	}
	
	// Parse the name field - look for <value><string>NAME</string></value>
	start := strings.Index(response, "<value><string>")
	if start == -1 {
		return "", fmt.Errorf("could not find quote name in response")
	}
	start += 17
	end := strings.Index(response[start:], "</string></value>")
	if end == -1 {
		return "", fmt.Errorf("invalid quote name format")
	}
	
	name := response[start : start+end]
	return name, nil
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
