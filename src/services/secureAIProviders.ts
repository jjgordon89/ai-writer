/**
 * Secure AI Providers service with encrypted API key storage
 */

import { enhancedSecureStorage } from './enhancedSecureStorage';
import { InputSanitizer, FormValidator, RateLimiter } from '../utils/validation';
import type {
  AIProvider,
  ProviderSettings,
  AISettings, // Using AISettings from types/ai
  AIRequest,
  AIResponse
} from '../types/ai';
// AI_PROVIDERS is already removed. Local type definitions above are removed.

// RequestBody interface is kept here if it's specific to this service's internal implementation
// For now, assuming it's internal to SecureAIService's private methods if this service were active.
interface RequestBody {
  model?: string | undefined;
  messages?: Array<{
    role: string;
    content: string;
  }> | undefined;
  temperature?: number | undefined;
  max_tokens?: number | undefined;
  inputs?: string | undefined;
  parameters?: {
    temperature?: number | undefined;
    max_new_tokens?: number | undefined;
    return_full_text?: boolean | undefined;
  } | undefined;
  prompt?: string | undefined;
  stream?: boolean | undefined;
  options?: {
    temperature?: number | undefined;
    num_predict?: number | undefined;
  } | undefined;
}

// AI_PROVIDERS list removed as it's now centralized in src/config/aiConfig.ts
// If this service is revived, it should import AI_PROVIDERS.

export class SecureAIService {
  private settings: AISettings; // Changed SecureAISettings to AISettings
  private rateLimiter: RateLimiter;
  private isInitialized = false;

  constructor(settings: AISettings) { // Changed SecureAISettings to AISettings
    this.settings = settings;
    this.rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
  }

  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await enhancedSecureStorage.initialize();
      this.isInitialized = true;
    }
  }

  async generateContent(request: AIRequest): Promise<AIResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Validate and sanitize input
    const sanitizedPrompt = InputSanitizer.sanitizeUserInput(request.prompt);
    if (!sanitizedPrompt || sanitizedPrompt.length < 1) {
      throw new Error('Invalid prompt provided');
    }

    if (sanitizedPrompt.length > 10000) {
      throw new Error('Prompt too long (maximum 10,000 characters)');
    }

    const provider = AI_PROVIDERS.find(p => p.id === this.settings.defaultProvider);
    if (!provider) {
      throw new Error('No provider configured');
    }

    const providerSettings = this.settings.providers[provider.id];
    if (!providerSettings?.isEnabled) {
      throw new Error(`Provider ${provider.name} is not enabled`);
    }

    // Rate limiting
    if (!this.rateLimiter.isAllowed(provider.id)) {
      throw new Error('Rate limit exceeded. Please wait before making another request.');
    }

    // Get API key securely
    let apiKey: string | null = null;
    if (provider.requiresApiKey) {
      apiKey = await enhancedSecureStorage.getSecure(`apikey-${provider.id}`);
      if (!apiKey) {
        throw new Error(`API key required for ${provider.name}`);
      }
    }

    const model = request.model || providerSettings.selectedModel || provider.models[0] || 'default';
    const temperature = Math.max(0, Math.min(2, request.temperature ?? this.settings.temperature));
    const maxTokens = Math.max(1, Math.min(4000, request.maxTokens ?? this.settings.maxTokens));

    const secureRequest: AIRequest = {
      prompt: sanitizedPrompt,
      type: InputSanitizer.sanitizeText(request.type),
      model,
      temperature,
      maxTokens
    };

    try {
      switch (provider.id) {
        case 'openai':
        case 'openrouter':
          return await this.callOpenAICompatible(provider, providerSettings, secureRequest, apiKey!);
        
        case 'anthropic':
          return await this.callAnthropic(provider, providerSettings, secureRequest, apiKey!);
        
        case 'huggingface':
          return await this.callHuggingFace(provider, providerSettings, secureRequest, apiKey!);
        
        case 'ollama':
        case 'lmstudio':
          return await this.callLocalProvider(provider, providerSettings, secureRequest);
        
        default:
          throw new Error(`Unsupported provider: ${provider.id}`);
      }
    } catch (error) {
      console.error(`AI generation failed for ${provider.name}:`, error);
      throw this.handleAPIError(error, provider);
    }
  }

  async setApiKey(providerId: string, apiKey: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Validate API key format
    const sanitizedKey = InputSanitizer.sanitizeApiKey(apiKey);
    if (!sanitizedKey) {
      throw new Error('Invalid API key format');
    }

    const validation = FormValidator.validateField(sanitizedKey, FormValidator.rules.apiKey);
    if (validation) {
      throw new Error(validation);
    }

    // Store encrypted
    await enhancedSecureStorage.setSecure(`apikey-${providerId}`, sanitizedKey);
  }

  async getApiKey(providerId: string): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await enhancedSecureStorage.getSecure(`apikey-${providerId}`);
  }

  async removeApiKey(providerId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    enhancedSecureStorage.removeSecure(`apikey-${providerId}`);
  }

  private async callOpenAICompatible(
    provider: AIProvider,
    settings: ProviderSettings,
    request: AIRequest,
    apiKey: string
  ): Promise<AIResponse> {
    const endpoint = settings.endpoint || provider.baseUrl;
    
    // Validate endpoint URL
    if (!InputSanitizer.validateUrl(endpoint)) {
      throw new Error('Invalid endpoint URL');
    }

    const url = `${endpoint}/chat/completions`;
    
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(provider.id === 'openrouter' && {
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AI Fiction Writer'
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
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const content = data.choices[0]?.message?.content || 'No response generated';
      
      return {
        content: InputSanitizer.sanitizeUserInput(content, true),
        provider: provider.name,
        model: request.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        } : undefined
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async callAnthropic(
    provider: AIProvider,
    settings: ProviderSettings,
    request: AIRequest,
    apiKey: string
  ): Promise<AIResponse> {
    const endpoint = settings.endpoint || provider.baseUrl;
    
    if (!InputSanitizer.validateUrl(endpoint)) {
      throw new Error('Invalid endpoint URL');
    }

    const url = `${endpoint}/messages`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          messages: [
            {
              role: 'user',
              content: request.prompt
            }
          ]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const content = data.content[0]?.text || 'No response generated';
      
      return {
        content: InputSanitizer.sanitizeUserInput(content, true),
        provider: provider.name,
        model: request.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens || 0,
          completionTokens: data.usage.output_tokens || 0,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
        } : undefined
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async callHuggingFace(
    provider: AIProvider,
    settings: ProviderSettings,
    request: AIRequest,
    apiKey: string
  ): Promise<AIResponse> {
    const url = `${provider.baseUrl}/${request.model}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // Longer timeout for HF

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: request.prompt,
          parameters: {
            temperature: request.temperature,
            max_new_tokens: request.maxTokens,
            return_full_text: false
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const content = data[0]?.generated_text || data.generated_text || 'No response generated';
      
      return {
        content: InputSanitizer.sanitizeUserInput(content, true),
        provider: provider.name,
        model: request.model || 'unknown'
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async callLocalProvider(
    provider: AIProvider,
    settings: ProviderSettings,
    request: AIRequest
  ): Promise<AIResponse> {
    const baseUrl = settings.endpoint || provider.baseUrl;
    
    if (!InputSanitizer.validateUrl(baseUrl)) {
      throw new Error('Invalid endpoint URL');
    }

    let url: string;
    let body: RequestBody;

    if (provider.id === 'ollama') {
      url = `${baseUrl}/api/generate`;
      body = {
        model: request.model || 'default',
        prompt: request.prompt,
        stream: false,
        options: {
          temperature: request.temperature || 0.7,
          num_predict: request.maxTokens || 1500
        }
      };
    } else {
      url = `${baseUrl}/chat/completions`;
      body = {
        model: request.model || 'default',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant specialized in creative writing and fiction.'
          },
          {
            role: 'user',
            content: request.prompt
          }
        ],
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 1500
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      let content: string;
      if (provider.id === 'ollama') {
        content = data.response || 'No response generated';
      } else {
        content = data.choices[0]?.message?.content || 'No response generated';
      }
      
      return {
        content: InputSanitizer.sanitizeUserInput(content, true),
        provider: provider.name,
        model: request.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        } : undefined
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private handleAPIError(error: unknown, provider: AIProvider): Error {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new Error(`Request timeout for ${provider.name}. Please try again.`);
      }
      
      if (error.message.includes('401') || error.message.includes('403')) {
        return new Error(`Authentication failed for ${provider.name}. Please check your API key.`);
      }
      
      if (error.message.includes('429')) {
        return new Error(`Rate limit exceeded for ${provider.name}. Please try again later.`);
      }
      
      if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        return new Error(`${provider.name} service is temporarily unavailable. Please try again later.`);
      }
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return new Error(`Unable to connect to ${provider.name}. Please check your internet connection${provider.type === 'local' ? ' and ensure the local service is running' : ''}.`);
      }
      
      return new Error(error.message);
    }
    
    return new Error(`An unexpected error occurred with ${provider.name}`);
  }

  updateSettings(newSettings: Partial<AISettings>) { // Changed SecureAISettings to AISettings
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings(): AISettings { // Changed SecureAISettings to AISettings
    return { ...this.settings };
  }
}

export function createDefaultSecureAISettings(): AISettings { // Changed SecureAISettings to AISettings
  // This function would also need to be updated to use AI_PROVIDERS from config
  // if this service and its settings creation were to be actively used.
  // For now, just aligning the type signature.
  const defaultProvidersSettings: Record<string, ProviderSettings> = {};
  // AI_PROVIDERS.forEach(provider => { // Assuming AI_PROVIDERS would be imported
  //   defaultProvidersSettings[provider.id] = {
  //     isEnabled: false,
  //     selectedModel: provider.models.length > 0 ? provider.models[0] : undefined,
  //   };
  // });

  return {
    providers: defaultProvidersSettings, // Should be dynamically populated
    defaultProvider: 'openai',
    temperature: 0.7,
    maxTokens: 1500,
  };
}