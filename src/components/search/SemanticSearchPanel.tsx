import React, { useState, useEffect, useCallback } from 'react';
import { Search, Sparkles, BookOpen, Users, Lightbulb, Filter, X, ArrowRight } from 'lucide-react';
import { vectorDatabaseService, SearchResult, DocumentEmbedding, CharacterEmbedding } from '../../services/vectorDatabase';
import { useProjectContext } from '../../hooks/useProjectContext';
import { useAsyncErrorHandler } from '../../hooks/useAsyncErrorHandler';

interface SearchFilters {
  documentType?: 'manuscript' | 'chapter' | 'scene' | 'note' | 'character' | 'story_arc' | undefined;
  relevanceThreshold: 'low' | 'medium' | 'high';
  maxResults: number;
}

interface ContentSuggestion {
  type: 'continuation' | 'inspiration' | 'related';
  title: string;
  content: string;
  score: number;
}

export function SemanticSearchPanel() {
  const { state } = useProjectContext();
  const { wrapAsync } = useAsyncErrorHandler({ component: 'SemanticSearchPanel' });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult<DocumentEmbedding>[]>([]);
  const [characterResults, setCharacterResults] = useState<SearchResult<CharacterEmbedding>[]>([]);
  const [contentSuggestions, setContentSuggestions] = useState<ContentSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'content' | 'characters' | 'suggestions'>('content');
  const [filters, setFilters] = useState<SearchFilters>({
    relevanceThreshold: 'medium',
    maxResults: 10
  });
  const [isVectorDbConfigured, setIsVectorDbConfigured] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Check if vector database is configured
  useEffect(() => {
    const checkConfiguration = async () => {
      setIsVectorDbConfigured(vectorDatabaseService.isConfigured());
    };
    
    checkConfiguration();
  }, []);

  // Auto-search when typing stops
  useEffect(() => {
    if (!searchQuery.trim() || !isVectorDbConfigured) return;

    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchMode, filters]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !state.currentProject || !isVectorDbConfigured) return;

    await wrapAsync(async () => {
      setIsSearching(true);
      
      try {
        if (searchMode === 'content') {
          const results = await vectorDatabaseService.searchDocuments(
            searchQuery,
            state.currentProject!.id,
            filters.maxResults,
            filters.documentType
          );
          
          // Filter by relevance threshold
          const filteredResults = results.filter(r => {
            if (filters.relevanceThreshold === 'high') return r.relevance === 'high';
            if (filters.relevanceThreshold === 'medium') return r.relevance !== 'low';
            return true;
          });
          
          setSearchResults(filteredResults);
        } else if (searchMode === 'characters') {
          const results = await vectorDatabaseService.findSimilarCharacters(
            searchQuery,
            state.currentProject!.id,
            filters.maxResults
          );
          
          const filteredResults = results.filter(r => {
            if (filters.relevanceThreshold === 'high') return r.relevance === 'high';
            if (filters.relevanceThreshold === 'medium') return r.relevance !== 'low';
            return true;
          });
          
          setCharacterResults(filteredResults);
        } else if (searchMode === 'suggestions') {
          const [continuation, inspiration, related] = await Promise.all([
            vectorDatabaseService.getContentSuggestions(searchQuery, state.currentProject!.id, 'continuation', 3),
            vectorDatabaseService.getContentSuggestions(searchQuery, state.currentProject!.id, 'inspiration', 3),
            vectorDatabaseService.getContentSuggestions(searchQuery, state.currentProject!.id, 'related', 4)
          ]);
          
          const suggestions: ContentSuggestion[] = [
            ...continuation.map(r => ({
              type: 'continuation' as const,
              title: r.item.title,
              content: r.item.content,
              score: r.score
            })),
            ...inspiration.map(r => ({
              type: 'inspiration' as const,
              title: r.item.title,
              content: r.item.content,
              score: r.score
            })),
            ...related.map(r => ({
              type: 'related' as const,
              title: r.item.title,
              content: r.item.content,
              score: r.score
            }))
          ];
          
          setContentSuggestions(suggestions.sort((a, b) => b.score - a.score));
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    });
  }, [searchQuery, searchMode, filters, state.currentProject, isVectorDbConfigured, wrapAsync]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCharacterResults([]);
    setContentSuggestions([]);
  };

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'continuation': return <ArrowRight className="w-4 h-4" />;
      case 'inspiration': return <Lightbulb className="w-4 h-4" />;
      case 'related': return <BookOpen className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  if (!isVectorDbConfigured) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Semantic Search Unavailable</h3>
          <p className="text-gray-600 mb-6 text-sm leading-relaxed">
            Vector database is not configured. Please set up an OpenAI API key in settings to enable 
            AI-powered semantic search, character analysis, and content suggestions.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <h4 className="text-sm font-medium text-blue-800">Semantic Search Features</h4>
                <ul className="text-sm text-blue-700 mt-1 space-y-1">
                  <li>• Find similar content across your project</li>
                  <li>• Discover character personality matches</li>
                  <li>• Get AI-powered writing suggestions</li>
                  <li>• Analyze themes and narrative patterns</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Semantic Search</h2>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your project content, characters, or get suggestions..."
          className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Search Mode Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { key: 'content', label: 'Content', icon: BookOpen },
          { key: 'characters', label: 'Characters', icon: Users },
          { key: 'suggestions', label: 'Suggestions', icon: Lightbulb }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSearchMode(key as 'content' | 'characters' | 'suggestions')}
            className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              searchMode === key
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Type
              </label>
              <select
                value={filters.documentType || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  documentType: e.target.value ? e.target.value as SearchFilters['documentType'] : undefined
                }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                <option value="">All Types</option>
                <option value="manuscript">Manuscript</option>
                <option value="chapter">Chapter</option>
                <option value="scene">Scene</option>
                <option value="note">Note</option>
                <option value="character">Character</option>
                <option value="story_arc">Story Arc</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Relevance Threshold
              </label>
              <select
                value={filters.relevanceThreshold}
                onChange={(e) => setFilters(prev => ({ ...prev, relevanceThreshold: e.target.value as 'low' | 'medium' | 'high' }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                <option value="low">Low (All Results)</option>
                <option value="medium">Medium (Relevant)</option>
                <option value="high">High (Very Relevant)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Results
              </label>
              <select
                value={filters.maxResults}
                onChange={(e) => setFilters(prev => ({ ...prev, maxResults: parseInt(e.target.value) }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                <option value="5">5 Results</option>
                <option value="10">10 Results</option>
                <option value="20">20 Results</option>
                <option value="50">50 Results</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isSearching && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-2 text-gray-600">Searching...</span>
        </div>
      )}

      {/* Search Results */}
      {!isSearching && searchQuery && (
        <div className="space-y-4">
          {/* Content Results */}
          {searchMode === 'content' && searchResults.length > 0 && (
            <div>
              <h3 className="text-md font-medium text-gray-900 mb-3">Content Results ({searchResults.length})</h3>
              <div className="space-y-3">
                {searchResults.map((result, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{result.item.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRelevanceColor(result.relevance)}`}>
                          {result.relevance}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {Math.round(result.score)}% match
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Type: {result.item.documentType.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {result.item.content.slice(0, 200)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Character Results */}
          {searchMode === 'characters' && characterResults.length > 0 && (
            <div>
              <h3 className="text-md font-medium text-gray-900 mb-3">Similar Characters ({characterResults.length})</h3>
              <div className="space-y-3">
                {characterResults.map((result, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{result.item.name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRelevanceColor(result.relevance)}`}>
                          {result.relevance}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {Math.round(result.score)}% match
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Role: {result.item.role}
                    </p>
                    <p className="text-sm text-gray-700 mb-2">
                      {result.item.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {result.item.traits.slice(0, 5).map((trait, traitIndex) => (
                        <span key={traitIndex} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Suggestions */}
          {searchMode === 'suggestions' && contentSuggestions.length > 0 && (
            <div>
              <h3 className="text-md font-medium text-gray-900 mb-3">Writing Suggestions ({contentSuggestions.length})</h3>
              <div className="space-y-3">
                {contentSuggestions.map((suggestion, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getSuggestionIcon(suggestion.type)}
                        <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                          {suggestion.type}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {Math.round(suggestion.score)}% match
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-4">
                      {suggestion.content.slice(0, 300)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {!isSearching && searchQuery && 
           ((searchMode === 'content' && searchResults.length === 0) ||
            (searchMode === 'characters' && characterResults.length === 0) ||
            (searchMode === 'suggestions' && contentSuggestions.length === 0)) && (
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
              <p className="text-gray-600">
                Try adjusting your search query or filters to find relevant content.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}