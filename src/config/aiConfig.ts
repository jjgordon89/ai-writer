import type { AIProvider } from '../types/ai';

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
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
