import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { useAIService } from '../hooks/useAIService'; // Renamed from useEnhancedSecureAIService
import type { AISettings, AIRequest, AIResponse } from '../types/ai'; // Updated imports
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
  settings: AISettings; // Updated to AISettings
  serviceMetrics: {
    requestCount: number;
    lastRequestTime: number;
    sessionInfo: ReturnType<typeof import('../services/enhancedSecureStorage').enhancedSecureStorage.getSessionInfo> | null;
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
  | { type: 'UPDATE_SETTINGS'; payload: AISettings } // Updated to AISettings
  | { type: 'UPDATE_METRICS'; payload: AIState['serviceMetrics'] };

interface AIContextValue {
  state: AIState;
  actions: {
    generateContent: (request: AIRequest) => Promise<{ success: boolean; data?: AIResponse; error?: string }>; // Updated to AIRequest, AIResponse
    setApiKey: (providerId: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
    getApiKey: (providerId: string) => Promise<string | null>;
    removeApiKey: (providerId: string) => Promise<{ success: boolean; error?: string }>;
    updateSettings: (settings: AISettings) => void; // Updated to AISettings
    clearHistory: () => void;
    refreshMetrics: () => void;
  };
}

const AIContext = createContext<AIContextValue | undefined>(undefined);

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

    case 'ADD_TO_HISTORY': {
      const newHistory = [action.payload, ...state.generationHistory.slice(0, 49)]; // Keep last 50
      return { ...state, generationHistory: newHistory };
    }

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
  const aiServiceHook = useAIService(); // Renamed variable for clarity from aiService to aiServiceHook
  const { reportError, wrapAsync } = useAsyncErrorHandler({ component: 'AIProvider' });

  const [state, dispatch] = useReducer(aiReducer, {
    isInitialized: false,
    initializationError: null,
    isGenerating: false,
    currentGeneration: '',
    generationHistory: [],
    settings: aiServiceHook.settings, // Use aiServiceHook
    serviceMetrics: {
      requestCount: 0,
      lastRequestTime: 0,
      sessionInfo: null,
      rateLimitStatus: {}
    }
  });

  // Sync with AI service state
  useEffect(() => {
    dispatch({ type: 'SET_INITIALIZED', payload: aiServiceHook.isInitialized });
    dispatch({ type: 'SET_INITIALIZATION_ERROR', payload: aiServiceHook.initializationError });
    dispatch({ type: 'UPDATE_SETTINGS', payload: aiServiceHook.settings });
  }, [aiServiceHook.isInitialized, aiServiceHook.initializationError, aiServiceHook.settings]);

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      try {
        const metrics = aiServiceHook.getServiceMetrics(); // Use aiServiceHook
        dispatch({ type: 'UPDATE_METRICS', payload: metrics });
      } catch (error) {
        reportError(error, { action: 'update-metrics' });
      }
    };

    const interval = setInterval(updateMetrics, 30000); // Update every 30 seconds
    updateMetrics(); // Initial update

    return () => clearInterval(interval);
  }, [aiServiceHook, reportError]); // Use aiServiceHook

  const actions = {
    generateContent: useCallback(async (request: AIRequest) => { // Updated to AIRequest
      return await wrapAsync(async () => {
        dispatch({ type: 'SET_GENERATING', payload: true });
        dispatch({ type: 'SET_CURRENT_GENERATION', payload: '' });

        const result = await aiServiceHook.generateContent(request); // Use aiServiceHook

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
    }, [aiServiceHook, wrapAsync]), // Use aiServiceHook

    setApiKey: useCallback(async (providerId: string, apiKey: string) => {
      return await aiServiceHook.setApiKey(providerId, apiKey); // Use aiServiceHook
    }, [aiServiceHook]), // Use aiServiceHook

    getApiKey: useCallback(async (providerId: string) => {
      return await aiServiceHook.getApiKey(providerId); // Use aiServiceHook
    }, [aiServiceHook]), // Use aiServiceHook

    removeApiKey: useCallback(async (providerId: string) => {
      return await aiServiceHook.removeApiKey(providerId); // Use aiServiceHook
    }, [aiServiceHook]), // Use aiServiceHook

    updateSettings: useCallback((settings: AISettings) => { // Updated to AISettings
      aiServiceHook.updateSettings(settings); // Use aiServiceHook
      dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    }, [aiServiceHook]), // Use aiServiceHook

    clearHistory: useCallback(() => {
      dispatch({ type: 'CLEAR_HISTORY' });
    }, []),

    refreshMetrics: useCallback(() => {
      try {
        const metrics = aiServiceHook.getServiceMetrics(); // Use aiServiceHook
        dispatch({ type: 'UPDATE_METRICS', payload: metrics });
      } catch (error) {
        reportError(error, { action: 'refresh-metrics' });
      }
    }, [aiServiceHook, reportError]) // Use aiServiceHook
  };

  return (
    <AIContext.Provider value={{ state, actions }}>
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