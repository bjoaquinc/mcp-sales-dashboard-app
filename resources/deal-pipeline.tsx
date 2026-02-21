import { useState } from "react";
import { McpUseProvider, useWidget, useWidgetTheme, type WidgetMetadata } from "mcp-use/react";
import { z } from "zod";

const activitySchema = z.object({
  id: z.number(),
  type: z.string(),
  content: z.string(),
  created_at: z.string(),
});

const dealItemSchema = z.object({
  product_name: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  line_total: z.number(),
});

const dealSchema = z.object({
  id: z.number(),
  account_id: z.number(),
  account_name: z.string(),
  title: z.string(),
  stage: z.string(),
  value: z.number(),
  close_date: z.string(),
  created_at: z.string(),
  item_count: z.number(),
  items: z.array(dealItemSchema),
  activities: z.array(activitySchema),
});

const stageSchema = z.object({
  stage: z.string(),
  totalValue: z.number(),
  deals: z.array(dealSchema),
});

const propsSchema = z.object({
  stages: z.array(stageSchema),
  activeValue: z.number(),
  dealCount: z.number(),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Interactive deal pipeline kanban board",
  props: propsSchema,
  exposeAsTool: false,
};

type Props = z.infer<typeof propsSchema>;
type Deal = z.infer<typeof dealSchema>;
type DealItem = z.infer<typeof dealItemSchema>;
type Activity = z.infer<typeof activitySchema>;
type Stage = z.infer<typeof stageSchema>;

const STAGE_ORDER = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"];

const STAGE_META: Record<string, { label: string; color: string; darkColor: string }> = {
  prospecting:   { label: "Prospecting",   color: "#2563eb", darkColor: "#60a5fa" },
  qualification: { label: "Qualification", color: "#7c3aed", darkColor: "#a78bfa" },
  proposal:      { label: "Proposal",      color: "#d97706", darkColor: "#fbbf24" },
  negotiation:   { label: "Negotiation",   color: "#ea580c", darkColor: "#fb923c" },
  closed_won:    { label: "Closed Won",    color: "#16a34a", darkColor: "#4ade80" },
  closed_lost:   { label: "Closed Lost",   color: "#dc2626", darkColor: "#f87171" },
};

function useColors() {
  const theme = useWidgetTheme();
  return {
    bg: theme === "dark" ? "#0f172a" : "#f1f5f9",
    cardBg: theme === "dark" ? "#1e293b" : "#ffffff",
    columnBg: theme === "dark" ? "#1a2332" : "#f8fafc",
    text: theme === "dark" ? "#e2e8f0" : "#0f172a",
    textSecondary: theme === "dark" ? "#94a3b8" : "#64748b",
    textMuted: theme === "dark" ? "#64748b" : "#94a3b8",
    border: theme === "dark" ? "#334155" : "#e2e8f0",
    borderLight: theme === "dark" ? "#1e293b" : "#f1f5f9",
    inputBg: theme === "dark" ? "#0f172a" : "#f8fafc",
    hoverBg: theme === "dark" ? "#334155" : "#f1f5f9",
    isDark: theme === "dark",
  };
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return "$" + (value / 1_000).toFixed(1) + "K";
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function nextStage(current: string): string | null {
  const activeStages = ["prospecting", "qualification", "proposal", "negotiation"];
  const idx = activeStages.indexOf(current);
  if (idx === -1 || idx === activeStages.length - 1) return null;
  return activeStages[idx + 1];
}

function PipelineHeader({ activeValue, dealCount, colors }: { activeValue: number; dealCount: number; colors: ReturnType<typeof useColors> }) {
  return (
    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.border}` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: colors.text }}>Deal Pipeline</h1>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>
            <span style={{ fontWeight: 600, color: colors.text }}>{dealCount}</span> active deals
          </div>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>
            Pipeline value: <span style={{ fontWeight: 600, color: colors.text }}>{formatCurrency(activeValue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityIcon({ type, colors }: { type: string; colors: ReturnType<typeof useColors> }) {
  const icons: Record<string, string> = { note: "N", call: "C", email: "E", stage_change: "S" };
  const iconColors: Record<string, string> = {
    note: "#6366f1",
    call: "#22c55e",
    email: "#3b82f6",
    stage_change: "#f59e0b",
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 20, height: 20, borderRadius: "50%", fontSize: 10, fontWeight: 700,
      backgroundColor: (iconColors[type] || "#94a3b8") + "22",
      color: iconColors[type] || colors.textSecondary,
      flexShrink: 0,
    }}>
      {icons[type] || "?"}
    </span>
  );
}

function ActivityTimeline({ activities, colors }: { activities: Activity[]; colors: ReturnType<typeof useColors> }) {
  if (activities.length === 0) {
    return <div style={{ fontSize: 12, color: colors.textMuted, padding: "8px 0" }}>No activity yet</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {activities.slice(0, 5).map(a => (
        <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <ActivityIcon type={a.type} colors={colors} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: colors.text, lineHeight: 1.4 }}>{a.content}</div>
            <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 1 }}>{formatDateTime(a.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DealItemsTable({ items, colors }: { items: DealItem[]; colors: ReturnType<typeof useColors> }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          {["Product", "Qty", "Price", "Total"].map(h => (
            <th key={h} style={{
              textAlign: h === "Product" ? "left" : "right",
              padding: "4px 6px", borderBottom: `1px solid ${colors.border}`,
              color: colors.textMuted, fontWeight: 600, fontSize: 10,
              textTransform: "uppercase" as const, letterSpacing: 0.5,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td style={{ padding: "4px 6px", color: colors.text }}>{item.product_name}</td>
            <td style={{ padding: "4px 6px", color: colors.textSecondary, textAlign: "right", fontFamily: "monospace" }}>{item.quantity}</td>
            <td style={{ padding: "4px 6px", color: colors.textSecondary, textAlign: "right", fontFamily: "monospace" }}>${item.unit_price.toFixed(2)}</td>
            <td style={{ padding: "4px 6px", color: colors.text, textAlign: "right", fontWeight: 600, fontFamily: "monospace" }}>${item.line_total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DealCard({ deal, isExpanded, onToggle, colors }: {
  deal: Deal;
  isExpanded: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { callTool } = useWidget();
  const [noteText, setNoteText] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const stageMeta = STAGE_META[deal.stage];
  const stageColor = colors.isDark ? stageMeta?.darkColor : stageMeta?.color;
  const next = nextStage(deal.stage);
  const isClosed = deal.stage === "closed_won" || deal.stage === "closed_lost";

  const handleAdvance = async () => {
    if (!next) return;
    setActionLoading("advance");
    try { await callTool("update-deal-stage", { deal_id: deal.id, new_stage: next }); }
    catch { /* error handled by framework */ }
    finally { setActionLoading(null); }
  };

  const handleCloseWon = async () => {
    setActionLoading("close-won");
    try { await callTool("close-deal-won", { deal_id: deal.id }); }
    catch { /* error handled by framework */ }
    finally { setActionLoading(null); }
  };

  const handleCloseLost = async () => {
    setActionLoading("close-lost");
    try { await callTool("update-deal-stage", { deal_id: deal.id, new_stage: "closed_lost" }); }
    catch { /* error handled by framework */ }
    finally { setActionLoading(null); }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setActionLoading("note");
    try {
      await callTool("add-deal-note", { deal_id: deal.id, content: noteText.trim() });
      setNoteText("");
    }
    catch { /* error handled by framework */ }
    finally { setActionLoading(null); }
  };

  const closeDateObj = new Date(deal.close_date);
  const now = new Date();
  const daysUntilClose = Math.ceil((closeDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilClose < 0 && !isClosed;
  const isUrgent = daysUntilClose >= 0 && daysUntilClose <= 14 && !isClosed;

  return (
    <div style={{
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      overflow: "hidden",
      borderLeft: `3px solid ${stageColor || colors.border}`,
    }}>
      <div
        onClick={onToggle}
        style={{ padding: "10px 12px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, lineHeight: 1.3 }}>{deal.title}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{deal.account_name}</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: stageColor, whiteSpace: "nowrap" as const }}>
            {formatCurrency(deal.value)}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" as const }}>
          <span style={{
            fontSize: 10, padding: "2px 6px", borderRadius: 4,
            backgroundColor: isOverdue ? "#dc262622" : isUrgent ? "#f59e0b22" : colors.borderLight,
            color: isOverdue ? "#dc2626" : isUrgent ? "#f59e0b" : colors.textSecondary,
            fontWeight: 500,
          }}>
            {isOverdue ? `${Math.abs(daysUntilClose)}d overdue` : isClosed ? formatDate(deal.close_date) : `${daysUntilClose}d left`}
          </span>
          <span style={{ fontSize: 10, color: colors.textMuted }}>{deal.item_count} product{deal.item_count !== 1 ? "s" : ""}</span>
          <span style={{ fontSize: 10, color: colors.textMuted, marginLeft: "auto" }}>{isExpanded ? "▼" : "▶"}</span>
        </div>
      </div>

      {isExpanded && (
        <div style={{ borderTop: `1px solid ${colors.border}`, padding: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 6 }}>Products</div>
            <DealItemsTable items={deal.items} colors={colors} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 6 }}>Activity</div>
            <ActivityTimeline activities={deal.activities} colors={colors} />
          </div>

          {!isClosed && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" as const }}>
              {next && (
                <button
                  onClick={handleAdvance}
                  disabled={actionLoading !== null}
                  style={{
                    padding: "5px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5,
                    border: "none", cursor: actionLoading ? "not-allowed" : "pointer",
                    backgroundColor: stageColor, color: "#fff", opacity: actionLoading ? 0.6 : 1,
                  }}
                >
                  {actionLoading === "advance" ? "Moving..." : `Advance to ${STAGE_META[next]?.label}`}
                </button>
              )}
              {deal.stage === "negotiation" && (
                <button
                  onClick={handleCloseWon}
                  disabled={actionLoading !== null}
                  style={{
                    padding: "5px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5,
                    border: "none", cursor: actionLoading ? "not-allowed" : "pointer",
                    backgroundColor: "#16a34a", color: "#fff", opacity: actionLoading ? 0.6 : 1,
                  }}
                >
                  {actionLoading === "close-won" ? "Closing..." : "Close Won"}
                </button>
              )}
              <button
                onClick={handleCloseLost}
                disabled={actionLoading !== null}
                style={{
                  padding: "5px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5,
                  border: `1px solid #dc262644`, backgroundColor: "transparent",
                  color: "#dc2626", cursor: actionLoading ? "not-allowed" : "pointer",
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                {actionLoading === "close-lost" ? "Closing..." : "Mark Lost"}
              </button>
            </div>
          )}

          <div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && noteText.trim()) handleAddNote(); }}
                placeholder="Add a note..."
                disabled={actionLoading === "note"}
                style={{
                  flex: 1, padding: "5px 8px", fontSize: 12,
                  border: `1px solid ${colors.border}`, borderRadius: 5,
                  backgroundColor: colors.inputBg, color: colors.text,
                  outline: "none",
                }}
              />
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim() || actionLoading === "note"}
                style={{
                  padding: "5px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5,
                  border: `1px solid ${colors.border}`, backgroundColor: colors.cardBg,
                  color: !noteText.trim() ? colors.textMuted : colors.text,
                  cursor: !noteText.trim() || actionLoading === "note" ? "not-allowed" : "pointer",
                }}
              >
                {actionLoading === "note" ? "..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageColumn({ stage, colors }: { stage: Stage; colors: ReturnType<typeof useColors> }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const meta = STAGE_META[stage.stage];
  const stageColor = colors.isDark ? meta?.darkColor : meta?.color;

  return (
    <div style={{
      flex: "0 0 260px",
      minWidth: 260,
      backgroundColor: colors.columnBg,
      borderRadius: 8,
      border: `1px solid ${colors.border}`,
      display: "flex",
      flexDirection: "column",
      maxHeight: "100%",
    }}>
      <div style={{
        padding: "10px 12px",
        borderBottom: `2px solid ${stageColor}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: stageColor }}>{meta?.label || stage.stage}</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
            backgroundColor: stageColor + "18", color: stageColor,
          }}>{stage.deals.length}</span>
        </div>
        <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: 500 }}>
          {formatCurrency(stage.totalValue)}
        </div>
      </div>

      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        {stage.deals.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: colors.textMuted }}>No deals</div>
        )}
        {stage.deals.map(deal => (
          <DealCard
            key={deal.id}
            deal={deal}
            isExpanded={expandedId === deal.id}
            onToggle={() => setExpandedId(expandedId === deal.id ? null : deal.id)}
            colors={colors}
          />
        ))}
      </div>
    </div>
  );
}

export default function DealPipeline() {
  const { props, isPending } = useWidget<Props>();
  const colors = useColors();

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div style={{ padding: 40, textAlign: "center", color: colors.textSecondary, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>Loading pipeline...</div>
        </div>
      </McpUseProvider>
    );
  }

  return (
    <McpUseProvider autoSize>
      <div style={{
        backgroundColor: colors.bg,
        color: colors.text,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}>
        <PipelineHeader activeValue={props.activeValue} dealCount={props.dealCount} colors={colors} />

        <div style={{
          display: "flex",
          gap: 10,
          padding: "12px 12px 16px",
          overflowX: "auto",
          alignItems: "flex-start",
        }}>
          {props.stages.map(stage => (
            <StageColumn key={stage.stage} stage={stage} colors={colors} />
          ))}
        </div>
      </div>
    </McpUseProvider>
  );
}
