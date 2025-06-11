/**
 * Enhanced AI Providers service with improved security and error handling
 */

import { enhancedSecureStorage } from './enhancedSecureStorage';
import { ErrorSanitizer } from '../utils/errorSanitization';
import { InputSanitizer, RateLimiter, FormValidator } from '../utils/validation';
import { AI_PROVIDERS } from '../config/aiConfig';
import type {
  AIProvider,
  ProviderSettings,
  AISettings, // Using AISettings from types/ai
  AIRequest,
  AIResponse
} from '../types/ai';

import { OpenAICompatibleStrategy } from './aiStrategies/OpenAICompatibleStrategy';
import { AnthropicStrategy } from './aiStrategies/AnthropicStrategy';
import { HuggingFaceStrategy } from './aiStrategies/HuggingFaceStrategy';
import { LocalProviderStrategy } from './aiStrategies/LocalProviderStrategy';
import type { IAIProviderStrategy } from '../types/ai';

// ErrorData and RequestBody interfaces are removed as their logic is now encapsulated
// within each strategy or they are no longer directly used by this service.

export class ConsolidatedAIService {
  private settings: AISettings;
  private rateLimiter: RateLimiter;
  private isInitialized = false;
  private requestCount = 0;
  private lastRequestTime = 0;
  private strategies: Map<string, IAIProviderStrategy>;

  constructor(settings: AISettings) {
    this.settings = settings;
    this.rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute

    this.strategies = new Map<string, IAIProviderStrategy>();
    this.strategies.set('openai', new OpenAICompatibleStrategy());
    this.strategies.set('openrouter', new OpenAICompatibleStrategy());
    this.strategies.set('anthropic', new AnthropicStrategy());
    this.strategies.set('huggingface', new HuggingFaceStrategy());
    this.strategies.set('ollama', new LocalProviderStrategy());
    this.strategies.set('lmstudio', new LocalProviderStrategy());
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

    // Enhanced input validation and sanitization
    const sanitizedRequest = this.validateAndSanitizeRequest(request);
    
    const provider = AI_PROVIDERS.find(p => p.id === this.settings.defaultProvider);
    if (!provider) {
      throw new Error('No provider configured');
    }

    const providerSettings = this.settings.providers[provider.id];
    if (!providerSettings?.isEnabled) {
      throw new Error(`Provider ${provider.name} is not enabled`);
    }

    // Enhanced rate limiting
    if (!this.rateLimiter.isAllowed(provider.id)) {
      const remaining = this.rateLimiter.getRemainingAttempts(provider.id);
      throw new Error(`Rate limit exceeded. ${remaining} requests remaining. Please wait before making another request.`);
    }

    // Track request metrics
    this.requestCount++;
    this.lastRequestTime = Date.now();

    // Get API key securely
    let apiKey: string | null = null;
    if (provider.requiresApiKey) {
      apiKey = await enhancedSecureStorage.getSecure(`apikey-${provider.id}`);
      if (!apiKey) {
        throw new Error(`API key required for ${provider.name}. Please configure it in settings.`);
      }
    }

    try {
      const response = await this.callProvider(provider, providerSettings, sanitizedRequest, apiKey);
      
      // Sanitize response content
      return {
        ...response,
        content: InputSanitizer.sanitizeUserInput(response.content, true)
      };
    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
        component: 'EnhancedSecureAIService',
        action: 'generateContent',
        metadata: { provider: provider.id, model: sanitizedRequest.model }
      });
      
      throw this.handleAPIError(error, provider, sanitizedRequest.model);
    }
  }

  private handleAPIError(error: unknown, provider: AIProvider, model?: string): Error {
    // Use ErrorSanitizer for initial sanitization and logging
    const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
      component: 'ConsolidatedAIService',
      action: 'generateContent',
      metadata: { provider: provider.id, model: model || 'unknown' }
    });

    // Enhance with more specific messages from SecureAIService's handleAPIError logic
    if (error instanceof Error) {
      if (error.name === 'AbortError' || sanitizedError.message.includes('timeout')) {
        return new Error(`Request timeout for ${provider.name}. Please try again.`);
      }

      // Check for common HTTP error patterns in the sanitized message or original error
      if (sanitizedError.message.includes('401') || sanitizedError.message.includes('403') ||
          (error.message && (error.message.includes('401') || error.message.includes('403')))) {
        return new Error(`Authentication failed for ${provider.name}. Please check your API key.`);
      }

      if (sanitizedError.message.includes('429') || (error.message && error.message.includes('429'))) {
        return new Error(`Rate limit exceeded for ${provider.name}. Please try again later.`);
      }

      if (sanitizedError.message.includes('500') || sanitizedError.message.includes('502') || sanitizedError.message.includes('503') ||
          (error.message && (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')))) {
        return new Error(`${provider.name} service is temporarily unavailable. Please try again later.`);
      }

      // Check for network errors specifically if ErrorSanitizer hasn't already genericized it
      if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('NetworkError'))) {
         // Check if it's a local provider and append specific advice
        const localMessage = provider.type === 'local' ? ' and ensure the local service is running' : '';
        return new Error(`Unable to connect to ${provider.name}. Please check your internet connection${localMessage}.`);
      }

      // Fallback to the sanitized message if no specific condition met
      return new Error(sanitizedError.message);
    }

    // Fallback for non-Error objects
    return new Error(sanitizedError.message || `An unexpected error occurred with ${provider.name}`);
  }

  async setApiKey(providerId: string, apiKey: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Enhanced API key validation
    const sanitizedKey = this.validateApiKey(providerId, apiKey);
    
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

  getServiceMetrics(): {
    requestCount: number;
    lastRequestTime: number;
    sessionInfo: ReturnType<typeof enhancedSecureStorage.getSessionInfo>;
    rateLimitStatus: Record<string, number>;
  } {
    const rateLimitStatus: Record<string, number> = {};
    AI_PROVIDERS.forEach(provider => {
      rateLimitStatus[provider.id] = this.rateLimiter.getRemainingAttempts(provider.id);
    });

    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      sessionInfo: enhancedSecureStorage.getSessionInfo(),
      rateLimitStatus
    };
  }

  private validateAndSanitizeRequest(request: AIRequest): AIRequest {
    // Validate required fields
    if (!request.prompt || typeof request.prompt !== 'string') {
      throw new Error('Valid prompt is required');
    }

    // Sanitize and validate prompt
    const sanitizedPrompt = InputSanitizer.sanitizeUserInput(request.prompt);
    if (!sanitizedPrompt || sanitizedPrompt.length < 1) {
      throw new Error('Invalid prompt provided');
    }

    if (sanitizedPrompt.length > 50000) { // Increased limit but still reasonable
      throw new Error('Prompt too long (maximum 50,000 characters)');
    }

    // Validate and sanitize other fields
    const sanitizedType = InputSanitizer.sanitizeText(request.type || 'general');
    const temperature = Math.max(0, Math.min(2, request.temperature ?? this.settings.temperature));
    const maxTokens = Math.max(1, Math.min(8000, request.maxTokens ?? this.settings.maxTokens));

    return {
      prompt: sanitizedPrompt,
      type: sanitizedType,
      model: request.model || 'default',
      temperature,
      maxTokens
    };
  }

  private validateApiKey(providerId: string, apiKey: string): string {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API key must be a non-empty string');
    }

    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (!provider) {
      throw new Error('Invalid provider ID');
    }

    // Provider-specific API key validation
    switch (providerId) {
      case 'openai':
        if (!apiKey.startsWith('sk-') || apiKey.length < 40) {
          throw new Error('Invalid OpenAI API key format');
        }
        break;
      case 'anthropic':
        if (!apiKey.startsWith('sk-ant-') || apiKey.length < 40) {
          throw new Error('Invalid Anthropic API key format');
        }
        break;
      case 'openrouter':
        if (!apiKey.startsWith('sk-or-') || apiKey.length < 40) {
          throw new Error('Invalid OpenRouter API key format');
        }
        break;
      case 'huggingface':
        if (!apiKey.startsWith('hf_') || apiKey.length < 20) {
          throw new Error('Invalid HuggingFace API key format');
        }
        break;
    }

    // General sanitization
    const sanitizedKey = InputSanitizer.sanitizeApiKey(apiKey);
    if (!sanitizedKey) {
      throw new Error('Invalid API key format after sanitization');
    }

    // Additional validation using FormValidator
    const validation = FormValidator.validateField(sanitizedKey, FormValidator.rules.apiKey);
    if (validation) {
      throw new Error(validation);
    }

    return sanitizedKey;
  }

  private async callProvider(
    providerConfig: AIProvider, // Renamed from 'provider' to 'providerConfig' for clarity
    providerSettings: ProviderSettings, // Renamed from 'settings' to 'providerSettings'
    request: AIRequest,
    apiKey: string | null
  ): Promise<AIResponse> {
    const strategy = this.strategies.get(providerConfig.id);
    if (!strategy) {
      throw new Error(`Unsupported provider: ${providerConfig.id}. No strategy found.`);
    }
    // The API key passed here is already fetched and validated by generateContent
    return strategy.handleRequest(providerConfig, providerSettings, request, apiKey);
  }

  // The private call* methods (callOpenAICompatible, callAnthropic, etc.) are now removed.
  // Their logic has been moved to their respective strategy classes.

  updateSettings(newSettings: Partial<AISettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings(): AISettings { // Changed SecureAISettings to AISettings
    return { ...this.settings };
  }
}

export function createDefaultSecureAISettings(): AISettings { // Changed SecureAISettings to AISettings
  const defaultProvidersSettings: Record<string, ProviderSettings> = {};
  AI_PROVIDERS.forEach(provider => {
    defaultProvidersSettings[provider.id] = {
      // apiKey: '', // apiKey is part of ProviderSettings in types/ai.ts, initialize if needed
      isEnabled: false, // Default to false for all
      selectedModel: provider.models.length > 0 ? provider.models[0] : undefined,
      // endpoint: '' // endpoint is part of ProviderSettings in types/ai.ts, initialize if needed
    };
  });

  // Example: Enable one provider by default if necessary, e.g. OpenAI
  if (defaultProvidersSettings.openai) {
    defaultProvidersSettings.openai.isEnabled = true;
  }


  return {
    providers: defaultProvidersSettings,
    defaultProvider: 'openai', // Ensure this default provider ID exists in AI_PROVIDERS
    temperature: 0.7,
    maxTokens: 1500,
  };
}