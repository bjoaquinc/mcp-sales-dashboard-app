import { McpUseProvider, useWidget, useWidgetTheme, type WidgetMetadata } from "mcp-use/react";
import { z } from "zod";

const propsSchema = z.object({
  revenue: z.array(z.object({
    month: z.string(),
    revenue: z.number(),
    order_count: z.number(),
  })),
  categorySales: z.array(z.object({
    category: z.string(),
    order_count: z.number(),
    total_revenue: z.number(),
  })),
  topProducts: z.array(z.object({
    name: z.string(),
    category: z.string(),
    units_sold: z.number(),
    revenue: z.number(),
  })),
  summary: z.object({
    total_orders: z.number(),
    total_revenue: z.number(),
    avg_order_value: z.number(),
    unique_products: z.number(),
  }),
  userName: z.string(),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Sales dashboard with revenue charts, category breakdown, and key metrics",
  props: propsSchema,
  exposeAsTool: false,
};

type Props = z.infer<typeof propsSchema>;

function useColors() {
  const theme = useWidgetTheme();
  return {
    bg: theme === "dark" ? "#1a1a2e" : "#ffffff",
    cardBg: theme === "dark" ? "#16213e" : "#f8f9fa",
    text: theme === "dark" ? "#e0e0e0" : "#1a1a1a",
    textSecondary: theme === "dark" ? "#a0a0a0" : "#666666",
    border: theme === "dark" ? "#2a2a4a" : "#e0e0e0",
    primary: theme === "dark" ? "#4a9eff" : "#0066cc",
    accent: theme === "dark" ? "#7c5cfc" : "#5a3fd6",
    success: theme === "dark" ? "#51cf66" : "#28a745",
    warning: theme === "dark" ? "#ffd43b" : "#f59f00",
    chartColors: theme === "dark"
      ? ["#4a9eff", "#7c5cfc", "#51cf66", "#ffd43b", "#ff6b6b"]
      : ["#0066cc", "#5a3fd6", "#28a745", "#f59f00", "#dc3545"],
  };
}

function formatCurrency(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatMonth(month: string): string {
  const [, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[parseInt(m, 10) - 1] || m;
}

function SummaryCards({ summary, colors }: { summary: Props["summary"]; colors: ReturnType<typeof useColors> }) {
  const cards = [
    { label: "Total Revenue", value: formatCurrency(summary.total_revenue), color: colors.primary },
    { label: "Total Orders", value: summary.total_orders.toLocaleString(), color: colors.accent },
    { label: "Avg Order Value", value: formatCurrency(summary.avg_order_value), color: colors.success },
    { label: "Products Sold", value: summary.unique_products.toString(), color: colors.warning },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
      {cards.map((card) => (
        <div key={card.label} style={{
          padding: 16,
          borderRadius: 8,
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderLeft: `4px solid ${card.color}`,
        }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: 500 }}>
            {card.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function RevenueChart({ data, colors }: { data: Props["revenue"]; colors: ReturnType<typeof useColors> }) {
  if (data.length === 0) return null;

  const maxRevenue = Math.max(...data.map((d) => d.revenue));
  const chartWidth = 600;
  const chartHeight = 200;
  const padding = { top: 10, right: 10, bottom: 30, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = innerWidth / data.length - 4;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: colors.text }}>
        Monthly Revenue (2025)
      </h3>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", maxWidth: chartWidth }}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padding.top + innerHeight * (1 - pct);
          return (
            <g key={pct}>
              <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y}
                stroke={colors.border} strokeWidth={0.5} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end"
                fill={colors.textSecondary} fontSize={10}>
                {formatCurrency(maxRevenue * pct)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const barHeight = (d.revenue / maxRevenue) * innerHeight;
          const x = padding.left + i * (innerWidth / data.length) + 2;
          const y = padding.top + innerHeight - barHeight;
          return (
            <g key={d.month}>
              <rect x={x} y={y} width={barWidth} height={barHeight}
                fill={colors.primary} rx={3} opacity={0.85} />
              <text x={x + barWidth / 2} y={chartHeight - 8} textAnchor="middle"
                fill={colors.textSecondary} fontSize={10}>
                {formatMonth(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CategoryChart({ data, colors }: { data: Props["categorySales"]; colors: ReturnType<typeof useColors> }) {
  if (data.length === 0) return null;

  const maxRevenue = Math.max(...data.map((d) => d.total_revenue));
  const barHeight = 28;
  const chartWidth = 600;
  const labelWidth = 100;
  const valueWidth = 80;
  const barAreaWidth = chartWidth - labelWidth - valueWidth - 20;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: colors.text }}>
        Revenue by Category
      </h3>
      <div>
        {data.map((d, i) => (
          <div key={d.category} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: labelWidth, fontSize: 13, color: colors.text, fontWeight: 500, textAlign: "right", flexShrink: 0 }}>
              {d.category}
            </div>
            <div style={{ flex: 1, height: barHeight, backgroundColor: colors.cardBg, borderRadius: 4, overflow: "hidden", border: `1px solid ${colors.border}` }}>
              <div style={{
                width: `${(d.total_revenue / maxRevenue) * 100}%`,
                height: "100%",
                backgroundColor: colors.chartColors[i % colors.chartColors.length],
                borderRadius: 4,
                transition: "width 0.3s ease",
                minWidth: 4,
              }} />
            </div>
            <div style={{ width: valueWidth, fontSize: 13, color: colors.textSecondary, fontWeight: 500, flexShrink: 0 }}>
              {formatCurrency(d.total_revenue)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopProductsTable({ data, colors }: { data: Props["topProducts"]; colors: ReturnType<typeof useColors> }) {
  return (
    <div>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: colors.text }}>
        Top Products
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["#", "Product", "Category", "Units Sold", "Revenue"].map((h) => (
                <th key={h} style={{
                  textAlign: h === "Units Sold" || h === "Revenue" ? "right" : "left",
                  padding: "8px 12px",
                  borderBottom: `2px solid ${colors.border}`,
                  color: colors.textSecondary,
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: "uppercase" as const,
                  letterSpacing: 0.5,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={p.name}>
                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                  {i + 1}
                </td>
                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${colors.border}`, color: colors.text, fontWeight: 500 }}>
                  {p.name}
                </td>
                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 11,
                    backgroundColor: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                  }}>
                    {p.category}
                  </span>
                </td>
                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "right" }}>
                  {p.units_sold}
                </td>
                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${colors.border}`, color: colors.primary, textAlign: "right", fontWeight: 600 }}>
                  {formatCurrency(p.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SalesDashboard() {
  const { props, isPending } = useWidget<Props>();
  const colors = useColors();

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div style={{ padding: 40, textAlign: "center", color: colors.textSecondary }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>Loading dashboard...</div>
        </div>
      </McpUseProvider>
    );
  }

  return (
    <McpUseProvider autoSize>
      <div style={{ padding: 20, backgroundColor: colors.bg, color: colors.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Sales Dashboard</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: colors.textSecondary }}>
            Welcome, {props.userName}
          </p>
        </div>

        <SummaryCards summary={props.summary} colors={colors} />
        <RevenueChart data={props.revenue} colors={colors} />
        <CategoryChart data={props.categorySales} colors={colors} />
        <TopProductsTable data={props.topProducts} colors={colors} />
      </div>
    </McpUseProvider>
  );
}
