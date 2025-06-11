import React, { useState } from 'react';
import { Bot, Send, Sparkles, Settings, Zap, AlertTriangle, Copy, CheckCircle, Clock, ListTree, UserCog, Palette } from 'lucide-react'; // Added ListTree, UserCog, Palette
import {
  AIService,
  AIRequest,
  createDefaultAISettings,
  AI_PROVIDERS,
  PlotGenerationRequest,
  PlotGenerationResponse,
  CharacterArcRequest,
  CharacterArcResponse,
  StyleToneAnalysisRequest,
  StyleToneAnalysisResponse
} from '../../services/aiProviders';
import { LanceDBService, TextChunk } from '../../services/lanceDBService'; // Added LanceDBService

interface AIPanelProps {
  aiService: AIService;
  onShowSettings: () => void;
}

const quickPrompts = [
  {
    title: 'Character Development',
    prompts: [
      'Create a complex backstory for my character including their childhood, formative experiences, and what drives them.',
      'Develop realistic character flaws and internal motivations that create compelling conflict.',
      'Suggest character relationships and potential conflicts that could drive the story forward.'
    ]
  },
  {
    title: 'Plot Development',
    prompts: [
      'Generate unexpected plot twists that recontextualize previous events in the story.',
      'Create tension and conflict scenarios that test my characters in meaningful ways.',
      'Develop compelling subplot ideas that complement and enhance the main narrative.'
    ]
  },
  {
    title: 'World Building',
    prompts: [
      'Create detailed setting descriptions that bring locations to life with sensory details.',
      'Develop unique cultural elements, customs, and societal structures.',
      'Generate location names and geographical features that fit the story\'s tone and genre.'
    ]
  },
  {
    title: 'Dialogue & Scenes',
    prompts: [
      'Write realistic dialogue that reveals character personality and advances the plot.',
      'Improve pacing and flow in scenes to maintain reader engagement.',
      'Add sensory details and atmospheric elements that immerse readers in the scene.'
    ]
  }
];

export function AIPanel({ aiService, onShowSettings }: AIPanelProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [error, setError] = useState('');

  // State for Plot Generation
  const [plotGenerationPrompt, setPlotGenerationPrompt] = useState('');
  const [generatedPlot, setGeneratedPlot] = useState<PlotGenerationResponse | null>(null);
  const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
  const [plotGenerationError, setPlotGenerationError] = useState('');

  // State for Character Arc Development
  const [characterArcPrompt, setCharacterArcPrompt] = useState('');
  const [characterNameForArc, setCharacterNameForArc] = useState(''); // Simple text input for now
  const [generatedCharacterArc, setGeneratedCharacterArc] = useState<CharacterArcResponse | null>(null);
  const [isGeneratingCharacterArc, setIsGeneratingCharacterArc] = useState(false);
  const [characterArcError, setCharacterArcError] = useState('');

  // State for Style/Tone Analysis
  const [textToAnalyze, setTextToAnalyze] = useState('');
  const [referenceTexts, setReferenceTexts] = useState(''); // Will be split by newline
  const [desiredStyle, setDesiredStyle] = useState('');
  const [desiredTone, setDesiredTone] = useState('');
  const [styleToneAnalysisResult, setStyleToneAnalysisResult] = useState<StyleToneAnalysisResponse | null>(null);
  const [isAnalyzingStyleTone, setIsAnalyzingStyleTone] = useState(false);
  const [styleToneAnalysisError, setStyleToneAnalysisError] = useState('');

  // State for LanceDBService
  const [lanceDBService, setLanceDBService] = useState<LanceDBService | null>(null);
  const [lanceDBStatus, setLanceDBStatus] = useState<string>('Initializing...'); // For display
  const [lanceDBError, setLanceDBError] = useState<string>('');


  const [generationHistory, setGenerationHistory] = useState<Array<{
    id: string;
    prompt: string;
    content: string;
    provider: string;
    model: string;
    timestamp: Date;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }>>([]);

  const settings = aiService.getSettings();
  const activeProvider = AI_PROVIDERS.find(p => p.id === settings.defaultProvider);
  const providerConfig = settings.providers[settings.defaultProvider];
  const isProviderConfigured = providerConfig?.isEnabled && 
    (!activeProvider?.requiresApiKey || providerConfig?.apiKey);

  // Effect to initialize LanceDBService
  React.useEffect(() => {
    if (aiService && isProviderConfigured && !lanceDBService && !lanceDBError) {
      console.log("Attempting to initialize LanceDBService...");
      setLanceDBStatus('Initializing...');
      const service = new LanceDBService(aiService);
      service.initialize()
        .then(() => {
          setLanceDBService(service);
          setLanceDBStatus('LanceDB Initialized');
          console.log('LanceDBService initialized successfully.');
        })
        .catch(err => {
          console.error('Failed to initialize LanceDBService:', err);
          setLanceDBError(err.message || 'Unknown error initializing LanceDB.');
          setLanceDBStatus('LanceDB Initialization Failed');
        });
    }
  }, [aiService, isProviderConfigured, lanceDBService, lanceDBError]);

  const handleGenerate = async (prompt: string, type: string = 'custom') => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError('');
    
    try {
      const request: AIRequest = {
        prompt: prompt.trim(),
        type,
        model: providerConfig?.selectedModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens
      };

      const response = await aiService.generateContent(request);
      
      setGeneratedContent(response.content);
      
      // Add to history
      const historyEntry = {
        id: Date.now().toString(),
        prompt: prompt.trim(),
        content: response.content,
        provider: response.provider,
        model: response.model,
        timestamp: new Date(),
        usage: response.usage
      };
      
      setGenerationHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('AI generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyzeStyleTone = async () => {
    if (!textToAnalyze.trim()) return;

    setIsAnalyzingStyleTone(true);
    setStyleToneAnalysisError('');
    // Keep previous results on screen while new ones are loading, or clear them:
    // setStyleToneAnalysisResult(null);

    let similarDocs: TextChunk[] = [];
    let lanceError = '';

    if (!lanceDBService && referenceTexts.trim()) {
      setStyleToneAnalysisError('LanceDB is not initialized. Cannot process reference texts or perform similarity search.');
      setIsAnalyzingStyleTone(false);
      return;
    }

    if (lanceDBService && referenceTexts.trim()) {
      try {
        const refTextsArray = referenceTexts.split('\n').map(t => t.trim()).filter(t => t);
        // For simplicity, adding all reference texts on each analysis.
        // A more robust implementation would check for existing texts or manage a collection.
        for (const refText of refTextsArray) {
          // Use a consistent ID for reference texts to allow potential updates or avoid duplicates if addText handles it.
          // For now, using text itself as part of ID, or a hash, could be one strategy.
          // Let's use a simple source identifier.
          await lanceDBService.addText(refText, `reference_document_${Date.now()}`);
        }
        console.log("Reference texts processed by LanceDB.");
      } catch (dbError) {
        console.error('Error adding reference texts to LanceDB:', dbError);
        lanceError += `Error adding reference texts: ${dbError instanceof Error ? dbError.message : String(dbError)}\n`;
      }
    }

    if (lanceDBService) {
      try {
        similarDocs = await lanceDBService.searchSimilarTexts(textToAnalyze.trim(), 3);
        console.log("Similar texts search completed by LanceDB.", similarDocs);
      } catch (dbError) {
        console.error('Error searching similar texts in LanceDB:', dbError);
        lanceError += `Error searching similar texts: ${dbError instanceof Error ? dbError.message : String(dbError)}\n`;
      }
    }

    try {
      const request: StyleToneAnalysisRequest = {
        prompt: `Analyze the style and tone of the following text: "${textToAnalyze.substring(0, 100)}..."`, // Shortened prompt for history
        textToAnalyze: textToAnalyze.trim(),
        referenceTexts: referenceTexts.trim() ? referenceTexts.split('\n').map(t => t.trim()).filter(t => t) : undefined,
        desiredStyle: desiredStyle.trim() || undefined,
        desiredTone: desiredTone.trim() || undefined,
        type: 'style-tone-analysis', // Ensure type is set
        model: providerConfig?.selectedModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      };

      const response = await aiService.analyzeStyleTone(request);

      // Combine AI response with LanceDB results for display
      const combinedResult: StyleToneAnalysisResponse & { similarSnippets?: TextChunk[] } = {
        ...response,
        ...(similarDocs.length > 0 && { similarSnippets: similarDocs }),
      };
      setStyleToneAnalysisResult(combinedResult);

      if (lanceError) {
        setStyleToneAnalysisError(prev => prev ? `${prev}\n${lanceError}` : lanceError);
      }

      const historyEntry = {
        id: `styletone-${Date.now().toString()}`,
        prompt: `Style/Tone Analysis for: "${textToAnalyze.substring(0, 50)}..." (Ref texts: ${referenceTexts.trim() ? 'Yes' : 'No'})`,
        content: `Feedback: ${response.feedbackOnStyle || ''} ${response.feedbackOnTone || ''}`.trim() + (similarDocs.length > 0 ? ` Found ${similarDocs.length} similar snippets.` : '') || 'Analysis complete.',
        provider: response.provider,
        model: response.model,
        timestamp: new Date(),
        usage: response.usage,
      };
      setGenerationHistory(prev => [historyEntry, ...prev.slice(0, 9)]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during style/tone analysis';
      setStyleToneAnalysisError(errorMessage);
      console.error('AI style/tone analysis failed:', err);
    } finally {
      setIsAnalyzingStyleTone(false);
    }
  };

  const handleDevelopCharacterArc = async () => {
    if (!characterArcPrompt.trim()) return;

    setIsGeneratingCharacterArc(true);
    setCharacterArcError('');
    setGeneratedCharacterArc(null);

    try {
      const request: CharacterArcRequest = {
        prompt: `Develop a character arc for ${characterNameForArc || 'the character'}. Details: ${characterArcPrompt.trim()}`,
        characterId: characterNameForArc.trim() || undefined, // Optional: use if you have a system for IDs
        // characterData: {} // Optional: Pass actual character data if available from a store or state
        desiredArcType: '', // Optional: Add UI for this if needed
        keyMotivations: [], // Optional: Add UI for this if needed
        type: 'character-arc-development', // Ensure type is set
        model: providerConfig?.selectedModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      };

      const response = await aiService.developCharacterArc(request);
      setGeneratedCharacterArc(response);

      const historyEntry = {
        id: `chararc-${Date.now().toString()}`,
        prompt: `Character Arc for ${characterNameForArc || 'Character'}: ${characterArcPrompt.trim()}`,
        content: response.suggestedArc ? response.suggestedArc.arcSummary : 'No arc generated',
        provider: response.provider,
        model: response.model,
        timestamp: new Date(),
        usage: response.usage,
      };
      setGenerationHistory(prev => [historyEntry, ...prev.slice(0, 9)]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during character arc development';
      setCharacterArcError(errorMessage);
      console.error('AI character arc development failed:', err);
    } finally {
      setIsGeneratingCharacterArc(false);
    }
  };

  const handleCustomPrompt = () => {
    if (customPrompt.trim()) {
      handleGenerate(customPrompt, 'custom');
    }
  };

  const handleGeneratePlot = async () => {
    if (!plotGenerationPrompt.trim()) return;

    setIsGeneratingPlot(true);
    setPlotGenerationError('');
    setGeneratedPlot(null);

    try {
      const request: PlotGenerationRequest = {
        prompt: plotGenerationPrompt.trim(), // Using plotGenerationPrompt as the main prompt for the request
        existingPlotSummary: plotGenerationPrompt.trim(), // Or map other specific fields
        // desiredGenres: [], // Example: Add UI elements for these if needed
        // keyThemes: [],   // Example: Add UI elements for these if needed
        type: 'plot-generation', // Ensure type is set
        model: providerConfig?.selectedModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      };

      const response = await aiService.generatePlot(request);
      setGeneratedPlot(response);

      // Optionally, add to a specific plot generation history or the main history
      const historyEntry = {
        id: `plot-${Date.now().toString()}`,
        prompt: `Plot: ${plotGenerationPrompt.trim()}`,
        content: response.suggestedPlots && response.suggestedPlots.length > 0
          ? response.suggestedPlots.map(p => p.summary).join('\n---\n')
          : 'No plot generated',
        provider: response.provider,
        model: response.model,
        timestamp: new Date(),
        usage: response.usage,
      };
      setGenerationHistory(prev => [historyEntry, ...prev.slice(0, 9)]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during plot generation';
      setPlotGenerationError(errorMessage);
      console.error('AI plot generation failed:', err);
    } finally {
      setIsGeneratingPlot(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const insertIntoEditor = (content: string) => {
    // This would need to be connected to the main editor
    // For now, we'll just copy to clipboard
    copyToClipboard(content);
  };

  if (!isProviderConfigured) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <span>AI Assistant</span>
          </h3>
          <button 
            onClick={onShowSettings}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">Configure AI Providers</h4>
          <p className="text-gray-600 mb-6 text-sm leading-relaxed">
            To start generating content, you need to configure at least one AI provider with a valid API key.
          </p>
          <button
            onClick={onShowSettings}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Open Settings
          </button>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h5 className="text-sm font-medium text-blue-800">Supported Providers</h5>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li>• Cloud: OpenAI, Anthropic, OpenRouter, HuggingFace</li>
                <li>• Local: Ollama, LM Studio</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          <span>AI Assistant</span>
        </h3>
        <button 
          onClick={onShowSettings}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Provider Status */}
      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">
            {activeProvider?.name} ({providerConfig?.selectedModel || activeProvider?.models[0]})
          </span>
        </div>
        <div className="text-xs text-green-600">
          {settings.temperature}°C • {settings.maxTokens} tokens
        </div>
      </div>

      {/* LanceDB Status Display */}
      <div className={`p-2 rounded-lg text-xs border ${lanceDBError ? 'bg-red-50 border-red-200 text-red-700' : (lanceDBService ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-300 text-yellow-700')}`}>
        LanceDB Status: {lanceDBStatus} {lanceDBError && `: ${lanceDBError}`}
      </div>


      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Generation Failed</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Custom Prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Custom Prompt
        </label>
        <div className="space-y-3">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Enter your prompt here... Be specific about what you want the AI to help with."
            disabled={isGenerating}
          />
          <button
            onClick={handleCustomPrompt}
            disabled={isGenerating || !customPrompt.trim()}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Plot Generation Section */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
          <ListTree className="w-4 h-4 text-blue-600" />
          <span>Plot Generation</span>
        </h4>
        <div className="space-y-3">
          <textarea
            value={plotGenerationPrompt}
            onChange={(e) => setPlotGenerationPrompt(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Enter your existing plot summary, key ideas, or themes..."
            disabled={isGeneratingPlot || isGenerating}
          />
          <button
            onClick={handleGeneratePlot}
            disabled={isGeneratingPlot || isGenerating || !plotGenerationPrompt.trim()}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGeneratingPlot ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Generating Plot...</span>
              </>
            ) : (
              <>
                <ListTree className="w-4 h-4" />
                <span>Generate Plot</span>
              </>
            )}
          </button>
        </div>
        {plotGenerationError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Plot Generation Failed</h4>
                <p className="text-sm text-red-700 mt-1">{plotGenerationError}</p>
              </div>
            </div>
          </div>
        )}
        {generatedPlot && generatedPlot.suggestedPlots && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-gray-900">Suggested Plots</h5>
              <button
                onClick={() => copyToClipboard(generatedPlot.suggestedPlots?.map(p => p.summary).join('\n\n') || '')}
                className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded flex items-center space-x-1"
              >
                <Copy className="w-3 h-3" />
                <span>Copy All</span>
              </button>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-64 overflow-y-auto space-y-3">
              {generatedPlot.suggestedPlots.map((plot, index) => (
                <div key={index} className="border-b border-gray-200 pb-2 mb-2 last:border-b-0 last:pb-0 last:mb-0">
                  <h6 className="text-xs font-semibold text-gray-800 mb-1">Plot Option {index + 1}</h6>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                    {plot.summary}
                  </pre>
                  {plot.potentialStoryArcs && plot.potentialStoryArcs.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs font-medium text-gray-600">Story Arcs:</p>
                      <ul className="list-disc list-inside pl-2 text-xs text-gray-600">
                        {plot.potentialStoryArcs.map((arc, arcIdx) => <li key={arcIdx}>{arc}</li>)}
                      </ul>
                    </div>
                  )}
                  {plot.keyTurningPoints && plot.keyTurningPoints.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs font-medium text-gray-600">Turning Points:</p>
                      <ul className="list-disc list-inside pl-2 text-xs text-gray-600">
                        {plot.keyTurningPoints.map((tp, tpIdx) => <li key={tpIdx}>{tp}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Style/Tone Consistency Analysis Section */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
          <Palette className="w-4 h-4 text-orange-600" />
          <span>Style/Tone Analysis</span>
        </h4>
        <div className="space-y-3">
          <textarea
            value={textToAnalyze}
            onChange={(e) => setTextToAnalyze(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Text to Analyze..."
            disabled={isAnalyzingStyleTone || isGenerating}
          />
          <textarea
            value={referenceTexts}
            onChange={(e) => setReferenceTexts(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Reference Texts (Optional, one per line)..."
            disabled={isAnalyzingStyleTone || isGenerating}
          />
          <input
            type="text"
            value={desiredStyle}
            onChange={(e) => setDesiredStyle(e.target.value)}
            placeholder="Desired Style (Optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            disabled={isAnalyzingStyleTone || isGenerating}
          />
          <input
            type="text"
            value={desiredTone}
            onChange={(e) => setDesiredTone(e.target.value)}
            placeholder="Desired Tone (Optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            disabled={isAnalyzingStyleTone || isGenerating || !lanceDBService}
          />
          <button
            onClick={handleAnalyzeStyleTone}
            disabled={isAnalyzingStyleTone || isGenerating || !textToAnalyze.trim() || !lanceDBService}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzingStyleTone ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Palette className="w-4 h-4" />
                <span>Analyze Style/Tone</span>
              </>
            )}
          </button>
        </div>
        {styleToneAnalysisError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Analysis Failed</h4>
                <p className="text-sm text-red-700 mt-1">{styleToneAnalysisError}</p>
              </div>
            </div>
          </div>
        )}
        {styleToneAnalysisResult && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-gray-900">Analysis Result</h5>
              <button
                 onClick={() => copyToClipboard(JSON.stringify(styleToneAnalysisResult, null, 2))}
                className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded flex items-center space-x-1"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Result</span>
              </button>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-96 overflow-y-auto space-y-3">
              {typeof styleToneAnalysisResult.consistencyScore === 'number' && (
                <div>
                  <h6 className="text-xs font-semibold text-gray-800">Consistency Score:</h6>
                  <p className="text-sm text-gray-700">{styleToneAnalysisResult.consistencyScore.toFixed(2)}</p>
                </div>
              )}
              {styleToneAnalysisResult.feedbackOnStyle && (
                <div>
                  <h6 className="text-xs font-semibold text-gray-800">Feedback on Style:</h6>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{styleToneAnalysisResult.feedbackOnStyle}</pre>
                </div>
              )}
              {styleToneAnalysisResult.feedbackOnTone && (
                <div>
                  <h6 className="text-xs font-semibold text-gray-800">Feedback on Tone:</h6>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{styleToneAnalysisResult.feedbackOnTone}</pre>
                </div>
              )}
              {styleToneAnalysisResult.suggestionsForImprovement && styleToneAnalysisResult.suggestionsForImprovement.length > 0 && (
                <div>
                  <h6 className="text-xs font-semibold text-gray-800">Suggestions for Improvement:</h6>
                  <ul className="list-disc list-inside pl-2 text-sm text-gray-700 space-y-1">
                    {styleToneAnalysisResult.suggestionsForImprovement.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Display Similar Snippets */}
              {(styleToneAnalysisResult as any).similarSnippets && (styleToneAnalysisResult as any).similarSnippets.length > 0 && (
                <div>
                  <h6 className="text-xs font-semibold text-gray-800 mt-3">Similar Stored Snippets (from LanceDB):</h6>
                  <ul className="space-y-2">
                    {(styleToneAnalysisResult as any).similarSnippets.map((snippet: TextChunk, index: number) => (
                      <li key={snippet.id || index} className="p-2 border border-gray-300 rounded bg-gray-100">
                        <p className="text-xs text-gray-600 truncate" title={snippet.text}>"{snippet.text}"</p>
                        <p className="text-xs text-gray-500">Source: {snippet.source} (Score: {snippet._score?.toFixed(3)})</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Character Arc Development Section */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
          <UserCog className="w-4 h-4 text-teal-600" />
          <span>Character Arc Development</span>
        </h4>
        <div className="space-y-3">
          <input
            type="text"
            value={characterNameForArc}
            onChange={(e) => setCharacterNameForArc(e.target.value)}
            placeholder="Character Name (Optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            disabled={isGeneratingCharacterArc || isGenerating}
          />
          <textarea
            value={characterArcPrompt}
            onChange={(e) => setCharacterArcPrompt(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Describe the character, desired arc type (e.g., redemption, fall), key motivations, or specific situations..."
            disabled={isGeneratingCharacterArc || isGenerating}
          />
          <button
            onClick={handleDevelopCharacterArc}
            disabled={isGeneratingCharacterArc || isGenerating || !characterArcPrompt.trim()}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGeneratingCharacterArc ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Developing Arc...</span>
              </>
            ) : (
              <>
                <UserCog className="w-4 h-4" />
                <span>Develop Character Arc</span>
              </>
            )}
          </button>
        </div>
        {characterArcError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Character Arc Failed</h4>
                <p className="text-sm text-red-700 mt-1">{characterArcError}</p>
              </div>
            </div>
          </div>
        )}
        {generatedCharacterArc && generatedCharacterArc.suggestedArc && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-gray-900">Suggested Character Arc</h5>
              <button
                onClick={() => copyToClipboard(JSON.stringify(generatedCharacterArc.suggestedArc, null, 2))}
                className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded flex items-center space-x-1"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Arc</span>
              </button>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-80 overflow-y-auto space-y-2">
              <div>
                <h6 className="text-xs font-semibold text-gray-800">Summary:</h6>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                  {generatedCharacterArc.suggestedArc.arcSummary}
                </pre>
              </div>
              {generatedCharacterArc.suggestedArc.keyDevelopmentStages && generatedCharacterArc.suggestedArc.keyDevelopmentStages.length > 0 && (
                <div>
                  <h6 className="text-xs font-semibold text-gray-800 mt-2">Key Development Stages:</h6>
                  <ul className="list-disc list-inside pl-2 text-sm text-gray-700 space-y-1">
                    {generatedCharacterArc.suggestedArc.keyDevelopmentStages.map((stage, index) => (
                      <li key={index}>{stage}</li>
                    ))}
                  </ul>
                </div>
              )}
              {generatedCharacterArc.suggestedArc.potentialConflicts && generatedCharacterArc.suggestedArc.potentialConflicts.length > 0 && (
                <div>
                  <h6 className="text-xs font-semibold text-gray-800 mt-2">Potential Conflicts:</h6>
                  <ul className="list-disc list-inside pl-2 text-sm text-gray-700 space-y-1">
                    {generatedCharacterArc.suggestedArc.potentialConflicts.map((conflict, index) => (
                      <li key={index}>{conflict}</li>
                    ))}
                  </ul>
                </div>
              )}
              {generatedCharacterArc.suggestedArc.endingResolution && (
                <div>
                  <h6 className="text-xs font-semibold text-gray-800 mt-2">Ending Resolution:</h6>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                    {generatedCharacterArc.suggestedArc.endingResolution}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Quick Prompts</span>
        </h4>
        
        <div className="space-y-4">
          {quickPrompts.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h5 className="text-sm font-medium text-gray-700 mb-2">
                {category.title}
              </h5>
              <div className="space-y-1">
                {category.prompts.map((prompt, promptIndex) => (
                  <button
                    key={promptIndex}
                    onClick={() => handleGenerate(prompt, category.title.toLowerCase())}
                    disabled={isGenerating}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated Content */}
      {generatedContent && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-md font-semibold text-gray-900">Generated Content</h4>
            <div className="flex space-x-1">
              <button
                onClick={() => copyToClipboard(generatedContent)}
                className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded flex items-center space-x-1"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </button>
              <button
                onClick={() => insertIntoEditor(generatedContent)}
                className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded"
              >
                Insert
              </button>
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
              {generatedContent}
            </pre>
          </div>
        </div>
      )}

      {/* Generation History */}
      {generationHistory.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-600" />
            <span>Recent Generations</span>
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {generationHistory.map((entry) => (
              <div key={entry.id} className="p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">
                    {entry.provider} • {entry.model}
                  </span>
                  <div className="flex items-center space-x-1">
                    {entry.usage && (
                      <span className="text-xs text-gray-500">
                        {entry.usage.totalTokens} tokens
                      </span>
                    )}
                    <button
                      onClick={() => copyToClipboard(entry.content)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">
                  {entry.prompt}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}