import React, { useState } from 'react';
import { Bot, Send, Sparkles, Settings, Zap, AlertTriangle, Copy, CheckCircle, Clock, ListTree, UserCog, Palette } from 'lucide-react';
import {
  SecureAISettings,
  AIRequest as EnhancedAIRequest,
  AIResponse as EnhancedAIResponse,
  PlotGenerationRequest,
  PlotGenerationResponse,
  CharacterArcRequest,
  CharacterArcResponse,
  StyleToneAnalysisRequest,
  StyleToneAnalysisResponse,
  AI_PROVIDERS,
  EnhancedSecureAIService
} from '../../services/enhancedAIProviders';
import { LanceDBService, TextChunk } from '../../services/lanceDBService';

interface AIPanelAIService {
  generateContent: (request: EnhancedAIRequest) => Promise<{ success: boolean; data?: EnhancedAIResponse; error?: string }>;
  getSettings: () => SecureAISettings;
  generatePlot: (request: PlotGenerationRequest) => Promise<{ success: boolean; data?: PlotGenerationResponse; error?: string }>;
  developCharacterArc: (request: CharacterArcRequest) => Promise<{ success: boolean; data?: CharacterArcResponse; error?: string }>;
  analyzeStyleTone: (request: StyleToneAnalysisRequest) => Promise<{ success: boolean; data?: StyleToneAnalysisResponse; error?: string }>;
  getEmbeddings: (texts: string[], model?: string) => Promise<{ success: boolean; data?: number[][]; error?: string }>;
  getActiveEmbeddingModelDimension: (model?: string) => Promise<{ success: boolean; data?: number; error?: string }>;
}

interface AIPanelProps {
  aiService: AIPanelAIService;
  enhancedServiceInstance: EnhancedSecureAIService | null;
  onShowSettings: () => void;
}

const quickPrompts = [
  { title: 'Character Development', prompts: ['Create a complex backstory...', 'Develop realistic character flaws...', 'Suggest character relationships...'] },
  { title: 'Plot Development', prompts: ['Generate unexpected plot twists...', 'Create tension and conflict...', 'Develop compelling subplot ideas...'] },
  { title: 'World Building', prompts: ['Create detailed setting descriptions...', 'Develop unique cultural elements...', 'Generate location names...'] },
  { title: 'Dialogue & Scenes', prompts: ['Write realistic dialogue...', 'Improve pacing and flow...', 'Add sensory details...'] }
];

export function AIPanel(props: AIPanelProps) {
  const { aiService: contextActions, enhancedServiceInstance, onShowSettings } = props;

  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [error, setError] = useState('');

  const [plotGenerationPrompt, setPlotGenerationPrompt] = useState('');
  const [generatedPlot, setGeneratedPlot] = useState<PlotGenerationResponse | null>(null);
  const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
  const [plotGenerationError, setPlotGenerationError] = useState('');

  const [characterArcPrompt, setCharacterArcPrompt] = useState('');
  const [characterNameForArc, setCharacterNameForArc] = useState('');
  const [generatedCharacterArc, setGeneratedCharacterArc] = useState<CharacterArcResponse | null>(null);
  const [isGeneratingCharacterArc, setIsGeneratingCharacterArc] = useState(false);
  const [characterArcError, setCharacterArcError] = useState('');

  const [textToAnalyze, setTextToAnalyze] = useState('');
  const [referenceTexts, setReferenceTexts] = useState('');
  const [desiredStyle, setDesiredStyle] = useState('');
  const [desiredTone, setDesiredTone] = useState('');
  const [styleToneAnalysisResult, setStyleToneAnalysisResult] = useState<StyleToneAnalysisResponse & { similarSnippets?: TextChunk[] } | null>(null);
  const [isAnalyzingStyleTone, setIsAnalyzingStyleTone] = useState(false);
  const [styleToneAnalysisError, setStyleToneAnalysisError] = useState('');

  const [lanceDBService, setLanceDBService] = useState<LanceDBService | null>(null);
  const [lanceDBStatus, setLanceDBStatus] = useState<string>('Awaiting AI Provider...');
  const [lanceDBError, setLanceDBError] = useState<string>('');
  const [addedReferenceTextIds, setAddedReferenceTextIds] = useState(new Set<string>());

  const settings = contextActions.getSettings();
  const activeProvider = AI_PROVIDERS.find(p => p.id === settings.defaultProvider);
  const providerConfig = settings.providers[settings.defaultProvider];
  const isProviderConfigured = providerConfig?.isEnabled && 
    (!activeProvider?.requiresApiKey || providerConfig?.apiKey);

  React.useEffect(() => {
    let isMounted = true;
    if (enhancedServiceInstance && isProviderConfigured && !lanceDBService && !lanceDBError &&
        lanceDBStatus !== 'Initializing...' && lanceDBStatus !== 'Fetching dimension...' && lanceDBStatus !== 'LanceDB Initialized') {
      const initLanceDB = async () => {
        if (!isMounted) return;
        setLanceDBStatus('Fetching dimension...');
        try {
          const currentProviderSettings = contextActions.getSettings().providers[contextActions.getSettings().defaultProvider];
          const selectedModelName = currentProviderSettings?.selectedEmbeddingModel;
          const dimensionResult = await contextActions.getActiveEmbeddingModelDimension(selectedModelName);
          if (!isMounted) return;
          if (!dimensionResult.success || typeof dimensionResult.data !== 'number') {
            throw new Error(dimensionResult.error || 'Failed to get embedding dimension.');
          }
          const dimension = dimensionResult.data;
          setLanceDBStatus('Initializing...');
          const service = new LanceDBService(enhancedServiceInstance, dimension);
          await service.initialize();
          if (!isMounted) return;
          setLanceDBService(service);
          setLanceDBStatus('LanceDB Initialized');
          setLanceDBError('');
        } catch (err) {
          if (!isMounted) return;
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error('Failed to init LanceDBService:', errorMessage);
          setLanceDBError(`Failed: ${errorMessage}`);
          setLanceDBStatus('Initialization Failed');
        }
      };
      initLanceDB();
    }
    return () => { isMounted = false; };
  }, [contextActions, enhancedServiceInstance, isProviderConfigured, lanceDBService, lanceDBStatus, lanceDBError]);

  const handleGenerate = async (promptText: string, type: string = 'custom') => {
    if (!promptText.trim()) return;
    setIsGenerating(true); setError(''); setGeneratedContent('');
    try {
      const request: EnhancedAIRequest = { prompt: promptText.trim(), type };
      const result = await contextActions.generateContent(request);
      if (result.success && result.data) setGeneratedContent(result.data.content);
      else setError(result.error || 'Failed to generate content.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage); console.error('AI generation process failed:', err);
    } finally { setIsGenerating(false); }
  };

  const handleGeneratePlot = async () => {
    if (!plotGenerationPrompt.trim()) return;
    setIsGeneratingPlot(true); setPlotGenerationError(''); setGeneratedPlot(null);
    try {
      const request: PlotGenerationRequest = {
        prompt: plotGenerationPrompt.trim(), existingPlotSummary: plotGenerationPrompt.trim(), type: 'plot-generation',
      };
      const result = await contextActions.generatePlot(request);
      if (result.success && result.data) setGeneratedPlot(result.data);
      else setPlotGenerationError(result.error || 'Failed to generate plot.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setPlotGenerationError(errorMessage); console.error('AI plot generation process failed:', err);
    } finally { setIsGeneratingPlot(false); }
  };

  const handleDevelopCharacterArc = async () => {
    if (!characterArcPrompt.trim()) return;
    setIsGeneratingCharacterArc(true); setCharacterArcError(''); setGeneratedCharacterArc(null);
    try {
      const request: CharacterArcRequest = {
        prompt: `Develop a character arc for ${characterNameForArc || 'the character'}. Details: ${characterArcPrompt.trim()}`,
        characterId: characterNameForArc.trim() || undefined, type: 'character-arc-development',
      };
      const result = await contextActions.developCharacterArc(request);
      if (result.success && result.data) setGeneratedCharacterArc(result.data);
      else setCharacterArcError(result.error || 'Failed to develop character arc.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setCharacterArcError(errorMessage); console.error('AI character arc development process failed:', err);
    } finally { setIsGeneratingCharacterArc(false); }
  };

  const handleAnalyzeStyleTone = async () => {
    if (!textToAnalyze.trim()) return;
    setIsAnalyzingStyleTone(true); setStyleToneAnalysisError('');
    let similarDocs: TextChunk[] = []; let lanceError = '';

    if (!lanceDBService) {
      setStyleToneAnalysisError('LanceDB is not initialized.'); setIsAnalyzingStyleTone(false); return;
    }

    const currentReferenceTexts = referenceTexts.trim() ? referenceTexts.split('\n').map(t => t.trim()).filter(t => t) : [];
    if (currentReferenceTexts.length > 0) {
      setLanceDBStatus('Adding references...');
      const newAddedIds = new Set(addedReferenceTextIds); let newTextsAddedCount = 0;
      try {
        for (const refText of currentReferenceTexts) {
          const textId = refText;
          if (!addedReferenceTextIds.has(textId)) {
            await lanceDBService.addText(refText, `ref_snippet_${newAddedIds.size + 1}`);
            newAddedIds.add(textId); newTextsAddedCount++;
          }
        }
        if (newTextsAddedCount > 0) setAddedReferenceTextIds(newAddedIds);
        setLanceDBStatus('LanceDB Initialized');
      } catch (dbError) {
        const msg = dbError instanceof Error ? dbError.message : String(dbError);
        console.error('Error adding reference texts to LanceDB:', msg);
        lanceError += `Error adding reference texts: ${msg}\n`;
        setLanceDBStatus('Error adding references');
      }
    }

    if (lanceDBService) {
      try {
        similarDocs = await lanceDBService.searchSimilarTexts(textToAnalyze.trim(), 3);
      } catch (dbError) {
        const msg = dbError instanceof Error ? dbError.message : String(dbError);
        console.error('Error searching similar texts in LanceDB:', msg);
        lanceError += `Error searching similar texts: ${msg}\n`;
      }
    }

    try {
      const request: StyleToneAnalysisRequest = {
        prompt: `Analyze the style and tone of the text: "${textToAnalyze.substring(0, 100)}..."`,
        textToAnalyze: textToAnalyze.trim(),
        referenceTexts: currentReferenceTexts.length > 0 ? currentReferenceTexts : undefined,
        desiredStyle: desiredStyle.trim() || undefined,
        desiredTone: desiredTone.trim() || undefined,
        type: 'style-tone-analysis',
      };
      const result = await contextActions.analyzeStyleTone(request);
      if (result.success && result.data) {
        const combinedResult: StyleToneAnalysisResponse & { similarSnippets?: TextChunk[] } = {
          ...(result.data as StyleToneAnalysisResponse),
          ...(similarDocs.length > 0 && { similarSnippets: similarDocs }),
        };
        setStyleToneAnalysisResult(combinedResult);
        if (lanceError) setStyleToneAnalysisError(prev => `${prev || ''}\n${lanceError}`.trim());
      } else {
        let currentErrors = result.error || 'Failed to analyze style/tone.';
        if (lanceError) currentErrors += `\n${lanceError}`;
        setStyleToneAnalysisError(currentErrors.trim());
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setStyleToneAnalysisError(prev => `${prev || ''}\n${errorMessage}`.trim());
      console.error('AI style/tone analysis process failed:', err);
    } finally { setIsAnalyzingStyleTone(false); }
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch (err) { console.error('Failed to copy to clipboard:', err); }
  };
  const insertIntoEditor = (content: string) => { copyToClipboard(content); };

  if (!isProviderConfigured) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2"><Bot className="w-5 h-5 text-indigo-600" /><span>AI Assistant</span></h3><button onClick={onShowSettings} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Settings className="w-4 h-4" /></button></div>
        <div className="text-center py-8"><div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><Settings className="w-8 h-8 text-gray-400" /></div><h4 className="text-lg font-medium text-gray-900 mb-2">Configure AI Providers</h4><p className="text-gray-600 mb-6 text-sm leading-relaxed">To start generating content, you need to configure at least one AI provider with a valid API key.</p><button onClick={onShowSettings} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Open Settings</button></div>
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"><div className="flex items-start space-x-3"><Zap className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" /><div><h5 className="text-sm font-medium text-blue-800">Supported Providers</h5><ul className="text-sm text-blue-700 mt-1 space-y-1"><li>• Cloud: OpenAI, Anthropic, OpenRouter, HuggingFace</li><li>• Local: Ollama, LM Studio</li></ul></div></div></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2"><Bot className="w-5 h-5 text-indigo-600" /><span>AI Assistant</span></h3><button onClick={onShowSettings} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Settings className="w-4 h-4" /></button></div>
      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"><div className="flex items-center space-x-2"><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-800">{activeProvider?.name} ({providerConfig?.selectedModel || activeProvider?.models[0]})</span></div><div className="text-xs text-green-600">{settings.temperature}°C • {settings.maxTokens} tokens</div></div>
      <div className={`p-2 rounded-lg text-xs border ${lanceDBError ? 'bg-red-50 border-red-200 text-red-700' : (lanceDBService ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-300 text-yellow-700')}`}>LanceDB Status: {lanceDBStatus} {lanceDBError && `: ${lanceDBError}`}</div>
      {error && (<div className="p-3 bg-red-50 border border-red-200 rounded-lg"><div className="flex items-start space-x-2"><AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" /><div><h4 className="text-sm font-medium text-red-800">Generation Failed</h4><p className="text-sm text-red-700 mt-1">{error}</p></div></div></div>)}
      <div><label className="block text-sm font-medium text-gray-700 mb-2">Custom Prompt</label><div className="space-y-3"><textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Enter your prompt here... Be specific about what you want the AI to help with." disabled={isGenerating} /><button onClick={() => handleGenerate(customPrompt, 'custom')} disabled={isGenerating || !customPrompt.trim()} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isGenerating ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>Generating...</span></>) : (<><Send className="w-4 h-4" /><span>Generate</span></>)}</button></div></div>
      <div><h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2"><ListTree className="w-4 h-4 text-blue-600" /><span>Plot Generation</span></h4><div className="space-y-3"><textarea value={plotGenerationPrompt} onChange={(e) => setPlotGenerationPrompt(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Enter your existing plot summary, key ideas, or themes..." disabled={isGeneratingPlot || isGenerating} /><button onClick={handleGeneratePlot} disabled={isGeneratingPlot || isGenerating || !plotGenerationPrompt.trim()} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isGeneratingPlot ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>Generating Plot...</span></>) : (<><ListTree className="w-4 h-4" /><span>Generate Plot</span></>)}</button></div>{plotGenerationError && (<div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg"><div className="flex items-start space-x-2"><AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" /><div className="text-sm text-red-700"><h4 className="font-medium text-red-800">Plot Generation Failed</h4>{plotGenerationError}</div></div></div>)}{generatedPlot && generatedPlot.suggestedPlots && (<div className="mt-4"><div className="flex items-center justify-between mb-2"><h5 className="text-sm font-semibold text-gray-900">Suggested Plots</h5><button onClick={() => copyToClipboard(generatedPlot.suggestedPlots?.map(p => p.summary).join('\n\n') || '')} className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded flex items-center space-x-1"><Copy className="w-3 h-3" /><span>Copy All</span></button></div><div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-64 overflow-y-auto space-y-3">{generatedPlot.suggestedPlots.map((plot, index) => (<div key={index} className="border-b border-gray-200 pb-2 mb-2 last:border-b-0 last:pb-0 last:mb-0"><h6 className="text-xs font-semibold text-gray-800 mb-1">Plot Option {index + 1}</h6><pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{plot.summary}</pre>{plot.potentialStoryArcs && plot.potentialStoryArcs.length > 0 && (<div className="mt-1"><p className="text-xs font-medium text-gray-600">Story Arcs:</p><ul className="list-disc list-inside pl-2 text-xs text-gray-600">{plot.potentialStoryArcs.map((arc, arcIdx) => <li key={arcIdx}>{arc}</li>)}</ul></div>)}{plot.keyTurningPoints && plot.keyTurningPoints.length > 0 && (<div className="mt-1"><p className="text-xs font-medium text-gray-600">Turning Points:</p><ul className="list-disc list-inside pl-2 text-xs text-gray-600">{plot.keyTurningPoints.map((tp, tpIdx) => <li key={tpIdx}>{tp}</li>)}</ul></div>)}</div>))}</div></div>)}</div>
      <div><h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2"><Palette className="w-4 h-4 text-orange-600" /><span>Style/Tone Analysis</span></h4><div className="space-y-3"><textarea value={textToAnalyze} onChange={(e) => setTextToAnalyze(e.target.value)} rows={5} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Text to Analyze..." disabled={isAnalyzingStyleTone || isGenerating} /><textarea value={referenceTexts} onChange={(e) => setReferenceTexts(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Reference Texts (Optional, one per line)..." disabled={isAnalyzingStyleTone || isGenerating} /><input type="text" value={desiredStyle} onChange={(e) => setDesiredStyle(e.target.value)} placeholder="Desired Style (Optional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" disabled={isAnalyzingStyleTone || isGenerating} /><input type="text" value={desiredTone} onChange={(e) => setDesiredTone(e.target.value)} placeholder="Desired Tone (Optional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" disabled={isAnalyzingStyleTone || isGenerating || !lanceDBService} /><button onClick={handleAnalyzeStyleTone} disabled={isAnalyzingStyleTone || isGenerating || !textToAnalyze.trim() || !lanceDBService} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isAnalyzingStyleTone ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>Analyzing...</span></>) : (<><Palette className="w-4 h-4" /><span>Analyze Style/Tone</span></>)}</button></div>{styleToneAnalysisError && (<div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg"><div className="flex items-start space-x-2"><AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" /><div className="text-sm text-red-700"><h4 className="font-medium text-red-800">Analysis Failed</h4>{styleToneAnalysisError}</div></div></div>)}{styleToneAnalysisResult && (<div className="mt-4"><div className="flex items-center justify-between mb-2"><h5 className="text-sm font-semibold text-gray-900">Analysis Result</h5><button onClick={() => copyToClipboard(JSON.stringify(styleToneAnalysisResult, null, 2))} className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded flex items-center space-x-1"><Copy className="w-3 h-3" /><span>Copy Result</span></button></div><div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-96 overflow-y-auto space-y-3">{typeof styleToneAnalysisResult.consistencyScore === 'number' && (<div><h6 className="text-xs font-semibold text-gray-800">Consistency Score:</h6><p className="text-sm text-gray-700">{styleToneAnalysisResult.consistencyScore.toFixed(2)}</p></div>)}{styleToneAnalysisResult.feedbackOnStyle && (<div><h6 className="text-xs font-semibold text-gray-800">Feedback on Style:</h6><pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{styleToneAnalysisResult.feedbackOnStyle}</pre></div>)}{styleToneAnalysisResult.feedbackOnTone && (<div><h6 className="text-xs font-semibold text-gray-800">Feedback on Tone:</h6><pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{styleToneAnalysisResult.feedbackOnTone}</pre></div>)}{styleToneAnalysisResult.suggestionsForImprovement && styleToneAnalysisResult.suggestionsForImprovement.length > 0 && (<div><h6 className="text-xs font-semibold text-gray-800">Suggestions for Improvement:</h6><ul className="list-disc list-inside pl-2 text-sm text-gray-700 space-y-1">{styleToneAnalysisResult.suggestionsForImprovement.map((suggestion, index) => (<li key={index}>{suggestion}</li>))}</ul></div>)}{(styleToneAnalysisResult as any).similarSnippets && (styleToneAnalysisResult as any).similarSnippets.length > 0 && (<div><h6 className="text-xs font-semibold text-gray-800 mt-3">Similar Stored Snippets (from LanceDB):</h6><ul className="space-y-2">{(styleToneAnalysisResult as any).similarSnippets.map((snippet: TextChunk, index: number) => (<li key={snippet.id || index} className="p-2 border border-gray-300 rounded bg-gray-100"><p className="text-xs text-gray-600 truncate" title={snippet.text}>"{snippet.text}"</p><p className="text-xs text-gray-500">Source: {snippet.source} (Score: {snippet._score?.toFixed(3)})</p></li>))}</ul></div>)}</div></div>)}</div>
      <div><h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2"><UserCog className="w-4 h-4 text-teal-600" /><span>Character Arc Development</span></h4><div className="space-y-3"><input type="text" value={characterNameForArc} onChange={(e) => setCharacterNameForArc(e.target.value)} placeholder="Character Name (Optional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" disabled={isGeneratingCharacterArc || isGenerating} /><textarea value={characterArcPrompt} onChange={(e) => setCharacterArcPrompt(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" placeholder="Describe the character, desired arc type (e.g., redemption, fall), key motivations, or specific situations..." disabled={isGeneratingCharacterArc || isGenerating} /><button onClick={handleDevelopCharacterArc} disabled={isGeneratingCharacterArc || isGenerating || !characterArcPrompt.trim()} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isGeneratingCharacterArc ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>Developing Arc...</span></>) : (<><UserCog className="w-4 h-4" /><span>Develop Character Arc</span></>)}</button></div>{characterArcError && (<div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg"><div className="flex items-start space-x-2"><AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" /><div className="text-sm text-red-700"><h4 className="font-medium text-red-800">Character Arc Failed</h4>{characterArcError}</div></div></div>)}{generatedCharacterArc && generatedCharacterArc.suggestedArc && (<div className="mt-4"><div className="flex items-center justify-between mb-2"><h5 className="text-sm font-semibold text-gray-900">Suggested Character Arc</h5><button onClick={() => copyToClipboard(JSON.stringify(generatedCharacterArc.suggestedArc, null, 2))} className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded flex items-center space-x-1"><Copy className="w-3 h-3" /><span>Copy Arc</span></button></div><div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-80 overflow-y-auto space-y-2"><div><h6 className="text-xs font-semibold text-gray-800">Summary:</h6><pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{generatedCharacterArc.suggestedArc.arcSummary}</pre></div>{generatedCharacterArc.suggestedArc.keyDevelopmentStages && generatedCharacterArc.suggestedArc.keyDevelopmentStages.length > 0 && (<div><h6 className="text-xs font-semibold text-gray-800 mt-2">Key Development Stages:</h6><ul className="list-disc list-inside pl-2 text-sm text-gray-700 space-y-1">{generatedCharacterArc.suggestedArc.keyDevelopmentStages.map((stage, index) => (<li key={index}>{stage}</li>))}</ul></div>)}{generatedCharacterArc.suggestedArc.potentialConflicts && generatedCharacterArc.suggestedArc.potentialConflicts.length > 0 && (<div><h6 className="text-xs font-semibold text-gray-800 mt-2">Potential Conflicts:</h6><ul className="list-disc list-inside pl-2 text-sm text-gray-700 space-y-1">{generatedCharacterArc.suggestedArc.potentialConflicts.map((conflict, index) => (<li key={index}>{conflict}</li>))}</ul></div>)}{generatedCharacterArc.suggestedArc.endingResolution && (<div><h6 className="text-xs font-semibold text-gray-800 mt-2">Ending Resolution:</h6><pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{generatedCharacterArc.suggestedArc.endingResolution}</pre></div>)}</div></div>)}</div>
      <div><h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center space-x-2"><Sparkles className="w-4 h-4 text-purple-600" /><span>Quick Prompts</span></h4><div className="space-y-4">{quickPrompts.map((category, categoryIndex) => (<div key={categoryIndex}><h5 className="text-sm font-medium text-gray-700 mb-2">{category.title}</h5><div className="space-y-1">{category.prompts.map((prompt, promptIndex) => (<button key={promptIndex} onClick={() => handleGenerate(prompt, category.title.toLowerCase())} disabled={isGenerating} className="w-full text-left px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{prompt}</button>))}</div></div>))}</div></div>
      {generatedContent && (<div><div className="flex items-center justify-between mb-2"><h4 className="text-md font-semibold text-gray-900">Generated Content</h4><div className="flex space-x-1"><button onClick={() => copyToClipboard(generatedContent)} className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded flex items-center space-x-1"><Copy className="w-3 h-3" /><span>Copy</span></button><button onClick={() => insertIntoEditor(generatedContent)} className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded">Insert</button></div></div><div className="p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-64 overflow-y-auto"><pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{generatedContent}</pre></div></div>)}
      {/* Local Generation History display is removed, assuming context handles global history */}
    </div>
  );
}
