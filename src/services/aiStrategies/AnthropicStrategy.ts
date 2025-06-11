import type { IAIProviderStrategy, AIProvider, AIRequest, AIResponse, ProviderSettings } from '../../types/ai';
import { InputSanitizer } from '../../utils/validation';

// Interface for error data, specific to how Anthropic API might return errors
interface ErrorData {
  error?: {
    message?: string;
    type?: string;
  };
  message?: string;
}

export class AnthropicStrategy implements IAIProviderStrategy {
  async handleRequest(
    providerConfig: AIProvider,
    providerSettings: ProviderSettings,
    request: AIRequest,
    apiKey?: string | null
  ): Promise<AIResponse> {
    if (!apiKey) {
      throw new Error(`API key is required for ${providerConfig.name}`);
    }

    const endpoint = providerSettings.endpoint || providerConfig.baseUrl;

    if (!InputSanitizer.validateUrl(endpoint)) {
      throw new Error(`Invalid endpoint URL for ${providerConfig.name}: ${endpoint}`);
    }

    const url = `${endpoint}/messages`; // Anthropic's messages API endpoint

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01', // Required Anthropic header
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: ErrorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `HTTP ${response.status}: ${response.statusText}` };
        }
        // Anthropic errors might have a type field within errorData.error
        throw new Error(errorData.error?.message || errorData.message || `API request failed for ${providerConfig.name} with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.content || !Array.isArray(data.content) || data.content.length === 0 || !data.content[0].text) {
        throw new Error(`Invalid response format from ${providerConfig.name}`);
      }

      const content = data.content[0].text;

      return {
        content, // Sanitization will be handled by ConsolidatedAIService
        provider: providerConfig.name,
        model: request.model || data.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens || 0,
          completionTokens: data.usage.output_tokens || 0,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        } : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
          throw error;
      }
      throw new Error(`An unexpected error occurred while calling ${providerConfig.name}: ${String(error)}`);
    }
  }
}
