/**
 * Shared AI-related TypeScript interfaces and type definitions.
 */

export interface AIProvider {
  id: string;
  name: string;
  type: 'cloud' | 'local';
  baseUrl: string;
  requiresApiKey: boolean;
  models: string[];
  description: string;
}

export interface ProviderSettings {
  apiKey?: string; // Added to make it comprehensive, was missing in enhancedAIProviders but present in aiProviders' AISettings.providers
  endpoint?: string;
  selectedModel?: string;
  isEnabled: boolean;
}

// Renaming SecureAISettings to AISettings for simplicity and broader use.
// This version is based on SecureAISettings from enhancedAIProviders.ts,
// ensuring it includes all necessary fields for the consolidated service.
export interface AISettings {
  providers: Record<string, ProviderSettings>; // Uses the comprehensive ProviderSettings
  defaultProvider: string;
  temperature: number;
  maxTokens: number;
}

export interface AIRequest {
  prompt: string;
  type: string; // e.g., 'generation', 'completion', 'chat'
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // Consider adding other common parameters like 'userId' or 'sessionId' if needed later
}

export interface AIResponse {
  content: string;
  provider: string; // Name of the provider that generated the response
  model: string; // Specific model used
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  // Consider adding 'timestamp', 'errorInfo' for more detailed responses
}

// Supporting types that were implicitly defined or part of other service files
// (like ErrorData or RequestBody from enhancedAIProviders) can be added here if they are
// intended for shared use across different services or components.
// For now, keeping it to the core types.

// Example of a more specific request type if needed in the future:
// export interface AIChatRequest extends AIRequest {
//   messageHistory: Array<{role: 'user' | 'assistant'; content: string}>;
// }

// Placeholder for other types if they emerge during refactoring
// export {}; // Removing export {} as we are adding a new export

export interface IAIProviderStrategy {
  handleRequest(
    providerConfig: AIProvider,
    providerSettings: ProviderSettings,
    request: AIRequest,
    apiKey?: string | null
  ): Promise<AIResponse>;
}
