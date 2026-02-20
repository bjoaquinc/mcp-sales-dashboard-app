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
}

initDatabase();

const server = new MCPServer({
  name: "sales-dashboard",
  title: "Sales Dashboard",
  version: "1.0.0",
  description: "Authenticated sales data visualization with live SQL",
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
    description: "Execute a SQL query against the sales database. Supports SELECT, INSERT, UPDATE, DELETE on tables: products, orders, monthly_revenue",
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

server.resource(
  {
    name: "database_schema",
    uri: "sales://schema",
    title: "Database Schema",
    description: "Complete schema of the sales database including tables, columns, types, and relationships",
  },
  async () => object({
    tables: {
      products: {
        columns: {
          id: "INTEGER PRIMARY KEY AUTOINCREMENT",
          name: "TEXT NOT NULL",
          category: "TEXT NOT NULL (Electronics, Furniture, Apparel, Food & Drink)",
          price: "REAL NOT NULL",
          stock: "INTEGER NOT NULL DEFAULT 0",
        },
        rowCount: (db.prepare("SELECT COUNT(*) as n FROM products").get() as { n: number }).n,
      },
      orders: {
        columns: {
          id: "INTEGER PRIMARY KEY AUTOINCREMENT",
          product_id: "INTEGER NOT NULL REFERENCES products(id)",
          quantity: "INTEGER NOT NULL",
          total: "REAL NOT NULL (price * quantity)",
          order_date: "TEXT NOT NULL (YYYY-MM-DD format, range: 2025-01 to 2025-12)",
        },
        rowCount: (db.prepare("SELECT COUNT(*) as n FROM orders").get() as { n: number }).n,
      },
      monthly_revenue: {
        columns: {
          id: "INTEGER PRIMARY KEY AUTOINCREMENT",
          month: "TEXT NOT NULL (YYYY-MM format)",
          revenue: "REAL NOT NULL",
          order_count: "INTEGER NOT NULL",
        },
        rowCount: (db.prepare("SELECT COUNT(*) as n FROM monthly_revenue").get() as { n: number }).n,
      },
    },
    relationships: [
      "orders.product_id -> products.id (many-to-one)",
    ],
  })
);

server.prompt(
  {
    name: "data-analyst",
    description: "Activates data analyst mode: the AI understands the full sales database schema and can generate SQL queries, analyze trends, and modify data on request",
    schema: z.object({
      goal: z.string().optional().describe("What you want to analyze or accomplish (e.g., 'find top selling category', 'add a new product')"),
    }),
  },
  async ({ goal }) => {
    const productCount = (db.prepare("SELECT COUNT(*) as n FROM products").get() as { n: number }).n;
    const orderCount = (db.prepare("SELECT COUNT(*) as n FROM orders").get() as { n: number }).n;

    const goalSection = goal
      ? `\n## Current Goal\n${goal}\n\nGenerate and execute the appropriate SQL query using the execute-sql tool.`
      : "";

    return markdown(`
# Sales Data Analyst Mode

You are a data analyst with full access to a sales database via the \`execute-sql\` tool.

## Database Schema

### products (${productCount} rows)
| Column   | Type    | Notes |
|----------|---------|-------|
| id       | INTEGER | Primary key, auto-increment |
| name     | TEXT    | Product name |
| category | TEXT    | One of: Electronics, Furniture, Apparel, Food & Drink |
| price    | REAL    | Unit price in USD |
| stock    | INTEGER | Current inventory count |

### orders (${orderCount} rows)
| Column     | Type    | Notes |
|------------|---------|-------|
| id         | INTEGER | Primary key, auto-increment |
| product_id | INTEGER | Foreign key -> products.id |
| quantity   | INTEGER | Units ordered |
| total      | REAL    | Order total (price * quantity) |
| order_date | TEXT    | Format: YYYY-MM-DD, range: 2025-01 to 2025-12 |

### monthly_revenue (12 rows)
| Column      | Type    | Notes |
|-------------|---------|-------|
| id          | INTEGER | Primary key, auto-increment |
| month       | TEXT    | Format: YYYY-MM |
| revenue     | REAL    | Total revenue for the month |
| order_count | INTEGER | Number of orders that month |

## Relationships
- \`orders.product_id\` references \`products.id\`

## Available Tools
- **execute-sql** — Run any SQL (SELECT, INSERT, UPDATE, DELETE). Results render in an interactive table widget.
- **view-sales-dashboard** — Show the visual dashboard with charts and KPI cards.

## Guidelines
- Always use the \`execute-sql\` tool to run queries — never just show SQL as text.
- For analysis questions, write efficient queries with JOINs, GROUP BY, and aggregates.
- For data modifications, confirm what will change before running UPDATE/DELETE.
- After modifying data, offer to show the dashboard so the user can see the visual impact.
- Use \`view-sales-dashboard\` when the user wants an overview or after significant data changes.
${goalSection}
    `);
  }
);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
console.log(`Sales Dashboard server running on port ${PORT}`);
server.listen(PORT);
