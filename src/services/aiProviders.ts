export interface AIProvider {
  id: string;
  name: string;
  type: 'cloud' | 'local';
  baseUrl: string;
  requiresApiKey: boolean;
  models: string[];
  embeddingModels?: string[]; // Added for embedding models
  description: string;
}

export interface AISettings {
  providers: Record<string, {
    apiKey?: string;
    endpoint?: string;
    selectedModel?: string;
    selectedEmbeddingModel?: string; // Added for selected embedding model
    isEnabled: boolean;
  }>;
  defaultProvider: string;
  temperature: number;
  maxTokens: number;
}

export interface AIRequest {
  prompt: string;
  type: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Helper map for embedding dimensions
const EMBEDDING_MODEL_DIMENSIONS: Record<string, number> = {
  // OpenAI
  'text-embedding-ada-002': 1536,
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  // OpenRouter (often prefixes OpenAI models)
  'openai/text-embedding-ada-002': 1536,
  'openai/text-embedding-3-small': 1536,
  'openai/text-embedding-3-large': 3072,
  // Add other providers/models here if known, e.g. Cohere, Google etc.
  // 'cohere/embed-english-v3.0': 1024,
  // 'google/text-embedding-004': 768,
};

import { Character } from '../types';

// Plot Generation Interfaces
export interface PlotGenerationRequest extends AIRequest {
  projectId?: string;
  existingPlotSummary?: string;
  desiredGenres?: string[];
  keyThemes?: string[];
  numberOfAlternativePlots?: number;
}

export interface PlotGenerationResponse extends AIResponse {
  suggestedPlots?: {
    summary: string;
    potentialStoryArcs?: string[];
    keyTurningPoints?: string[];
  }[];
}

// Character Arc Development Interfaces
export interface CharacterArcRequest extends AIRequest {
  characterId?: string;
  characterData?: Character;
  desiredArcType?: string; // e.g., redemption, tragic fall
  keyMotivations?: string[];
}

export interface CharacterArcResponse extends AIResponse {
  suggestedArc?: {
    arcSummary: string;
    keyDevelopmentStages?: string[];
    potentialConflicts?: string[];
    endingResolution?: string;
  };
}

// Style/Tone Consistency Analysis Interfaces
export interface StyleToneAnalysisRequest extends AIRequest {
  textToAnalyze: string;
  referenceTexts?: string[];
  desiredStyle?: string;
  desiredTone?: string;
}

export interface StyleToneAnalysisResponse extends AIResponse {
  consistencyScore?: number; // if reference texts are provided
  feedbackOnStyle?: string;
  feedbackOnTone?: string;
  suggestionsForImprovement?: string[];
}

// Embedding Interfaces
export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage?: { // Optional usage information
    promptTokens?: number;
    totalTokens?: number;
  };
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
    embeddingModels: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
    description: 'Industry-leading models from OpenAI including GPT-4 and GPT-3.5'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    type: 'cloud',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
    description: 'Claude models known for safety and helpfulness'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'cloud',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    models: [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'meta-llama/llama-3.1-405b-instruct',
      'google/gemini-pro-1.5',
      'mistralai/mistral-large'
    ],
    description: 'Access to multiple AI models through a single API'
  },
  {
    id: 'huggingface',
    name: 'HuggingFace',
    type: 'cloud',
    baseUrl: 'https://api-inference.huggingface.co/models',
    requiresApiKey: true,
    models: [
      'microsoft/DialoGPT-large',
      'facebook/blenderbot-400M-distill',
      'microsoft/DialoGPT-medium'
    ],
    description: 'Open-source models from the HuggingFace community'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    type: 'local',
    baseUrl: 'http://localhost:11434',
    requiresApiKey: false,
    models: ['llama3.1', 'llama3.1:70b', 'codellama', 'mistral', 'neural-chat'],
    description: 'Run models locally with Ollama'
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    type: 'local',
    baseUrl: 'http://localhost:1234/v1',
    requiresApiKey: false,
    models: ['local-model'],
    description: 'Run models locally with LM Studio'
  }
];

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

  private resolveEmbeddingModelName(requestedModel?: string): string | undefined {
    const provider = AI_PROVIDERS.find(p => p.id === this.settings.defaultProvider);
    if (!provider) return undefined;
    const providerSettings = this.settings.providers[provider.id];

    return requestedModel || providerSettings?.selectedEmbeddingModel || provider.embeddingModels?.[0];
  }

  async getActiveEmbeddingModelDimension(embeddingModel?: string): Promise<number> {
    const modelName = this.resolveEmbeddingModelName(embeddingModel);

    if (!modelName) {
      console.warn('Could not resolve embedding model name. Falling back to default dimension 1536.');
      return 1536; // Default or fallback dimension
    }

    const dimension = EMBEDDING_MODEL_DIMENSIONS[modelName];
    if (!dimension) {
      // Attempt to find a generic OpenAI model if the specific one is missing, as they often share dimensions
      if (modelName.startsWith('text-embedding-') || modelName.startsWith('openai/text-embedding-')) {
        console.warn(`Dimension for ${modelName} not found in map, defaulting to 1536 for OpenAI-like model.`);
        return 1536;
      }
      console.warn(`Dimension for model ${modelName} not found. Returning default of 1536. Consider updating EMBEDDING_MODEL_DIMENSIONS.`);
      return 1536; // Fallback dimension
    }
    return dimension;
  }

  // Embedding method
  async getEmbeddings(texts: string[], embeddingModel?: string): Promise<number[][]> {
    const provider = AI_PROVIDERS.find(p => p.id === this.settings.defaultProvider);
    if (!provider) {
      throw new Error('No provider configured for embeddings.');
    }

    const providerSettings = this.settings.providers[provider.id];
    if (!providerSettings?.isEnabled) {
      throw new Error(`Provider ${provider.name} is not enabled for embeddings.`);
    }

    if (provider.requiresApiKey && !providerSettings.apiKey) {
      throw new Error(`API key required for ${provider.name} embeddings.`);
    }

    const modelToUse = this.resolveEmbeddingModelName(embeddingModel);
    if (!modelToUse) {
      throw new Error(`No embedding model configured for ${provider.name}.`);
    }

    // For now, only OpenAI and OpenRouter are implemented for embeddings
    if (provider.id === 'openai' || provider.id === 'openrouter') {
      return this.callOpenAIEmbeddings(provider, providerSettings, texts, modelToUse);
    } else {
      console.warn(`Embedding generation for ${provider.name} is not yet implemented.`);
      throw new Error(`Embedding generation for ${provider.name} is not yet implemented.`);
    }
  }

  private async callOpenAIEmbeddings(
    provider: AIProvider,
    settings: any,
    texts: string[],
    embeddingModel: string
  ): Promise<number[][]> {
    // OpenRouter uses the same base URL for embeddings but needs it specified if different from chat
    // For OpenAI, it's usually provider.baseUrl + /embeddings
    // For OpenRouter, it's often settings.endpoint (which is their base) + /embeddings
    let url = `${settings.endpoint || provider.baseUrl}/embeddings`;
    if (provider.id === 'openrouter' && settings.endpoint) {
        // OpenRouter's endpoint is the full base URL, so we just add /embeddings if not already there
        if (!settings.endpoint.endsWith('/embeddings')) {
            url = `${settings.endpoint}/embeddings`;
        } else {
            url = settings.endpoint; // Already includes /embeddings
        }
    }


    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        ...(provider.id === 'openrouter' && { // Specific headers for OpenRouter if any
          'HTTP-Referer': window.location.origin, // Example header
          'X-Title': 'AI Fiction Writer' // Example header
        })
      },
      body: JSON.stringify({
        input: texts,
        model: embeddingModel,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Attempt to get a more specific error message from OpenAI/OpenRouter
      const message = errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      console.error(`OpenAI/OpenRouter Embedding API Error: ${response.status}`, errorData);
      throw new Error(message);
    }

    const data = await response.json();

    // The OpenAI response structure is data: [{ embedding: [...] }, { embedding: [...] }]
    // It can also be just { data: [{...}], usage: {...} }
    if (!data.data || !Array.isArray(data.data)) {
        console.error('Unexpected response structure from embedding API:', data);
        throw new Error('Failed to parse embeddings from API response: data field is missing or not an array.');
    }

    return data.data.map((item: any) => {
      if (!item.embedding || !Array.isArray(item.embedding)) {
        console.error('Invalid embedding item found:', item);
        throw new Error('Invalid embedding format in API response item.');
      }
      return item.embedding;
    });
  }


  async generatePlot(request: PlotGenerationRequest): Promise<PlotGenerationResponse> {
    const response = await this.generateContent({
      ...request,
      type: 'plot-generation', // Set the type for the generic handler
    });
    return response as PlotGenerationResponse;
  }

  async developCharacterArc(request: CharacterArcRequest): Promise<CharacterArcResponse> {
    const response = await this.generateContent({
      ...request,
      type: 'character-arc-development', // Set the type for the generic handler
    });
    return response as CharacterArcResponse;
  }

  async analyzeStyleTone(request: StyleToneAnalysisRequest): Promise<StyleToneAnalysisResponse> {
    const response = await this.generateContent({
      ...request,
      type: 'style-tone-analysis', // Set the type for the generic handler
    });
    return response as StyleToneAnalysisResponse;
  }
}

export function createDefaultAISettings(): AISettings {
  return {
    providers: {
      openai: { isEnabled: false, selectedEmbeddingModel: 'text-embedding-3-small' },
      anthropic: { isEnabled: false },
      openrouter: { isEnabled: false, selectedEmbeddingModel: 'openai/text-embedding-ada-002' }, // Example for OpenRouter
      huggingface: { isEnabled: false },
      ollama: { isEnabled: false },
      lmstudio: { isEnabled: false }
    },
    defaultProvider: 'openai',
    temperature: 0.7,
    maxTokens: 1500
  };
}