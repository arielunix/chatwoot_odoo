package odoo

import (
	"fmt"
	"odoo-backend/internal/config"
	"odoo-backend/internal/utils"
	"regexp"
	"strconv"
	"strings"
)

// InvoiceService handles invoice creation from quotes
type InvoiceService struct {
	config *config.Config
}

// NewInvoiceService creates a new invoice service
func NewInvoiceService(cfg *config.Config) *InvoiceService {
	return &InvoiceService{config: cfg}
}

// CreateInvoiceFromQuote creates an invoice from a quote using the manual approach
func (s *InvoiceService) CreateInvoiceFromQuote(quoteID int, uid int) (int, error) {
	fmt.Println("Step 1: Getting quote details", quoteID)
	
	// Get quote details
	quoteXML := fmt.Sprintf(`<?xml version="1.0"?>
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
            <value><array>
              <data>
                <value><int>%d</int></value>
              </data>
            </array></value>
            <value><array>
              <data>
                <value><string>state</string></value>
                <value><string>partner_id</string></value>
                <value><string>partner_shipping_id</string></value>
                <value><string>order_line</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, quoteID)
	
	quoteText, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", quoteXML)
	if err != nil {
		return 0, fmt.Errorf("error getting quote details: %v", err)
	}
	
	fmt.Println("Quote details response:", quoteText)
	
	// Extract state
	stateMatch := regexp.MustCompile(`<name>state<\/name>[\s\S]*?<value><string>(.*?)<\/string>`).FindStringSubmatch(quoteText)
	state := ""
	if len(stateMatch) > 1 {
		state = stateMatch[1]
	}
	fmt.Println("Quote state:", state)
	
	// Extract partner_id
	partnerMatch := regexp.MustCompile(`<name>partner_id<\/name>[\s\S]*?<value><array>[\s\S]*?<value><int>(\d+)<\/int>`).FindStringSubmatch(quoteText)
	partnerID := 0
	if len(partnerMatch) > 1 {
		partnerID, _ = strconv.Atoi(partnerMatch[1])
	}
	fmt.Println("Partner ID:", partnerID)
	
	// Extract partner_shipping_id
	shippingMatch := regexp.MustCompile(`<name>partner_shipping_id<\/name>[\s\S]*?<value><array>[\s\S]*?<value><int>(\d+)<\/int>`).FindStringSubmatch(quoteText)
	shippingID := partnerID
	if len(shippingMatch) > 1 {
		shippingID, _ = strconv.Atoi(shippingMatch[1])
	}
	fmt.Println("Shipping ID:", shippingID)
	
	// Extract order_line IDs - capture all <int> tags within order_line array
	orderLinePattern := regexp.MustCompile(`<name>order_line<\/name>[\s\S]*?<value><array>[\s\S]*?<data>[\s\S]*?((?:<value><int>\d+<\/int>[\s\S]*?)+)</data>`)
	orderLineMatch := orderLinePattern.FindStringSubmatch(quoteText)
	var orderLineIDs []int
	if len(orderLineMatch) > 1 {
		// Extract all individual IDs from the matched section
		idPattern := regexp.MustCompile(`<int>(\d+)<\/int>`)
		idMatches := idPattern.FindAllStringSubmatch(orderLineMatch[1], -1)
		for _, match := range idMatches {
			if len(match) > 1 {
				if id, err := strconv.Atoi(match[1]); err == nil {
					orderLineIDs = append(orderLineIDs, id)
				}
			}
		}
	}
	fmt.Println("Order line IDs:", orderLineIDs)
	
	// Confirm quote if in draft or sent state
	if state == "draft" || state == "sent" {
		fmt.Println("Step 2: Confirming quote")
		confirmXML := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>sale.order</string></value></param>
    <param><value><string>action_confirm</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>%d</int></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, quoteID)
		
		_, err = utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", confirmXML)
		if err != nil {
			return 0, fmt.Errorf("error confirming quote: %v", err)
		}
		fmt.Println("Quote confirmed successfully")
	} else {
		fmt.Println("Quote already confirmed, skipping confirmation step")
	}
	
	// Get order line details
	fmt.Println("Step 3: Getting order line details")
	var invoiceLinesXML string
	if len(orderLineIDs) > 0 {
		lineIDsXML := ""
		for _, lineID := range orderLineIDs {
			lineIDsXML += fmt.Sprintf(`<value><int>%d</int></value>`, lineID)
		}
		
		linesXML := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>sale.order.line</string></value></param>
    <param><value><string>read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                %s
              </data>
            </array></value>
            <value><array>
              <data>
                <value><string>product_id</string></value>
                <value><string>product_uom_qty</string></value>
                <value><string>price_unit</string></value>
                <value><string>name</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, lineIDsXML)
		
		linesText, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", linesXML)
		if err != nil {
			return 0, fmt.Errorf("error getting order line details: %v", err)
		}
		
		fmt.Println("Order lines response:", linesText)
		
		// Parse lines to create invoice lines
		lineStructs := regexp.MustCompile(`<struct>([\s\S]*?)<\/struct>`).FindAllStringSubmatch(linesText, -1)
		for i, match := range lineStructs {
			if len(match) > 1 {
				lineStruct := match[1]
				
				productIdMatch := regexp.MustCompile(`<name>product_id<\/name>[\s\S]*?<value><array>[\s\S]*?<value><int>(\d+)<\/int>`).FindStringSubmatch(lineStruct)
				qtyMatch := regexp.MustCompile(`<name>product_uom_qty<\/name>[\s\S]*?<value><double>([\d.]+)<\/double>`).FindStringSubmatch(lineStruct)
				priceMatch := regexp.MustCompile(`<name>price_unit<\/name>[\s\S]*?<value><double>([\d.]+)<\/double>`).FindStringSubmatch(lineStruct)
				nameMatch := regexp.MustCompile(`<name>name<\/name>[\s\S]*?<value><string>(.*?)<\/string>`).FindStringSubmatch(lineStruct)
				
				productID := 0
				if len(productIdMatch) > 1 {
					productID, _ = strconv.Atoi(productIdMatch[1])
				}
				
				qty := 1.0
				if len(qtyMatch) > 1 {
					qty, _ = strconv.ParseFloat(qtyMatch[1], 64)
				}
				
				price := 0.0
				if len(priceMatch) > 1 {
					price, _ = strconv.ParseFloat(priceMatch[1], 64)
				}
				
				name := ""
				if len(nameMatch) > 1 {
					name = nameMatch[1]
				}
				
				fmt.Printf("Line %d: Product ID %d, Qty %.2f, Price %.2f, Name %s\n", i+1, productID, qty, price, name)
				
				// Use command (0, 0, {...}) to create new line
				invoiceLinesXML += fmt.Sprintf(`
                    <value>
                      <array>
                        <data>
                          <value><int>0</int></value>
                          <value><int>0</int></value>
                          <value>
                            <struct>
                              <member>
                                <name>product_id</name>
                                <value><int>%d</int></value>
                              </member>
                              <member>
                                <name>quantity</name>
                                <value><double>%.2f</double></value>
                              </member>
                              <member>
                                <name>price_unit</name>
                                <value><double>%.2f</double></value>
                              </member>
                              <member>
                                <name>name</name>
                                <value><string>%s</string></value>
                              </member>
                            </struct>
                          </value>
                        </data>
                      </array>
                    </value>`, productID, qty, price, name)
			}
		}
	}
	
	// Create invoice manually with account.move
	fmt.Println("Step 4: Creating invoice with account.move")
	invoiceXML := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>create</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value>
                  <struct>
                    <member>
                      <name>move_type</name>
                      <value><string>out_invoice</string></value>
                    </member>
                    <member>
                      <name>partner_id</name>
                      <value><int>%d</int></value>
                    </member>
                    <member>
                      <name>partner_shipping_id</name>
                      <value><int>%d</int></value>
                    </member>
                    <member>
                      <name>invoice_origin</name>
                      <value><string>S%d</string></value>
                    </member>
                    <member>
                      <name>invoice_line_ids</name>
                      <value>
                        <array>
                          <data>%s
                          </data>
                        </array>
                      </value>
                    </member>
                  </struct>
                </value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, partnerID, shippingID, quoteID, invoiceLinesXML)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", invoiceXML)
	if err != nil {
		return 0, fmt.Errorf("error creating invoice: %v", err)
	}
	
	fmt.Println("Invoice creation response:", text)
	
	// Parse the result to get invoice ID
	invoiceIDMatch := regexp.MustCompile(`<int>(\d+)<\/int>`).FindStringSubmatch(text)
	invoiceID := 0
	if len(invoiceIDMatch) > 1 {
		invoiceID, _ = strconv.Atoi(invoiceIDMatch[1])
	}
	
	fmt.Println("Invoice ID created:", invoiceID)
	
	if invoiceID == 0 {
		return 0, fmt.Errorf("could not get invoice ID from response")
	}
	
	// Validate the invoice (change from draft to posted)
	fmt.Println("Step 5: Validating invoice")
	validateXML := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>action_post</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>%d</int></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, invoiceID)
	
	_, err = utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", validateXML)
	if err != nil {
		return 0, fmt.Errorf("error validating invoice: %v", err)
	}
	
	fmt.Println("Invoice validated successfully")
	
	return invoiceID, nil
}

// GetInvoiceDetail retrieves invoice detail
func (s *InvoiceService) GetInvoiceDetail(invoiceID int, uid int) (*utils.InvoiceDetail, error) {
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array><data><value><int>%d</int></value></data></array></value>
            <value><array>
              <data>
                <value><string>id</string></value>
                <value><string>name</string></value>
                <value><string>state</string></value>
                <value><string>move_type</string></value>
                <value><string>partner_id</string></value>
                <value><string>invoice_date</string></value>
                <value><string>amount_total</string></value>
                <value><string>amount_untaxed</string></value>
                <value><string>amount_tax</string></value>
                <value><string>invoice_origin</string></value>
                <value><string>invoice_line_ids</string></value>
                <value><string>payment_state</string></value>
                <value><string>amount_residual</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, invoiceID)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return nil, err
	}
	
	return utils.ParseInvoiceDetail(text), nil
}

// PayInvoice pays an invoice using the account.payment.register wizard
func (s *InvoiceService) PayInvoice(invoiceID, journalID, paymentMethodID int, amount float64, uid int) error {
	fmt.Printf("Paying invoice ID: %d, Amount: %.2f, Journal: %d\n", invoiceID, amount, journalID)
	
	// 1. Get invoice details to obtain partner_id and amount_residual
	invoiceXML := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array><data><value><int>%d</int></value></data></array></value>
            <value><array><data><value><string>partner_id</string></value><value><string>amount_residual</string></value></data></array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, invoiceID)
	
	invoiceText, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", invoiceXML)
	if err != nil {
		return fmt.Errorf("error getting invoice: %v", err)
	}
	
	detail := utils.ParseInvoiceDetail(invoiceText)
	if detail == nil {
		return fmt.Errorf("invoice not found")
	}
	
	partnerID := detail.PartnerID
	amountResidual := detail.AmountResidual
	fmt.Printf("Partner ID: %d, Amount Residual: %.2f\n", partnerID, amountResidual)
	
	// Use amount_residual for payment instead of user-provided amount
	paymentAmount := amountResidual
	
	// 2. Get invoice lines for the wizard
	linesXML := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.move.line</string></value></param>
    <param><value><string>search</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><array>
                  <data>
                    <value><string>move_id</string></value>
                    <value><string>=</string></value>
                    <value><int>%d</int></value>
                  </data>
                </array></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, invoiceID)
	
	linesText, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", linesXML)
	if err != nil {
		return fmt.Errorf("error getting invoice lines: %v", err)
	}
	
	lineMatches := regexp.MustCompile(`<int>(\d+)<\/int>`).FindAllStringSubmatch(linesText, -1)
	var lineIDs []int
	for _, match := range lineMatches {
		if len(match) > 1 {
			if id, err := strconv.Atoi(match[1]); err == nil {
				lineIDs = append(lineIDs, id)
			}
		}
	}
	
	if len(lineIDs) == 0 {
		return fmt.Errorf("no invoice lines found")
	}
	
	fmt.Printf("Invoice line IDs: %v\n", lineIDs)
	
	// 3. Create wizard account.payment.register
	lineIDsXML := ""
	for _, lineID := range lineIDs {
		lineIDsXML += fmt.Sprintf(`<value><int>%d</int></value>`, lineID)
	}
	
	wizardXML := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.payment.register</string></value></param>
    <param><value><string>create</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value>
                  <struct>
                    <member>
                      <name>amount</name>
                      <value><double>%.2f</double></value>
                    </member>
                    <member>
                      <name>journal_id</name>
                      <value><int>%d</int></value>
                    </member>
                    <member>
                      <name>payment_type</name>
                      <value><string>inbound</string></value>
                    </member>
                    <member>
                      <name>line_ids</name>
                      <value><array><data>%s</data></array></value>
                    </member>
                  </struct>
                </value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, paymentAmount, journalID, lineIDsXML)
	
	fmt.Println("Creating wizard...")
	wizardText, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", wizardXML)
	if err != nil {
		return fmt.Errorf("error creating wizard: %v", err)
	}
	
	fmt.Println("Wizard response:", wizardText)
	
	wizardIDMatch := regexp.MustCompile(`<int>(\d+)<\/int>`).FindStringSubmatch(wizardText)
	wizardID := 0
	if len(wizardIDMatch) > 1 {
		wizardID, _ = strconv.Atoi(wizardIDMatch[1])
	}
	
	fmt.Printf("Wizard ID: %d\n", wizardID)
	
	if wizardID == 0 {
		return fmt.Errorf("could not create wizard")
	}
	
	// 4. Call action_create_payments
	createPaymentsXML := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.payment.register</string></value></param>
    <param><value><string>action_create_payments</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>%d</int></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, wizardID)
	
	fmt.Println("Calling action_create_payments...")
	paymentResponse, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", createPaymentsXML)
	if err != nil {
		fmt.Println("XML-RPC Error calling action_create_payments:", err)
		// Check for specific error about payment method line in the error message
		if strings.Contains(err.Error(), "línea de método de pago") || strings.Contains(err.Error(), "payment method line") {
			return fmt.Errorf("El diario seleccionado no tiene configurado un método de pago. Por favor, seleccione un diario válido (Efectivo o Banco).")
		}
		return fmt.Errorf("error creating payments: %v", err)
	}
	
	fmt.Println("Payment response:", paymentResponse)
	
	// Check for specific Odoo errors in response
	if strings.Contains(paymentResponse, "fault") {
		// Check for specific error about payment method line
		if strings.Contains(paymentResponse, "línea de método de pago") || strings.Contains(paymentResponse, "payment method line") {
			return fmt.Errorf("El diario seleccionado no tiene configurado un método de pago. Por favor, seleccione un diario válido (Efectivo o Banco).")
		}
		return fmt.Errorf("Odoo error: %s", paymentResponse)
	}
	
	fmt.Println("Payment created successfully")
	
	return nil
}
