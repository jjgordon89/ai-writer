import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { useEnhancedSecureAIService } from '../hooks/useEnhancedSecureAIService';
import {
  SecureAISettings,
  AIRequest as EnhancedAIRequest, // Renaming to avoid conflict if base AIRequest is different
  AIResponse as EnhancedAIResponse,
  PlotGenerationRequest,
  PlotGenerationResponse,
  CharacterArcRequest,
  CharacterArcResponse,
  StyleToneAnalysisRequest,
  StyleToneAnalysisResponse,
  // EmbeddingRequest is not directly passed to context actions from UI in this design
  // EmbeddingResponse is part of the return type of getEmbeddings
  EnhancedSecureAIService // Import the service class itself
} from '../services/enhancedAIProviders';
import { useAsyncErrorHandler } from '../hooks/useAsyncErrorHandler';

interface GenerationHistory {
  id: string;
  prompt: string;
  content: string;
  provider: string;
  model: string;
  timestamp: Date;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface AIState {
  isInitialized: boolean;
  initializationError: string | null;
  isGenerating: boolean;
  currentGeneration: string;
  generationHistory: GenerationHistory[];
  settings: SecureAISettings;
  serviceMetrics: {
    requestCount: number;
    lastRequestTime: number;
    sessionInfo: any;
    rateLimitStatus: Record<string, number>;
  };
}

type AIAction =
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_INITIALIZATION_ERROR'; payload: string | null }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_CURRENT_GENERATION'; payload: string }
  | { type: 'ADD_TO_HISTORY'; payload: GenerationHistory }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'UPDATE_SETTINGS'; payload: SecureAISettings }
  | { type: 'UPDATE_METRICS'; payload: AIState['serviceMetrics'] };

interface AIContextValue {
  state: AIState;
  actions: {
    generateContent: (request: EnhancedAIRequest) => Promise<{ success: boolean; data?: EnhancedAIResponse; error?: string }>;
    setApiKey: (providerId: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
    getApiKey: (providerId: string) => Promise<string | null>;
    removeApiKey: (providerId: string) => Promise<{ success: boolean; error?: string }>;
    updateSettings: (settings: SecureAISettings) => void;
    clearHistory: () => void;
    refreshMetrics: () => void;
    // New actions
    generatePlot: (request: PlotGenerationRequest) => Promise<{ success: boolean; data?: PlotGenerationResponse; error?: string }>;
    developCharacterArc: (request: CharacterArcRequest) => Promise<{ success: boolean; data?: CharacterArcResponse; error?: string }>;
    analyzeStyleTone: (request: StyleToneAnalysisRequest) => Promise<{ success: boolean; data?: StyleToneAnalysisResponse; error?: string }>;
    getEmbeddings: (texts: string[], model?: string) => Promise<{ success: boolean; data?: number[][]; error?: string }>;
    getActiveEmbeddingModelDimension: (model?: string) => Promise<{ success: boolean; data?: number; error?: string }>;
  };
  rawService: EnhancedSecureAIService | null; // Added rawService
}

const AIContext = createContext<AIContextValue | undefined>(undefined);

// Initial context value considering rawService
const initialAIContextValue: AIContextValue = {
  state: { // Placeholder for initial state, will be overridden by reducer
    isInitialized: false,
    initializationError: null,
    isGenerating: false,
    currentGeneration: '',
    generationHistory: [],
    settings: createDefaultSecureAISettings(), // Use default settings
    serviceMetrics: {
      requestCount: 0,
      lastRequestTime: 0,
      sessionInfo: null,
      rateLimitStatus: {}
    }
  },
  actions: { // Placeholder actions, will be overridden
    generateContent: async () => ({ success: false, error: 'Context not fully initialized' }),
    setApiKey: async () => ({ success: false, error: 'Context not fully initialized' }),
    getApiKey: async () => null,
    removeApiKey: async () => ({ success: false, error: 'Context not fully initialized' }),
    updateSettings: () => {},
    clearHistory: () => {},
    refreshMetrics: () => {},
    generatePlot: async () => ({ success: false, error: 'Context not fully initialized' }),
    developCharacterArc: async () => ({ success: false, error: 'Context not fully initialized' }),
    analyzeStyleTone: async () => ({ success: false, error: 'Context not fully initialized' }),
    getEmbeddings: async () => ({ success: false, error: 'Context not fully initialized' }),
    getActiveEmbeddingModelDimension: async () => ({ success: false, error: 'Context not fully initialized' }),
  },
  rawService: null // Initialize rawService as null
};


const AIContext = createContext<AIContextValue>(initialAIContextValue);


function aiReducer(state: AIState, action: AIAction): AIState {
  switch (action.type) {
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };

    case 'SET_INITIALIZATION_ERROR':
      return { ...state, initializationError: action.payload };

    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload };

    case 'SET_CURRENT_GENERATION':
      return { ...state, currentGeneration: action.payload };

    case 'ADD_TO_HISTORY':
      const newHistory = [action.payload, ...state.generationHistory.slice(0, 49)]; // Keep last 50
      return { ...state, generationHistory: newHistory };

    case 'CLEAR_HISTORY':
      return { ...state, generationHistory: [] };

    case 'UPDATE_SETTINGS':
      return { ...state, settings: action.payload };

    case 'UPDATE_METRICS':
      return { ...state, serviceMetrics: action.payload };

    default:
      return state;
  }
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const aiService = useEnhancedSecureAIService();
  const { reportError, wrapAsync } = useAsyncErrorHandler({ component: 'AIProvider' });

  const [state, dispatch] = useReducer(aiReducer, {
    isInitialized: false,
    initializationError: null,
    isGenerating: false,
    currentGeneration: '',
    generationHistory: [],
    settings: aiService.settings,
    serviceMetrics: {
      requestCount: 0,
      lastRequestTime: 0,
      sessionInfo: null,
      rateLimitStatus: {}
    }
  });

  // Sync with AI service state
  useEffect(() => {
    dispatch({ type: 'SET_INITIALIZED', payload: aiService.isInitialized });
    dispatch({ type: 'SET_INITIALIZATION_ERROR', payload: aiService.initializationError });
    dispatch({ type: 'UPDATE_SETTINGS', payload: aiService.settings });
  }, [aiService.isInitialized, aiService.initializationError, aiService.settings]);

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      try {
        const metrics = aiService.getServiceMetrics();
        dispatch({ type: 'UPDATE_METRICS', payload: metrics });
      } catch (error) {
        reportError(error, { action: 'update-metrics' });
      }
    };

    const interval = setInterval(updateMetrics, 30000); // Update every 30 seconds
    updateMetrics(); // Initial update

    return () => clearInterval(interval);
  }, [aiService, reportError]);

  const actions = {
    generateContent: useCallback(async (request: EnhancedAIRequest) => { // Use EnhancedAIRequest
      return await wrapAsync(async () => {
        dispatch({ type: 'SET_GENERATING', payload: true });
        dispatch({ type: 'SET_CURRENT_GENERATION', payload: '' });

        const result = await aiService.generateContent(request);

        if (result.success && result.data) {
          const historyEntry: GenerationHistory = {
            id: Date.now().toString(),
            prompt: request.prompt,
            content: result.data.content,
            provider: result.data.provider,
            model: result.data.model,
            timestamp: new Date(),
            usage: result.data.usage
          };

          dispatch({ type: 'ADD_TO_HISTORY', payload: historyEntry });
          dispatch({ type: 'SET_CURRENT_GENERATION', payload: result.data.content });
        }

        dispatch({ type: 'SET_GENERATING', payload: false });
        return result;
      }, { action: 'generate-content' });
    }, [aiService, wrapAsync]),

    setApiKey: useCallback(async (providerId: string, apiKey: string) => {
      return await aiService.setApiKey(providerId, apiKey);
    }, [aiService]),

    getApiKey: useCallback(async (providerId: string) => {
      return await aiService.getApiKey(providerId);
    }, [aiService]),

    removeApiKey: useCallback(async (providerId: string) => {
      return await aiService.removeApiKey(providerId);
    }, [aiService]),

    updateSettings: useCallback((settings: SecureAISettings) => {
      aiService.updateSettings(settings);
      dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    }, [aiService]),

    clearHistory: useCallback(() => {
      dispatch({ type: 'CLEAR_HISTORY' });
    }, []),

    refreshMetrics: useCallback(() => {
      try {
        const metrics = aiService.getServiceMetrics();
        dispatch({ type: 'UPDATE_METRICS', payload: metrics });
      } catch (error) {
        reportError(error, { action: 'refresh-metrics' });
      }
    }, [aiService, reportError]),

    // New action implementations
    generatePlot: useCallback(async (request: PlotGenerationRequest) => {
      return await wrapAsync(async () => {
        dispatch({ type: 'SET_GENERATING', payload: true });
        const result = await aiService.generatePlot(request);
        if (result.success && result.data) {
          const historyEntry: GenerationHistory = {
            id: Date.now().toString(),
            prompt: request.prompt || `Plot Gen: ${request.existingPlotSummary?.substring(0,50) || 'New Plot'}`,
            content: JSON.stringify(result.data.suggestedPlots || result.data, null, 2), // Store main data
            provider: result.data.provider || 'unknown',
            model: result.data.model || 'unknown',
            timestamp: new Date(),
            usage: result.data.usage,
          };
          dispatch({ type: 'ADD_TO_HISTORY', payload: historyEntry });
          // Optionally set currentGeneration or a new state field for structured plot data
        }
        dispatch({ type: 'SET_GENERATING', payload: false });
        return result;
      }, { action: `generate-plot-${request.type || 'plot'}` });
    }, [aiService, wrapAsync]),

    developCharacterArc: useCallback(async (request: CharacterArcRequest) => {
      return await wrapAsync(async () => {
        dispatch({ type: 'SET_GENERATING', payload: true });
        const result = await aiService.developCharacterArc(request);
        if (result.success && result.data) {
          const historyEntry: GenerationHistory = {
            id: Date.now().toString(),
            prompt: request.prompt || `Character Arc: ${request.characterId || 'New Character'}`,
            content: JSON.stringify(result.data.suggestedArc || result.data, null, 2),
            provider: result.data.provider || 'unknown',
            model: result.data.model || 'unknown',
            timestamp: new Date(),
            usage: result.data.usage,
          };
          dispatch({ type: 'ADD_TO_HISTORY', payload: historyEntry });
        }
        dispatch({ type: 'SET_GENERATING', payload: false });
        return result;
      }, { action: `develop-character-arc-${request.type || 'character'}` });
    }, [aiService, wrapAsync]),

    analyzeStyleTone: useCallback(async (request: StyleToneAnalysisRequest) => {
      return await wrapAsync(async () => {
        dispatch({ type: 'SET_GENERATING', payload: true });
        const result = await aiService.analyzeStyleTone(request);
        if (result.success && result.data) {
          let contentSummary = `Style/Tone Feedback: ${result.data.feedbackOnStyle?.substring(0,50) || ''}...`;
          if ((result.data as any).similarSnippets) { // Assuming similarSnippets is added by hook
            contentSummary += ` Found ${(result.data as any).similarSnippets.length} similar snippets.`;
          }
          const historyEntry: GenerationHistory = {
            id: Date.now().toString(),
            prompt: `Style/Tone Analysis: ${request.textToAnalyze.substring(0,50)}...`,
            content: contentSummary, // Or JSON.stringify(result.data, null, 2) for full data
            provider: result.data.provider || 'unknown',
            model: result.data.model || 'unknown',
            timestamp: new Date(),
            usage: result.data.usage,
          };
          dispatch({ type: 'ADD_TO_HISTORY', payload: historyEntry });
        }
        dispatch({ type: 'SET_GENERATING', payload: false });
        return result;
      }, { action: `analyze-style-tone-${request.type || 'style'}` });
    }, [aiService, wrapAsync]),

    getEmbeddings: useCallback(async (texts: string[], model?: string) => {
      // This action typically doesn't set global 'isGenerating' or add to history in the same way
      return await wrapAsync(async () => {
        return await aiService.getEmbeddings(texts, model);
      }, { action: 'get-embeddings' });
    }, [aiService, wrapAsync]),

    getActiveEmbeddingModelDimension: useCallback(async (model?: string) => {
      // Also typically doesn't set global 'isGenerating'
      return await wrapAsync(async () => {
        return await aiService.getActiveEmbeddingModelDimension(model);
      }, { action: 'get-embedding-dimension' });
    }, [aiService, wrapAsync]),
  };

  return (
    <AIContext.Provider value={{ state, actions, rawService: aiService }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}