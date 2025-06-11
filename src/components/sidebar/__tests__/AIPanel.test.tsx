import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AIPanel } from '../AIPanel';
import { AIContextValue, AIState } from '../../../contexts/AIContext';
import {
  EnhancedSecureAIService,
  SecureAISettings,
  PlotGenerationRequest,
  PlotGenerationResponse,
  CharacterArcRequest,
  CharacterArcResponse,
  StyleToneAnalysisRequest,
  StyleToneAnalysisResponse,
  EnhancedAIRequest,
  EnhancedAIResponse
} from '../../../services/enhancedAIProviders';
import { LanceDBService } from '../../../services/lanceDBService';

// Default AI State for context
const defaultAIState: AIState = {
  isInitialized: true,
  initializationError: null,
  isGenerating: false,
  currentGeneration: '',
  generationHistory: [],
  settings: {
    providers: { openai: { isEnabled: true, selectedModel: 'gpt-4o', selectedEmbeddingModel: 'text-embedding-3-small' } },
    defaultProvider: 'openai',
    temperature: 0.7,
    maxTokens: 1500,
  },
  serviceMetrics: { requestCount: 0, lastRequestTime: 0, sessionInfo: null, rateLimitStatus: {} },
};

// Mock AI Actions and raw service for context
const mockAIActions = {
  generateContent: jest.fn().mockResolvedValue({ success: true, data: { content: 'Mocked content', provider: 'OpenAI', model: 'gpt-4o' } }),
  setApiKey: jest.fn().mockResolvedValue({ success: true }),
  getApiKey: jest.fn().mockResolvedValue('sk-mockkey'),
  removeApiKey: jest.fn().mockResolvedValue({ success: true }),
  updateSettings: jest.fn(),
  clearHistory: jest.fn(),
  refreshMetrics: jest.fn(),
  generatePlot: jest.fn().mockResolvedValue({ success: true, data: { suggestedPlots: [], provider: 'OpenAI', model: 'gpt-4o', content:'' } }),
  developCharacterArc: jest.fn().mockResolvedValue({ success: true, data: { suggestedArc: {}, provider: 'OpenAI', model: 'gpt-4o', content:'' } }),
  analyzeStyleTone: jest.fn().mockResolvedValue({ success: true, data: { feedbackOnStyle: 'Good.', provider: 'OpenAI', model: 'gpt-4o', content:'' } }),
  getEmbeddings: jest.fn().mockResolvedValue({ success: true, data: [[0.1]] }),
  getActiveEmbeddingModelDimension: jest.fn().mockResolvedValue({ success: true, data: 1536 }),
};

const mockEnhancedServiceInstance = {
  getEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2]]),
  getActiveEmbeddingModelDimension: jest.fn().mockResolvedValue(1536),
  initialize: jest.fn().mockResolvedValue(undefined),
  getSettings: jest.fn().mockReturnValue(defaultAIState.settings),
  // Add stubs for other methods if they were to be called by LanceDBService or other direct consumers
  generateContent: jest.fn(),
  generatePlot: jest.fn(),
  developCharacterArc: jest.fn(),
  analyzeStyleTone: jest.fn(),
  setApiKey: jest.fn(),
  removeApiKey: jest.fn(),
  getApiKey: jest.fn(),
  updateSettings: jest.fn(),
  getServiceMetrics: jest.fn(),
} as unknown as EnhancedSecureAIService;


// Mock LanceDBService
const mockLanceDBInstance = {
  initialize: jest.fn().mockResolvedValue(undefined),
  addText: jest.fn().mockResolvedValue(undefined),
  searchSimilarTexts: jest.fn().mockResolvedValue([]),
  getTableSchema: jest.fn().mockResolvedValue({ fields: [] }),
};
jest.mock('../../../services/lanceDBService', () => {
  return {
    LanceDBService: jest.fn().mockImplementation(() => mockLanceDBInstance),
  };
});

// Helper to render AIPanel with mocked context and props
const renderAIPanel = (aiStateOverrides: Partial<AIState> = {}, aiActionsOverrides: Partial<typeof mockAIActions> = {}) => {
  const currentAIState = { ...defaultAIState, ...aiStateOverrides };
  const currentAIActions = { ...mockAIActions, ...aiActionsOverrides };

  const aiServicePropForAIPanel = {
    generateContent: currentAIActions.generateContent,
    getSettings: () => currentAIState.settings,
    generatePlot: currentAIActions.generatePlot,
    developCharacterArc: currentAIActions.developCharacterArc,
    analyzeStyleTone: currentAIActions.analyzeStyleTone,
    getEmbeddings: currentAIActions.getEmbeddings,
    getActiveEmbeddingModelDimension: currentAIActions.getActiveEmbeddingModelDimension,
  };

  return render(
    <AIPanel
      aiService={aiServicePropForAIPanel as any}
      enhancedServiceInstance={mockEnhancedServiceInstance}
      onShowSettings={jest.fn()}
    />
  );
};


describe('AIPanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (LanceDBService as jest.Mock).mockImplementation(() => {
        mockLanceDBInstance.initialize.mockClear().mockResolvedValue(undefined);
        mockLanceDBInstance.addText.mockClear().mockResolvedValue(undefined);
        mockLanceDBInstance.searchSimilarTexts.mockClear().mockResolvedValue([]);
        mockLanceDBInstance.getTableSchema.mockClear().mockResolvedValue({fields: []});
        return mockLanceDBInstance;
    });
    (mockEnhancedServiceInstance.getEmbeddings as jest.Mock).mockClear().mockResolvedValue([[0.1,0.2]]);
    (mockEnhancedServiceInstance.getActiveEmbeddingModelDimension as jest.Mock).mockClear().mockResolvedValue(1536);
  });

  it('should render all feature sections correctly', () => {
    renderAIPanel();
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByText(/Custom Prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/Plot Generation/i)).toBeInTheDocument();
    expect(screen.getByText(/Character Arc Development/i)).toBeInTheDocument();
    expect(screen.getByText(/Style\/Tone Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Prompts/i)).toBeInTheDocument();
  });

  it('should initialize LanceDBService on mount', async () => {
    renderAIPanel();
    await waitFor(() => {
      expect(LanceDBService).toHaveBeenCalledWith(mockEnhancedServiceInstance, 1536);
    });
    await waitFor(() => {
      expect(mockLanceDBInstance.initialize).toHaveBeenCalledTimes(1);
    });
    // Check for status update based on successful initialization path in AIPanel's useEffect
    // This depends on mockAIActions.getActiveEmbeddingModelDimension resolving successfully as well.
    // Since default mockAIActions.getActiveEmbeddingModelDimension resolves with success: true, data: 1536
    // and mockLanceDBInstance.initialize resolves, status should be "LanceDB Initialized"
    expect(await screen.findByText('LanceDB Status: LanceDB Initialized')).toBeInTheDocument();
  });

  describe('Plot Generation Feature', () => {
    it('should call generatePlot action and display results on success', async () => {
      const plotData: PlotGenerationResponse = {
        suggestedPlots: [{ summary: 'A grand adventure begins.', potentialStoryArcs: ['Quest for MacGuffin'], keyTurningPoints: ['Discovery'] }],
        provider: 'OpenAI',
        model: 'gpt-4o',
        content: "" // content is string in AIResponse, PlotGenerationResponse extends it
      };
      // Override the default mock for this specific test
      const generatePlotMock = jest.fn().mockResolvedValue({ success: true, data: plotData });
      renderAIPanel({}, { generatePlot: generatePlotMock });


      const plotPromptTextarea = screen.getByPlaceholderText(/existing plot summary, key ideas, or themes/i);
      fireEvent.change(plotPromptTextarea, { target: { value: 'Test plot idea' } });
      fireEvent.click(screen.getByRole('button', { name: /Generate Plot/i }));

      expect(generatePlotMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test plot idea',
          existingPlotSummary: 'Test plot idea', // As per current AIPanel.handleGeneratePlot
          type: 'plot-generation'
        })
      );

      await waitFor(() => {
        expect(screen.getByText('A grand adventure begins.')).toBeInTheDocument();
      });
      expect(screen.queryByText(/Generating Plot.../i)).not.toBeInTheDocument();
    });

    it('should display error message if generatePlot action fails', async () => {
      const generatePlotMock = jest.fn().mockResolvedValue({ success: false, error: 'Plot generation failed miserably.' });
      renderAIPanel({}, { generatePlot: generatePlotMock });


      fireEvent.change(screen.getByPlaceholderText(/existing plot summary or ideas/i), { target: { value: 'Another plot' } });
      fireEvent.click(screen.getByRole('button', { name: /Generate Plot/i }));

      await waitFor(() => {
        expect(screen.getByText('Plot generation failed miserably.')).toBeInTheDocument();
      });
    });
  });

  describe('Character Arc Development Feature', () => {
    it('should call developCharacterArc action and display results on success', async () => {
      const arcData: CharacterArcResponse = {
        suggestedArc: {
          arcSummary: 'A hero learns a valuable lesson.',
          keyDevelopmentStages: ['Introduction', 'Challenge', 'Climax', 'Resolution'],
          potentialConflicts: ['Internal doubt'],
          endingResolution: 'Victory and growth.'
        },
        provider: 'OpenAI', model: 'gpt-4o', content: ""
      };
      // Override the default mock for this specific test
      const developCharacterArcMock = jest.fn().mockResolvedValue({ success: true, data: arcData });
      renderAIPanel({}, { developCharacterArc: developCharacterArcMock });

      fireEvent.change(screen.getByPlaceholderText(/Character Name \(Optional\)/i), { target: { value: 'Sir Test' } });
      fireEvent.change(screen.getByPlaceholderText(/Describe the character, desired arc type/i), { target: { value: 'Test arc idea' } });
      fireEvent.click(screen.getByRole('button', { name: /Develop Character Arc/i }));

      expect(developCharacterArcMock).toHaveBeenCalledWith(
        expect.objectContaining({
          // Based on AIPanel's current implementation of constructing the prompt for CharacterArcRequest
          prompt: `Develop a character arc for Sir Test. Details: Test arc idea`,
          type: 'character-arc-development',
          characterId: 'Sir Test'
        })
      );

      await waitFor(() => {
        expect(screen.getByText('A hero learns a valuable lesson.')).toBeInTheDocument();
        expect(screen.getByText(/Challenge/i)).toBeInTheDocument(); // Check for a stage
      });
    });

    it('should display error message if developCharacterArc action fails', async () => {
      const developCharacterArcMock = jest.fn().mockResolvedValue({ success: false, error: 'Arc development failed utterly.' });
      renderAIPanel({}, { developCharacterArc: developCharacterArcMock });


      fireEvent.change(screen.getByPlaceholderText(/Character Name \(Optional\)/i), { target: { value: 'Sir Fail' } });
      fireEvent.change(screen.getByPlaceholderText(/Describe the character, desired arc type/i), { target: { value: 'Failed arc idea' } });
      fireEvent.click(screen.getByRole('button', { name: /Develop Character Arc/i }));

      await waitFor(() => {
        expect(screen.getByText('Arc development failed utterly.')).toBeInTheDocument();
      });
    });
  });

  describe('Style/Tone Analysis Feature', () => {
    const styleToneData: StyleToneAnalysisResponse = {
      feedbackOnStyle: 'Style is consistent.',
      feedbackOnTone: 'Tone is appropriate.',
      suggestionsForImprovement: ['None needed.'],
      consistencyScore: 0.9,
      provider: 'OpenAI', model: 'gpt-4o', content: ""
    };
    const mockLanceDBSnippets: TextChunk[] = [ // Ensure TextChunk type is used if available and matches LanceDBService output
      { id: 's1', text: 'Similar snippet 1 text', vector: [], source: 'ref_doc1', createdAt: new Date(), _score: 0.92 },
      { id: 's2', text: 'Another similar snippet text', vector: [], source: 'ref_doc2', createdAt: new Date(), _score: 0.88 },
    ];

    beforeEach(() => {
      // Reset relevant action mocks for this suite
      mockAIActions.analyzeStyleTone.mockReset().mockResolvedValue({ success: true, data: styleToneData });
      // LanceDBService instance and its method mocks are reset in the main beforeEach
      // but we might need to reset specific method mocks on mockLanceDBInstance if they are changed within tests
      mockLanceDBInstance.searchSimilarTexts.mockClear().mockResolvedValue([]); // Default to no snippets
      mockLanceDBInstance.addText.mockClear().mockResolvedValue(undefined);
    });

    it('should call analyzeStyleTone, addText, searchSimilarTexts and display results on success (with reference texts)', async () => {
      mockLanceDBInstance.searchSimilarTexts.mockResolvedValue(mockLanceDBSnippets);

      renderAIPanel();

      await waitFor(() => expect(screen.getByText('LanceDB Status: LanceDB Initialized')).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/text to analyze/i), { target: { value: 'Analyze this sample text.' } });
      fireEvent.change(screen.getByPlaceholderText(/reference texts \(optional, one per line\)/i), { target: { value: 'Reference 1\nReference 2' } });
      fireEvent.change(screen.getByPlaceholderText(/^Desired Style \(Optional\)$/i), { target: { value: 'Formal' } });
      fireEvent.change(screen.getByPlaceholderText(/^Desired Tone \(Optional\)$/i), { target: { value: 'Serious' } });

      fireEvent.click(screen.getByRole('button', { name: /Analyze Style\/Tone/i }));

      await waitFor(() => {
        expect(mockLanceDBInstance.addText).toHaveBeenCalledWith('Reference 1', expect.stringContaining('ref_snippet_'));
        expect(mockLanceDBInstance.addText).toHaveBeenCalledWith('Reference 2', expect.stringContaining('ref_snippet_'));
      });
      expect(mockLanceDBInstance.addText).toHaveBeenCalledTimes(2);

      expect(mockLanceDBInstance.searchSimilarTexts).toHaveBeenCalledWith('Analyze this sample text.', 3);

      expect(mockAIActions.analyzeStyleTone).toHaveBeenCalledWith(
        expect.objectContaining({
          textToAnalyze: 'Analyze this sample text.',
          referenceTexts: ['Reference 1', 'Reference 2'],
          desiredStyle: 'Formal',
          desiredTone: 'Serious',
          type: 'style-tone-analysis'
        })
      );

      await waitFor(() => {
        expect(screen.getByText('Style is consistent.')).toBeInTheDocument();
        expect(screen.getByText('Tone is appropriate.')).toBeInTheDocument();
        expect(screen.getByText(/Similar snippet 1 text/i)).toBeInTheDocument();
        expect(screen.getByText(/Another similar snippet text/i)).toBeInTheDocument();
      });
    });

    it('should call analyzeStyleTone and searchSimilarTexts (no addText) if no reference texts are provided', async () => {
      // searchSimilarTexts mock already defaults to [] in beforeEach
      renderAIPanel();
      await waitFor(() => expect(screen.getByText('LanceDB Status: LanceDB Initialized')).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/text to analyze/i), { target: { value: 'Only analyze this.' } });
      fireEvent.click(screen.getByRole('button', { name: /Analyze Style\/Tone/i }));

      expect(mockLanceDBInstance.addText).not.toHaveBeenCalled();
      expect(mockLanceDBInstance.searchSimilarTexts).toHaveBeenCalledWith('Only analyze this.', 3);
      expect(mockAIActions.analyzeStyleTone).toHaveBeenCalledWith(
        expect.objectContaining({
          textToAnalyze: 'Only analyze this.',
          referenceTexts: undefined, // AIPanel sends undefined if referenceTexts field is empty
        })
      );

      await waitFor(() => {
        expect(screen.getByText('Style is consistent.')).toBeInTheDocument();
      });
      // The header for similar snippets is "Similar Stored Snippets (from LanceDB):"
      // It only appears if (styleToneAnalysisResult as any).similarSnippets is true and length > 0
      expect(screen.queryByText(/Similar Stored Snippets \(from LanceDB\):/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Similar snippet 1 text/i)).not.toBeInTheDocument();
    });

    it('should display error message if analyzeStyleTone action fails', async () => {
      mockAIActions.analyzeStyleTone.mockReset().mockResolvedValue({ success: false, error: 'Style analysis AI failed.' });
      renderAIPanel();
      await waitFor(() => expect(screen.getByText('LanceDB Status: LanceDB Initialized')).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/text to analyze/i), { target: { value: 'Text for failing AI.' } });
      fireEvent.click(screen.getByRole('button', { name: /Analyze Style\/Tone/i }));

      await waitFor(() => {
        expect(screen.getByText('Style analysis AI failed.')).toBeInTheDocument();
      });
    });

    it('should proceed with AI analysis even if adding reference text to LanceDB fails', async () => {
      mockLanceDBInstance.addText.mockRejectedValueOnce(new Error('LanceDB addText failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(); // Spy on console.error
      renderAIPanel();
      await waitFor(() => expect(screen.getByText('LanceDB Status: LanceDB Initialized')).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/text to analyze/i), { target: { value: 'Test with LanceDB add fail.' } });
      fireEvent.change(screen.getByPlaceholderText(/reference texts \(optional, one per line\)/i), { target: { value: 'Ref text that will fail to add' } });
      fireEvent.click(screen.getByRole('button', { name: /Analyze Style\/Tone/i }));

      await waitFor(() => {
        expect(mockLanceDBInstance.addText).toHaveBeenCalledTimes(1);
      });
      expect(mockAIActions.analyzeStyleTone).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByText('Style is consistent.')).toBeInTheDocument();
      });
      // Check if the error message includes the LanceDB error
      await waitFor(() => {
         expect(screen.getByText(expect.stringContaining('Error adding reference texts: LanceDB addText failed'))).toBeInTheDocument();
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error adding reference texts to LanceDB:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should display AI analysis results even if LanceDB search fails', async () => {
        mockLanceDBInstance.searchSimilarTexts.mockRejectedValueOnce(new Error('LanceDB search failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        renderAIPanel();
        await waitFor(() => expect(screen.getByText('LanceDB Status: LanceDB Initialized')).toBeInTheDocument());

        fireEvent.change(screen.getByPlaceholderText(/text to analyze/i), { target: { value: 'Test with LanceDB search fail.' } });
        fireEvent.click(screen.getByRole('button', { name: /Analyze Style\/Tone/i }));

        await waitFor(() => {
            expect(mockLanceDBInstance.searchSimilarTexts).toHaveBeenCalledTimes(1);
        });
        expect(mockAIActions.analyzeStyleTone).toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText('Style is consistent.')).toBeInTheDocument();
        });
        expect(screen.queryByText(/Similar snippet 1 text/i)).not.toBeInTheDocument();
        // Check if the error message includes the LanceDB error
        await waitFor(() => {
          expect(screen.getByText(expect.stringContaining('Error searching similar texts: LanceDB search failed'))).toBeInTheDocument();
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error searching similar texts in LanceDB:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });
  });
});
