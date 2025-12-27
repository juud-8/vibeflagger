/*
IMPORTANT NOTICE: DO NOT REMOVE
./src/api/anthropic.ts
Anthropic Claude API client for AI-powered relationship insights.
Uses Claude 3.5 Sonnet for analyzing behavioral patterns and generating insights.
*/

import Constants from "expo-constants";

const ANTHROPIC_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_VIBECODE_ANTHROPIC_API_KEY ||
  process.env.EXPO_PUBLIC_VIBECODE_ANTHROPIC_API_KEY;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Call the Anthropic Messages API
 * @param messages - Array of messages for the conversation
 * @param options - Optional configuration
 * @returns The AI response
 */
export const callAnthropicAPI = async (
  messages: AnthropicMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    system?: string;
  }
): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }> => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: options?.model || "claude-3-5-sonnet-20241022",
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.7,
        system: options?.system,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Anthropic API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data: AnthropicResponse = await response.json();

    return {
      content: data.content[0]?.text || "",
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
    };
  } catch (error) {
    console.error("Anthropic API Error:", error);
    throw error;
  }
};

/**
 * Simple chat completion with Claude
 * @param prompt - The user prompt
 * @param systemPrompt - Optional system prompt
 * @returns The AI response
 */
export const getClaudeResponse = async (
  prompt: string,
  systemPrompt?: string
): Promise<string> => {
  const result = await callAnthropicAPI(
    [{ role: "user", content: prompt }],
    { system: systemPrompt }
  );
  return result.content;
};
