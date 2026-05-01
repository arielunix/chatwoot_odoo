package utils

import (
	"regexp"
	"strconv"
	"strings"
)

type Partner struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Phone  string `json:"phone"`
	Mobile string `json:"mobile"`
	Email  string `json:"email"`
}

type Quote struct {
	ID           int     `json:"id"`
	Name         string  `json:"name"`
	DateOrder    string  `json:"date_order"`
	AmountTotal  float64 `json:"amount_total"`
	State        string  `json:"state"`
	InvoiceCount int     `json:"invoice_count"`
}

type QuoteDetail struct {
	ID           int         `json:"id"`
	Name         string      `json:"name"`
	DateOrder    string      `json:"date_order"`
	AmountTotal  float64     `json:"amount_total"`
	AmountUntaxed float64    `json:"amount_untaxed"`
	AmountTax    float64     `json:"amount_tax"`
	State        string      `json:"state"`
	Note         string      `json:"note"`
	InvoiceCount int         `json:"invoice_count"`
	OrderLine    string      `json:"order_line"`
	OrderLines   []OrderLine `json:"order_lines"`
}

type OrderLine struct {
	ID              int     `json:"id"`
	ProductID       int     `json:"product_id"`
	Name            string  `json:"name"`
	ProductUOMQty   int     `json:"product_uom_qty"`
	ProductUOM      int     `json:"product_uom"`
	PriceUnit       float64 `json:"price_unit"`
	Discount        float64 `json:"discount"`
	PriceSubtotal   float64 `json:"price_subtotal"`
	PriceTax        float64 `json:"price_tax"`
	PriceTotal      float64 `json:"price_total"`
}

type InvoiceDetail struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	State          string  `json:"state"`
	MoveType       string  `json:"move_type"`
	PartnerID      int     `json:"partner_id"`
	InvoiceDate    string  `json:"invoice_date"`
	AmountTotal    float64 `json:"amount_total"`
	AmountUntaxed  float64 `json:"amount_untaxed"`
	AmountTax      float64 `json:"amount_tax"`
	InvoiceOrigin  string  `json:"invoice_origin"`
	InvoiceLineIDs string  `json:"invoice_line_ids"`
	PaymentState   string  `json:"payment_state"`
	AmountResidual float64 `json:"amount_residual"`
}

type Product struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	ListPrice   float64 `json:"list_price"`
	DefaultCode string  `json:"default_code"`
	UOMID       int     `json:"uom_id"`
}

// extractField extracts a field value from XML struct
func extractField(structXML, field string) interface{} {
	// For array fields, use a greedy pattern to capture complete arrays
	if field == "order_line" || field == "invoice_line_ids" {
		pattern := `<name>` + field + `</name>[\s\S]*?<value>([\s\S]*)</value>`
		re := regexp.MustCompile(pattern)
		match := re.FindStringSubmatch(structXML)
		if match != nil {
			val := match[1]
			if strings.Contains(val, "<array>") {
				// Find the complete array by matching from <array> to </array>
				arrayPattern := `<array>([\s\S]*?)</array>`
				arrayMatch := regexp.MustCompile(arrayPattern).FindStringSubmatch(val)
				if arrayMatch != nil {
					return arrayMatch[0] // Return complete array including tags
				}
			}
			return val
		}
		return nil
	}
	
	pattern := `<name>` + field + `</name>[\s\S]*?<value>([\s\S]*?)</value>`
	re := regexp.MustCompile(pattern)
	match := re.FindStringSubmatch(structXML)
	if match == nil {
		return nil
	}
	
	val := match[1]
	
	// array - capture complete array including nested tags
	if strings.Contains(val, "<array>") {
		// Find the complete array by matching from <array> to </array>
		arrayPattern := `<array>([\s\S]*?)</array>`
		arrayMatch := regexp.MustCompile(arrayPattern).FindStringSubmatch(val)
		if arrayMatch != nil {
			return arrayMatch[0] // Return complete array including tags
		}
		return val
	}
	
	// string
	if strings.Contains(val, "<string>") {
		stringPattern := `<string>([\s\S]*?)</string>`
		stringMatch := regexp.MustCompile(stringPattern).FindStringSubmatch(val)
		if stringMatch != nil {
			return stringMatch[1]
		}
		return ""
	}
	
	// int
	if strings.Contains(val, "<int>") {
		intPattern := `<int>(\d+)</int>`
		intMatch := regexp.MustCompile(intPattern).FindStringSubmatch(val)
		if intMatch != nil {
			if num, err := strconv.Atoi(intMatch[1]); err == nil {
				return num
			}
		}
		return 0
	}
	
	// boolean
	if strings.Contains(val, "<boolean>") {
		return strings.Contains(val, "1")
	}
	
	// double/float
	if strings.Contains(val, "<double>") {
		doublePattern := `<double>([\d.]+)</double>`
		doubleMatch := regexp.MustCompile(doublePattern).FindStringSubmatch(val)
		if doubleMatch != nil {
			if num, err := strconv.ParseFloat(doubleMatch[1], 64); err == nil {
				return num
			}
		}
		return 0.0
	}
	
	// If no type tags, return as string
	return val
}

// ParsePartners parses XML response to Partner structs
func ParsePartners(xml string) []Partner {
	structs := regexp.MustCompile(`<struct>([\s\S]*?)</struct>`).FindAllString(xml, -1)
	if structs == nil {
		return []Partner{}
	}
	
	partners := make([]Partner, 0)
	for _, structXML := range structs {
		id := extractField(structXML, "id")
		name := extractField(structXML, "name")
		phone := extractField(structXML, "phone")
		mobile := extractField(structXML, "mobile")
		email := extractField(structXML, "email")
		
		partner := Partner{
			ID:     toInt(id),
			Name:   toString(name),
			Phone:  toString(phone),
			Mobile: toString(mobile),
			Email:  toString(email),
		}
		partners = append(partners, partner)
	}
	
	return partners
}

func toInt(v interface{}) int {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case int:
		return val
	case float64:
		return int(val)
	case string:
		if num, err := strconv.Atoi(val); err == nil {
			return num
		}
		return 0
	default:
		return 0
	}
}

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case bool:
		if val {
			return "true"
		}
		return "false"
	case int:
		return strconv.Itoa(val)
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	default:
		return ""
	}
}

// ParseQuotes parses XML response to Quote structs
func ParseQuotes(xml string) []Quote {
	structs := regexp.MustCompile(`<struct>([\s\S]*?)</struct>`).FindAllString(xml, -1)
	if structs == nil {
		return []Quote{}
	}
	
	quotes := make([]Quote, 0)
	for _, structXML := range structs {
		quote := Quote{
			ID:           toInt(extractField(structXML, "id")),
			Name:         toString(extractField(structXML, "name")),
			DateOrder:    toString(extractField(structXML, "date_order")),
			AmountTotal:  toFloat(extractField(structXML, "amount_total")),
			State:        toString(extractField(structXML, "state")),
			InvoiceCount: toInt(extractField(structXML, "invoice_count")),
		}
		quotes = append(quotes, quote)
	}
	
	return quotes
}

func toFloat(v interface{}) float64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case int:
		return float64(val)
	case string:
		if num, err := strconv.ParseFloat(val, 64); err == nil {
			return num
		}
		return 0
	default:
		return 0
	}
}

// ParseArray parses XML array to extract integer IDs
func ParseArray(xml string) []int {
	result := []int{}
	
	// Find all <int> tags in the array
	intPattern := regexp.MustCompile(`<int>(\d+)</int>`)
	matches := intPattern.FindAllStringSubmatch(xml, -1)
	
	for _, match := range matches {
		if len(match) > 1 {
			if id, err := strconv.Atoi(match[1]); err == nil {
				result = append(result, id)
			}
		}
	}
	
	return result
}

// ParseQuoteDetail parses XML response to QuoteDetail struct
func ParseQuoteDetail(xml string) *QuoteDetail {
	structs := regexp.MustCompile(`<struct>([\s\S]*?)</struct>`).FindAllString(xml, -1)
	if structs == nil {
		return nil
	}
	
	structXML := structs[0]
	detail := &QuoteDetail{
		ID:           toInt(extractField(structXML, "id")),
		Name:         toString(extractField(structXML, "name")),
		DateOrder:    toString(extractField(structXML, "date_order")),
		AmountTotal:  toFloat(extractField(structXML, "amount_total")),
		AmountUntaxed: toFloat(extractField(structXML, "amount_untaxed")),
		AmountTax:    toFloat(extractField(structXML, "amount_tax")),
		State:        toString(extractField(structXML, "state")),
		Note:         toString(extractField(structXML, "note")),
		InvoiceCount: toInt(extractField(structXML, "invoice_count")),
	}
	
	if orderLine := extractField(structXML, "order_line"); orderLine != nil {
		detail.OrderLine = toString(orderLine)
	}
	
	return detail
}

// ParseOrderLines parses XML response to OrderLine structs
func ParseOrderLines(xml string) []OrderLine {
	structs := regexp.MustCompile(`<struct>([\s\S]*?)</struct>`).FindAllString(xml, -1)
	if structs == nil {
		return []OrderLine{}
	}
	
	lines := make([]OrderLine, 0)
	for _, structXML := range structs {
		line := OrderLine{
			ID:            toInt(extractField(structXML, "id")),
			ProductID:     toInt(extractField(structXML, "product_id")),
			Name:          toString(extractField(structXML, "name")),
			ProductUOMQty: toInt(extractField(structXML, "product_uom_qty")),
			ProductUOM:    toInt(extractField(structXML, "product_uom")),
			PriceUnit:     toFloat(extractField(structXML, "price_unit")),
			Discount:      toFloat(extractField(structXML, "discount")),
			PriceSubtotal: toFloat(extractField(structXML, "price_subtotal")),
			PriceTax:      toFloat(extractField(structXML, "price_tax")),
			PriceTotal:    toFloat(extractField(structXML, "price_total")),
		}
		lines = append(lines, line)
	}
	
	return lines
}

// ParseInvoiceDetail parses XML response to InvoiceDetail struct
func ParseInvoiceDetail(xml string) *InvoiceDetail {
	structs := regexp.MustCompile(`<struct>([\s\S]*?)</struct>`).FindAllString(xml, -1)
	if structs == nil {
		return nil
	}
	
	structXML := structs[0]
	detail := &InvoiceDetail{
		ID:             toInt(extractField(structXML, "id")),
		Name:           toString(extractField(structXML, "name")),
		State:          toString(extractField(structXML, "state")),
		MoveType:       toString(extractField(structXML, "move_type")),
		PartnerID:      toInt(extractField(structXML, "partner_id")),
		InvoiceDate:    toString(extractField(structXML, "invoice_date")),
		AmountTotal:    toFloat(extractField(structXML, "amount_total")),
		AmountUntaxed:  toFloat(extractField(structXML, "amount_untaxed")),
		AmountTax:      toFloat(extractField(structXML, "amount_tax")),
		InvoiceOrigin:  toString(extractField(structXML, "invoice_origin")),
		PaymentState:   toString(extractField(structXML, "payment_state")),
		AmountResidual: toFloat(extractField(structXML, "amount_residual")),
	}
	
	if invoiceLineIDs := extractField(structXML, "invoice_line_ids"); invoiceLineIDs != nil {
		detail.InvoiceLineIDs = toString(invoiceLineIDs)
	}
	
	return detail
}

// ParseProducts parses XML response to product structs
func ParseProducts(xml string) []Product {
	structs := regexp.MustCompile(`<struct>([\s\S]*?)</struct>`).FindAllString(xml, -1)
	if structs == nil {
		return []Product{}
	}
	
	products := make([]Product, 0)
	for _, structXML := range structs {
		product := Product{
			ID:          toInt(extractField(structXML, "id")),
			Name:        toString(extractField(structXML, "name")),
			ListPrice:   toFloat(extractField(structXML, "list_price")),
			DefaultCode: toString(extractField(structXML, "default_code")),
			UOMID:       toInt(extractField(structXML, "uom_id")),
		}
		products = append(products, product)
	}
	
	return products
}

// CleanPhone removes non-digit characters from phone number
func CleanPhone(phone string) string {
	return strings.ReplaceAll(strings.ReplaceAll(phone, " ", ""), "-", "")
}
