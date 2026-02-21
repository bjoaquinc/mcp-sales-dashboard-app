import { MCPServer, oauthWorkOSProvider, text, object, widget, error, markdown } from "mcp-use/server";
import { z } from "zod";
import Database from "better-sqlite3";

const db = new Database(":memory:");

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      total REAL NOT NULL,
      order_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_revenue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      revenue REAL NOT NULL,
      order_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      website TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      title TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'prospecting',
      value REAL NOT NULL DEFAULT 0,
      close_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deal_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER NOT NULL REFERENCES deals(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER NOT NULL REFERENCES deals(id),
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const insertProduct = db.prepare(
    "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)"
  );
  const insertOrder = db.prepare(
    "INSERT INTO orders (product_id, quantity, total, order_date) VALUES (?, ?, ?, ?)"
  );
  const insertRevenue = db.prepare(
    "INSERT INTO monthly_revenue (month, revenue, order_count) VALUES (?, ?, ?)"
  );

  const products = [
    ["Widget Pro", "Electronics", 49.99, 150],
    ["Gadget Plus", "Electronics", 79.99, 85],
    ["Smart Sensor", "Electronics", 34.99, 200],
    ["Comfort Chair", "Furniture", 299.99, 30],
    ["Standing Desk", "Furniture", 449.99, 25],
    ["Desk Lamp", "Furniture", 59.99, 120],
    ["Running Shoes", "Apparel", 129.99, 75],
    ["Winter Jacket", "Apparel", 199.99, 40],
    ["Cotton T-Shirt", "Apparel", 24.99, 300],
    ["Protein Bars (12pk)", "Food & Drink", 29.99, 500],
    ["Organic Coffee", "Food & Drink", 18.99, 250],
    ["Green Tea Set", "Food & Drink", 39.99, 100],
  ] as const;

  const insertProducts = db.transaction(() => {
    for (const p of products) {
      insertProduct.run(...p);
    }
  });
  insertProducts();

  const months = [
    "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
    "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  ];
  const revenueData = [
    [12400, 87], [15800, 112], [14200, 95], [18900, 134],
    [22100, 156], [19700, 141], [24500, 178], [27800, 195],
    [23400, 167], [28900, 203], [35200, 248], [31600, 222],
  ];

  const insertRevenueData = db.transaction(() => {
    for (let i = 0; i < months.length; i++) {
      insertRevenue.run(months[i], revenueData[i][0], revenueData[i][1]);
    }
  });
  insertRevenueData();

  const allProducts = db.prepare("SELECT id, price FROM products").all() as Array<{ id: number; price: number }>;

  const insertOrders = db.transaction(() => {
    for (const month of months) {
      const orderCount = 10 + Math.floor(Math.random() * 20);
      for (let j = 0; j < orderCount; j++) {
        const product = allProducts[Math.floor(Math.random() * allProducts.length)];
        const qty = 1 + Math.floor(Math.random() * 5);
        const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
        insertOrder.run(product.id, qty, +(product.price * qty).toFixed(2), `${month}-${day}`);
      }
    }
  });
  insertOrders();

  seedCrmData(allProducts);
}

function seedCrmData(allProducts: Array<{ id: number; price: number }>) {
  const insertAccount = db.prepare(
    "INSERT INTO accounts (name, industry, website, created_at) VALUES (?, ?, ?, ?)"
  );
  const insertDeal = db.prepare(
    "INSERT INTO deals (account_id, title, stage, value, close_date, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertDealItem = db.prepare(
    "INSERT INTO deal_items (deal_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)"
  );
  const insertActivity = db.prepare(
    "INSERT INTO activities (deal_id, type, content, created_at) VALUES (?, ?, ?, ?)"
  );

  const accounts = [
    ["Acme Corporation", "Technology", "https://acme.example.com", "2025-01-15 09:00:00"],
    ["TechCorp Solutions", "Software", "https://techcorp.example.com", "2025-02-03 10:30:00"],
    ["GlobalTrade Inc", "Retail", "https://globaltrade.example.com", "2025-03-10 14:00:00"],
    ["Summit Healthcare", "Healthcare", "https://summithc.example.com", "2025-01-22 11:00:00"],
    ["Pinnacle Finance", "Financial Services", "https://pinnacle.example.com", "2025-04-05 08:45:00"],
    ["Evergreen Manufacturing", "Manufacturing", "https://evergreen.example.com", "2025-02-18 16:00:00"],
    ["Coastal Logistics", "Transportation", "https://coastal.example.com", "2025-05-01 09:15:00"],
    ["Horizon Media Group", "Media", "https://horizonmedia.example.com", "2025-03-28 13:00:00"],
  ] as const;

  db.transaction(() => {
    for (const a of accounts) insertAccount.run(...a);
  })();

  const STAGES = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"] as const;

  const deals: Array<{ accountId: number; title: string; stage: string; closeDate: string; createdAt: string; items: Array<{ productId: number; qty: number }> }> = [
    { accountId: 1, title: "Acme Office Upgrade", stage: "negotiation", closeDate: "2026-03-15", createdAt: "2025-11-01 10:00:00", items: [{ productId: 5, qty: 20 }, { productId: 4, qty: 20 }, { productId: 6, qty: 40 }] },
    { accountId: 2, title: "TechCorp Sensor Rollout", stage: "proposal", closeDate: "2026-04-01", createdAt: "2025-12-10 09:00:00", items: [{ productId: 3, qty: 100 }, { productId: 1, qty: 50 }] },
    { accountId: 3, title: "GlobalTrade Apparel Bundle", stage: "qualification", closeDate: "2026-05-15", createdAt: "2026-01-05 14:00:00", items: [{ productId: 7, qty: 200 }, { productId: 9, qty: 500 }, { productId: 8, qty: 100 }] },
    { accountId: 4, title: "Summit Break Room Supply", stage: "closed_won", closeDate: "2025-12-20", createdAt: "2025-09-15 08:00:00", items: [{ productId: 10, qty: 50 }, { productId: 11, qty: 30 }, { productId: 12, qty: 20 }] },
    { accountId: 5, title: "Pinnacle Trading Floor Desks", stage: "negotiation", closeDate: "2026-03-01", createdAt: "2025-10-20 11:30:00", items: [{ productId: 5, qty: 50 }, { productId: 6, qty: 50 }] },
    { accountId: 6, title: "Evergreen Factory Electronics", stage: "prospecting", closeDate: "2026-06-30", createdAt: "2026-02-01 09:00:00", items: [{ productId: 1, qty: 200 }, { productId: 2, qty: 100 }] },
    { accountId: 7, title: "Coastal Team Apparel", stage: "prospecting", closeDate: "2026-07-15", createdAt: "2026-02-10 10:00:00", items: [{ productId: 9, qty: 300 }, { productId: 7, qty: 50 }] },
    { accountId: 8, title: "Horizon Office Refresh", stage: "proposal", closeDate: "2026-04-15", createdAt: "2025-12-20 15:00:00", items: [{ productId: 4, qty: 15 }, { productId: 5, qty: 10 }, { productId: 6, qty: 30 }] },
    { accountId: 1, title: "Acme Electronics Fleet", stage: "qualification", closeDate: "2026-06-01", createdAt: "2026-01-20 11:00:00", items: [{ productId: 2, qty: 75 }, { productId: 3, qty: 150 }] },
    { accountId: 3, title: "GlobalTrade Coffee Program", stage: "closed_won", closeDate: "2025-11-30", createdAt: "2025-08-10 13:00:00", items: [{ productId: 11, qty: 200 }, { productId: 12, qty: 80 }] },
    { accountId: 5, title: "Pinnacle Wellness Package", stage: "prospecting", closeDate: "2026-08-01", createdAt: "2026-02-15 09:30:00", items: [{ productId: 10, qty: 100 }, { productId: 7, qty: 25 }] },
    { accountId: 2, title: "TechCorp Furniture Refit", stage: "closed_lost", closeDate: "2025-10-15", createdAt: "2025-07-01 10:00:00", items: [{ productId: 4, qty: 30 }, { productId: 5, qty: 30 }] },
    { accountId: 6, title: "Evergreen Staff Uniforms", stage: "qualification", closeDate: "2026-05-01", createdAt: "2026-01-12 08:45:00", items: [{ productId: 9, qty: 1000 }, { productId: 8, qty: 200 }] },
    { accountId: 4, title: "Summit Gadget Pilot", stage: "closed_lost", closeDate: "2026-01-10", createdAt: "2025-10-05 14:00:00", items: [{ productId: 1, qty: 10 }, { productId: 2, qty: 10 }] },
    { accountId: 8, title: "Horizon Snack Bar Setup", stage: "proposal", closeDate: "2026-04-30", createdAt: "2026-01-25 16:00:00", items: [{ productId: 10, qty: 40 }, { productId: 11, qty: 60 }, { productId: 12, qty: 25 }] },
  ];

  const productPriceMap = new Map(allProducts.map(p => [p.id, p.price]));

  db.transaction(() => {
    for (const deal of deals) {
      const value = deal.items.reduce((sum, item) => {
        const price = productPriceMap.get(item.productId) || 0;
        return sum + price * item.qty;
      }, 0);

      const result = insertDeal.run(deal.accountId, deal.title, deal.stage, +value.toFixed(2), deal.closeDate, deal.createdAt);
      const dealId = result.lastInsertRowid as number;

      for (const item of deal.items) {
        const price = productPriceMap.get(item.productId) || 0;
        insertDealItem.run(dealId, item.productId, item.qty, price);
      }

      insertActivity.run(dealId, "stage_change", `Deal created in ${deal.stage}`, deal.createdAt);
    }
  })();

  const activitySeed = [
    [1, "call", "Discussed office layout requirements with procurement team", "2025-11-15 14:00:00"],
    [1, "note", "Budget approved by Acme CFO, moving to final negotiation", "2026-01-10 09:30:00"],
    [1, "email", "Sent revised pricing proposal with volume discount", "2026-02-05 11:00:00"],
    [2, "call", "Technical review call with TechCorp engineering lead", "2026-01-05 10:00:00"],
    [2, "note", "They need sensors compatible with their IoT platform", "2026-01-15 16:00:00"],
    [3, "note", "GlobalTrade wants to test with 3 stores first", "2026-01-20 13:00:00"],
    [4, "note", "Order delivered successfully, client very satisfied", "2025-12-22 10:00:00"],
    [5, "call", "Pinnacle VP wants standing desks for entire trading floor", "2025-12-01 09:00:00"],
    [5, "note", "Competitor also bidding — need to sharpen pricing", "2026-01-20 15:00:00"],
    [5, "email", "Sent final proposal with 15% volume discount", "2026-02-10 11:00:00"],
    [6, "note", "Initial outreach — Evergreen expanding factory floor", "2026-02-05 09:00:00"],
    [8, "call", "Horizon wants modern furniture for new office wing", "2026-01-05 14:00:00"],
    [8, "note", "Requested samples of Comfort Chair and Standing Desk", "2026-01-18 10:00:00"],
    [9, "note", "Acme interested in standardizing on Gadget Plus", "2026-02-01 11:00:00"],
    [10, "note", "Coffee program rollout was a huge success", "2025-12-05 09:00:00"],
    [12, "note", "TechCorp went with a local vendor instead — price sensitive", "2025-10-16 09:00:00"],
    [14, "note", "Summit decided to delay gadget pilot indefinitely", "2026-01-12 10:00:00"],
    [15, "call", "Discussed snack bar options with Horizon office manager", "2026-02-01 14:00:00"],
  ] as const;

  db.transaction(() => {
    for (const a of activitySeed) insertActivity.run(...a);
  })();
}

initDatabase();

const server = new MCPServer({
  name: "sales-dashboard",
  title: "Sales Dashboard",
  version: "1.0.0",
  description: "Sales CRM with deal pipeline, analytics, and live SQL",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  oauth: oauthWorkOSProvider(),
  favicon: "favicon.ico",
  icons: [
    { src: "icon.svg", mimeType: "image/svg+xml", sizes: ["512x512"] },
  ],
});

server.tool(
  {
    name: "view-sales-dashboard",
    description: "View the sales dashboard with revenue charts, category breakdown, and key metrics",
    schema: z.object({}),
    widget: {
      name: "sales-dashboard",
      invoking: "Loading dashboard data...",
      invoked: "Dashboard loaded",
    },
  },
  async (_args, ctx) => {
    const revenue = db.prepare(
      "SELECT month, revenue, order_count FROM monthly_revenue ORDER BY month"
    ).all() as Array<{ month: string; revenue: number; order_count: number }>;

    const categorySales = db.prepare(`
      SELECT p.category, COUNT(o.id) as order_count, SUM(o.total) as total_revenue
      FROM orders o JOIN products p ON o.product_id = p.id
      GROUP BY p.category ORDER BY total_revenue DESC
    `).all() as Array<{ category: string; order_count: number; total_revenue: number }>;

    const topProducts = db.prepare(`
      SELECT p.name, p.category, SUM(o.quantity) as units_sold, SUM(o.total) as revenue
      FROM orders o JOIN products p ON o.product_id = p.id
      GROUP BY p.id ORDER BY revenue DESC LIMIT 5
    `).all() as Array<{ name: string; category: string; units_sold: number; revenue: number }>;

    const summary = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total) as total_revenue,
        AVG(total) as avg_order_value,
        COUNT(DISTINCT product_id) as unique_products
      FROM orders
    `).get() as { total_orders: number; total_revenue: number; avg_order_value: number; unique_products: number };

    const userName = ctx.auth?.user?.name || ctx.auth?.user?.email || "User";

    return widget({
      props: { revenue, categorySales, topProducts, summary, userName },
      output: text(
        `Sales Dashboard for ${userName}:\n` +
        `Total Revenue: $${summary.total_revenue.toFixed(2)}\n` +
        `Total Orders: ${summary.total_orders}\n` +
        `Avg Order Value: $${summary.avg_order_value.toFixed(2)}\n` +
        `Top Product: ${topProducts[0]?.name || "N/A"}`
      ),
    });
  }
);

server.tool(
  {
    name: "execute-sql",
    description: "Execute a SQL query against the sales database. Supports SELECT, INSERT, UPDATE, DELETE on tables: products, orders, monthly_revenue, accounts, deals, deal_items, activities",
    schema: z.object({
      query: z.string().describe("SQL query to execute (SELECT, INSERT, UPDATE, DELETE)"),
    }),
    annotations: {
      destructiveHint: true,
    },
    widget: {
      name: "sql-console",
      invoking: "Executing query...",
      invoked: "Query complete",
    },
  },
  async ({ query }) => {
    const trimmed = query.trim();
    const isSelect = /^SELECT\b/i.test(trimmed);
    const start = performance.now();

    try {
      if (isSelect) {
        const rows = db.prepare(trimmed).all() as Record<string, unknown>[];
        const executionTime = +(performance.now() - start).toFixed(2);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        return widget({
          props: {
            query: trimmed,
            columns,
            rows: rows.slice(0, 500),
            totalRows: rows.length,
            rowsAffected: null,
            executionTime,
            isError: false,
            errorMessage: null,
          },
          output: text(`Query returned ${rows.length} row(s) in ${executionTime}ms`),
        });
      }

      const result = db.prepare(trimmed).run();
      const executionTime = +(performance.now() - start).toFixed(2);

      return widget({
        props: {
          query: trimmed,
          columns: [],
          rows: [],
          totalRows: 0,
          rowsAffected: result.changes,
          executionTime,
          isError: false,
          errorMessage: null,
        },
        output: text(`Query executed: ${result.changes} row(s) affected in ${executionTime}ms`),
      });
    } catch (err) {
      const executionTime = +(performance.now() - start).toFixed(2);
      const message = err instanceof Error ? err.message : "Unknown SQL error";

      return widget({
        props: {
          query: trimmed,
          columns: [],
          rows: [],
          totalRows: 0,
          rowsAffected: null,
          executionTime,
          isError: true,
          errorMessage: message,
        },
        output: error(`SQL Error: ${message}`),
      });
    }
  }
);

// --- Deal Pipeline Tools ---

const DEAL_STAGES = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
type DealStage = typeof DEAL_STAGES[number];

interface DealRow {
  id: number;
  account_id: number;
  account_name: string;
  title: string;
  stage: string;
  value: number;
  close_date: string;
  created_at: string;
  item_count: number;
}

interface DealItemRow {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface ActivityRow {
  id: number;
  type: string;
  content: string;
  created_at: string;
}

function queryPipelineDeals(): DealRow[] {
  return db.prepare(`
    SELECT d.id, d.account_id, a.name as account_name, d.title, d.stage,
           d.value, d.close_date, d.created_at,
           COUNT(di.id) as item_count
    FROM deals d
    JOIN accounts a ON d.account_id = a.id
    LEFT JOIN deal_items di ON di.deal_id = d.id
    GROUP BY d.id
    ORDER BY d.value DESC
  `).all() as DealRow[];
}

function queryDealItems(dealId: number): DealItemRow[] {
  return db.prepare(`
    SELECT p.name as product_name, di.quantity, di.unit_price,
           (di.quantity * di.unit_price) as line_total
    FROM deal_items di
    JOIN products p ON di.product_id = p.id
    WHERE di.deal_id = ?
  `).all(dealId) as DealItemRow[];
}

function queryDealActivities(dealId: number): ActivityRow[] {
  return db.prepare(`
    SELECT id, type, content, created_at
    FROM activities
    WHERE deal_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(dealId) as ActivityRow[];
}

server.tool(
  {
    name: "view-pipeline",
    description: "View the deal pipeline as an interactive kanban board showing all deals grouped by stage (prospecting, qualification, proposal, negotiation, closed_won, closed_lost)",
    schema: z.object({}),
    widget: {
      name: "deal-pipeline",
      invoking: "Loading pipeline...",
      invoked: "Pipeline loaded",
    },
  },
  async () => {
    const deals = queryPipelineDeals();

    const stages = DEAL_STAGES.map(stage => {
      const stageDeals = deals.filter(d => d.stage === stage);
      return {
        stage,
        totalValue: stageDeals.reduce((sum, d) => sum + d.value, 0),
        deals: stageDeals.map(d => ({
          ...d,
          items: queryDealItems(d.id),
          activities: queryDealActivities(d.id),
        })),
      };
    });

    const activeValue = stages
      .filter(s => !["closed_won", "closed_lost"].includes(s.stage))
      .reduce((sum, s) => sum + s.totalValue, 0);
    const dealCount = deals.filter(d => !["closed_won", "closed_lost"].includes(d.stage)).length;

    return widget({
      props: { stages, activeValue, dealCount },
      output: text(
        `Pipeline: ${dealCount} active deals worth $${activeValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
        stages.map(s => `${s.stage}: ${s.deals.length} deals ($${s.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })})`).join("\n")
      ),
    });
  }
);

server.tool(
  {
    name: "create-deal",
    description: "Create a new deal in the pipeline. Creates the account if it doesn't exist.",
    schema: z.object({
      account_name: z.string().describe("Company name (creates account if new)"),
      title: z.string().describe("Deal title (e.g. 'Acme Office Upgrade')"),
      products: z.array(z.object({
        product_id: z.number().describe("Product ID from the products table"),
        quantity: z.number().min(1).describe("Quantity to include in the deal"),
      })).min(1).describe("Products to include in the deal"),
      close_date: z.string().describe("Expected close date (YYYY-MM-DD)"),
    }),
  },
  async ({ account_name, title, products: dealProducts, close_date }) => {
    let account = db.prepare("SELECT id FROM accounts WHERE name = ?").get(account_name) as { id: number } | undefined;

    if (!account) {
      const result = db.prepare("INSERT INTO accounts (name, industry, website) VALUES (?, 'Unknown', NULL)").run(account_name);
      account = { id: result.lastInsertRowid as number };
    }

    let totalValue = 0;
    const lineItems: Array<{ productId: number; qty: number; price: number }> = [];

    for (const item of dealProducts) {
      const product = db.prepare("SELECT id, price FROM products WHERE id = ?").get(item.product_id) as { id: number; price: number } | undefined;
      if (!product) return error(`Product ID ${item.product_id} not found`);
      lineItems.push({ productId: product.id, qty: item.quantity, price: product.price });
      totalValue += product.price * item.quantity;
    }

    const dealResult = db.prepare(
      "INSERT INTO deals (account_id, title, stage, value, close_date) VALUES (?, ?, 'prospecting', ?, ?)"
    ).run(account.id, title, +totalValue.toFixed(2), close_date);
    const dealId = dealResult.lastInsertRowid as number;

    const insertDealItem = db.prepare("INSERT INTO deal_items (deal_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)");
    for (const item of lineItems) {
      insertDealItem.run(dealId, item.productId, item.qty, item.price);
    }

    db.prepare("INSERT INTO activities (deal_id, type, content) VALUES (?, 'stage_change', ?)").run(
      dealId, `Deal created in prospecting`
    );

    return text(`Created deal "${title}" for ${account_name} worth $${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} with ${lineItems.length} product(s). Close date: ${close_date}`);
  }
);

server.tool(
  {
    name: "update-deal-stage",
    description: "Move a deal to a different pipeline stage",
    schema: z.object({
      deal_id: z.number().describe("Deal ID"),
      new_stage: z.enum(DEAL_STAGES).describe("Target stage"),
    }),
  },
  async ({ deal_id, new_stage }) => {
    const deal = db.prepare("SELECT id, title, stage FROM deals WHERE id = ?").get(deal_id) as { id: number; title: string; stage: string } | undefined;
    if (!deal) return error(`Deal ID ${deal_id} not found`);
    if (deal.stage === new_stage) return text(`Deal "${deal.title}" is already in ${new_stage}`);

    db.prepare("UPDATE deals SET stage = ? WHERE id = ?").run(new_stage, deal_id);
    db.prepare("INSERT INTO activities (deal_id, type, content) VALUES (?, 'stage_change', ?)").run(
      deal_id, `Moved from ${deal.stage} to ${new_stage}`
    );

    return text(`Moved "${deal.title}" from ${deal.stage} to ${new_stage}`);
  }
);

server.tool(
  {
    name: "add-deal-note",
    description: "Add a note or activity to a deal",
    schema: z.object({
      deal_id: z.number().describe("Deal ID"),
      content: z.string().describe("Note content"),
    }),
  },
  async ({ deal_id, content }) => {
    const deal = db.prepare("SELECT id, title FROM deals WHERE id = ?").get(deal_id) as { id: number; title: string } | undefined;
    if (!deal) return error(`Deal ID ${deal_id} not found`);

    db.prepare("INSERT INTO activities (deal_id, type, content) VALUES (?, 'note', ?)").run(deal_id, content);

    return text(`Note added to "${deal.title}"`);
  }
);

server.tool(
  {
    name: "close-deal-won",
    description: "Close a deal as won and automatically generate orders from its line items",
    schema: z.object({
      deal_id: z.number().describe("Deal ID to close as won"),
    }),
    annotations: {
      destructiveHint: true,
    },
  },
  async ({ deal_id }) => {
    const deal = db.prepare("SELECT id, title, stage FROM deals WHERE id = ?").get(deal_id) as { id: number; title: string; stage: string } | undefined;
    if (!deal) return error(`Deal ID ${deal_id} not found`);
    if (deal.stage === "closed_won") return text(`Deal "${deal.title}" is already closed as won`);
    if (deal.stage === "closed_lost") return error(`Deal "${deal.title}" is closed as lost and cannot be re-opened as won`);

    const items = db.prepare("SELECT product_id, quantity, unit_price FROM deal_items WHERE deal_id = ?").all(deal_id) as Array<{ product_id: number; quantity: number; unit_price: number }>;

    const today = new Date().toISOString().split("T")[0];
    const insertOrder = db.prepare("INSERT INTO orders (product_id, quantity, total, order_date) VALUES (?, ?, ?, ?)");

    let totalOrders = 0;
    let totalRevenue = 0;

    db.transaction(() => {
      for (const item of items) {
        const orderTotal = +(item.quantity * item.unit_price).toFixed(2);
        insertOrder.run(item.product_id, item.quantity, orderTotal, today);
        totalOrders++;
        totalRevenue += orderTotal;
      }

      db.prepare("UPDATE deals SET stage = 'closed_won' WHERE id = ?").run(deal_id);
      db.prepare("INSERT INTO activities (deal_id, type, content) VALUES (?, 'stage_change', ?)").run(
        deal_id, `Deal closed as WON — generated ${totalOrders} order(s) worth $${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      );
    })();

    return text(`Deal "${deal.title}" closed as WON! Created ${totalOrders} order(s) totaling $${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}. These orders now appear in the sales dashboard.`);
  }
);

server.resource(
  {
    name: "database_schema",
    uri: "sales://schema",
    title: "Database Schema",
    description: "Complete schema of the sales database including tables, columns, types, and relationships",
  },
  async () => {
    const rowCount = (table: string) => (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;

    return object({
      tables: {
        products: {
          columns: {
            id: "INTEGER PRIMARY KEY AUTOINCREMENT",
            name: "TEXT NOT NULL",
            category: "TEXT NOT NULL (Electronics, Furniture, Apparel, Food & Drink)",
            price: "REAL NOT NULL",
            stock: "INTEGER NOT NULL DEFAULT 0",
          },
          rowCount: rowCount("products"),
        },
        orders: {
          columns: {
            id: "INTEGER PRIMARY KEY AUTOINCREMENT",
            product_id: "INTEGER NOT NULL REFERENCES products(id)",
            quantity: "INTEGER NOT NULL",
            total: "REAL NOT NULL (price * quantity)",
            order_date: "TEXT NOT NULL (YYYY-MM-DD format)",
          },
          rowCount: rowCount("orders"),
        },
        monthly_revenue: {
          columns: {
            id: "INTEGER PRIMARY KEY AUTOINCREMENT",
            month: "TEXT NOT NULL (YYYY-MM format)",
            revenue: "REAL NOT NULL",
            order_count: "INTEGER NOT NULL",
          },
          rowCount: rowCount("monthly_revenue"),
        },
        accounts: {
          columns: {
            id: "INTEGER PRIMARY KEY AUTOINCREMENT",
            name: "TEXT NOT NULL",
            industry: "TEXT NOT NULL",
            website: "TEXT (nullable)",
            created_at: "TEXT NOT NULL (datetime)",
          },
          rowCount: rowCount("accounts"),
        },
        deals: {
          columns: {
            id: "INTEGER PRIMARY KEY AUTOINCREMENT",
            account_id: "INTEGER NOT NULL REFERENCES accounts(id)",
            title: "TEXT NOT NULL",
            stage: "TEXT NOT NULL (prospecting, qualification, proposal, negotiation, closed_won, closed_lost)",
            value: "REAL NOT NULL (sum of deal line items)",
            close_date: "TEXT NOT NULL (YYYY-MM-DD)",
            created_at: "TEXT NOT NULL (datetime)",
          },
          rowCount: rowCount("deals"),
        },
        deal_items: {
          columns: {
            id: "INTEGER PRIMARY KEY AUTOINCREMENT",
            deal_id: "INTEGER NOT NULL REFERENCES deals(id)",
            product_id: "INTEGER NOT NULL REFERENCES products(id)",
            quantity: "INTEGER NOT NULL",
            unit_price: "REAL NOT NULL",
          },
          rowCount: rowCount("deal_items"),
        },
        activities: {
          columns: {
            id: "INTEGER PRIMARY KEY AUTOINCREMENT",
            deal_id: "INTEGER NOT NULL REFERENCES deals(id)",
            type: "TEXT NOT NULL (note, call, email, stage_change)",
            content: "TEXT NOT NULL",
            created_at: "TEXT NOT NULL (datetime)",
          },
          rowCount: rowCount("activities"),
        },
      },
      relationships: [
        "orders.product_id -> products.id (many-to-one)",
        "deals.account_id -> accounts.id (many-to-one)",
        "deal_items.deal_id -> deals.id (many-to-one)",
        "deal_items.product_id -> products.id (many-to-one)",
        "activities.deal_id -> deals.id (many-to-one)",
      ],
    });
  }
);

server.prompt(
  {
    name: "data-analyst",
    description: "Activates CRM analyst mode: the AI understands the full database schema (products, orders, accounts, deals, activities) and can generate SQL queries, manage the pipeline, analyze trends, and modify data",
    schema: z.object({
      goal: z.string().optional().describe("What you want to analyze or accomplish (e.g., 'pipeline value by stage', 'deals closing this month', 'win rate')"),
    }),
  },
  async ({ goal }) => {
    const rc = (table: string) => (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;

    const goalSection = goal
      ? `\n## Current Goal\n${goal}\n\nGenerate and execute the appropriate SQL query using the execute-sql tool, or use the pipeline tools if applicable.`
      : "";

    return markdown(`
# Sales CRM Analyst Mode

You are a CRM analyst with full access to a sales database and deal pipeline.

## Database Schema

### products (${rc("products")} rows)
| Column   | Type    | Notes |
|----------|---------|-------|
| id       | INTEGER | Primary key |
| name     | TEXT    | Product name |
| category | TEXT    | Electronics, Furniture, Apparel, Food & Drink |
| price    | REAL    | Unit price in USD |
| stock    | INTEGER | Current inventory count |

### orders (${rc("orders")} rows)
| Column     | Type    | Notes |
|------------|---------|-------|
| id         | INTEGER | Primary key |
| product_id | INTEGER | FK -> products.id |
| quantity   | INTEGER | Units ordered |
| total      | REAL    | Order total (price * quantity) |
| order_date | TEXT    | YYYY-MM-DD |

### monthly_revenue (${rc("monthly_revenue")} rows)
| Column      | Type    | Notes |
|-------------|---------|-------|
| id          | INTEGER | Primary key |
| month       | TEXT    | YYYY-MM |
| revenue     | REAL    | Total revenue for the month |
| order_count | INTEGER | Orders that month |

### accounts (${rc("accounts")} rows)
| Column     | Type    | Notes |
|------------|---------|-------|
| id         | INTEGER | Primary key |
| name       | TEXT    | Company name |
| industry   | TEXT    | Industry vertical |
| website    | TEXT    | Company URL (nullable) |
| created_at | TEXT    | Datetime created |

### deals (${rc("deals")} rows)
| Column     | Type    | Notes |
|------------|---------|-------|
| id         | INTEGER | Primary key |
| account_id | INTEGER | FK -> accounts.id |
| title      | TEXT    | Deal name |
| stage      | TEXT    | prospecting, qualification, proposal, negotiation, closed_won, closed_lost |
| value      | REAL    | Total deal value (sum of line items) |
| close_date | TEXT    | Expected close date YYYY-MM-DD |
| created_at | TEXT    | Datetime created |

### deal_items (${rc("deal_items")} rows)
| Column     | Type    | Notes |
|------------|---------|-------|
| id         | INTEGER | Primary key |
| deal_id    | INTEGER | FK -> deals.id |
| product_id | INTEGER | FK -> products.id |
| quantity   | INTEGER | Units in deal |
| unit_price | REAL    | Price per unit at time of deal |

### activities (${rc("activities")} rows)
| Column     | Type    | Notes |
|------------|---------|-------|
| id         | INTEGER | Primary key |
| deal_id    | INTEGER | FK -> deals.id |
| type       | TEXT    | note, call, email, stage_change |
| content    | TEXT    | Activity description |
| created_at | TEXT    | Datetime created |

## Key Relationships
- \`orders.product_id\` -> \`products.id\`
- \`deals.account_id\` -> \`accounts.id\`
- \`deal_items.deal_id\` -> \`deals.id\`, \`deal_items.product_id\` -> \`products.id\`
- \`activities.deal_id\` -> \`deals.id\`
- When a deal is closed as won, orders are generated from deal_items

## Available Tools
- **execute-sql** — Run any SQL query. Results render in an interactive table widget.
- **view-sales-dashboard** — Visual dashboard with revenue charts and KPI cards.
- **view-pipeline** — Interactive kanban board showing all deals by stage.
- **create-deal** — Create a new deal with account, products, and close date.
- **update-deal-stage** — Move a deal to a different pipeline stage.
- **add-deal-note** — Add a note to a deal.
- **close-deal-won** — Close a deal as won and auto-generate orders.

## Guidelines
- Use \`execute-sql\` for data analysis queries.
- Use \`view-pipeline\` when the user wants to see or manage their deals.
- Use \`view-sales-dashboard\` for revenue and order analytics.
- When closing deals, use \`close-deal-won\` which auto-generates orders.
- For pipeline analysis (win rate, stage conversion, pipeline value), use SQL against the deals table.
${goalSection}
    `);
  }
);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
console.log(`Sales Dashboard server running on port ${PORT}`);
server.listen(PORT);
