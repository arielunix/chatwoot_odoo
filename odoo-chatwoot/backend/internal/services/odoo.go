package services

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"odoo-backend/internal/config"
	"odoo-backend/internal/services/odoo"
	"odoo-backend/internal/utils"
	"regexp"
	"strconv"
	"strings"
)

// downloadAndEncodeImage downloads an image from URL and returns base64 encoded string
func downloadAndEncodeImage(url string) (string, error) {
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to download image: status %d", resp.StatusCode)
	}

	imageData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// Convert to base64 without data URI prefix (Odoo expects raw base64)
	base64Str := base64.StdEncoding.EncodeToString(imageData)
	return base64Str, nil
}

type OdooService struct {
	config        *config.Config
	uidCache      *int
	ReportService *odoo.ReportService
	InvoiceService *odoo.InvoiceService
}

func NewOdooService(cfg *config.Config) *OdooService {
	return &OdooService{
		config:        cfg,
		uidCache:      nil,
		ReportService: odoo.NewReportService(cfg),
		InvoiceService: odoo.NewInvoiceService(cfg),
	}
}

func (s *OdooService) GetUID() (int, error) {
	if s.uidCache != nil {
		return *s.uidCache, nil
	}
	
	uid, err := utils.Authenticate(s.config.OdooURL, s.config.OdooDB, s.config.OdooUser, s.config.OdooPass)
	if err != nil {
		return 0, err
	}
	
	s.uidCache = &uid
	return uid, nil
}

// SearchCustomer searches for a customer by phone
func (s *OdooService) SearchCustomer(phone string) ([]utils.Partner, error) {
	uid, err := s.GetUID()
	if err != nil {
		return nil, err
	}
	
	cleanPhone := utils.CleanPhone(phone)
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>res.partner</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <array>
                <data>
                  <value><string>|</string></value>
                  <value>
                    <array>
                      <data>
                        <value><string>phone</string></value>
                        <value><string>ilike</string></value>
                        <value><string>%s</string></value>
                      </data>
                    </array>
                  </value>
                  <value>
                    <array>
                      <data>
                        <value><string>mobile</string></value>
                        <value><string>ilike</string></value>
                        <value><string>%s</string></value>
                      </data>
                    </array>
                  </value>
                </data>
              </array>
            </value>
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
                  <value><string>id</string></value>
                  <value><string>name</string></value>
                  <value><string>phone</string></value>
                  <value><string>mobile</string></value>
                  <value><string>email</string></value>
                </data>
              </array>
            </value>
          </member>
          <member>
            <name>limit</name>
            <value><int>5</int></value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, cleanPhone, cleanPhone)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return nil, err
	}
	
	return utils.ParsePartners(text), nil
}

// CreateCustomer creates a new customer
func (s *OdooService) CreateCustomer(name, phone, email, imageURL string) (int, error) {
	uid, err := s.GetUID()
	if err != nil {
		return 0, err
	}
	
	var imageXML string
	if imageURL != "" {
		// Download image and convert to base64 (optional - if it fails, continue without image)
		imageBase64, err := downloadAndEncodeImage(imageURL)
		if err == nil && imageBase64 != "" {
			imageXML = fmt.Sprintf(`
                <member>
                  <name>image_1920</name>
                  <value><string>%s</string></value>
                </member>`, imageBase64)
		}
		// If image download fails, we continue without the image (graceful degradation)
	}
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>res.partner</string></value></param>
    <param><value><string>create</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <struct>
                <member>
                  <name>name</name>
                  <value><string>%s</string></value>
                </member>
                <member>
                  <name>phone</name>
                  <value><string>%s</string></value>
                </member>
                <member>
                  <name>email</name>
                  <value><string>%s</string></value>
                </member>%s
              </struct>
            </value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, name, phone, email, imageXML)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return 0, err
	}
	
	// Extract ID from response
	start := strings.Index(text, "<int>")
	if start == -1 {
		return 0, fmt.Errorf("create failed: no ID found")
	}
	start += 5
	end := strings.Index(text[start:], "</int>")
	if end == -1 {
		return 0, fmt.Errorf("create failed: invalid ID format")
	}
	
	var id int
	_, err = fmt.Sscanf(text[start:start+end], "%d", &id)
	if err != nil {
		return 0, fmt.Errorf("create failed: invalid ID")
	}
	
	return id, nil
}

// GetProducts retrieves products
func (s *OdooService) GetProducts() ([]utils.Product, error) {
	uid, err := s.GetUID()
	if err != nil {
		return nil, err
	}
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>product.product</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <array>
                <data>
                </data>
              </array>
            </value>
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
                  <value><string>id</string></value>
                  <value><string>name</string></value>
                  <value><string>list_price</string></value>
                  <value><string>default_code</string></value>
                  <value><string>uom_id</string></value>
                </data>
              </array>
            </value>
          </member>
          <member>
            <name>limit</name>
            <value><int>50</int></value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return nil, err
	}
	
	return utils.ParseProducts(text), nil
}

// CreateQuote creates a sale order (quote)
func (s *OdooService) CreateQuote(partnerID int, orderLines []OrderLine, note string) (int, error) {
	uid, err := s.GetUID()
	if err != nil {
		return 0, err
	}
	
	// Build order lines XML
	orderLinesXML := ""
	for _, line := range orderLines {
		orderLinesXML += fmt.Sprintf(`
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
                            <name>product_uom_qty</name>
                            <value><int>%d</int></value>
                          </member>
                          <member>
                            <name>price_unit</name>
                            <value><double>%.2f</double></value>
                          </member>
                          %s
                          %s
                        </struct>
                      </value>
                    </data>
                  </array>
                </value>`, line.ProductID, line.ProductUOMQty, line.PriceUnit, 
			func() string {
				if line.Name != "" {
					return fmt.Sprintf(`<member><name>name</name><value><string>%s</string></value></member>`, line.Name)
				}
				return ""
			}(),
			func() string {
				if line.ProductUOM > 0 {
					return fmt.Sprintf(`<member><name>product_uom</name><value><int>%d</int></value></member>`, line.ProductUOM)
				}
				return ""
			}())
	}
	
	noteXML := fmt.Sprintf(`<member><name>note</name><value><string>%s</string></value></member>`, note)
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>sale.order</string></value></param>
    <param><value><string>create</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <struct>
                <member>
                  <name>partner_id</name>
                  <value><int>%d</int></value>
                </member>
                <member>
                  <name>order_line</name>
                  <value>
                    <array>
                      <data>%s</data>
                    </array>
                  </value>
                </member>
                %s
              </struct>
            </value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, partnerID, orderLinesXML, noteXML)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return 0, err
	}
	
	// Extract ID from response
	start := strings.Index(text, "<int>")
	if start == -1 {
		return 0, fmt.Errorf("create quote failed: no ID found")
	}
	start += 5
	end := strings.Index(text[start:], "</int>")
	if end == -1 {
		return 0, fmt.Errorf("create quote failed: invalid ID format")
	}
	
	var id int
	_, err = fmt.Sscanf(text[start:start+end], "%d", &id)
	if err != nil {
		return 0, fmt.Errorf("create quote failed: invalid ID")
	}
	
	return id, nil
}

// GetQuotesByPartner retrieves quotes for a partner
func (s *OdooService) GetQuotesByPartner(partnerID int) ([]utils.Quote, error) {
	uid, err := s.GetUID()
	if err != nil {
		return nil, err
	}
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>sale.order</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><array>
                  <data>
                    <value><string>partner_id</string></value>
                    <value><string>=</string></value>
                    <value><int>%d</int></value>
                  </data>
                </array></value>
              </data>
            </array></value>
            <value><array>
              <data>
                <value><string>id</string></value>
                <value><string>name</string></value>
                <value><string>date_order</string></value>
                <value><string>amount_total</string></value>
                <value><string>state</string></value>
                <value><string>invoice_count</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, partnerID)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return nil, err
	}
	
	return utils.ParseQuotes(text), nil
}

// GetQuoteDetail retrieves quote detail by ID
func (s *OdooService) GetQuoteDetail(id int) (*utils.QuoteDetail, error) {
	uid, err := s.GetUID()
	if err != nil {
		return nil, err
	}
	
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
            <value><array>
              <data>
                <value><int>%d</int></value>
              </data>
            </array></value>
            <value><array>
              <data>
                <value><string>id</string></value>
                <value><string>name</string></value>
                <value><string>date_order</string></value>
                <value><string>amount_total</string></value>
                <value><string>amount_untaxed</string></value>
                <value><string>amount_tax</string></value>
                <value><string>state</string></value>
                <value><string>note</string></value>
                <value><string>invoice_count</string></value>
                <value><string>order_line</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, id)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return nil, err
	}
	
	detail := utils.ParseQuoteDetail(text)
	
	// Get order line details if order_line IDs are present
	if detail.OrderLine != "" {
		// Parse order_line IDs from the response
		lineIDs := utils.ParseArray(detail.OrderLine)
		
		if len(lineIDs) > 0 {
			// Build XML-RPC call to get order line details
			lineIDsXML := ""
			for _, lineID := range lineIDs {
				lineIDsXML += fmt.Sprintf(`<value><int>%d</int></value>`, lineID)
			}
			
			xml = fmt.Sprintf(`<?xml version="1.0"?>
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
                <value><string>id</string></value>
                <value><string>name</string></value>
                <value><string>product_id</string></value>
                <value><string>product_uom_qty</string></value>
                <value><string>price_unit</string></value>
                <value><string>price_subtotal</string></value>
                <value><string>product_uom</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, lineIDsXML)
			
			lineText, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
			if err == nil {
				detail.OrderLines = utils.ParseOrderLines(lineText)
			}
		}
	}
	
	return detail, nil
}

// UpdateQuote updates a quote
func (s *OdooService) UpdateQuote(id int, data map[string]interface{}) error {
	uid, err := s.GetUID()
	if err != nil {
		return err
	}
	
	// Build data XML
	dataXML := ""
	for key, value := range data {
		switch v := value.(type) {
		case string:
			dataXML += fmt.Sprintf(`<member><name>%s</name><value><string>%s</string></value></member>`, key, v)
		case int:
			dataXML += fmt.Sprintf(`<member><name>%s</name><value><int>%d</int></value></member>`, key, v)
		case float64:
			dataXML += fmt.Sprintf(`<member><name>%s</name><value><double>%.2f</double></value></member>`, key, v)
		}
	}
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>sale.order</string></value></param>
    <param><value><string>write</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array><data><value><int>%d</int></value></data></array></value>
            <value><struct>%s</struct></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, id, dataXML)
	
	_, err = utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	return err
}

// CreateInvoiceFromQuote creates an invoice from a quote using the InvoiceService
func (s *OdooService) CreateInvoiceFromQuote(quoteID int) (int, error) {
	uid, err := s.GetUID()
	if err != nil {
		return 0, err
	}
	
	return s.InvoiceService.CreateInvoiceFromQuote(quoteID, uid)
}

// GetInvoiceStatus retrieves invoice status
func (s *OdooService) GetInvoiceStatus(quoteID int) (bool, string, []int, error) {
	uid, err := s.GetUID()
	if err != nil {
		return false, "", nil, err
	}
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><array>
                  <data>
                    <value><string>invoice_origin</string></value>
                    <value><string>ilike</string></value>
                    <value><string>%d</string></value>
                  </data>
                </array></value>
              </data>
            </array></value>
            <value><array>
              <data>
                <value><string>id</string></value>
                <value><string>payment_state</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, quoteID)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return false, "", nil, err
	}
	
	// Check if invoice exists
	if !strings.Contains(text, "<struct>") {
		return false, "", nil, nil
	}
	
	// Extract invoice IDs and payment state
	structs := regexp.MustCompile(`<struct>([\s\S]*?)</struct>`).FindAllStringSubmatch(text, -1)
	if structs == nil {
		return false, "", nil, nil
	}
	
	var invoiceIDs []int
	var paymentState string
	
	for _, match := range structs {
		if len(match) > 1 {
			structXML := match[1]
			
			// Extract ID
			idMatch := regexp.MustCompile(`<name>id<\/name>[\s\S]*?<value><int>(\d+)<\/int>`).FindStringSubmatch(structXML)
			if len(idMatch) > 1 {
				if id, err := strconv.Atoi(idMatch[1]); err == nil {
					invoiceIDs = append(invoiceIDs, id)
				}
			}
			
			// Extract payment state
			if paymentState == "" {
				stateMatch := regexp.MustCompile(`<name>payment_state<\/name>[\s\S]*?<value><string>(.*?)<\/string>`).FindStringSubmatch(structXML)
				if len(stateMatch) > 1 {
					paymentState = stateMatch[1]
				}
			}
		}
	}
	
	if len(invoiceIDs) > 0 {
		return true, paymentState, invoiceIDs, nil
	}
	
	return false, "", nil, nil
}

// GetInvoiceDetail retrieves invoice detail
func (s *OdooService) GetInvoiceDetail(invoiceID int) (*utils.InvoiceDetail, error) {
	uid, err := s.GetUID()
	if err != nil {
		return nil, err
	}
	
	return s.InvoiceService.GetInvoiceDetail(invoiceID, uid)
}

// GetPaymentMethods retrieves payment methods
func (s *OdooService) GetPaymentMethods() ([]map[string]interface{}, error) {
	uid, err := s.GetUID()
	if err != nil {
		return nil, err
	}
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.payment.method</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array><data></data></array></value>
            <value><array>
              <data>
                <value><string>id</string></value>
                <value><string>name</string></value>
                <value><string>code</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return nil, err
	}
	
	// Parse payment methods
	methods := []map[string]interface{}{}
	structs := utils.ParsePartners(text) // Reuse parser
	for _, s := range structs {
		methods = append(methods, map[string]interface{}{
			"id":   s.ID,
			"name": s.Name,
		})
	}
	
	return methods, nil
}

// GetJournals retrieves journals
func (s *OdooService) GetJournals() ([]map[string]interface{}, error) {
	uid, err := s.GetUID()
	if err != nil {
		return nil, err
	}
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.journal</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array><data></data></array></value>
            <value><array>
              <data>
                <value><string>id</string></value>
                <value><string>name</string></value>
                <value><string>type</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return nil, err
	}
	
	// Parse journals
	journals := []map[string]interface{}{}
	structs := utils.ParsePartners(text) // Reuse parser
	for _, s := range structs {
		journals = append(journals, map[string]interface{}{
			"id":   s.ID,
			"name": s.Name,
		})
	}
	
	return journals, nil
}

// PayInvoice pays an invoice
func (s *OdooService) PayInvoice(invoiceID, journalID, paymentMethodID int, amount float64) error {
	uid, err := s.GetUID()
	if err != nil {
		return err
	}
	
	return s.InvoiceService.PayInvoice(invoiceID, journalID, paymentMethodID, amount, uid)
}

// CreateLead creates a lead
func (s *OdooService) CreateLead(name, phone, email string) (int, error) {
	uid, err := s.GetUID()
	if err != nil {
		return 0, err
	}
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>crm.lead</string></value></param>
    <param><value><string>create</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <struct>
                <member>
                  <name>name</name>
                  <value><string>%s</string></value>
                </member>
                <member>
                  <name>phone</name>
                  <value><string>%s</string></value>
                </member>
                <member>
                  <name>email_from</name>
                  <value><string>%s</string></value>
                </member>
              </struct>
            </value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, name, phone, email)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return 0, err
	}
	
	// Extract ID from response
	start := strings.Index(text, "<int>")
	if start == -1 {
		return 0, fmt.Errorf("create lead failed: no ID found")
	}
	start += 5
	end := strings.Index(text[start:], "</int>")
	if end == -1 {
		return 0, fmt.Errorf("create lead failed: invalid ID format")
	}
	
	var id int
	_, err = fmt.Sscanf(text[start:start+end], "%d", &id)
	if err != nil {
		return 0, fmt.Errorf("create lead failed: invalid ID")
	}
	
	return id, nil
}

// GetLeads retrieves leads
func (s *OdooService) GetLeads() ([]utils.Partner, error) {
	uid, err := s.GetUID()
	if err != nil {
		return nil, err
	}
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>crm.lead</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array><data></data></array></value>
            <value><array>
              <data>
                <value><string>id</string></value>
                <value><string>name</string></value>
                <value><string>phone</string></value>
                <value><string>email_from</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return nil, err
	}
	
	return utils.ParsePartners(text), nil
}

// OrderLine represents a sale order line
type OrderLine struct {
	ProductID     int     `json:"product_id"`
	Name          string  `json:"name"`
	ProductUOMQty int     `json:"product_uom_qty"`
	PriceUnit     float64 `json:"price_unit"`
	ProductUOM    int     `json:"product_uom"`
}
