import { AI_PROVIDERS } from '../config/aiConfig';
import type { AIProvider, AISettings, AIRequest, AIResponse, ProviderSettings } from '../types/ai'; // Using ProviderSettings from types/ai

export class AIService {
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  async generateContent(request: AIRequest): Promise<AIResponse> {
    const provider = AI_PROVIDERS.find(p => p.id === this.settings.defaultProvider);
    if (!provider) {
      throw new Error('No provider configured');
    }

    const providerSettings = this.settings.providers[provider.id];
    if (!providerSettings?.isEnabled) {
      throw new Error(`Provider ${provider.name} is not enabled`);
    }

    if (provider.requiresApiKey && !providerSettings.apiKey) {
      throw new Error(`API key required for ${provider.name}`);
    }

    const model = request.model || providerSettings.selectedModel || provider.models[0];
    const temperature = request.temperature ?? this.settings.temperature;
    const maxTokens = request.maxTokens ?? this.settings.maxTokens;

    try {
      switch (provider.id) {
        case 'openai':
        case 'openrouter':
          return await this.callOpenAICompatible(provider, providerSettings, {
            ...request,
            model,
            temperature,
            maxTokens
          });
        
        case 'anthropic':
          return await this.callAnthropic(provider, providerSettings, {
            ...request,
            model,
            temperature,
            maxTokens
          });
        
        case 'huggingface':
          return await this.callHuggingFace(provider, providerSettings, {
            ...request,
            model,
            temperature,
            maxTokens
          });
        
        case 'ollama':
        case 'lmstudio':
          return await this.callLocalProvider(provider, providerSettings, {
            ...request,
            model,
            temperature,
            maxTokens
          });
        
        default:
          throw new Error(`Unsupported provider: ${provider.id}`);
      }
    } catch (error) {
      console.error(`AI generation failed for ${provider.name}:`, error);
      throw this.handleAPIError(error, provider);
    }
  }

  private async callOpenAICompatible(
    provider: AIProvider,
    settings: any,
    request: AIRequest
  ): Promise<AIResponse> {
    const url = `${settings.endpoint || provider.baseUrl}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
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
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0]?.message?.content || 'No response generated',
      provider: provider.name,
      model: request.model || 'unknown',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }

  private async callAnthropic(
    provider: AIProvider,
    settings: any,
    request: AIRequest
  ): Promise<AIResponse> {
    const url = `${settings.endpoint || provider.baseUrl}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
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
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.content[0]?.text || 'No response generated',
      provider: provider.name,
      model: request.model || 'unknown',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      } : undefined
    };
  }

  private async callHuggingFace(
    provider: AIProvider,
    settings: any,
    request: AIRequest
  ): Promise<AIResponse> {
    const url = `${provider.baseUrl}/${request.model}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: request.prompt,
        parameters: {
          temperature: request.temperature,
          max_new_tokens: request.maxTokens,
          return_full_text: false
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data[0]?.generated_text || data.generated_text || 'No response generated',
      provider: provider.name,
      model: request.model || 'unknown'
    };
  }

  private async callLocalProvider(
    provider: AIProvider,
    settings: any,
    request: AIRequest
  ): Promise<AIResponse> {
    const baseUrl = settings.endpoint || provider.baseUrl;
    let url: string;
    let body: any;

    if (provider.id === 'ollama') {
      url = `${baseUrl}/api/generate`;
      body = {
        model: request.model,
        prompt: request.prompt,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens
        }
      };
    } else {
      // LM Studio (OpenAI compatible)
      url = `${baseUrl}/chat/completions`;
      body = {
        model: request.model,
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
        temperature: request.temperature,
        max_tokens: request.maxTokens
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (provider.id === 'ollama') {
      return {
        content: data.response || 'No response generated',
        provider: provider.name,
        model: request.model || 'unknown'
      };
    } else {
      return {
        content: data.choices[0]?.message?.content || 'No response generated',
        provider: provider.name,
        model: request.model || 'unknown',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined
      };
    }
  }

  private handleAPIError(error: any, provider: AIProvider): Error {
    if (error.message?.includes('401') || error.message?.includes('403')) {
      return new Error(`Authentication failed for ${provider.name}. Please check your API key.`);
    }
    
    if (error.message?.includes('429')) {
      return new Error(`Rate limit exceeded for ${provider.name}. Please try again later.`);
    }
    
    if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) {
      return new Error(`${provider.name} service is temporarily unavailable. Please try again later.`);
    }
    
    if (error.name === 'TypeError' && error.message?.includes('fetch')) {
      return new Error(`Unable to connect to ${provider.name}. Please check your internet connection${provider.type === 'local' ? ' and ensure the local service is running' : ''}.`);
    }
    
    return new Error(error.message || `An unexpected error occurred with ${provider.name}`);
  }

  updateSettings(newSettings: Partial<AISettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings(): AISettings {
    return { ...this.settings };
  }
}

export function createDefaultAISettings(): AISettings {
  const defaultProvidersSettings: Record<string, ProviderSettings> = {};
  AI_PROVIDERS.forEach(provider => {
    defaultProvidersSettings[provider.id] = {
      apiKey: '', // Add apiKey property
      isEnabled: provider.id === 'openai', // Enable OpenAI by default
      selectedModel: provider.models.length > 0 ? provider.models[0] : undefined,
      endpoint: '' // Add endpoint property
    };
  });

  return {
    providers: defaultProvidersSettings,
    defaultProvider: 'openai', // Default to OpenAI
    temperature: 0.7,
    maxTokens: 1500, // Keep maxTokens consistent with SecureAISettings
  };
}