package services

import (
	"fmt"
	"odoo-backend/internal/config"
	"odoo-backend/internal/services/odoo"
	"odoo-backend/internal/utils"
	"strings"
)

type OdooService struct {
	config        *config.Config
	uidCache      *int
	ReportService *odoo.ReportService
}

func NewOdooService(cfg *config.Config) *OdooService {
	return &OdooService{
		config:        cfg,
		uidCache:      nil,
		ReportService: odoo.NewReportService(cfg),
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
func (s *OdooService) CreateCustomer(name, phone, email string) (int, error) {
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
	
	return utils.ParseQuoteDetail(text), nil
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

// CreateInvoiceFromQuote creates an invoice from a quote
func (s *OdooService) CreateInvoiceFromQuote(quoteID int) (int, error) {
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
    <param><value><string>sale.order</string></value></param>
    <param><value><string>action_create_invoice</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array><data><value><int>%d</int></value></data></array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, quoteID)
	
	text, err := utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	if err != nil {
		return 0, err
	}
	
	// Extract invoice ID from response
	start := strings.Index(text, "<int>")
	if start == -1 {
		return 0, fmt.Errorf("create invoice failed: no ID found")
	}
	start += 5
	end := strings.Index(text[start:], "</int>")
	if end == -1 {
		return 0, fmt.Errorf("create invoice failed: invalid ID format")
	}
	
	var id int
	_, err = fmt.Sscanf(text[start:start+end], "%d", &id)
	if err != nil {
		return 0, fmt.Errorf("create invoice failed: invalid ID")
	}
	
	return id, nil
}

// GetInvoiceStatus retrieves invoice status
func (s *OdooService) GetInvoiceStatus(quoteID int) (bool, string, error) {
	uid, err := s.GetUID()
	if err != nil {
		return false, "", err
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
		return false, "", err
	}
	
	// Check if invoice exists
	if !strings.Contains(text, "<struct>") {
		return false, "", nil
	}
	
	// Extract payment state
	structs := utils.ParseInvoiceDetail(text)
	if structs != nil {
		return true, structs.PaymentState, nil
	}
	
	return false, "", nil
}

// GetInvoiceDetail retrieves invoice detail
func (s *OdooService) GetInvoiceDetail(invoiceID int) (*utils.InvoiceDetail, error) {
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
	
	xml := fmt.Sprintf(`<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>%s</string></value></param>
    <param><value><int>%d</int></value></param>
    <param><value><string>%s</string></value></param>
    <param><value><string>account.payment</string></value></param>
    <param><value><string>create</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <struct>
                <member>
                  <name>amount</name>
                  <value><double>%.2f</double></value>
                </member>
                <member>
                  <name>payment_type</name>
                  <value><string>inbound</string></value>
                </member>
                <member>
                  <name>partner_type</name>
                  <value><string>customer</string></value>
                </member>
                <member>
                  <name>journal_id</name>
                  <value><int>%d</int></value>
                </member>
                <member>
                  <name>payment_method_id</name>
                  <value><int>%d</int></value>
                </member>
                <member>
                  <name>payment_method_line_id</name>
                  <value><int>%d</int></value>
                </member>
              </struct>
            </value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`, s.config.OdooDB, uid, s.config.OdooPass, amount, journalID, paymentMethodID, paymentMethodID)
	
	_, err = utils.XMLRPCCall(s.config.OdooURL, "/xmlrpc/2/object", xml)
	return err
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
