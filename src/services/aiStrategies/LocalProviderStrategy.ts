import type { IAIProviderStrategy, AIProvider, AIRequest, AIResponse, ProviderSettings } from '../../types/ai';
import { InputSanitizer } from '../../utils/validation';

// Interface for error data, specific to local providers
interface ErrorData {
  error?: {
    message?: string; // Standard OpenAI-like error
  };
  message?: string; // Ollama sometimes puts the error directly in message
}

// Interface for the request body, which can vary between Ollama and LM Studio
interface LocalRequestBody {
  model: string;
  prompt?: string; // For Ollama
  messages?: Array<{ role: string; content: string }>; // For LM Studio (OpenAI compatible)
  stream?: boolean;
  options?: { // Ollama specific options
    temperature?: number;
    num_predict?: number; // Max tokens for Ollama
  };
  temperature?: number; // For LM Studio
  max_tokens?: number; // For LM Studio
}

export class LocalProviderStrategy implements IAIProviderStrategy {
  async handleRequest(
    providerConfig: AIProvider,
    providerSettings: ProviderSettings,
    request: AIRequest,
    // apiKey is not typically used by local providers, so it's optional in the interface
    _apiKey?: string | null
  ): Promise<AIResponse> {
    const baseUrl = providerSettings.endpoint || providerConfig.baseUrl;

    if (!InputSanitizer.validateUrl(baseUrl)) {
      throw new Error(`Invalid endpoint URL for ${providerConfig.name}: ${baseUrl}`);
    }

    let url: string;
    let body: LocalRequestBody;

    const modelToUse = request.model || providerSettings.selectedModel || providerConfig.models[0] || 'default';

    if (providerConfig.id === 'ollama') {
      url = `${baseUrl}/api/generate`; // Ollama's generate endpoint
      body = {
        model: modelToUse,
        prompt: request.prompt,
        stream: false,
        options: {
          temperature: request.temperature || 0.7,
          num_predict: request.maxTokens || 1500, // Ollama uses num_predict for max tokens
        },
      };
    } else if (providerConfig.id === 'lmstudio') {
      url = `${baseUrl}/chat/completions`; // LM Studio uses an OpenAI compatible endpoint
      body = {
        model: modelToUse,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant specialized in creative writing and fiction.',
          },
          { role: 'user', content: request.prompt },
        ],
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1500,
      };
    } else {
      throw new Error(`Unsupported local provider ID: ${providerConfig.id}`);
    }

    const controller = new AbortController();
    // Local models can also take time, especially if not loaded or on slower hardware.
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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
        throw new Error(errorData.error?.message || errorData.message || `API request failed for ${providerConfig.name} with status ${response.status}`);
      }

      const data = await response.json();
      let content: string;
      let usage: AIResponse['usage'] = undefined;

      if (providerConfig.id === 'ollama') {
        content = data.response || 'No response generated';
        // Ollama's generate endpoint may provide some context/usage data, but not standard token counts
        // For example: data.total_duration, data.prompt_eval_count, data.eval_count
        // Mapping these to promptTokens/completionTokens is not straightforward.
        // We can sum eval counts if needed:
        if (data.prompt_eval_count && data.eval_count) {
            usage = {
                promptTokens: data.prompt_eval_count,
                completionTokens: data.eval_count,
                totalTokens: data.prompt_eval_count + data.eval_count
            };
        }
      } else { // LM Studio or other OpenAI-compatible local server
        if (!data.choices || !data.choices[0] || !data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
          throw new Error(`Invalid response format from ${providerConfig.name}`);
        }
        content = data.choices[0].message.content;
        if (data.usage) { // LM Studio might return OpenAI-like usage stats
            usage = {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0
            };
        }
      }

      return {
        content, // Sanitization by ConsolidatedAIService
        provider: providerConfig.name,
        model: modelToUse,
        usage
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
