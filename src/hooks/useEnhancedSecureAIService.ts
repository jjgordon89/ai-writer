import { useState, useEffect, useCallback } from 'react';
import {
  EnhancedSecureAIService,
  SecureAISettings,
  createDefaultSecureAISettings,
  AIRequest, // Added for generateContent if not already implicitly covered
  PlotGenerationRequest,
  PlotGenerationResponse,
  CharacterArcRequest,
  CharacterArcResponse,
  StyleToneAnalysisRequest,
  StyleToneAnalysisResponse,
  // EmbeddingRequest, // Not directly used in hook return, but good for context
  // EmbeddingResponse // Not directly used in hook return
} from '../services/enhancedAIProviders';
import { useAsyncErrorHandler } from './useAsyncErrorHandler';
import { ErrorSanitizer } from '../utils/errorSanitization';

export function useEnhancedSecureAIService() {
  const [settings, setSettings] = useState<SecureAISettings>(() => {
    try {
      const saved = localStorage.getItem('aiSettings');
      return saved ? JSON.parse(saved) : createDefaultSecureAISettings();
    } catch (error) {
      console.error('Failed to load AI settings:', error);
      return createDefaultSecureAISettings();
    }
  });

  const [aiService, setAIService] = useState<EnhancedSecureAIService>(() => new EnhancedSecureAIService(settings));
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  
  const { reportError, safeAsync } = useAsyncErrorHandler({ 
    component: 'useEnhancedSecureAIService' 
  });

  // Initialize secure storage
  useEffect(() => {
    const initializeService = async () => {
      try {
        setInitializationError(null);
        await aiService.initialize();
        setIsInitialized(true);
      } catch (error) {
        const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
          component: 'useEnhancedSecureAIService',
          action: 'initialize'
        });
        setInitializationError(sanitizedError.message);
        reportError(error, { action: 'service-initialization' });
      }
    };

    initializeService();
  }, [aiService, reportError]);

  const updateSettings = (newSettings: SecureAISettings) => {
    try {
      setSettings(newSettings);
      localStorage.setItem('aiSettings', JSON.stringify(newSettings));
      aiService.updateSettings(newSettings);
    } catch (error) {
      reportError(error, { action: 'update-settings' });
    }
  };

  const setApiKey = async (providerId: string, apiKey: string): Promise<{ success: boolean; error?: string }> => {
    return await safeAsync(
      async () => {
        await aiService.setApiKey(providerId, apiKey);
        return { success: true };
      },
      { success: false, error: 'Failed to save API key' },
      { action: 'set-api-key', metadata: { providerId } }
    ) || { success: false, error: 'Failed to save API key' };
  };

  const getApiKey = async (providerId: string): Promise<string | null> => {
    return await safeAsync(
      async () => await aiService.getApiKey(providerId),
      null,
      { action: 'get-api-key', metadata: { providerId } }
    ) || null;
  };

  const removeApiKey = async (providerId: string): Promise<{ success: boolean; error?: string }> => {
    return await safeAsync(
      async () => {
        await aiService.removeApiKey(providerId);
        return { success: true };
      },
      { success: false, error: 'Failed to remove API key' },
      { action: 'remove-api-key', metadata: { providerId } }
    ) || { success: false, error: 'Failed to remove API key' };
  };

  const generateContent = async (request: any): Promise<{ success: boolean; data?: any; error?: string }> => {
    if (!isInitialized) {
      return { success: false, error: 'Service not initialized' };
    }

    return await safeAsync(
      async () => {
        const response = await aiService.generateContent(request);
        return { success: true, data: response };
      },
      { success: false, error: 'Failed to generate content' },
      { action: 'generate-content', metadata: { type: request.type } }
    ) || { success: false, error: 'Failed to generate content' };
  };

  const getServiceMetrics = () => {
    try {
      return aiService.getServiceMetrics();
    } catch (error) {
      reportError(error, { action: 'get-metrics' });
      return {
        requestCount: 0,
        lastRequestTime: 0,
        sessionInfo: null,
        rateLimitStatus: {}
      };
    }
  };

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('aiSettings', JSON.stringify(settings));
    } catch (error) {
      reportError(error, { action: 'save-settings' });
    }
  }, [settings, reportError]);

  // --- New Methods ---

  const generatePlot = useCallback(async (request: PlotGenerationRequest): Promise<{ success: boolean; data?: PlotGenerationResponse; error?: string }> => {
    if (!isInitialized) return { success: false, error: 'Service not initialized' };
    return await safeAsync(
      async () => ({ success: true, data: await aiService.generatePlot(request) }),
      { success: false, error: 'Failed to generate plot' },
      { action: 'generate-plot', metadata: { projectId: request.projectId } }
    ) || { success: false, error: 'Failed to generate plot' };
  }, [aiService, isInitialized, safeAsync]);

  const developCharacterArc = useCallback(async (request: CharacterArcRequest): Promise<{ success: boolean; data?: CharacterArcResponse; error?: string }> => {
    if (!isInitialized) return { success: false, error: 'Service not initialized' };
    return await safeAsync(
      async () => ({ success: true, data: await aiService.developCharacterArc(request) }),
      { success: false, error: 'Failed to develop character arc' },
      { action: 'develop-character-arc', metadata: { characterId: request.characterId } }
    ) || { success: false, error: 'Failed to develop character arc' };
  }, [aiService, isInitialized, safeAsync]);

  const analyzeStyleTone = useCallback(async (request: StyleToneAnalysisRequest): Promise<{ success: boolean; data?: StyleToneAnalysisResponse; error?: string }> => {
    if (!isInitialized) return { success: false, error: 'Service not initialized' };
    return await safeAsync(
      async () => ({ success: true, data: await aiService.analyzeStyleTone(request) }),
      { success: false, error: 'Failed to analyze style/tone' },
      { action: 'analyze-style-tone' }
    ) || { success: false, error: 'Failed to analyze style/tone' };
  }, [aiService, isInitialized, safeAsync]);

  const getEmbeddings = useCallback(async (texts: string[], embeddingModel?: string): Promise<{ success: boolean; data?: number[][]; error?: string }> => {
    if (!isInitialized) return { success: false, error: 'Service not initialized' };
    return await safeAsync(
      async () => ({ success: true, data: await aiService.getEmbeddings(texts, embeddingModel) }),
      { success: false, error: 'Failed to get embeddings' },
      { action: 'get-embeddings' }
    ) || { success: false, error: 'Failed to get embeddings' };
  }, [aiService, isInitialized, safeAsync]);

  const getActiveEmbeddingModelDimension = useCallback(async (embeddingModel?: string): Promise<{ success: boolean; data?: number; error?: string }> => {
    if (!isInitialized) return { success: false, error: 'Service not initialized' };
     return await safeAsync(
      async () => ({ success: true, data: await aiService.getActiveEmbeddingModelDimension(embeddingModel) }),
      { success: false, error: 'Failed to get embedding model dimension' },
      { action: 'get-active-embedding-model-dimension' }
    ) || { success: false, error: 'Failed to get embedding model dimension' };
  }, [aiService, isInitialized, safeAsync]);

  return {
    settings,
    aiService,
    isInitialized,
    initializationError,
    updateSettings,
    setApiKey,
    getApiKey,
    removeApiKey,
    generateContent,
    getServiceMetrics,
    // New methods
    generatePlot,
    developCharacterArc,
    analyzeStyleTone,
    getEmbeddings,
    getActiveEmbeddingModelDimension
  };
}