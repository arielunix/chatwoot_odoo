package config

import (
	"os"
)

type Config struct {
	OdooURL          string
	OdooDB           string
	OdooUser         string
	OdooPass         string
	OdooPassSimple   string
	ChatwootURL      string
	ChatwootToken    string
	ChatwootAccountID string
	Port             string
}

func Load() *Config {
	return &Config{
		OdooURL:          getEnv("ODOO_URL", "http://localhost:8069"),
		OdooDB:           getEnv("ODOO_DB", ""),
		OdooUser:         getEnv("ODOO_USER", ""),
		OdooPass:         getEnv("ODOO_PASS", ""),
		OdooPassSimple:   getEnv("ODOO_PASS_SIMPLE", ""),
		ChatwootURL:      getEnv("CHATWOOT_URL", "https://crm.tulogica.com"),
		ChatwootToken:    getEnv("CHATWOOT_API_TOKEN", ""),
		ChatwootAccountID: getEnv("CHATWOOT_ACCOUNT_ID", "2"),
		Port:             getEnv("PORT", "3001"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
