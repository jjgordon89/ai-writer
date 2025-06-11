import { EnhancedSecureAIService, createDefaultSecureAISettings, AI_PROVIDERS, PlotGenerationRequest, PlotGenerationResponse, SecureAISettings } from '../enhancedAIProviders';
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
      // Ensure anthropic provider has no embeddingModels defined in AI_PROVIDERS for this test,
      // or that selectedEmbeddingModel is also undefined for it.
      const anthropicProviderDef = AI_PROVIDERS.find(p => p.id === 'anthropic');
      if (anthropicProviderDef) anthropicProviderDef.embeddingModels = undefined; // Temporarily ensure no defaults picked up

      service = new EnhancedSecureAIService(settings);
      // The error message is "Embedding generation for anthropic is not yet implemented."
      await expect(service.getEmbeddings(['text'])).rejects.toThrow('Embedding generation for anthropic is not yet implemented.');
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
});
