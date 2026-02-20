import { useState, useEffect } from "react";
import { McpUseProvider, useWidget, useWidgetTheme, type WidgetMetadata } from "mcp-use/react";
import { z } from "zod";

const propsSchema = z.object({
  query: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  totalRows: z.number(),
  rowsAffected: z.number().nullable(),
  executionTime: z.number(),
  isError: z.boolean(),
  errorMessage: z.string().nullable(),
});

export const widgetMetadata: WidgetMetadata = {
  description: "SQL console with query results table and interactive query input",
  props: propsSchema,
  exposeAsTool: false,
};

type Props = z.infer<typeof propsSchema>;

function useColors() {
  const theme = useWidgetTheme();
  return {
    bg: theme === "dark" ? "#1a1a2e" : "#ffffff",
    cardBg: theme === "dark" ? "#16213e" : "#f8f9fa",
    inputBg: theme === "dark" ? "#0f1729" : "#ffffff",
    text: theme === "dark" ? "#e0e0e0" : "#1a1a1a",
    textSecondary: theme === "dark" ? "#a0a0a0" : "#666666",
    border: theme === "dark" ? "#2a2a4a" : "#e0e0e0",
    primary: theme === "dark" ? "#4a9eff" : "#0066cc",
    success: theme === "dark" ? "#51cf66" : "#28a745",
    error: theme === "dark" ? "#ff6b6b" : "#dc3545",
    errorBg: theme === "dark" ? "#2d1b1b" : "#fff5f5",
    successBg: theme === "dark" ? "#1b2d1b" : "#f0fff4",
    headerBg: theme === "dark" ? "#0d1117" : "#f1f3f5",
    rowHover: theme === "dark" ? "#1e2a3a" : "#f8f9fa",
    codeBg: theme === "dark" ? "#0d1117" : "#f6f8fa",
  };
}

function StatusBadge({ isError, rowsAffected, totalRows, executionTime, colors }: {
  isError: boolean;
  rowsAffected: number | null;
  totalRows: number;
  executionTime: number;
  colors: ReturnType<typeof useColors>;
}) {
  if (isError) {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 500,
        backgroundColor: colors.errorBg, color: colors.error, border: `1px solid ${colors.error}33`,
      }}>
        Error &middot; {executionTime}ms
      </div>
    );
  }

  const label = rowsAffected !== null
    ? `${rowsAffected} row(s) affected`
    : `${totalRows} row(s) returned`;

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 500,
      backgroundColor: colors.successBg, color: colors.success, border: `1px solid ${colors.success}33`,
    }}>
      {label} &middot; {executionTime}ms
    </div>
  );
}

function ResultsTable({ columns, rows, colors }: {
  columns: string[];
  rows: Record<string, unknown>[];
  colors: ReturnType<typeof useColors>;
}) {
  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${colors.border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} style={{
                padding: "8px 12px",
                textAlign: "left",
                backgroundColor: colors.headerBg,
                borderBottom: `2px solid ${colors.border}`,
                color: colors.textSecondary,
                fontWeight: 600,
                fontSize: 11,
                textTransform: "uppercase" as const,
                letterSpacing: 0.5,
                whiteSpace: "nowrap" as const,
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col} style={{
                  padding: "6px 12px",
                  borderBottom: `1px solid ${colors.border}`,
                  color: colors.text,
                  whiteSpace: "nowrap" as const,
                  maxWidth: 300,
                  overflow: "hidden",
                  textOverflow: "ellipsis" as const,
                  fontFamily: typeof row[col] === "number" ? "monospace" : "inherit",
                }}>
                  {row[col] === null ? (
                    <span style={{ color: colors.textSecondary, fontStyle: "italic" }}>NULL</span>
                  ) : (
                    String(row[col])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueryInput({ initialQuery, onExecute, running, colors }: {
  initialQuery: string;
  onExecute: (query: string) => void;
  running: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || running) return;
    onExecute(query.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (query.trim() && !running) onExecute(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
      <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
        Run another query
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="SELECT * FROM products WHERE category = 'Electronics'"
          disabled={running}
          rows={3}
          style={{
            flex: 1,
            padding: 10,
            fontSize: 13,
            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            backgroundColor: colors.inputBg,
            color: colors.text,
            resize: "vertical" as const,
            outline: "none",
            lineHeight: 1.5,
          }}
        />
        <button
          type="submit"
          disabled={running || !query.trim()}
          style={{
            padding: "10px 20px",
            border: "none",
            borderRadius: 6,
            backgroundColor: running || !query.trim() ? colors.border : colors.primary,
            color: "#ffffff",
            cursor: running || !query.trim() ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 13,
            alignSelf: "flex-end",
            whiteSpace: "nowrap" as const,
          }}
        >
          {running ? "Running..." : "Run"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
        Ctrl+Enter / Cmd+Enter to execute
      </div>
    </form>
  );
}

export default function SqlConsole() {
  const { props, isPending, callTool } = useWidget<Props>();
  const colors = useColors();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Props | null>(null);

  useEffect(() => {
    if (!isPending) {
      setResults(props);
    }
  }, [isPending, props]);

  const handleExecute = async (query: string) => {
    setRunning(true);
    try {
      await callTool("execute-sql", { query });
    } catch (err) {
      setResults({
        query,
        columns: [],
        rows: [],
        totalRows: 0,
        rowsAffected: null,
        executionTime: 0,
        isError: true,
        errorMessage: err instanceof Error ? err.message : "Execution failed",
      });
    } finally {
      setRunning(false);
    }
  };

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div style={{ padding: 40, textAlign: "center", color: colors.textSecondary }}>
          Executing query...
        </div>
      </McpUseProvider>
    );
  }

  const display = results || props;

  return (
    <McpUseProvider autoSize>
      <div style={{ padding: 20, backgroundColor: colors.bg, color: colors.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" as const, gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>SQL Console</h2>
          <StatusBadge
            isError={display.isError}
            rowsAffected={display.rowsAffected}
            totalRows={display.totalRows}
            executionTime={display.executionTime}
            colors={colors}
          />
        </div>

        <div style={{
          padding: 12,
          borderRadius: 6,
          backgroundColor: colors.codeBg,
          border: `1px solid ${colors.border}`,
          marginBottom: 16,
          overflowX: "auto",
        }}>
          <code style={{ fontSize: 13, fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace", color: colors.text, whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const }}>
            {display.query}
          </code>
        </div>

        {display.isError && display.errorMessage && (
          <div style={{
            padding: 12,
            borderRadius: 6,
            backgroundColor: colors.errorBg,
            border: `1px solid ${colors.error}33`,
            color: colors.error,
            marginBottom: 16,
            fontSize: 13,
          }}>
            <strong>Error:</strong> {display.errorMessage}
          </div>
        )}

        {!display.isError && display.rowsAffected !== null && (
          <div style={{
            padding: 12,
            borderRadius: 6,
            backgroundColor: colors.successBg,
            border: `1px solid ${colors.success}33`,
            color: colors.success,
            marginBottom: 16,
            fontSize: 13,
          }}>
            Query executed successfully. {display.rowsAffected} row(s) affected.
          </div>
        )}

        {display.columns.length > 0 && (
          <>
            {display.totalRows > display.rows.length && (
              <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                Showing {display.rows.length} of {display.totalRows} rows
              </div>
            )}
            <ResultsTable columns={display.columns} rows={display.rows} colors={colors} />
          </>
        )}

        <QueryInput
          initialQuery={display.query}
          onExecute={handleExecute}
          running={running}
          colors={colors}
        />
      </div>
    </McpUseProvider>
  );
}
