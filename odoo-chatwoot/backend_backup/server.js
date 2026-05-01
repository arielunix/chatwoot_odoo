import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ⚙️ CONFIG
const ODOO_URL = process.env.ODOO_URL;
const DB = process.env.ODOO_DB;
const USER = process.env.ODOO_USER;
const PASS = process.env.ODOO_PASS;

// Chatwoot Config
const CHATWOOT_URL = process.env.CHATWOOT_URL || "https://crm.tulogica.com";
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN || "";
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID || "2";

let uidCache = null;

function parseInvoiceDetail(xml) {
    const structs = xml.match(/<struct>([\s\S]*?)<\/struct>/g);

    if (!structs) return null;

    const struct = structs[0];

    const get = (field) => {
        const regex = new RegExp(
            `<name>${field}<\\/name>[\\s\\S]*?<value>([\\s\\S]*?)<\\/value>`
        );
        const match = struct.match(regex);

        if (!match) return null;

        const val = match[1];

        // string
        const str = val.match(/<string>(.*?)<\/string>/);
        if (str) return str[1];

        // int
        const int = val.match(/<int>(\d+)<\/int>/);
        if (int) return parseInt(int[1]);

        // double
        const num = val.match(/<double>([\d.]+)<\/double>/);
        if (num) return parseFloat(num[1]);

        // boolean
        const bool = val.match(/<boolean>(.*?)<\/boolean>/);
        if (bool) return bool[1] === "1" || bool[1] === "true";

        // array (invoice_line_ids)
        const arr = val.match(/<array>([\s\S]*?)<\/array>/);
        if (arr) return arr[1];

        return null;
    };

    return {
        id: get("id"),
        name: get("name"),
        state: get("state"),
        move_type: get("move_type"),
        partner_id: get("partner_id"),
        invoice_date: get("invoice_date"),
        amount_total: get("amount_total"),
        amount_untaxed: get("amount_untaxed"),
        amount_tax: get("amount_tax"),
        invoice_origin: get("invoice_origin"),
        invoice_line_ids: get("invoice_line_ids"),
        payment_state: get("payment_state"),
        amount_residual: get("amount_residual"),
    };
}

// 🔧 CHATWOOT API CALL
async function chatwootCall(endpoint, options = {}) {
    const res = await fetch(`${CHATWOOT_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "api_access_token": CHATWOOT_API_TOKEN,
            ...options.headers,
        },
    });

    if (!res.ok) {
        throw new Error(`Chatwoot Error: ${res.status}`);
    }

    return res.json();
}

// 🔧 XMLRPC CALL
async function xmlrpcCall(endpoint, xml) {
    const res = await fetch(`${ODOO_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body: xml,
    });

    const text = await res.text();

    if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
    }

    if (text.includes("<fault>")) {
        console.error("❌ Odoo Fault:\n", text);
        throw new Error("Error en Odoo (ver logs)");
    }

    if (text.includes("AccessDenied")) {
        throw new Error("❌ Access Denied → usa API KEY");
    }

    return text;
}

// 🔑 LOGIN
async function login() {
    if (uidCache) return uidCache;

    console.log("🔐 Login Odoo...");

    const xml = `<?xml version="1.0"?>
  <methodCall>
    <methodName>authenticate</methodName>
    <params>
      <param><value><string>${DB}</string></value></param>
      <param><value><string>${USER}</string></value></param>
      <param><value><string>${PASS}</string></value></param>
      <param><value><struct/></value></param>
    </params>
  </methodCall>`;

    const text = await xmlrpcCall("/xmlrpc/2/common", xml);

    const match = text.match(/<int>(\d+)<\/int>/);

    if (!match) {
        throw new Error("❌ Login fallido");
    }

    uidCache = parseInt(match[1]);
    console.log("✅ UID:", uidCache);

    return uidCache;
}

// 🧠 PARSER XML → JSON
function parsePartners(xml) {
    const records = [];

    const structs = xml.match(/<struct>([\s\S]*?)<\/struct>/g);

    if (!structs) return [];

    for (const struct of structs) {
        const get = (field) => {
            const regex = new RegExp(
                `<name>${field}<\\/name>[\\s\\S]*?<value>([\\s\\S]*?)<\\/value>`
            );
            const match = struct.match(regex);

            if (!match) return null;

            const val = match[1];

            // string
            const str = val.match(/<string>(.*?)<\/string>/);
            if (str) return str[1];

            // int
            const int = val.match(/<int>(.*?)<\/int>/);
            if (int) return parseInt(int[1]);

            // double
            const num = val.match(/<double>(.*?)<\/double>/);
            if (num) return parseFloat(num[1]);

            // boolean
            const bool = val.match(/<boolean>(.*?)<\/boolean>/);
            if (bool) return bool[1] === "1" || bool[1] === "true";

            return null;
        };

        records.push({
            id: get("id"),
            name: get("name"),
            phone: get("phone"),
            mobile: get("mobile"),
            email: get("email"),
        });
    }

    return records;
}

function parseQuotes(xml) {
    const records = [];

    const structs = xml.match(/<struct>([\s\S]*?)<\/struct>/g);

    if (!structs) return [];

    for (const struct of structs) {
        const get = (field) => {
            const regex = new RegExp(
                `<name>${field}<\\/name>[\\s\\S]*?<value>([\\s\\S]*?)<\\/value>`
            );
            const match = struct.match(regex);

            if (!match) return null;

            const val = match[1];

            // string
            const str = val.match(/<string>(.*?)<\/string>/);
            if (str) return str[1];

            // int
            const int = val.match(/<int>(.*?)<\/int>/);
            if (int) return parseInt(int[1]);

            // double
            const num = val.match(/<double>(.*?)<\/double>/);
            if (num) return parseFloat(num[1]);

            // boolean
            const bool = val.match(/<boolean>(.*?)<\/boolean>/);
            if (bool) return bool[1] === "1" || bool[1] === "true";

            return null;
        };

        records.push({
            id: get("id"),
            name: get("name"),
            date_order: get("date_order"),
            amount_total: get("amount_total"),
            state: get("state"),
            invoice_count: get("invoice_count"),
        });
    }

    return records;
}

function parseQuoteDetail(xml) {
    const structs = xml.match(/<struct>([\s\S]*?)<\/struct>/g);

    if (!structs) return null;

    const struct = structs[0];

    const get = (field) => {
        const regex = new RegExp(
            `<name>${field}<\\/name>[\\s\\S]*?<value>([\\s\\S]*?)<\\/value>`
        );
        const match = struct.match(regex);

        if (!match) return null;

        const val = match[1];

        // string
        const str = val.match(/<string>(.*?)<\/string>/);
        if (str) return str[1];

        // int
        const int = val.match(/<int>(.*?)<\/int>/);
        if (int) return parseInt(int[1]);

        // double
        const num = val.match(/<double>(.*?)<\/double>/);
        if (num) return parseFloat(num[1]);

        // boolean
        const bool = val.match(/<boolean>(.*?)<\/boolean>/);
        if (bool) return bool[1] === "1" || bool[1] === "true";

        // array (order_line)
        const arr = val.match(/<array>([\s\S]*?)<\/array>/);
        if (arr) return arr[1];

        return null;
    };

    return {
        id: get("id"),
        name: get("name"),
        date_order: get("date_order"),
        amount_total: get("amount_total"),
        amount_untaxed: get("amount_untaxed"),
        amount_tax: get("amount_tax"),
        state: get("state"),
        note: get("note"),
        invoice_count: get("invoice_count"),
        order_line: get("order_line"),
    };
}

function parseOrderLines(xml) {
    const records = [];

    const structs = xml.match(/<struct>([\s\S]*?)<\/struct>/g);

    if (!structs) return [];

    for (const struct of structs) {
        const get = (field) => {
            const regex = new RegExp(
                `<name>${field}<\\/name>[\\s\\S]*?<value>([\\s\\S]*?)<\\/value>`
            );
            const match = struct.match(regex);

            if (!match) return null;

            const val = match[1];

            // string
            const str = val.match(/<string>(.*?)<\/string>/);
            if (str) return str[1];

            // int
            const int = val.match(/<int>(.*?)<\/int>/);
            if (int) return parseInt(int[1]);

            // double
            const num = val.match(/<double>(.*?)<\/double>/);
            if (num) return parseFloat(num[1]);

            return null;
        };

        records.push({
            id: get("id"),
            product_id: get("product_id"),
            name: get("name"),
            product_uom_qty: get("product_uom_qty"),
            product_uom: get("product_uom"),
            price_unit: get("price_unit"),
            discount: get("discount"),
            price_subtotal: get("price_subtotal"),
            price_tax: get("price_tax"),
            price_total: get("price_total"),
        });
    }

    return records;
}

// 🔍 BUSCAR CLIENTE
app.post("/odoo/customer", async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ error: "phone requerido" });
        }

        const uid = await login();
        const cleanPhone = phone.replace(/\D/g, "");

        const xml = `<?xml version="1.0"?>
   
<methodCall>
  <methodName>execute_kw</methodName>
  <params>

    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>

    <param><value><string>res.partner</string></value></param>
    <param><value><string>search_read</string></value></param>

    <!-- ✅ args → SOLO domain -->
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
                        <value><string>${cleanPhone}</string></value>
                      </data>
                    </array>
                  </value>

                  <value>
                    <array>
                      <data>
                        <value><string>mobile</string></value>
                        <value><string>ilike</string></value>
                        <value><string>${cleanPhone}</string></value>
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

    <!-- ✅ kwargs -->
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
</methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", xml);

        const partners = parsePartners(text);

        return res.json({
            success: true,
            count: partners.length,
            data: partners,
        });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📝 CREAR CLIENTE
app.post("/odoo/customer/create", async (req, res) => {
    try {
        const { name, phone, email } = req.body;

        if (!name) {
            return res.status(400).json({ error: "name requerido" });
        }

        const uid = await login();

        const xml = `<?xml version="1.0"?>
    <methodCall>
      <methodName>execute_kw</methodName>
      <params>

        <param><value><string>${DB}</string></value></param>
        <param><value><int>${uid}</int></value></param>
        <param><value><string>${PASS}</string></value></param>

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
                      <value><string>${name}</string></value>
                    </member>
                    <member>
                      <name>phone</name>
                      <value><string>${phone || ""}</string></value>
                    </member>
                    <member>
                      <name>email</name>
                      <value><string>${email || ""}</string></value>
                    </member>
                  </struct>
                </value>
              </data>
            </array>
          </value>
        </param>

      </params>
    </methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", xml);

        const match = text.match(/<int>(\d+)<\/int>/);

        return res.json({
            success: true,
            id: match ? parseInt(match[1]) : null,
        });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ❤️ HEALTH
app.get("/health", async (req, res) => {
    try {
        const uid = await login();
        res.json({ ok: true, uid });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// � BUSCAR CLIENTE EN ODOO (para el panel)
app.post("/odoo/search-customer", async (req, res) => {
    try {
        const { phone, name, email } = req.body;

        const uid = await login();
        const cleanPhone = phone ? phone.replace(/\D/g, "") : "";

        // Si hay teléfono, buscar; si no, buscar por email
        let domain;
        if (cleanPhone) {
            domain = `[["|",["phone","ilike","${cleanPhone}"],["mobile","ilike","${cleanPhone}"]]]`;
        } else if (email) {
            domain = `[["email","ilike","${email}"]]`;
        } else {
            return res.json({ found: false, customer: null });
        }

        const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>res.partner</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param><value><array><data><value>${domain}</value></data></array></value></param>
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
          <member><name>limit</name><value><int>1</int></value></member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", xml);
        const partners = parsePartners(text);

        if (partners.length > 0) {
            return res.json({ found: true, customer: partners[0] });
        }

        return res.json({ found: false, customer: null });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📝 CREAR CLIENTE EN ODOO (para el panel)
app.post("/odoo/create-customer", async (req, res) => {
    try {
        const { name, phone, email } = req.body;

        if (!name) {
            return res.status(400).json({ error: "name requerido" });
        }

        const uid = await login();

        const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
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
                  <value><string>${name}</string></value>
                </member>
                <member>
                  <name>phone</name>
                  <value><string>${phone || ""}</string></value>
                </member>
                <member>
                  <name>email</name>
                  <value><string>${email || ""}</string></value>
                </member>
              </struct>
            </value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", xml);
        const match = text.match(/<int>(\d+)<\/int>/);

        const newId = match ? parseInt(match[1]) : null;

        return res.json({
            success: true,
            id: newId,
            customer: { id: newId, name, phone, email }
        });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});
// 📦 LISTAR PRODUCTOS
app.get("/odoo/products", async (req, res) => {
    try {
        const uid = await login();

        const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>product.product</string></value></param>
    <param><value><string>search_read</string></value></param>
    
    <!-- args → domain vacío [] -->
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

    <!-- kwargs → fields y limit -->
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
</methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", xml);
        
        // Parse products usando la función parsePartners existente
        const products = [];
        const structs = text.match(/<struct>([\s\S]*?)<\/struct>/g) || [];
        
        for (const struct of structs) {
            const get = (field) => {
                const regex = new RegExp(`<name>${field}</name>[\\s\\S]*?<value>([\\s\\S]*?)</value>`);
                const match = struct.match(regex);
                if (!match) return null;
                const val = match[1];
                
                // string
                const str = val.match(/<string>(.*?)<\/string>/);
                if (str) return str[1];
                
                // int
                const int = val.match(/<int>(.*?)<\/int>/);
                if (int) return parseInt(int[1]);
                
                // double
                const num = val.match(/<double>(.*?)<\/double>/);
                if (num) return parseFloat(num[1]);
                
                // boolean false
                if (val.includes("<boolean>0</boolean>")) return null;
                
                return null;
            };
            
            products.push({
                id: get("id"),
                name: get("name"),
                list_price: get("list_price") || 0,
                default_code: get("default_code"),
                uom_id: get("uom_id") || 1
            });
        }

        return res.json({ success: true, products });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📝 CREAR PRESUPUESTO (SALE ORDER)
app.post("/odoo/quote", async (req, res) => {
    try {
        const { partner_id, order_lines, note } = req.body;

        console.log("📝 Creando presupuesto con nota:", note);
        console.log("📝 Partner ID:", partner_id);
        console.log("📝 Order Lines:", order_lines);

        if (!partner_id) {
            return res.status(400).json({ error: "partner_id requerido" });
        }

        const uid = await login();

        // Construir líneas de pedido usando comandos de Odoo (0, 0, {values})
        let orderLinesXml = "";
        if (order_lines && order_lines.length > 0) {
            for (const line of order_lines) {
                orderLinesXml += `
                <value>
                  <array>
                    <data>
                      <value><int>0</int></value>
                      <value><int>0</int></value>
                      <value>
                        <struct>
                          <member>
                            <name>product_id</name>
                            <value><int>${line.product_id}</int></value>
                          </member>
                          <member>
                            <name>product_uom_qty</name>
                            <value><int>${line.product_uom_qty || 1}</int></value>
                          </member>
                          <member>
                            <name>price_unit</name>
                            <value><double>${line.price_unit || 0}</double></value>
                          </member>
                          ${line.name ? `
                          <member>
                            <name>name</name>
                            <value><string>${line.name}</string></value>
                          </member>` : ''}
                          ${line.product_uom ? `
                          <member>
                            <name>product_uom</name>
                            <value><int>${line.product_uom}</int></value>
                          </member>` : ''}
                        </struct>
                      </value>
                    </data>
                  </array>
                </value>`;
            }
        }

        // Construir XML con nota opcional (enviar string vacío para sobrescribir valor por defecto de Odoo)
        const noteXml = `
                <member>
                  <name>note</name>
                  <value><string>${note || ''}</string></value>
                </member>`;

        const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
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
                  <value><int>${partner_id}</int></value>
                </member>
                <member>
                  <name>order_line</name>
                  <value>
                    <array>
                      <data>
                        ${orderLinesXml}
                      </data>
                    </array>
                  </value>
                </member>${noteXml}
              </struct>
            </value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", xml);
        const match = text.match(/<int>(\d+)<\/int>/);

        return res.json({
            success: true,
            id: match ? parseInt(match[1]) : null
        });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📋 LISTAR PRESUPUESTOS DE UN CLIENTE
// TEMPORALMENTE DESHABILITADO - Error de dominio XML persiste
// 📋 OBTENER COTIZACIONES POR PARTNER_ID
app.get("/odoo/quotes/:partner_id", async (req, res) => {
    try {
        const { partner_id } = req.params;
        const uid = await login();

        const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
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
                    <value><int>${partner_id}</int></value>
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
</methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", xml);
        const quotes = parseQuotes(text);
        
        console.log(`📊 Cotizaciones obtenidas para partner ${partner_id}:`, quotes.map(q => ({id: q.id, name: q.name, invoice_count: q.invoice_count})));

        return res.json({ success: true, quotes });

    } catch (error) {
        console.error("❌ Error buscando presupuestos:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📋 OBTENER DETALLE DE COTIZACIÓN POR ID
app.get("/odoo/quote/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const uid = await login();

        const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>sale.order</string></value></param>
    <param><value><string>read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>${id}</int></value>
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
</methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", xml);
        const quote = parseQuoteDetail(text);

        // Obtener líneas de pedido por separado
        const orderLinesXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>sale.order.line</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><array>
                  <data>
                    <value><string>order_id</string></value>
                    <value><string>=</string></value>
                    <value><int>${id}</int></value>
                  </data>
                </array></value>
              </data>
            </array></value>
            <value><array>
              <data>
                <value><string>id</string></value>
                <value><string>product_id</string></value>
                <value><string>name</string></value>
                <value><string>product_uom_qty</string></value>
                <value><string>product_uom</string></value>
                <value><string>price_unit</string></value>
                <value><string>discount</string></value>
                <value><string>price_subtotal</string></value>
                <value><string>price_tax</string></value>
                <value><string>price_total</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        const orderLinesText = await xmlrpcCall("/xmlrpc/2/object", orderLinesXml);
        const orderLines = parseOrderLines(orderLinesText);

        return res.json({ success: true, quote: { ...quote, order_lines: orderLines } });

    } catch (error) {
        console.error("❌ Error obteniendo detalle de cotización:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📝 MODIFICAR COTIZACIÓN
app.put("/odoo/quote/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { note, state } = req.body;

        const uid = await login();

        let updateFields = "";
        
        if (note) {
            updateFields += `
                <member>
                  <name>note</name>
                  <value><string>${note}</string></value>
                </member>`;
        }
        
        if (state) {
            updateFields += `
                <member>
                  <name>state</name>
                  <value><string>${state}</string></value>
                </member>`;
        }

        const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>sale.order</string></value></param>
    <param><value><string>write</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>${id}</int></value>
              </data>
            </array></value>
            <value>
              <struct>${updateFields}
              </struct>
            </value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        await xmlrpcCall("/xmlrpc/2/object", xml);

        return res.json({ success: true });

    } catch (error) {
        console.error("❌ Error modificando cotización:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📄 CREAR FACTURA DESDE COTIZACIÓN
app.post("/odoo/quote/:id/invoice", async (req, res) => {
    try {
        const { id } = req.params;
        const uid = await login();

        console.log(`📝 Creando factura para cotización ID: ${id}`);

        // Obtener datos completos de la cotización
        const quoteXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>sale.order</string></value></param>
    <param><value><string>read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>${id}</int></value>
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
</methodCall>`;

        const quoteText = await xmlrpcCall("/xmlrpc/2/object", quoteXml);
        
        // Extraer state
        const stateMatch = quoteText.match(/<name>state<\/name>[\s\S]*?<value><string>(.*?)<\/string>/);
        const state = stateMatch ? stateMatch[1] : null;

        // Extraer partner_id
        const partnerMatch = quoteText.match(/<name>partner_id<\/name>[\s\S]*?<value><array>[\s\S]*?<value><int>(\d+)<\/int>/);
        const partnerId = partnerMatch ? parseInt(partnerMatch[1]) : null;

        // Extraer partner_shipping_id
        const shippingMatch = quoteText.match(/<name>partner_shipping_id<\/name>[\s\S]*?<value><array>[\s\S]*?<value><int>(\d+)<\/int>/);
        const shippingId = shippingMatch ? parseInt(shippingMatch[1]) : partnerId;

        // Extraer order_line IDs
        const orderLineMatch = quoteText.match(/<name>order_line<\/name>[\s\S]*?<value><array>[\s\S]*?<data>[\s\S]*?<value><int>(\d+)<\/int>/g);
        const orderLineIds = orderLineMatch ? orderLineMatch.map(m => parseInt(m.match(/<int>(\d+)<\/int>/)[1])) : [];

        console.log(`📊 Estado: ${state}, Partner ID: ${partnerId}, Order Lines: ${orderLineIds.join(', ')}`);

        // Confirmar si está en draft o sent
        if (state === 'draft' || state === 'sent') {
            console.log(`✅ Confirmando cotización...`);
            const confirmXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>sale.order</string></value></param>
    <param><value><string>action_confirm</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>${id}</int></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;
            await xmlrpcCall("/xmlrpc/2/object", confirmXml);
            console.log(`✅ Cotización confirmada`);
        }

        // Obtener detalles de las líneas de pedido
        let invoiceLinesXml = "";
        if (orderLineIds.length > 0) {
            const linesXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>sale.order.line</string></value></param>
    <param><value><string>read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                ${orderLineIds.map(id => `<value><int>${id}</int></value>`).join('')}
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
</methodCall>`;
            
            const linesText = await xmlrpcCall("/xmlrpc/2/object", linesXml);
            console.log(`📊 Líneas de pedido: ${linesText.substring(0, 500)}...`);

            // Parsear líneas para crear líneas de factura
            const lineStructs = linesText.match(/<struct>([\s\S]*?)<\/struct>/g);
            if (lineStructs) {
                lineStructs.forEach((lineStruct, index) => {
                    const productIdMatch = lineStruct.match(/<name>product_id<\/name>[\s\S]*?<value><array>[\s\S]*?<value><int>(\d+)<\/int>/);
                    const qtyMatch = lineStruct.match(/<name>product_uom_qty<\/name>[\s\S]*?<value><double>([\d.]+)<\/double>/);
                    const priceMatch = lineStruct.match(/<name>price_unit<\/name>[\s\S]*?<value><double>([\d.]+)<\/double>/);
                    const nameMatch = lineStruct.match(/<name>name<\/name>[\s\S]*?<value><string>(.*?)<\/string>/);

                    const productId = productIdMatch ? parseInt(productIdMatch[1]) : null;
                    const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
                    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
                    const name = nameMatch ? nameMatch[1] : "";

                    console.log(`� Línea ${index + 1}: Product ID ${productId}, Qty ${qty}, Price ${price}, Name ${name}`);

                    // Usar comando (0, 0, {...}) para crear nueva línea
                    invoiceLinesXml += `
                    <value>
                      <array>
                        <data>
                          <value><int>0</int></value>
                          <value><int>0</int></value>
                          <value>
                            <struct>
                              <member>
                                <name>product_id</name>
                                <value><int>${productId}</int></value>
                              </member>
                              <member>
                                <name>quantity</name>
                                <value><double>${qty}</double></value>
                              </member>
                              <member>
                                <name>price_unit</name>
                                <value><double>${price}</double></value>
                              </member>
                              <member>
                                <name>name</name>
                                <value><string>${name}</string></value>
                              </member>
                            </struct>
                          </value>
                        </data>
                      </array>
                    </value>`;
                });
            }
        }

        // Crear factura manualmente con account.move
        console.log(`📄 Creando factura con account.move...`);
        const invoiceXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
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
                      <value><int>${partnerId}</int></value>
                    </member>
                    <member>
                      <name>partner_shipping_id</name>
                      <value><int>${shippingId}</int></value>
                    </member>
                    <member>
                      <name>invoice_origin</name>
                      <value><string>${id}</string></value>
                    </member>
                    <member>
                      <name>invoice_line_ids</name>
                      <value>
                        <array>
                          <data>${invoiceLinesXml}
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
</methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", invoiceXml);
        console.log(`📄 Respuesta de creación de factura: ${text.substring(0, 500)}...`);
        
        // Parsear el resultado para obtener el ID de la factura
        const invoiceIdMatch = text.match(/<int>(\d+)<\/int>/);
        const invoiceId = invoiceIdMatch ? parseInt(invoiceIdMatch[1]) : null;

        console.log(`📄 ID de factura creada: ${invoiceId}`);

        if (!invoiceId) {
            console.error(`❌ No se pudo obtener el ID de la factura`);
            return res.status(500).json({ error: "No se pudo obtener el ID de la factura" });
        }

        // Validar la factura (cambiar de borrador a confirmado)
        console.log(`📄 Validando factura...`);
        const validateXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>action_post</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>${invoiceId}</int></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        await xmlrpcCall("/xmlrpc/2/object", validateXml);
        console.log(`✅ Factura validada`);

        return res.json({ success: true, invoiceId });

    } catch (error) {
        console.error("❌ Error creando factura:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📄 VERIFICAR SI COTIZACIÓN TIENE FACTURA
app.get("/odoo/quote/:id/invoice-status", async (req, res) => {
    try {
        const { id } = req.params;
        const uid = await login();

        console.log(`📄 Verificando estado de factura para cotización ID: ${id}`);

        // Buscar facturas donde invoice_origin = ID de cotización
        const searchXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>search</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><array>
                  <data>
                    <value><string>invoice_origin</string></value>
                    <value><string>=</string></value>
                    <value><string>${id}</string></value>
                  </data>
                </array></value>
                <value><array>
                  <data>
                    <value><string>move_type</string></value>
                    <value><string>=</string></value>
                    <value><string>out_invoice</string></value>
                  </data>
                </array></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        const searchText = await xmlrpcCall("/xmlrpc/2/object", searchXml);
        console.log(`📄 Resultado de búsqueda: ${searchText.substring(0, 500)}...`);
        const invoiceIds = searchText.match(/<int>(\d+)<\/int>/g);
        
        // Extraer solo los números de los IDs
        const cleanInvoiceIds = invoiceIds ? invoiceIds.map(id => parseInt(id.match(/<int>(\d+)<\/int>/)[1])) : [];

        const hasInvoice = cleanInvoiceIds.length > 0;
        console.log(`📄 Cotización ${id} tiene factura: ${hasInvoice}, IDs encontrados: ${cleanInvoiceIds}`);

        // Si tiene factura, obtener el estado de pago
        let paymentState = null;
        if (hasInvoice && cleanInvoiceIds.length > 0) {
            const invoiceId = cleanInvoiceIds[0];
            const invoiceXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>${invoiceId}</int></value>
              </data>
            </array></value>
            <value><array>
              <data>
                <value><string>payment_state</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;
            
            const invoiceText = await xmlrpcCall("/xmlrpc/2/object", invoiceXml);
            const paymentMatch = invoiceText.match(/<name>payment_state<\/name>[\s\S]*?<value><string>(.*?)<\/string>/);
            paymentState = paymentMatch ? paymentMatch[1] : null;
            console.log(`📄 Estado de pago: ${paymentState}`);
        }

        return res.json({ hasInvoice, invoiceIds: cleanInvoiceIds, paymentState });

    } catch (error) {
        console.error("❌ Error verificando estado de factura:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📄 OBTENER DETALLE DE FACTURA
app.get("/odoo/invoice/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const uid = await login();

        console.log(`📄 Obteniendo detalle de factura ID: ${id}`);

        const invoiceXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>${id}</int></value>
              </data>
            </array></value>
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
</methodCall>`;

        const invoiceText = await xmlrpcCall("/xmlrpc/2/object", invoiceXml);
        console.log(`📄 Respuesta de detalle de factura: ${invoiceText.substring(0, 500)}...`);

        const invoice = parseInvoiceDetail(invoiceText);
        console.log(`📄 Factura parseada:`, invoice);

        return res.json({ success: true, invoice });

    } catch (error) {
        console.error("❌ Error obteniendo detalle de factura:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📋 OBTENER MÉTODOS DE PAGO DISPONIBLES
app.get("/odoo/payment-methods", async (req, res) => {
    try {
        const uid = await login();

        console.log(`📋 Obteniendo métodos de pago disponibles`);

        const searchXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>account.payment.method</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><array>
                  <data>
                    <value><string>payment_type</string></value>
                    <value><string>=</string></value>
                    <value><string>inbound</string></value>
                  </data>
                </array></value>
              </data>
            </array></value>
            <value><array>
              <data>
                <value><string>id</string></value>
                <value><string>name</string></value>
                <value><string>payment_type</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        const searchText = await xmlrpcCall("/xmlrpc/2/object", searchXml);
        console.log(`📋 Resultado de búsqueda de métodos de pago: ${searchText.substring(0, 500)}...`);

        // Parsear métodos de pago
        const methods = [];
        const structs = searchText.match(/<struct>([\s\S]*?)<\/struct>/g);
        if (structs) {
            for (const struct of structs) {
                const getId = () => {
                    const match = struct.match(/<name>id<\/name>[\s\S]*?<value><int>(\d+)<\/int>/);
                    return match ? parseInt(match[1]) : null;
                };
                const getName = () => {
                    const match = struct.match(/<name>name<\/name>[\s\S]*?<value><string>(.*?)<\/string>/);
                    return match ? match[1] : null;
                };
                const id = getId();
                const name = getName();
                if (id && name) {
                    methods.push({ id, name });
                }
            }
        }

        return res.json({ success: true, methods });

    } catch (error) {
        console.error("❌ Error obteniendo métodos de pago:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 📋 OBTENER DIARIOS DISPONIBLES
app.get("/odoo/journals", async (req, res) => {
    try {
        const uid = await login();

        console.log(`📋 Obteniendo diarios disponibles`);

        const searchXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>account.journal</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><array>
                  <data>
                    <value><string>type</string></value>
                    <value><string>in</string></value>
                    <value><array>
                      <data>
                        <value><string>bank</string></value>
                        <value><string>cash</string></value>
                      </data>
                    </array></value>
                  </data>
                </array></value>
              </data>
            </array></value>
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
</methodCall>`;

        const searchText = await xmlrpcCall("/xmlrpc/2/object", searchXml);
        console.log(`📋 Resultado de búsqueda de diarios: ${searchText.substring(0, 500)}...`);

        // Parsear diarios
        const journals = [];
        const structs = searchText.match(/<struct>([\s\S]*?)<\/struct>/g);
        if (structs) {
            for (const struct of structs) {
                const getId = () => {
                    const match = struct.match(/<name>id<\/name>[\s\S]*?<value><int>(\d+)<\/int>/);
                    return match ? parseInt(match[1]) : null;
                };
                const getName = () => {
                    const match = struct.match(/<name>name<\/name>[\s\S]*?<value><string>(.*?)<\/string>/);
                    return match ? match[1] : null;
                };
                const id = getId();
                const name = getName();
                if (id && name) {
                    journals.push({ id, name });
                }
            }
        }

        return res.json({ success: true, journals });

    } catch (error) {
        console.error("❌ Error obteniendo diarios:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 💳 REGISTRAR PAGO DE FACTURA
app.post("/odoo/invoice/:id/pay", async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, journal_id } = req.body;
        const uid = await login();

        console.log(`💳 Registrando pago para factura ID: ${id}, Monto: ${amount}, Diario: ${journal_id}`);

        // 1. Leer factura para obtener partner_id
        const invoiceXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>account.move</string></value></param>
    <param><value><string>read</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>${id}</int></value>
              </data>
            </array></value>
            <value><array>
              <data>
                <value><string>partner_id</string></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        const invoiceText = await xmlrpcCall("/xmlrpc/2/object", invoiceXml);
        const invoice = parseInvoiceDetail(invoiceText);

        if (!invoice) {
            return res.status(404).json({ error: "Factura no encontrada" });
        }

        const partnerId = Array.isArray(invoice.partner_id) ? invoice.partner_id[0] : invoice.partner_id;

        // 2. Obtener líneas de la factura para usar el wizard
        const linesXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
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
                    <value><int>${id}</int></value>
                  </data>
                </array></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        const linesText = await xmlrpcCall("/xmlrpc/2/object", linesXml);
        const lineIds = linesText.match(/<int>(\d+)<\/int>/g);
        const lineIdsArray = lineIds ? lineIds.map(id => parseInt(id.replace(/<int>|<\/int>/g, ''))) : [];

        if (lineIdsArray.length === 0) {
            return res.status(404).json({ error: "No se encontraron líneas de factura" });
        }

        console.log(`💳 Líneas de factura encontradas: ${lineIdsArray.join(', ')}`);

        // 3. Usar el wizard account.payment.register para pago total
        const wizardXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
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
                      <value><double>${amount}</double></value>
                    </member>
                    <member>
                      <name>journal_id</name>
                      <value><int>${journal_id || 1}</int></value>
                    </member>
                    <member>
                      <name>payment_type</name>
                      <value><string>inbound</string></value>
                    </member>
                    <member>
                      <name>line_ids</name>
                      <value><array><data>${lineIdsArray.map(id => `<value><int>${id}</int></value>`).join('')}</data></array></value>
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
</methodCall>`;

        const wizardText = await xmlrpcCall("/xmlrpc/2/object", wizardXml);
        const wizardIdMatch = wizardText.match(/<int>(\d+)<\/int>/);
        const wizardId = wizardIdMatch ? parseInt(wizardIdMatch[1]) : null;

        console.log(`💳 ID de wizard creado: ${wizardId}`);

        if (!wizardId) {
            return res.status(500).json({ error: "No se pudo crear el wizard" });
        }

        // 4. Llamar a action_create_payments
        const createPaymentsXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>account.payment.register</string></value></param>
    <param><value><string>action_create_payments</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value><array>
              <data>
                <value><int>${wizardId}</int></value>
              </data>
            </array></value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        await xmlrpcCall("/xmlrpc/2/object", createPaymentsXml);
        console.log(`💳 Pago total creado y publicado exitosamente`);

        return res.json({ success: true, message: `Pago total creado exitosamente.` });

    } catch (error) {
        console.error("❌ Error registrando pago:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 🎯 CREAR LEAD/OPORTUNIDAD EN ODOO
app.post("/odoo/lead", async (req, res) => {
    try {
        const { 
            name,           // Nombre del lead (requerido)
            partner_id,     // ID del cliente en Odoo (opcional)
            contact_name,   // Nombre del contacto (si no hay partner_id)
            email_from,     // Email del contacto
            phone,          // Teléfono
            description,    // Descripción/Notas
            type,           // 'lead' o 'opportunity' (default: 'lead')
            stage_id,       // ID de la etapa (opcional)
            user_id,        // ID del vendedor asignado (opcional)
            team_id,        // ID del equipo de ventas (opcional)
            priority,       // Prioridad: '0' (baja), '1' (media), '2' (alta), '3' (muy alta)
            tag_ids         // Array de IDs de etiquetas (opcional)
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: "name requerido" });
        }

        const uid = await login();

        // Construir el struct del lead
        let leadStruct = `
            <member>
                <name>name</name>
                <value><string>${name}</string></value>
            </member>
            <member>
                <name>type</name>
                <value><string>${type || 'lead'}</string></value>
            </member>`;

        // Agregar partner_id si existe
        if (partner_id) {
            leadStruct += `
            <member>
                <name>partner_id</name>
                <value><int>${partner_id}</int></value>
            </member>`;
        }

        // Agregar contact_name si no hay partner_id
        if (!partner_id && contact_name) {
            leadStruct += `
            <member>
                <name>contact_name</name>
                <value><string>${contact_name}</string></value>
            </member>`;
        }

        // Agregar email
        if (email_from) {
            leadStruct += `
            <member>
                <name>email_from</name>
                <value><string>${email_from}</string></value>
            </member>`;
        }

        // Agregar teléfono
        if (phone) {
            leadStruct += `
            <member>
                <name>phone</name>
                <value><string>${phone}</string></value>
            </member>`;
        }

        // Agregar descripción
        if (description) {
            leadStruct += `
            <member>
                <name>description</name>
                <value><string>${description}</string></value>
            </member>`;
        }

        // Agregar prioridad
        if (priority) {
            leadStruct += `
            <member>
                <name>priority</name>
                <value><string>${priority}</string></value>
            </member>`;
        }

        // Agregar user_id (vendedor asignado)
        if (user_id) {
            leadStruct += `
            <member>
                <name>user_id</name>
                <value><int>${user_id}</int></value>
            </member>`;
        }

        // Agregar team_id (equipo de ventas)
        if (team_id) {
            leadStruct += `
            <member>
                <name>team_id</name>
                <value><int>${team_id}</int></value>
            </member>`;
        }

        // Agregar stage_id (etapa)
        if (stage_id) {
            leadStruct += `
            <member>
                <name>stage_id</name>
                <value><int>${stage_id}</int></value>
            </member>`;
        }

        // Agregar etiquetas
        if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
            const tagsXml = tag_ids.map(id => `<value><int>${id}</int></value>`).join('');
            leadStruct += `
            <member>
                <name>tag_ids</name>
                <value>
                    <array>
                        <data>${tagsXml}</data>
                    </array>
                </value>
            </member>`;
        }

        const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>crm.lead</string></value></param>
    <param><value><string>create</string></value></param>
    <param>
      <value>
        <array>
          <data>
            <value>
              <struct>
                ${leadStruct}
              </struct>
            </value>
          </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", xml);
        const match = text.match(/<int>(\d+)<\/int>/);

        const leadId = match ? parseInt(match[1]) : null;

        return res.json({
            success: true,
            id: leadId,
            message: `Lead creado exitosamente con ID: ${leadId}`
        });

    } catch (error) {
        console.error("❌ Error creando lead:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 🔍 BUSCAR LEADS EN ODOO
app.get("/odoo/leads", async (req, res) => {
    try {
        const { limit = 20, partner_id, type } = req.query;
        const uid = await login();

        // Construir dominio de búsqueda
        let domainParts = [];
        
        if (partner_id) {
            domainParts.push(`["partner_id","=",${partner_id}]`);
        }
        
        if (type) {
            domainParts.push(`["type","=","${type}"]`);
        }

        const domain = domainParts.length > 0 ? `[${domainParts.join(',')}]` : `[[]]`;

        const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${PASS}</string></value></param>
    <param><value><string>crm.lead</string></value></param>
    <param><value><string>search_read</string></value></param>
    <param><value><array><data><value>${domain}</value></data></array></value></param>
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
                  <value><string>contact_name</string></value>
                  <value><string>email_from</string></value>
                  <value><string>phone</string></value>
                  <value><string>stage_id</string></value>
                  <value><string>type</string></value>
                  <value><string>priority</string></value>
                  <value><string>create_date</string></value>
                </data>
              </array>
            </value>
          </member>
          <member><name>limit</name><value><int>${limit}</int></value></member>
          <member><name>order</name><value><string>create_date desc</string></value></member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;

        const text = await xmlrpcCall("/xmlrpc/2/object", xml);
        
        // Parse leads (similar a parsePartners)
        const leads = [];
        const structs = text.match(/<struct>([\s\S]*?)<\/struct>/g) || [];
        
        for (const struct of structs) {
            const get = (field) => {
                const regex = new RegExp(`<name>${field}</name>[\\s\\S]*?<value>([\\s\\S]*?)</value>`);
                const match = struct.match(regex);
                if (!match) return null;
                const val = match[1];
                const str = val.match(/<string>(.*?)<\/string>/);
                if (str) return str[1];
                const int = val.match(/<int>(.*?)<\/int>/);
                if (int) return parseInt(int[1]);
                return null;
            };
            
            leads.push({
                id: get("id"),
                name: get("name"),
                contact_name: get("contact_name"),
                email: get("email_from"),
                phone: get("phone"),
                stage_id: get("stage_id"),
                type: get("type"),
                priority: get("priority"),
                create_date: get("create_date")
            });
        }

        return res.json({ success: true, count: leads.length, leads });

    } catch (error) {
        console.error("❌ Error buscando leads:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 🔄 Chatwoot Proxy Endpoint (evita CORS)
app.post("/chatwoot/send-message", async (req, res) => {
  try {
    const { conversationId, content, messageType = "outgoing" } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({ error: "conversationId y content son requeridos" });
    }

    const url = `${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`;

    const response = await axios.post(url, {
      content: content,
      message_type: messageType,
      private: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': CHATWOOT_API_TOKEN,
      }
    });

    return res.json({ success: true, data: response.data });

  } catch (error) {
    console.error("Error en proxy Chatwoot:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🚀 START
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 API lista en http://localhost:${PORT}`);
});