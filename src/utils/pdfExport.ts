import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { format } from "date-fns";
import type { LogEntry } from "../database/db";

function getTypeLabel(type: string): string {
  switch (type) {
    case "GREEN":
      return "Green Flag";
    case "YELLOW":
      return "Yellow Alert";
    case "RED":
      return "Red Flag";
    default:
      return type;
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case "GREEN":
      return "#00aa44";
    case "YELLOW":
      return "#cc8800";
    case "RED":
      return "#cc0000";
    default:
      return "#666666";
  }
}

function generateReportHTML(logs: LogEntry[]): string {
  const reportDate = format(new Date(), "MMMM d, yyyy 'at' h:mm a");
  const totalLogs = logs.length;

  const redCount = logs.filter((l) => l.type === "RED").length;
  const yellowCount = logs.filter((l) => l.type === "YELLOW").length;
  const greenCount = logs.filter((l) => l.type === "GREEN").length;

  const tableRows = logs
    .map(
      (log) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${format(
        new Date(log.timestamp),
        "MMM d, yyyy h:mm a"
      )}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; font-weight: 500;">${
        log.person
      }</td>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; color: ${getTypeColor(
        log.type
      )}; font-weight: 600;">${getTypeLabel(log.type)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${
        log.severity
      }/10</td>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; font-style: italic;">${
        log.category
      }</td>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; max-width: 200px;">${
        log.notes || "—"
      }</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
          background: white;
          color: #1a1a1a;
          padding: 40px;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 3px solid #1a1a1a;
          padding-bottom: 20px;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .header .subtitle {
          font-size: 14px;
          color: #666;
          font-weight: 500;
        }
        .summary {
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
          display: flex;
          justify-content: space-around;
        }
        .summary-item {
          text-align: center;
        }
        .summary-item .label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .summary-item .value {
          font-size: 24px;
          font-weight: 700;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }
        thead {
          background: #1a1a1a;
          color: white;
        }
        thead th {
          padding: 14px 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        tbody tr:hover {
          background: #fafafa;
        }
        .footer {
          text-align: center;
          padding-top: 20px;
          border-top: 2px solid #e0e0e0;
          color: #666;
          font-size: 12px;
        }
        .footer strong {
          color: #1a1a1a;
        }
        @media print {
          body {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>VibeVault Relationship Audit Report</h1>
        <p class="subtitle">Generated on ${reportDate}</p>
      </div>

      <div class="summary">
        <div class="summary-item">
          <div class="label">Total Entries</div>
          <div class="value">${totalLogs}</div>
        </div>
        <div class="summary-item">
          <div class="label">Green Flags</div>
          <div class="value" style="color: #00aa44;">${greenCount}</div>
        </div>
        <div class="summary-item">
          <div class="label">Yellow Alerts</div>
          <div class="value" style="color: #cc8800;">${yellowCount}</div>
        </div>
        <div class="summary-item">
          <div class="label">Red Flags</div>
          <div class="value" style="color: #cc0000;">${redCount}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Person</th>
            <th>Type</th>
            <th style="text-align: center;">Severity</th>
            <th>Category</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div class="footer">
        <p><strong>Confidential Report</strong></p>
        <p>Evidence generated by VibeVault • For private use only</p>
      </div>
    </body>
    </html>
  `;
}

export async function generateAndShareReport(logs: LogEntry[]): Promise<void> {
  if (logs.length === 0) {
    throw new Error("No logs to export");
  }

  const html = generateReportHTML(logs);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Share VibeVault Report",
      UTI: "com.adobe.pdf",
    });
  } else {
    throw new Error("Sharing is not available on this device");
  }
}
