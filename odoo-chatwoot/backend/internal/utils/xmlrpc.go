package utils

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// XMLRPCCall performs an XML-RPC call to Odoo
func XMLRPCCall(odooURL, endpoint, xml string) (string, error) {
	url := odooURL + endpoint
	
	req, err := http.NewRequest("POST", url, bytes.NewBufferString(xml))
	if err != nil {
		return "", err
	}
	
	req.Header.Set("Content-Type", "text/xml")
	
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
	
	text := string(body)
	
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP Error: %d", resp.StatusCode)
	}
	
	if strings.Contains(text, "<fault>") {
		return "", fmt.Errorf("Odoo Fault: %s", text)
	}
	
	if strings.Contains(text, "AccessDenied") {
		return "", fmt.Errorf("Access Denied: use API KEY")
	}
	
	return text, nil
}

// Authenticate performs Odoo authentication
func Authenticate(odooURL, db, user, pass string) (int, error) {
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><struct/></value></param>
  </params>
</methodCall>`, db, user, pass)
	
	text, err := XMLRPCCall(odooURL, "/xmlrpc/2/common", xml)
	if err != nil {
		return 0, err
	}
	
	// Extract UID from response
	start := strings.Index(text, "<int>")
	if start == -1 {
		return 0, fmt.Errorf("Login failed: no UID found")
	}
	start += 5
	end := strings.Index(text[start:], "</int>")
	if end == -1 {
		return 0, fmt.Errorf("Login failed: invalid UID format")
	}
	
	var uid int
	_, err = fmt.Sscanf(text[start:start+end], "%d", &uid)
	if err != nil {
		return 0, fmt.Errorf("Login failed: invalid UID")
	}
	
	return uid, nil
}
