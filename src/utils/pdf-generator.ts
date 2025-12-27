import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { format } from "date-fns";
import type { LogEntry, ProfileStats } from "../database/db";

/**
 * Generates a professional PDF "Receipts" report for a person's relationship audit
 */
export async function generateReceiptsPDF(
  stats: ProfileStats,
  logs: LogEntry[]
): Promise<void> {
  try {
    // Calculate average severity
    const avgSeverity = logs.length > 0
      ? (logs.reduce((sum, log) => sum + log.severity, 0) / logs.length).toFixed(1)
      : "0.0";

    // Sort logs chronologically (oldest first for the report)
    const sortedLogs = [...logs].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Generate HTML content - PROFESSIONAL LEGAL DOCUMENT STYLE
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Courier New', monospace;
              background: #FFFFFF;
              color: #000000;
              padding: 40px 30px;
              line-height: 1.6;
            }

            .header {
              text-align: center;
              border-bottom: 3px solid #000000;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }

            .title {
              font-size: 24px;
              font-weight: bold;
              color: #000000;
              letter-spacing: 2px;
              margin-bottom: 10px;
              text-transform: uppercase;
            }

            .subject-name {
              font-size: 20px;
              color: #000000;
              margin: 10px 0;
              font-weight: bold;
            }

            .relationship {
              font-size: 12px;
              color: #333333;
              text-transform: uppercase;
              letter-spacing: 1px;
            }

            .summary {
              background: #F5F5F5;
              border: 2px solid #CCCCCC;
              border-left: 4px solid #000000;
              padding: 20px;
              margin: 30px 0;
            }

            .summary-title {
              font-size: 14px;
              color: #000000;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 15px;
              font-weight: bold;
            }

            .stat-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #DDDDDD;
            }

            .stat-row:last-child {
              border-bottom: none;
            }

            .stat-label {
              color: #333333;
              font-size: 12px;
            }

            .stat-value {
              color: #000000;
              font-weight: bold;
              font-size: 12px;
            }

            .critical { color: #CC0000; }
            .warning { color: #CC6600; }
            .success { color: #006600; }

            .table-title {
              font-size: 16px;
              color: #000000;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin: 30px 0 15px 0;
              border-bottom: 2px solid #000000;
              padding-bottom: 10px;
              font-weight: bold;
            }

            .log-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              border: 1px solid #CCCCCC;
            }

            .log-table th {
              background: #333333;
              color: #FFFFFF;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
              padding: 12px 8px;
              text-align: left;
              border-bottom: 2px solid #000000;
            }

            .log-table td {
              padding: 12px 8px;
              border-bottom: 1px solid #DDDDDD;
              font-size: 10px;
              color: #000000;
            }

            .log-table tr {
              background: #FFFFFF;
            }

            .log-table tr:nth-child(even) {
              background: #F9F9F9;
            }

            .log-row-red {
              border-left: 4px solid #CC0000;
            }

            .log-row-yellow {
              border-left: 4px solid #CC6600;
            }

            .log-row-green {
              border-left: 4px solid #006600;
            }

            .type-badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 3px;
              font-size: 9px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .badge-red {
              background: #FFDDDD;
              color: #CC0000;
              border: 1px solid #CC0000;
            }

            .badge-yellow {
              background: #FFF4DD;
              color: #CC6600;
              border: 1px solid #CC6600;
            }

            .badge-green {
              background: #DDFFDD;
              color: #006600;
              border: 1px solid #006600;
            }

            .notes-cell {
              max-width: 250px;
              color: #333333;
              font-style: italic;
              word-wrap: break-word;
            }

            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #CCCCCC;
              text-align: center;
              color: #666666;
              font-size: 10px;
            }

            .footer-title {
              color: #000000;
              font-size: 11px;
              font-weight: bold;
              letter-spacing: 1px;
            }

            .timestamp {
              color: #666666;
              margin-top: 5px;
            }

            .no-logs {
              text-align: center;
              padding: 40px;
              color: #666666;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Relationship Audit</div>
            <div class="subject-name">${stats.profile.name}</div>
            <div class="relationship">${stats.profile.relationship}</div>
          </div>

          <div class="summary">
            <div class="summary-title">Executive Summary</div>
            <div class="stat-row">
              <span class="stat-label">Total Incidents:</span>
              <span class="stat-value">${stats.totalLogs}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Red Flags:</span>
              <span class="stat-value critical">${stats.redCount}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Yellow Alerts:</span>
              <span class="stat-value warning">${stats.yellowCount}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Green Flags:</span>
              <span class="stat-value success">${stats.greenCount}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Average Severity:</span>
              <span class="stat-value">${avgSeverity}/10</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Toxicity Score:</span>
              <span class="stat-value ${stats.vibeScore > 50 ? 'critical' : stats.vibeScore > 25 ? 'warning' : 'success'}">${stats.vibeScore}%</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Health Status:</span>
              <span class="stat-value ${stats.healthStatus === 'Critical' || stats.healthStatus === 'Toxic' ? 'critical' : stats.healthStatus === 'Concerning' ? 'warning' : 'success'}">${stats.healthStatus}</span>
            </div>
          </div>

          <div class="table-title">Chronological Incident Log</div>

          ${sortedLogs.length === 0 ? `
            <div class="no-logs">No incidents recorded</div>
          ` : `
            <table class="log-table">
              <thead>
                <tr>
                  <th style="width: 20%;">Date</th>
                  <th style="width: 12%;">Type</th>
                  <th style="width: 10%;">Severity</th>
                  <th style="width: 18%;">Category</th>
                  <th style="width: 40%;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${sortedLogs.map(log => `
                  <tr class="log-row-${log.type.toLowerCase()}">
                    <td>${format(new Date(log.timestamp), "MMM d, yyyy h:mm a")}</td>
                    <td><span class="type-badge badge-${log.type.toLowerCase()}">${log.type}</span></td>
                    <td style="color: ${log.severity >= 7 ? '#CC0000' : log.severity >= 4 ? '#CC6600' : '#006600'}; font-weight: bold;">${log.severity}/10</td>
                    <td>${log.category}</td>
                    <td class="notes-cell">${log.notes || "—"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}

          <div class="footer">
            <div class="footer-title">Generated by Vibe-Flagger Secure Vault</div>
            <div class="timestamp">Report Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</div>
          </div>
        </body>
      </html>
    `;

    // Generate PDF
    const { uri } = await Print.printToFileAsync({ html });

    // Share the PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Relationship Audit - ${stats.profile.name}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      throw new Error("Sharing is not available on this device");
    }
  } catch (error) {
    console.error("PDF Generation Error:", error);
    throw error;
  }
}
