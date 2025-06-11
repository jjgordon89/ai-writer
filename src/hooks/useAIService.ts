import { useState, useEffect } from 'react';
import { ConsolidatedAIService, createDefaultSecureAISettings } from '../services/enhancedAIProviders';
import type { AISettings, AIRequest, AIResponse } from '../types/ai'; // Import centralized types
import { useAsyncErrorHandler } from './useAsyncErrorHandler';
import { ErrorSanitizer } from '../utils/errorSanitization';

export function useAIService() { // Renamed from useEnhancedSecureAIService
  const [settings, setSettings] = useState<AISettings>(() => { // Use AISettings
    try {
      const saved = localStorage.getItem('aiSettings');
      return saved ? JSON.parse(saved) : createDefaultSecureAISettings();
    } catch (error) {
      console.error('Failed to load AI settings:', error);
      return createDefaultSecureAISettings();
    }
  });

  const [aiService, setAIService] = useState<ConsolidatedAIService>(() => new ConsolidatedAIService(settings)); // Use ConsolidatedAIService
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

  const updateSettings = (newSettings: AISettings) => { // Use AISettings
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

  const generateContent = async (request: AIRequest): Promise<{ success: boolean; data?: AIResponse; error?: string }> => { // Use AIRequest and AIResponse
    if (!isInitialized) {
      return { success: false, error: 'Service not initialized' };
    }

    return await safeAsync(
      async () => {
        const response = await aiService.generateContent(request); // aiService.generateContent now expects AIRequest
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
    getServiceMetrics
  };
}