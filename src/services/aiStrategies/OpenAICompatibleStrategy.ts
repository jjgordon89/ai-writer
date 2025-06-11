import type { IAIProviderStrategy, AIProvider, AIRequest, AIResponse, ProviderSettings } from '../../types/ai';
import { InputSanitizer } from '../../utils/validation';

// Interface for error data, specific to how OpenAI-compatible APIs might return errors
interface ErrorData {
  error?: {
    message?: string;
  };
  message?: string; // Sometimes the error is directly in a message property
}

export class OpenAICompatibleStrategy implements IAIProviderStrategy {
  async handleRequest(
    providerConfig: AIProvider,
    providerSettings: ProviderSettings, // User-specific settings for this provider
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

    const url = `${endpoint}/chat/completions`;

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(providerConfig.id === 'openrouter' && { // Specific header for OpenRouter
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '', // Handle server-side if necessary
          'X-Title': 'AI Fiction Writer' // Example app title
        })
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant specialized in creative writing and fiction. Provide detailed, creative, and engaging responses that help writers develop their stories.'
          },
          {
            role: 'user',
            content: request.prompt
          }
        ],
        temperature: request.temperature,
        max_tokens: request.maxTokens
      })
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: ErrorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // If parsing fails, use the raw text as the message
          errorData = { message: errorText || `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error?.message || errorData.message || `API request failed for ${providerConfig.name} with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
        throw new Error(`Invalid response format from ${providerConfig.name}`);
      }

      const content = data.choices[0].message.content;

      return {
        content, // Sanitization of response.content will be handled by ConsolidatedAIService
        provider: providerConfig.name,
        model: request.model || data.model || 'unknown', // Use actual model from response if available
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        } : undefined
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) { // Rethrow known errors
          throw error;
      }
      throw new Error(`An unexpected error occurred while calling ${providerConfig.name}: ${String(error)}`);
    }
  }
}
