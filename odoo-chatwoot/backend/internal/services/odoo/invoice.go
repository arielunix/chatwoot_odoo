package odoo

import (
	"fmt"
	"odoo-backend/internal/config"
	"odoo-backend/internal/utils"
	"regexp"
	"strconv"
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
