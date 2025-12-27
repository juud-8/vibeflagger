/**
 * AI Insights Service for VibeFlagger Premium
 * Uses Anthropic Claude 3.5 Sonnet for relationship behavioral analysis
 */

import { callAnthropicAPI } from "../api/anthropic";
import { LogEntry } from "../database/db";
import { format } from "date-fns";

// Minimum logs required for AI analysis
export const MIN_LOGS_FOR_AI = 5;

export interface BehaviorAnalysis {
  patterns: string[];
  risks: {
    level: "low" | "moderate" | "high" | "critical";
    concerns: string[];
    summary: string;
  };
  recommendations: string[];
  timeline_insights: string[];
  health_trend: "improving" | "stable" | "declining";
}

export interface MonthlyReport {
  summary: string;
  trend: "improving" | "stable" | "declining";
  key_concerns: string[];
  highlights: string[];
  activity_count: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Format logs for AI analysis with comprehensive context
 */
function formatLogsForAI(
  logs: LogEntry[],
  profileName: string,
  relationship?: string
): string {
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let formatted = `RELATIONSHIP BEHAVIOR ANALYSIS\n`;
  formatted += `${"=".repeat(60)}\n\n`;
  formatted += `Subject: ${profileName}\n`;
  if (relationship) {
    formatted += `Relationship Type: ${relationship}\n`;
  }
  formatted += `Total Incidents Logged: ${logs.length}\n`;
  formatted += `Date Range: ${format(new Date(sortedLogs[0].timestamp), "MMM dd, yyyy")} - ${format(new Date(sortedLogs[sortedLogs.length - 1].timestamp), "MMM dd, yyyy")}\n\n`;

  // Flag distribution
  const redCount = logs.filter((l) => l.type === "RED").length;
  const yellowCount = logs.filter((l) => l.type === "YELLOW").length;
  const greenCount = logs.filter((l) => l.type === "GREEN").length;

  formatted += `FLAG DISTRIBUTION:\n`;
  formatted += `  Red Flags (Negative): ${redCount}\n`;
  formatted += `  Yellow Alerts (Concerning): ${yellowCount}\n`;
  formatted += `  Green Flags (Positive): ${greenCount}\n\n`;

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  logs.forEach((log) => {
    categoryMap[log.category] = (categoryMap[log.category] || 0) + 1;
  });

  formatted += `CATEGORY BREAKDOWN:\n`;
  Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      formatted += `  ${category}: ${count} incidents\n`;
    });

  formatted += `\nCHRONOLOGICAL LOG ENTRIES:\n`;
  formatted += `${"=".repeat(60)}\n\n`;

  sortedLogs.forEach((log, index) => {
    const date = format(new Date(log.timestamp), "yyyy-MM-dd HH:mm");
    formatted += `Entry #${index + 1} | ${date}\n`;
    formatted += `  Type: ${log.type} | Severity: ${log.severity}/10\n`;
    formatted += `  Category: ${log.category}\n`;
    if (log.notes) {
      formatted += `  Notes: ${log.notes}\n`;
    }
    formatted += `\n`;
  });

  return formatted;
}

/**
 * Analyze a person's behavior patterns using Claude AI
 */
export async function analyzePersonBehavior(
  logs: LogEntry[],
  profileName: string,
  relationship?: string
): Promise<BehaviorAnalysis> {
  if (logs.length < MIN_LOGS_FOR_AI) {
    throw new Error(
      `Need at least ${MIN_LOGS_FOR_AI} logs for AI analysis. Currently have ${logs.length}.`
    );
  }

  const formattedLogs = formatLogsForAI(logs, profileName, relationship);

  const systemPrompt = `You are a relationship behavior analyst. Analyze the following logs objectively and ethically. Focus on patterns, not judgments. Provide actionable insights. Never tell the user what to do - only provide observations and considerations. Be empathetic but honest about concerning patterns.`;

  const userPrompt = `${formattedLogs}

Based on this behavioral log data, provide a comprehensive analysis in JSON format:

{
  "patterns": [
    "List 4-6 specific behavioral patterns you observe from the data",
    "Focus on recurring themes, escalation patterns, or cycles",
    "Be specific and reference actual flag types/categories"
  ],
  "risks": {
    "level": "low" | "moderate" | "high" | "critical",
    "concerns": ["List 2-4 specific concerns based on the data"],
    "summary": "A 2-3 sentence objective assessment of relationship health"
  },
  "recommendations": [
    "Provide 3-5 considerations or observations (not commands)",
    "Frame as 'You might consider...' or 'This pattern suggests...'",
    "Be empathetic but honest"
  ],
  "timeline_insights": [
    "Note 2-4 temporal patterns (e.g., increasing frequency, recent changes)",
    "Reference specific date ranges from the logs"
  ],
  "health_trend": "improving" | "stable" | "declining"
}

IMPORTANT: Base your analysis ONLY on the provided data. Be objective and evidence-based.`;

  try {
    const response = await callAnthropicAPI(
      [{ role: "user", content: userPrompt }],
      {
        system: systemPrompt,
        maxTokens: 4096,
        temperature: 0.5,
        model: "claude-3-5-sonnet-20241022",
      }
    );

    // Parse JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI returned invalid response format");
    }

    const analysis: BehaviorAnalysis = JSON.parse(jsonMatch[0]);
    return analysis;
  } catch (error: any) {
    console.error("AI Analysis Error:", error);

    if (error.message?.includes("rate limit")) {
      throw new Error("AI service is currently busy. Please try again in a moment.");
    } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
      throw new Error("Network error. Please check your connection and try again.");
    } else if (error.message?.includes("API key")) {
      throw new Error("AI service configuration error. Please contact support.");
    }

    throw new Error("Failed to generate AI insights. Please try again.");
  }
}

/**
 * Chat with AI about a specific person's behavior
 */
export async function chatAboutPerson(
  logs: LogEntry[],
  profileName: string,
  userQuestion: string,
  chatHistory: ChatMessage[] = []
): Promise<string> {
  if (logs.length < MIN_LOGS_FOR_AI) {
    throw new Error(
      `Need at least ${MIN_LOGS_FOR_AI} logs to chat with AI about this person.`
    );
  }

  const formattedLogs = formatLogsForAI(logs, profileName);

  const systemPrompt = `You are a supportive AI assistant helping someone understand relationship patterns. Answer questions based ONLY on the provided log data. Be empathetic, ethical, and never make definitive judgments. If asked for advice, provide considerations rather than commands.

BEHAVIORAL DATA:
${formattedLogs}

Guidelines:
- Base answers ONLY on the provided log data
- Use phrases like "Based on the logs..." or "The data suggests..."
- If asked about something not in the logs, acknowledge the limitation
- Be empathetic but objective
- Never tell the user what to do; offer considerations
- Maintain appropriate professional boundaries`;

  // Build conversation with history
  const messages: ChatMessage[] = [...chatHistory, { role: "user", content: userQuestion }];

  try {
    const response = await callAnthropicAPI(messages, {
      system: systemPrompt,
      maxTokens: 1024,
      temperature: 0.7,
      model: "claude-3-5-sonnet-20241022",
    });

    return response.content;
  } catch (error: any) {
    console.error("AI Chat Error:", error);

    if (error.message?.includes("rate limit")) {
      throw new Error("AI is currently busy. Please wait a moment and try again.");
    } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
      throw new Error("Connection error. Please check your network.");
    }

    throw new Error("Failed to get AI response. Please try again.");
  }
}

/**
 * Generate a monthly behavioral report
 */
export async function generateMonthlyReport(
  logs: LogEntry[],
  profileName: string,
  month: string
): Promise<MonthlyReport> {
  if (logs.length === 0) {
    throw new Error("No logs available for this month.");
  }

  const formattedLogs = formatLogsForAI(logs, profileName);

  const systemPrompt = `You are a relationship analyst creating monthly behavior summaries. Provide concise, data-driven insights focused on trends and key moments.`;

  const userPrompt = `${formattedLogs}

Generate a monthly report for ${month} in JSON format:

{
  "summary": "A comprehensive 3-4 sentence executive summary of the month's behavioral patterns",
  "trend": "improving" | "stable" | "declining",
  "key_concerns": ["List 2-4 specific concerns from this month"],
  "highlights": ["List 2-3 positive moments or patterns if any"],
  "activity_count": ${logs.length}
}

Focus on what changed this month compared to previous patterns if evident.`;

  try {
    const response = await callAnthropicAPI(
      [{ role: "user", content: userPrompt }],
      {
        system: systemPrompt,
        maxTokens: 2048,
        temperature: 0.5,
        model: "claude-3-5-sonnet-20241022",
      }
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI returned invalid response format");
    }

    const report: MonthlyReport = JSON.parse(jsonMatch[0]);
    return report;
  } catch (error: any) {
    console.error("Monthly Report Error:", error);
    throw new Error("Failed to generate monthly report. Please try again.");
  }
}

/**
 * Check if logs meet minimum requirement for AI analysis
 */
export function canUseAIAnalysis(logCount: number): boolean {
  return logCount >= MIN_LOGS_FOR_AI;
}
