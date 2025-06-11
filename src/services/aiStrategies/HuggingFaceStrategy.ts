import type { IAIProviderStrategy, AIProvider, AIRequest, AIResponse, ProviderSettings } from '../../types/ai';
// InputSanitizer might not be strictly needed here if endpoint URLs are fixed and inputs are pre-validated.
// However, including it for consistency or future needs if endpoint becomes configurable.
import { InputSanitizer } from '../../utils/validation';

// Interface for error data, specific to HuggingFace API
interface ErrorData {
  error?: string | string[]; // HuggingFace might return a string or array of strings
  message?: string; // Fallback or alternative error message key
  // Potentially other fields like `warnings`, `model_id` might be present
}

export class HuggingFaceStrategy implements IAIProviderStrategy {
  async handleRequest(
    providerConfig: AIProvider,
    providerSettings: ProviderSettings,
    request: AIRequest,
    apiKey?: string | null
  ): Promise<AIResponse> {
    if (!apiKey) {
      throw new Error(`API key is required for ${providerConfig.name}`);
    }

    // Validate model for HuggingFace as it's part of the URL
    if (!request.model || typeof request.model !== 'string' || request.model.trim() === '') {
        throw new Error('A valid model ID is required for HuggingFace requests.');
    }

    // Endpoint construction for HuggingFace typically involves the model ID.
    // providerConfig.baseUrl should be the base part, e.g., "https://api-inference.huggingface.co/models"
    const url = `${providerConfig.baseUrl}/${request.model}`;

    if (!InputSanitizer.validateUrl(url)) { // Validate the constructed URL
        throw new Error(`Invalid endpoint URL for ${providerConfig.name}: ${url}`);
    }

    const controller = new AbortController();
    // HuggingFace models, especially larger ones or those that need to load, can take longer.
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: request.prompt,
          parameters: {
            temperature: request.temperature,
            max_new_tokens: request.maxTokens, // HuggingFace uses 'max_new_tokens'
            return_full_text: false, // Usually set to false to get only the generated part
          },
          // Some models might support 'options' like 'use_cache': false, 'wait_for_model': true
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
          errorData = { message: errorText || `HTTP ${response.status}: ${response.statusText}`};
        }
        // HuggingFace error messages can be in `errorData.error` (string/array) or `errorData.message`
        const errorMessage = Array.isArray(errorData.error) ? errorData.error.join(', ') : errorData.error;
        throw new Error(errorMessage || errorData.message || `API request failed for ${providerConfig.name} with status ${response.status}`);
      }

      const data = await response.json();

      let content: string;
      // Response format can vary; sometimes it's an array with the first element holding the text,
      // sometimes it's an object with a `generated_text` field.
      if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
        content = data[0].generated_text;
      } else if (data.generated_text) {
        content = data.generated_text;
      } else {
        throw new Error(`Invalid or unexpected response format from ${providerConfig.name}`);
      }

      return {
        content, // Sanitization by ConsolidatedAIService
        provider: providerConfig.name,
        model: request.model, // Return the requested model
        // HuggingFace typically doesn't provide token usage stats in the same way
        usage: undefined
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
