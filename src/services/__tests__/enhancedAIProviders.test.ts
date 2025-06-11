import {
  EnhancedSecureAIService,
  createDefaultSecureAISettings,
  AI_PROVIDERS,
  PlotGenerationRequest,
  PlotGenerationResponse,
  SecureAISettings,
  CharacterArcRequest, // Added
  CharacterArcResponse, // Added
  StyleToneAnalysisRequest, // Added
  StyleToneAnalysisResponse // Added
} from '../enhancedAIProviders';
import { enhancedSecureStorage } from '../enhancedSecureStorage';

// Mock enhancedSecureStorage
jest.mock('../enhancedSecureStorage', () => ({
  enhancedSecureStorage: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getSecure: jest.fn(),
    setSecure: jest.fn().mockResolvedValue(undefined),
    removeSecure: jest.fn().mockResolvedValue(undefined),
    getSessionInfo: jest.fn().mockReturnValue({ deviceId: 'test-device' }),
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('EnhancedSecureAIService', () => {
  let service: EnhancedSecureAIService;
  let settings: SecureAISettings;

  beforeEach(() => {
    jest.clearAllMocks();
    settings = createDefaultSecureAISettings();
    // Enable OpenAI provider and set a default model for testing
    settings.defaultProvider = 'openai';
    settings.providers.openai = {
      isEnabled: true,
      selectedModel: 'gpt-4o', // Default generation model
      selectedEmbeddingModel: 'text-embedding-3-small', // Default embedding model
    };
    service = new EnhancedSecureAIService(settings);
    // Ensure service is initialized for tests that might depend on it (like API key checks)
    // For most direct method calls, this internal state might not be an issue if initialize logic is simple.
    // However, EnhancedSecureAIService's generateContent calls initialize if not already.
    // We can call it manually or ensure mocks cover its path.
    // await service.initialize(); // This might be needed if initialize does more than secureStorage init
  });

  describe('generatePlot', () => {
    it('should generate a plot successfully with OpenAI', async () => {
      // Arrange
      const mockApiKey = 'sk-testapikey';
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue(mockApiKey);

      const mockPlotRequest: PlotGenerationRequest = {
        prompt: 'A story about a dragon.', // This top-level prompt might be used by generatePlot to structure a more specific one
        type: 'plot-generation',
        existingPlotSummary: 'The dragon lived in a cave.',
        desiredGenres: ['fantasy'],
      };

      // This is the content the AI is expected to return, which will be a string field in AIResponse
      const aiGeneratedPlotContent = {
        suggestedPlots: [{
          summary: 'The dragon finds a magical sword.',
          potentialStoryArcs: ['The sword quest'],
          keyTurningPoints: ['Finding the sword', 'Defeating the villain'],
        }]
      };

      const mockApiResponse = {
        id: 'cmpl-test123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify(aiGeneratedPlotContent), // The AI returns a stringified JSON
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 50, total_tokens: 60 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
        text: async () => JSON.stringify(mockApiResponse),
      });

      // Act
      // The actual implementation of generatePlot in EnhancedSecureAIService passes a modified prompt to generateContent
      const result = await service.generatePlot(mockPlotRequest);

      // Assert
      expect(enhancedSecureStorage.getSecure).toHaveBeenCalledWith('apikey-openai');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchCall = mockFetch.mock.calls[0];
      const fetchUrl = fetchCall[0];
      const fetchOptions = fetchCall[1];

      expect(fetchUrl).toBe('https://api.openai.com/v1/chat/completions');
      expect(fetchOptions.method).toBe('POST');
      expect(fetchOptions.headers.Authorization).toBe(`Bearer ${mockApiKey}`);

      const requestBody = JSON.parse(fetchOptions.body);
      // Check the prompt that was constructed by `generatePlot` and sent to `generateContent`
      expect(requestBody.messages[1].content).toEqual(mockPlotRequest.prompt || `Generate plot ideas based on: ${mockPlotRequest.existingPlotSummary || 'general fiction concepts'}`);


      expect(result.provider).toBe('OpenAI');

      // The `generatePlot` method (as currently implemented in EnhancedSecureAIService)
      // does `return response as PlotGenerationResponse;` where response is from `generateContent`.
      // This means `result.content` will be the stringified JSON from the AI.
      // The test needs to expect this string, and any parsing should happen *outside* the service,
      // or `generatePlot` needs to be updated to parse it.
      // Based on the current service implementation, we expect a string.
      expect(result.content).toBe(JSON.stringify(aiGeneratedPlotContent));

      // If generatePlot were to parse the content itself, the assertion would be:
      // expect(result.content).toEqual(aiGeneratedPlotContent);
      // And the PlotGenerationResponse interface's `content` field would be `object` or a specific type.
      // For now, `AIResponse.content` is `string`.
    });

    it('should throw an error if API key is missing for OpenAI plot generation', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue(null); // No API key

      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);

      const mockPlotRequest: PlotGenerationRequest = { prompt: 'A story about a dragon.', type: 'plot-generation' };
      // Expecting the specific error message from EnhancedSecureAIService when API key is missing
      // The service's generateContent method, called by generatePlot, checks for API key.
      await expect(service.generatePlot(mockPlotRequest))
        .rejects.toThrow('API key required for OpenAI. Please configure it in settings.');
    });

    it('should handle fetch network errors during plot generation', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);

      const mockPlotRequest: PlotGenerationRequest = { prompt: 'A story.', type: 'plot-generation' };
      // ErrorSanitizer might modify this message. The service itself re-throws the error.
      // The actual error message would be caught by the generic try-catch in generateContent, then sanitized.
      // For a TypeError 'Network request failed', ErrorSanitizer.sanitizeForUser would return a generic message or the original.
      // Let's assume it returns the original message or a wrapper around it for now.
      await expect(service.generatePlot(mockPlotRequest))
        .rejects.toThrow(expect.stringContaining('Network request failed'));
    });

    it('should handle API errors (e.g., 401 Unauthorized) during plot generation', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      const apiErrorResponse = {
        error: { message: 'Invalid API key', type: 'auth_error', code: 'invalid_api_key' },
      };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => apiErrorResponse,
        text: async () => JSON.stringify(apiErrorResponse),
      });

      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);

      const mockPlotRequest: PlotGenerationRequest = { prompt: 'A story.', type: 'plot-generation' };
      // The callOpenAICompatible method throws `errorData.error?.message` or the HTTP status.
      await expect(service.generatePlot(mockPlotRequest))
        .rejects.toThrow(expect.stringContaining('Invalid API key'));
    });

    it('should handle malformed successful API responses during plot generation', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      const malformedApiResponse = {
        id: 'cmpl-malformed123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        // choices: [], // Missing or malformed choices
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => malformedApiResponse,
      });

      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);

      const mockPlotRequest: PlotGenerationRequest = { prompt: 'A story.', type: 'plot-generation' };
      await expect(service.generatePlot(mockPlotRequest))
        .rejects.toThrow('Invalid response format from API'); // From callOpenAICompatible
    });
  });

  describe('getEmbeddings', () => {
    it('should fetch embeddings successfully from OpenAI', async () => {
      const mockApiKey = 'sk-testapikey';
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue(mockApiKey);

      const texts = ['hello world', 'another text'];
      const model = 'text-embedding-3-small';
      const mockEmbeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
      const mockApiResponse = {
        object: 'list',
        data: [
          { object: 'embedding', index: 0, embedding: mockEmbeddings[0] },
          { object: 'embedding', index: 1, embedding: mockEmbeddings[1] },
        ],
        model: model,
        usage: { prompt_tokens: 8, total_tokens: 8 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      // Ensure settings are configured for OpenAI as default
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true, selectedEmbeddingModel: model };
      service = new EnhancedSecureAIService(settings);

      const result = await service.getEmbeddings(texts, model);

      expect(enhancedSecureStorage.getSecure).toHaveBeenCalledWith('apikey-openai');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.openai.com/v1/embeddings');
      expect(JSON.parse(fetchCall[1].body)).toEqual({ input: texts, model: model });
      expect(result).toEqual(mockEmbeddings);
    });

    it('should throw an error if API key is missing for OpenAI embeddings', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue(null); // No API key

      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true, selectedEmbeddingModel: 'text-embedding-3-small' };
      service = new EnhancedSecureAIService(settings);

      // The actual error message comes from EnhancedSecureAIService's getApiKey failing or getEmbeddings check.
      // It should be "API key for openai not found." as per current getEmbeddings implementation.
      await expect(service.getEmbeddings(['text'])).rejects.toThrow('API key for openai not found.');
    });

    it('should throw for non-OpenAI/OpenRouter providers if not implemented', async () => {
      settings.defaultProvider = 'anthropic';
      settings.providers.anthropic = { isEnabled: true, selectedModel: 'claude-3-haiku-20240307' };
      const anthropicProviderDef = AI_PROVIDERS.find(p => p.id === 'anthropic');
      if (anthropicProviderDef) anthropicProviderDef.embeddingModels = undefined;

      service = new EnhancedSecureAIService(settings);
      await expect(service.getEmbeddings(['text'])).rejects.toThrow('Embedding generation for anthropic is not yet implemented.');
    });

    it('should handle fetch network errors during getEmbeddings', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true, selectedEmbeddingModel: 'text-embedding-3-small' };
      service = new EnhancedSecureAIService(settings);
      await expect(service.getEmbeddings(['text'], 'text-embedding-3-small')).rejects.toThrow('Network request failed');
    });

    it('should handle API errors (e.g., 401 Unauthorized) during getEmbeddings', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      const apiErrorResponse = { error: { message: 'Invalid API key for embeddings' } };
      mockFetch.mockResolvedValueOnce({
        ok: false, status: 401, json: async () => apiErrorResponse, text: async () => JSON.stringify(apiErrorResponse)
      });
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true, selectedEmbeddingModel: 'text-embedding-3-small' };
      service = new EnhancedSecureAIService(settings);
      await expect(service.getEmbeddings(['text'], 'text-embedding-3-small')).rejects.toThrow('Invalid API key for embeddings');
    });

    it('should handle malformed successful API responses during getEmbeddings (missing data.data)', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      const malformedApiResponse = { object: 'list', model: 'text-embedding-3-small' /* data field missing */ };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => malformedApiResponse });
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true, selectedEmbeddingModel: 'text-embedding-3-small' };
      service = new EnhancedSecureAIService(settings);
      await expect(service.getEmbeddings(['text'], 'text-embedding-3-small')).rejects.toThrow('Failed to parse embeddings from API response: data field is missing or not an array.');
    });

    it('should handle malformed successful API responses during getEmbeddings (missing item.embedding)', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      const malformedApiResponse = {
        object: 'list',
        data: [{ object: 'embedding', index: 0 /* embedding field missing */ }],
        model: 'text-embedding-3-small'
      };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => malformedApiResponse });
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true, selectedEmbeddingModel: 'text-embedding-3-small' };
      service = new EnhancedSecureAIService(settings);
      await expect(service.getEmbeddings(['text'], 'text-embedding-3-small')).rejects.toThrow('Invalid embedding format in API response item.');
    });
  });

  describe('getActiveEmbeddingModelDimension', () => {
    beforeEach(() => {
        settings = createDefaultSecureAISettings();
        settings.defaultProvider = 'openai';
        settings.providers.openai = {
            isEnabled: true,
            selectedModel: 'gpt-4o',
            selectedEmbeddingModel: 'text-embedding-3-small',
        };
        service = new EnhancedSecureAIService(settings);
    });

    it('should return correct dimension for default selected embedding model (OpenAI)', async () => {
      const dimension = await service.getActiveEmbeddingModelDimension();
      expect(dimension).toBe(1536); // For text-embedding-3-small
    });

    it('should return correct dimension for an explicitly passed known model (OpenAI)', async () => {
      const dimension = await service.getActiveEmbeddingModelDimension('text-embedding-3-large');
      expect(dimension).toBe(3072);
    });

    it('should return default dimension and warn for an unknown model for the active provider', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const dimension = await service.getActiveEmbeddingModelDimension('openai/unknown-openai-model');
      expect(dimension).toBe(1536);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("[EnhancedSecureAIService] Dimension for model openai/unknown-openai-model not found. Returning default of 1536. Consider updating EMBEDDING_MODEL_DIMENSIONS."));
      consoleWarnSpy.mockRestore();
    });

    it('should return default dimension and warn if provider has no specific embedding model selected and no defaults', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      settings.defaultProvider = 'huggingface'; // A provider that might not have embeddingModels in AI_PROVIDERS
      settings.providers.huggingface = { isEnabled: true, selectedModel: 'some-hf-model', selectedEmbeddingModel: undefined };

      const originalHFProvider = AI_PROVIDERS.find(p => p.id === 'huggingface');
      let oldEmbeddingModels: string[] | undefined;
      if (originalHFProvider) {
        oldEmbeddingModels = originalHFProvider.embeddingModels;
        originalHFProvider.embeddingModels = []; // Temporarily remove default embedding models
      }

      service = new EnhancedSecureAIService(settings);
      const dimension = await service.getActiveEmbeddingModelDimension(); // No model passed, so it tries to resolve default

      expect(dimension).toBe(1536); // Default dimension
      // Check for the specific warning when no model name could be resolved at all for the provider
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("[EnhancedSecureAIService] Could not resolve embedding model name. Falling back to default dimension 1536."));

      if (originalHFProvider) { // Restore
        originalHFProvider.embeddingModels = oldEmbeddingModels;
      }
      consoleWarnSpy.mockRestore();
    });
  });

  describe('developCharacterArc', () => {
    it('should develop a character arc successfully with OpenAI', async () => {
      const mockApiKey = 'sk-testapikey';
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue(mockApiKey);

      const mockArcRequest: CharacterArcRequest = {
        prompt: 'Develop an arc for a knight who learns humility.',
        type: 'character-arc-development',
        characterId: 'sir-gawain',
        characterData: { id: 'sir-gawain', name: 'Sir Gawain', description: 'A proud knight' } as any,
        desiredArcType: 'redemption',
      };

      const aiGeneratedArcContent = {
        suggestedArc: {
          arcSummary: 'The knight starts arrogant, faces trials, learns humility, and becomes a true hero.',
          keyDevelopmentStages: ['Initial arrogance', 'Challenging quest', 'Moment of failure', 'Learning humility', 'Redemption'],
          potentialConflicts: ['Conflict with a humble peasant', 'Internal struggle with pride'],
          endingResolution: 'The knight sacrifices personal glory for the greater good.'
        }
      };
      const mockApiResponse = {
        id: 'cmpl-chararc123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{ message: { content: JSON.stringify(aiGeneratedArcContent) } }],
        usage: { prompt_tokens: 15, completion_tokens: 150, total_tokens: 165 },
      };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockApiResponse });

      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true, selectedModel: 'gpt-4o' };
      service = new EnhancedSecureAIService(settings);

      const result = await service.developCharacterArc(mockArcRequest);

      expect(enhancedSecureStorage.getSecure).toHaveBeenCalledWith('apikey-openai');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body as string);

      // Check how EnhancedSecureAIService.developCharacterArc constructs the prompt
      // Based on current placeholder: request.prompt || `Develop character arc for ${request.characterId || 'a character'} with details: ${JSON.stringify(request.characterData) || ''}`
      const expectedPrompt = mockArcRequest.prompt || `Develop character arc for ${mockArcRequest.characterId || 'a character'} with details: ${JSON.stringify(mockArcRequest.characterData) || ''}`;
      expect(requestBody.messages[1].content).toBe(expectedPrompt);

      expect(result.provider).toBe('OpenAI');
      expect(result.content).toBe(JSON.stringify(aiGeneratedArcContent));
    });

    it('should throw an error if API key is missing for OpenAI character arc development', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue(null);
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);
      const mockRequest: CharacterArcRequest = { prompt: 'Arc for a hero.', type: 'character-arc-development' };
      await expect(service.developCharacterArc(mockRequest))
        .rejects.toThrow('API key required for OpenAI. Please configure it in settings.');
    });

    it('should handle fetch network errors during character arc development', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);
      const mockRequest: CharacterArcRequest = { prompt: 'Arc for a hero.', type: 'character-arc-development' };
      await expect(service.developCharacterArc(mockRequest))
        .rejects.toThrow(expect.stringContaining('Network request failed'));
    });

    it('should handle API errors (e.g., 401 Unauthorized) during character arc development', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      const apiErrorResponse = { error: { message: 'Invalid API key' } };
      mockFetch.mockResolvedValueOnce({
        ok: false, status: 401, json: async () => apiErrorResponse, text: async () => JSON.stringify(apiErrorResponse)
      });
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);
      const mockRequest: CharacterArcRequest = { prompt: 'Arc for a hero.', type: 'character-arc-development' };
      await expect(service.developCharacterArc(mockRequest))
        .rejects.toThrow(expect.stringContaining('Invalid API key'));
    });

    it('should handle malformed successful API responses during character arc development', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      const malformedApiResponse = { id: 'cmpl-malformed123' /* Missing choices */ };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => malformedApiResponse });
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);
      const mockRequest: CharacterArcRequest = { prompt: 'Arc for a hero.', type: 'character-arc-development' };
      await expect(service.developCharacterArc(mockRequest))
        .rejects.toThrow('Invalid response format from API');
    });
  });

  describe('analyzeStyleTone', () => {
    it('should analyze style and tone successfully with OpenAI', async () => {
      const mockApiKey = 'sk-testapikey';
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue(mockApiKey);

      const mockStyleToneRequest: StyleToneAnalysisRequest = {
        prompt: 'Analyze the style of this text: It was a dark and stormy night.',
        type: 'style-tone-analysis',
        textToAnalyze: 'It was a dark and stormy night. The wind howled like a banshee.',
        referenceTexts: ['Call me Ishmael.'],
        desiredStyle: 'gothic',
        desiredTone: 'ominous',
      };

      const aiGeneratedStyleToneContent = {
        consistencyScore: 0.85,
        feedbackOnStyle: 'The style is appropriately dark and matches gothic literature.',
        feedbackOnTone: 'The tone is ominous and suspenseful.',
        suggestionsForImprovement: ['Consider adding more sensory details.']
      };
      const mockApiResponse = {
        id: 'cmpl-styletone123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{ message: { content: JSON.stringify(aiGeneratedStyleToneContent) } }],
        usage: { prompt_tokens: 20, completion_tokens: 120, total_tokens: 140 },
      };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockApiResponse });

      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true, selectedModel: 'gpt-4o' };
      service = new EnhancedSecureAIService(settings);

      const result = await service.analyzeStyleTone(mockStyleToneRequest);

      expect(enhancedSecureStorage.getSecure).toHaveBeenCalledWith('apikey-openai');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body as string);

      // Based on current placeholder: request.prompt || `Analyze style/tone for text: "${request.textToAnalyze.substring(0,100)}..."`
      const expectedPrompt = mockStyleToneRequest.prompt || `Analyze style/tone for text: "${mockStyleToneRequest.textToAnalyze.substring(0,100)}..."`;
      expect(requestBody.messages[1].content).toBe(expectedPrompt);

      expect(result.provider).toBe('OpenAI');
      expect(result.content).toBe(JSON.stringify(aiGeneratedStyleToneContent));
    });

    it('should throw an error if API key is missing for OpenAI style/tone analysis', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue(null);
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);
      const mockRequest: StyleToneAnalysisRequest = { textToAnalyze: 'Some text.', type: 'style-tone-analysis' };
      await expect(service.analyzeStyleTone(mockRequest))
        .rejects.toThrow('API key required for OpenAI. Please configure it in settings.');
    });

    it('should handle fetch network errors during style/tone analysis', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);
      const mockRequest: StyleToneAnalysisRequest = { textToAnalyze: 'Some text.', type: 'style-tone-analysis' };
      await expect(service.analyzeStyleTone(mockRequest))
        .rejects.toThrow(expect.stringContaining('Network request failed'));
    });

    it('should handle API errors (e.g., 401 Unauthorized) during style/tone analysis', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      const apiErrorResponse = { error: { message: 'Invalid API key' } };
      mockFetch.mockResolvedValueOnce({
        ok: false, status: 401, json: async () => apiErrorResponse, text: async () => JSON.stringify(apiErrorResponse)
      });
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);
      const mockRequest: StyleToneAnalysisRequest = { textToAnalyze: 'Some text.', type: 'style-tone-analysis' };
      await expect(service.analyzeStyleTone(mockRequest))
        .rejects.toThrow(expect.stringContaining('Invalid API key'));
    });

    it('should handle malformed successful API responses during style/tone analysis', async () => {
      (enhancedSecureStorage.getSecure as jest.Mock).mockResolvedValue('sk-testapikey');
      const malformedApiResponse = { id: 'cmpl-malformed123' /* Missing choices */ };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => malformedApiResponse });
      settings.defaultProvider = 'openai';
      settings.providers.openai = { ...settings.providers.openai, isEnabled: true };
      service = new EnhancedSecureAIService(settings);
      const mockRequest: StyleToneAnalysisRequest = { textToAnalyze: 'Some text.', type: 'style-tone-analysis' };
      await expect(service.analyzeStyleTone(mockRequest))
        .rejects.toThrow('Invalid response format from API');
    });
  });
});
