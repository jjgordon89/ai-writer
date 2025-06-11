import React, { useState } from 'react';
import { StoryArc, StoryAct, Scene, Character } from '../../types';
import { useAI } from '../../contexts/AIContext';
import { Plus, BookOpen, Play, CheckCircle, Clock, ChevronRight, ChevronDown, Users, MapPin, Edit2, Trash2, GripVertical, Sparkles } from 'lucide-react';

interface StoryArcsPanelProps {
  storyArcs: StoryArc[];
  characters: Character[];
  onAddStoryArc: (arc: Omit<StoryArc, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateStoryArc: (id: string, updates: Partial<StoryArc>) => void;
  onDeleteStoryArc: (id: string) => void;
}

const statusIcons = {
  planning: Clock,
  active: Play,
  completed: CheckCircle,
};

const statusColors = {
  planning: 'text-yellow-600 bg-yellow-100',
  active: 'text-green-600 bg-green-100',
  completed: 'text-blue-600 bg-blue-100',
};

const typeColors = {
  main: 'text-purple-600 bg-purple-100',
  subplot: 'text-indigo-600 bg-indigo-100',
  character: 'text-green-600 bg-green-100',
};

export function StoryArcsPanel({ 
  storyArcs, 
  characters,
  onAddStoryArc, 
  onUpdateStoryArc, 
  onDeleteStoryArc 
}: StoryArcsPanelProps) {
  const [selectedArc, setSelectedArc] = useState<StoryArc | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedArcs, setExpandedArcs] = useState<Set<string>>(new Set());
  const [detailView, setDetailView] = useState<{ arcId: string; actId?: string } | null>(null);

  const toggleArcExpansion = (arcId: string) => {
    const newExpanded = new Set(expandedArcs);
    if (newExpanded.has(arcId)) {
      newExpanded.delete(arcId);
    } else {
      newExpanded.add(arcId);
    }
    setExpandedArcs(newExpanded);
  };

  if (detailView) {
    const arc = storyArcs.find(a => a.id === detailView.arcId);
    if (!arc) return null;
    
    if (detailView.actId) {
      const act = arc.acts.find(a => a.id === detailView.actId);
      if (!act) return null;
      
      return (
        <ActDetailView
          arc={arc}
          act={act}
          characters={characters}
          onUpdateArc={onUpdateStoryArc}
          onBack={() => setDetailView({ arcId: arc.id })}
        />
      );
    }
    
    return (
      <ArcDetailView
        arc={arc}
        characters={characters}
        onUpdateArc={onUpdateStoryArc}
        onViewAct={(actId) => setDetailView({ arcId: arc.id, actId })}
        onBack={() => setDetailView(null)}
      />
    );
  }

  if (isCreating || selectedArc) {
    return (
      <StoryArcForm
        storyArc={selectedArc}
        characters={characters}
        onSave={(arc) => {
          if (selectedArc) {
            onUpdateStoryArc(selectedArc.id, arc);
          } else {
            onAddStoryArc(arc);
          }
          setSelectedArc(null);
          setIsCreating(false);
        }}
        onCancel={() => {
          setSelectedArc(null);
          setIsCreating(false);
        }}
        onDelete={selectedArc ? () => {
          onDeleteStoryArc(selectedArc.id);
          setSelectedArc(null);
        } : undefined}
      />
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Story Arcs</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      <div className="space-y-3">
        {storyArcs.map((arc) => {
          const StatusIcon = statusIcons[arc.status];
          const isExpanded = expandedArcs.has(arc.id);
          
          return (
            <div key={arc.id} className="bg-white rounded-lg border border-gray-200">
              <div
                className="p-3 hover:border-indigo-300 cursor-pointer transition-colors"
                onClick={() => setDetailView({ arcId: arc.id })}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleArcExpansion(arc.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    <h4 className="font-medium text-gray-900">{arc.title}</h4>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${typeColors[arc.type]}`}>
                      {arc.type}
                    </div>
                    <div className={`p-1 rounded-full ${statusColors[arc.status]}`}>
                      <StatusIcon className="w-3 h-3" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedArc(arc);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 line-clamp-2 mb-2 ml-6">
                  {arc.description || 'No description'}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 ml-6">
                  <span>{arc.acts.length} acts</span>
                  <span>{arc.characters.length} characters</span>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-3 bg-gray-50">
                  <div className="space-y-2">
                    {arc.acts.map((act, index) => (
                      <div
                        key={act.id}
                        className="flex items-center justify-between p-2 bg-white rounded border hover:border-indigo-200 cursor-pointer"
                        onClick={() => setDetailView({ arcId: arc.id, actId: act.id })}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Act {index + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{act.title}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>{act.scenes.length} scenes</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    ))}
                    
                    {arc.acts.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-2">
                        No acts defined. Click to add structure.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {storyArcs.length === 0 && (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No story arcs yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create your first story arc
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Exporting components for testing
export { StoryArcForm, ArcDetailView, ActDetailView, SceneEditor };

interface ArcDetailViewProps {
  arc: StoryArc;
  characters: Character[];
  onUpdateArc: (id: string, updates: Partial<StoryArc>) => void;
  onViewAct: (actId: string) => void;
  onBack: () => void;
}

function ArcDetailView({ arc, characters, onUpdateArc, onViewAct, onBack }: ArcDetailViewProps) {
  const { generateContent } = useAI();
  const [actStructureSuggestions, setActStructureSuggestions] = useState<{ title: string; description: string; }[] | null>(null);
  const [showActSuggestionsLoading, setShowActSuggestionsLoading] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);


  const handleSuggestActStructure = async () => {
    setShowActSuggestionsLoading(true);
    setActStructureSuggestions(null);
    setSuggestionError(null);

    const prompt = `Based on the story arc titled '${arc.title}' with description '${arc.description}', suggest a 3-act structure. For each act, provide a title and a brief one-sentence description. Return this as a JSON array of objects, where each object has 'title' and 'description' keys. Example: [{ "title": "Act 1: Setup", "description": "Introduce characters and conflict." }, { "title": "Act 2: Confrontation", "description": "Main conflict unfolds." }, { "title": "Act 3: Resolution", "description": "Conflict is resolved." }]`;

    try {
      const aiResponse = await generateContent(prompt); // Assuming generateContent takes string prompt
      if (aiResponse) {
        try {
          const parsedSuggestions = JSON.parse(aiResponse);
          if (Array.isArray(parsedSuggestions) && parsedSuggestions.every(s => s.title && s.description)) {
            setActStructureSuggestions(parsedSuggestions);
          } else {
            throw new Error("AI response is not in the expected format (array of {title, description}).");
          }
        } catch (e) {
          console.error("Error parsing AI response for act structure:", e);
          setSuggestionError("Failed to parse AI suggestions. The format was unexpected.");
          setActStructureSuggestions([]); // Indicate error by empty array or specific error state
        }
      } else {
        setSuggestionError("AI did not return any suggestions.");
        setActStructureSuggestions([]);
      }
    } catch (error) {
      console.error("Error generating act structure:", error);
      setSuggestionError("An error occurred while fetching AI suggestions.");
      setActStructureSuggestions([]);
    } finally {
      setShowActSuggestionsLoading(false);
    }
  };

  const handleAddSuggestedAct = (suggestedAct: { title: string; description: string }) => {
    const newAct: StoryAct = {
      id: Date.now().toString(),
      title: suggestedAct.title,
      description: suggestedAct.description,
      scenes: [],
      order: arc.acts.length,
    };
    onUpdateArc(arc.id, {
      acts: [...arc.acts, newAct],
    });
    // Optionally, remove the added suggestion or clear all
    // setActStructureSuggestions(prev => prev?.filter(s => s.title !== suggestedAct.title) || null);
  };

  const addAct = () => {
    const newAct: StoryAct = {
      id: Date.now().toString(),
      title: `Act ${arc.acts.length + 1}`,
      description: '',
      scenes: [],
      order: arc.acts.length
    };
    
    onUpdateArc(arc.id, {
      acts: [...arc.acts, newAct]
    });
  };

  const updateAct = (actId: string, updates: Partial<StoryAct>) => {
    const updatedActs = arc.acts.map(act =>
      act.id === actId ? { ...act, ...updates } : act
    );
    onUpdateArc(arc.id, { acts: updatedActs });
  };

  const deleteAct = (actId: string) => {
    const filteredActs = arc.acts.filter(act => act.id !== actId);
    onUpdateArc(arc.id, { acts: filteredActs });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{arc.title}</h3>
        <button
          onClick={onBack}
          className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Back
        </button>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-700 mb-2">{arc.description}</p>
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <span className={`px-2 py-1 rounded ${typeColors[arc.type]}`}>
            {arc.type}
          </span>
          <span className={`px-2 py-1 rounded ${statusColors[arc.status]}`}>
            {arc.status}
          </span>
          <span>{arc.characters.length} characters involved</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h4 className="text-md font-semibold text-gray-900">Acts Structure</h4>
        <div className="flex space-x-2">
          <button
            onClick={handleSuggestActStructure}
            disabled={showActSuggestionsLoading}
            className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            title="Suggest Act Structure with AI"
          >
            <Sparkles className="w-4 h-4" />
            <span>Suggest Acts</span>
          </button>
          <button
            onClick={addAct}
            className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Act</span>
          </button>
        </div>
      </div>

      {showActSuggestionsLoading && (
        <div className="p-4 my-4 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          Loading act structure suggestions...
        </div>
      )}

      {suggestionError && (
        <div className="p-4 my-4 text-center text-red-600 bg-red-50 rounded-lg border border-red-200">
          {suggestionError}
          <button
            onClick={() => { setSuggestionError(null); setActStructureSuggestions(null); }}
            className="ml-2 text-sm text-red-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {actStructureSuggestions && actStructureSuggestions.length > 0 && (
        <div className="p-4 my-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-md font-semibold text-purple-700">Suggested Act Structure</h5>
            <button
              onClick={() => setActStructureSuggestions(null)}
              className="text-sm text-purple-600 hover:text-purple-800"
            >
              Clear Suggestions
            </button>
          </div>
          <div className="space-y-3">
            {actStructureSuggestions.map((suggestion, index) => (
              <div key={index} className="p-3 bg-white rounded-lg border border-purple-300 shadow-sm">
                <h6 className="font-semibold text-gray-800">{suggestion.title}</h6>
                <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                <button
                  onClick={() => handleAddSuggestedAct(suggestion)}
                  className="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                >
                  Add this Act
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {arc.acts.map((act, index) => (
          <div key={act.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <h5 className="font-medium text-gray-900">Act {index + 1}: {act.title}</h5>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => onViewAct(act.id)}
                  className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteAct(act.id)}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">{act.description || 'No description'}</p>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{act.scenes.length} scenes</span>
              <button
                onClick={() => onViewAct(act.id)}
                className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800"
              >
                <span>Manage scenes</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {arc.acts.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">No acts defined</p>
            <button
              onClick={addAct}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Add First Act
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ActDetailViewProps {
  arc: StoryArc;
  act: StoryAct;
  characters: Character[];
  onUpdateArc: (id: string, updates: Partial<StoryArc>) => void;
  onBack: () => void;
}

function ActDetailView({ arc, act, characters, onUpdateArc, onBack }: ActDetailViewProps) {
  const { generateContent } = useAI();
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  // Part 1: Act Editing States
  const [isEditingAct, setIsEditingAct] = useState<boolean>(false);
  const [editableActData, setEditableActData] = useState<{ title: string; description: string; } | null>(null);
  const [previousActTitle, setPreviousActTitle] = useState<string | null>(null);
  const [previousActDescription, setPreviousActDescription] = useState<string | null>(null);

  // Part 1: AI Suggestion Handler for Act Fields
  const handleSuggestForActField = async (fieldName: 'title' | 'description') => {
    if (!editableActData) return;

    let prompt = '';
    const currentTitle = editableActData.title;
    const currentDescription = editableActData.description;

    if (fieldName === 'title') {
      prompt = `Suggest an improved or alternative act title for an act currently titled '${currentTitle}' with description '${currentDescription}'. The act is part of the story arc '${arc.title}'. New Title:`;
    } else { // description
      prompt = `Suggest an improved or alternative act description for an act titled '${currentTitle}' (current description: '${currentDescription}'). This act is part of the story arc '${arc.title}'. New Description:`;
    }

    console.log(`Generating suggestion for act ${fieldName} with prompt:`, prompt);
    try {
      const aiResponse = await generateContent(prompt);
      if (aiResponse && typeof aiResponse === 'string') {
        setEditableActData(prevData => {
          if (!prevData) return null;
          if (fieldName === 'title') {
            setPreviousActTitle(prevData.title);
            return { ...prevData, title: aiResponse };
          } else {
            setPreviousActDescription(prevData.description);
            return { ...prevData, description: aiResponse };
          }
        });
      } else {
        console.log("AI did not return a valid suggestion.");
      }
    } catch (error) {
      console.error(`Error generating ${fieldName} for act:`, error);
    }
  };

  // Part 1: Undo Handler for Act Fields
  const handleUndoForActField = (fieldName: 'title' | 'description') => {
    setEditableActData(prevData => {
      if (!prevData) return null;
      if (fieldName === 'title' && previousActTitle !== null) {
        setPreviousActTitle(null);
        return { ...prevData, title: previousActTitle };
      }
      if (fieldName === 'description' && previousActDescription !== null) {
        setPreviousActDescription(null);
        return { ...prevData, description: previousActDescription };
      }
      return prevData;
    });
  };

  // Part 1: Save/Cancel for Act Edit Form
  const handleSaveActChanges = () => {
    if (editableActData) {
      const updatedActs = arc.acts.map(a =>
        a.id === act.id ? { ...a, ...editableActData } : a
      );
      onUpdateArc(arc.id, { acts: updatedActs });
    }
    setIsEditingAct(false);
    setEditableActData(null);
    setPreviousActTitle(null);
    setPreviousActDescription(null);
  };

  const handleCancelActEdit = () => {
    setIsEditingAct(false);
    setEditableActData(null);
    setPreviousActTitle(null);
    setPreviousActDescription(null);
  };


  // Part 2: Scene Ideas States (will be implemented next)
  const [sceneIdeasSuggestions, setSceneIdeasSuggestions] = useState<{ idea: string; }[] | null>(null);
  const [showSceneIdeasLoading, setShowSceneIdeasLoading] = useState<boolean>(false);
  const [sceneIdeasError, setSceneIdeasError] = useState<string | null>(null);

  const handleSuggestSceneIdeas = async () => {
    setShowSceneIdeasLoading(true);
    setSceneIdeasSuggestions(null);
    setSceneIdeasError(null);

    const prompt = `For a story act titled '${act.title}' (which is part of story arc '${arc.title}'), suggest 5 brief, distinct scene ideas or key events that could occur within this act. Return as a JSON array of objects, where each object has an 'idea' key. For example: [{ "idea": "Character A confronts Character B." }, {"idea": "A mysterious artifact is discovered."}, {"idea": "A chase sequence through the city."} , {"idea": "A quiet moment of reflection for the protagonist."}, {"idea": "A shocking betrayal is revealed."}]`;

    try {
      const aiResponse = await generateContent(prompt);
      if (aiResponse && typeof aiResponse === 'string') {
        try {
          const parsedIdeas = JSON.parse(aiResponse);
          if (Array.isArray(parsedIdeas) && parsedIdeas.every(item => typeof item.idea === 'string')) {
            setSceneIdeasSuggestions(parsedIdeas);
          } else {
            throw new Error("AI response is not in the expected format (array of {idea: string}).");
          }
        } catch (e) {
          console.error("Error parsing AI response for scene ideas:", e);
          setSceneIdeasError("Failed to parse AI suggestions for scene ideas. The format was unexpected.");
          setSceneIdeasSuggestions([]);
        }
      } else {
        setSceneIdeasError("AI did not return any scene ideas.");
        setSceneIdeasSuggestions([]);
      }
    } catch (error) {
      console.error("Error generating scene ideas:", error);
      setSceneIdeasError("An error occurred while fetching AI suggestions for scene ideas.");
      setSceneIdeasSuggestions([]);
    } finally {
      setShowSceneIdeasLoading(false);
    }
  };

  const handleAddSuggestedSceneIdea = (ideaText: string) => {
    const newScene: Scene = {
      id: Date.now().toString(),
      title: ideaText.substring(0, 50) + (ideaText.length > 50 ? "..." : ""), // Truncate for title
      description: ideaText,
      characters: [],
      location: '',
      notes: 'AI Suggested Idea',
      order: act.scenes.length,
    };

    const updatedAct = { ...act, scenes: [...act.scenes, newScene] };
    const updatedActs = arc.acts.map(a => (a.id === act.id ? updatedAct : a));
    onUpdateArc(arc.id, { acts: updatedActs });
    // Optionally clear or filter sceneIdeasSuggestions here
  };

  const addScene = () => {
    const newScene: Scene = {
      id: Date.now().toString(),
      title: `Scene ${act.scenes.length + 1}`,
      description: '',
      characters: [],
      location: '',
      notes: '',
      order: act.scenes.length
    };

    const updatedAct = {
      ...act,
      scenes: [...act.scenes, newScene]
    };

    const updatedActs = arc.acts.map(a => a.id === act.id ? updatedAct : a);
    onUpdateArc(arc.id, { acts: updatedActs });
  };

  const updateScene = (sceneId: string, updates: Partial<Scene>) => {
    const updatedScenes = act.scenes.map(scene =>
      scene.id === sceneId ? { ...scene, ...updates } : scene
    );

    const updatedAct = { ...act, scenes: updatedScenes };
    const updatedActs = arc.acts.map(a => a.id === act.id ? updatedAct : a);
    onUpdateArc(arc.id, { acts: updatedActs });
  };

  const deleteScene = (sceneId: string) => {
    const filteredScenes = act.scenes.filter(scene => scene.id !== sceneId);
    const updatedAct = { ...act, scenes: filteredScenes };
    const updatedActs = arc.acts.map(a => a.id === act.id ? updatedAct : a);
    onUpdateArc(arc.id, { acts: updatedActs });
  };

  return (
    <div className="p-4">
      {isEditingAct && editableActData ? (
        <div className="mb-6 p-4 bg-white border border-indigo-300 rounded-lg shadow-md">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Edit Act Details</h4>
          <div className="space-y-3">
            {/* Title Editing */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="act-edit-title" className="block text-sm font-medium text-gray-700">Title</label>
                <div className="flex items-center space-x-2">
                  {previousActTitle !== null && (
                    <button type="button" onClick={() => handleUndoForActField('title')} className="text-xs text-gray-500 hover:text-gray-700">Undo</button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSuggestForActField('title')}
                    className="p-1 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                    title="Suggest Title with AI"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <input
                id="act-edit-title"
                type="text"
                value={editableActData.title}
                onChange={(e) => {
                  setEditableActData({ ...editableActData, title: e.target.value });
                  if (previousActTitle !== null) setPreviousActTitle(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {/* Description Editing */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="act-edit-description" className="block text-sm font-medium text-gray-700">Description</label>
                <div className="flex items-center space-x-2">
                  {previousActDescription !== null && (
                    <button type="button" onClick={() => handleUndoForActField('description')} className="text-xs text-gray-500 hover:text-gray-700">Undo</button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSuggestForActField('description')}
                    className="p-1 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                    title="Suggest Description with AI"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <textarea
                id="act-edit-description"
                value={editableActData.description}
                onChange={(e) => {
                  setEditableActData({ ...editableActData, description: e.target.value });
                  if (previousActDescription !== null) setPreviousActDescription(null);
                }}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <button onClick={handleCancelActEdit} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleSaveActChanges} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{act.title}</h3>
              <button
                onClick={() => {
                  setIsEditingAct(true);
                  setEditableActData({ title: act.title, description: act.description });
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 mt-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit Act Details</span>
              </button>
            </div>
            <button
              onClick={onBack}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Back to Arc
            </button>
          </div>
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">{act.description}</p>
          </div>
        </>
      )}

      <div className="flex items-center justify-between mb-4">
        <h4 className="text-md font-semibold text-gray-900">Scenes</h4>
        <div className="flex space-x-2">
          <button
            onClick={handleSuggestSceneIdeas}
            disabled={showSceneIdeasLoading}
            className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            title="Suggest Scene Ideas with AI"
          >
            <Sparkles className="w-4 h-4" />
            <span>Suggest Ideas</span>
          </button>
          <button
            onClick={addScene}
            className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Scene</span>
          </button>
        </div>
      </div>

      {/* Display Scene Ideas Suggestions */}
      {showSceneIdeasLoading && (
        <div className="p-4 my-4 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          Loading scene ideas...
        </div>
      )}

      {sceneIdeasError && (
        <div className="p-4 my-4 text-center text-red-600 bg-red-50 rounded-lg border border-red-200">
          {sceneIdeasError}
          <button
            onClick={() => { setSceneIdeasError(null); setSceneIdeasSuggestions(null); }}
            className="ml-2 text-sm text-red-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {sceneIdeasSuggestions && sceneIdeasSuggestions.length > 0 && (
        <div className="p-4 my-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-md font-semibold text-purple-700">Suggested Scene Ideas</h5>
            <button
              onClick={() => setSceneIdeasSuggestions(null)}
              className="text-sm text-purple-600 hover:text-purple-800"
            >
              Clear Ideas
            </button>
          </div>
          <div className="space-y-2">
            {sceneIdeasSuggestions.map((suggestion, index) => (
              <div key={index} className="p-3 bg-white rounded-lg border border-purple-300 shadow-sm flex items-center justify-between">
                <p className="text-sm text-gray-700 flex-1 mr-2">{suggestion.idea}</p>
                <button
                  onClick={() => handleAddSuggestedSceneIdea(suggestion.idea)}
                  className="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors whitespace-nowrap"
                >
                  Add as New Scene
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {act.scenes.map((scene, index) => (
          <div key={scene.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <h5 className="font-medium text-gray-900">Scene {index + 1}: {scene.title}</h5>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => setEditingScene(scene)}
                  className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteScene(scene.id)}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">{scene.description || 'No description'}</p>
            
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <MapPin className="w-3 h-3" />
                <span>{scene.location || 'No location'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>{scene.characters.length} characters</span>
              </div>
            </div>
          </div>
        ))}

        {act.scenes.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <Play className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">No scenes defined</p>
            <button
              onClick={addScene}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Add First Scene
            </button>
          </div>
        )}
      </div>

      {editingScene && (
        <SceneEditor
          scene={editingScene}
          characters={characters}
          onSave={(updates) => {
            updateScene(editingScene.id, updates);
            setEditingScene(null);
          }}
          onCancel={() => setEditingScene(null)}
        />
      )}
    </div>
  );
}

interface SceneEditorProps {
  scene: Scene;
  characters: Character[];
  onSave: (updates: Partial<Scene>) => void;
  onCancel: () => void;
}

function SceneEditor({ scene, characters, onSave, onCancel }: SceneEditorProps) {
  const { generateContent } = useAI();
  const [formData, setFormData] = useState({
    title: scene.title,
    description: scene.description,
    location: scene.location,
    characters: scene.characters,
    notes: scene.notes,
  });

  const [previousSceneTitle, setPreviousSceneTitle] = useState<string | null>(null);
  const [previousSceneDescription, setPreviousSceneDescription] = useState<string | null>(null);
  const [previousSceneLocation, setPreviousSceneLocation] = useState<string | null>(null);
  const [previousSceneNotes, setPreviousSceneNotes] = useState<string | null>(null);

  const characterNames = formData.characters
    .map(id => characters.find(c => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  const handleSuggestForSceneField = async (fieldName: 'title' | 'description' | 'location' | 'notes') => {
    let prompt = '';
    let currentValue = formData[fieldName];

    switch (fieldName) {
      case 'title':
        prompt = `Suggest an improved or alternative scene title for a scene currently titled '${formData.title}'.
Scene Description: ${formData.description}
Location: ${formData.location}
Characters: ${characterNames || 'None specified'}
Current Notes: ${formData.notes}
New Title Suggestion:`;
        break;
      case 'description':
        prompt = `Suggest an improved or alternative scene description.
Scene Title: '${formData.title}'
Location: ${formData.location}
Characters: ${characterNames || 'None specified'}
Current Description: ${currentValue}
Current Notes: ${formData.notes}
New Description Suggestion:`;
        break;
      case 'location':
        prompt = `Suggest a more vivid or appropriate scene location.
Scene Title: '${formData.title}'
Description: ${formData.description}
Characters: ${characterNames || 'None specified'}
Current Location: ${currentValue}
Current Notes: ${formData.notes}
New Location Suggestion:`;
        break;
      case 'notes':
        prompt = `Suggest additional notes or expand on existing notes for the scene.
Scene Title: '${formData.title}'
Description: ${formData.description}
Location: ${formData.location}
Characters: ${characterNames || 'None specified'}
Current Notes: ${currentValue}
New/Expanded Notes Suggestion:`;
        break;
    }

    console.log(`Generating suggestion for scene ${fieldName} with prompt:`, prompt);
    try {
      const aiResponse = await generateContent(prompt);
      if (aiResponse && typeof aiResponse === 'string') {
        if (fieldName === 'title') setPreviousSceneTitle(currentValue);
        else if (fieldName === 'description') setPreviousSceneDescription(currentValue);
        else if (fieldName === 'location') setPreviousSceneLocation(currentValue);
        else if (fieldName === 'notes') setPreviousSceneNotes(currentValue);
        setFormData({ ...formData, [fieldName]: aiResponse });
      } else {
        console.log(`AI did not return a valid suggestion for ${fieldName}.`);
      }
    } catch (error) {
      console.error(`Error generating ${fieldName} for scene:`, error);
    }
  };

  const handleUndoForSceneField = (fieldName: 'title' | 'description' | 'location' | 'notes') => {
    let previousValue: string | null = null;
    if (fieldName === 'title') { previousValue = previousSceneTitle; setPreviousSceneTitle(null); }
    else if (fieldName === 'description') { previousValue = previousSceneDescription; setPreviousSceneDescription(null); }
    else if (fieldName === 'location') { previousValue = previousSceneLocation; setPreviousSceneLocation(null); }
    else if (fieldName === 'notes') { previousValue = previousSceneNotes; setPreviousSceneNotes(null); }

    if (previousValue !== null) {
      setFormData({ ...formData, [fieldName]: previousValue });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const toggleCharacter = (characterId: string) => {
    const updated = formData.characters.includes(characterId)
      ? formData.characters.filter(id => id !== characterId)
      : [...formData.characters, characterId];
    setFormData({ ...formData, characters: updated });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Edit Scene</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          {/* Title Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="scene-title" className="block text-sm font-medium text-gray-700">Title</label>
              <div className="flex items-center space-x-2">
                {previousSceneTitle !== null && (
                  <button type="button" onClick={() => handleUndoForSceneField('title')} className="text-xs text-gray-500 hover:text-gray-700">Undo</button>
                )}
                <button
                  type="button"
                  onClick={() => handleSuggestForSceneField('title')}
                  className="p-1 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                  title="Suggest Title with AI"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
            <input
              id="scene-title"
              type="text"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                if (previousSceneTitle !== null) setPreviousSceneTitle(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Location Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="scene-location" className="block text-sm font-medium text-gray-700">Location</label>
              <div className="flex items-center space-x-2">
                {previousSceneLocation !== null && (
                  <button type="button" onClick={() => handleUndoForSceneField('location')} className="text-xs text-gray-500 hover:text-gray-700">Undo</button>
                )}
                <button
                  type="button"
                  onClick={() => handleSuggestForSceneField('location')}
                  className="p-1 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                  title="Suggest Location with AI"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
            <input
              id="scene-location"
              type="text"
              value={formData.location}
              onChange={(e) => {
                setFormData({ ...formData, location: e.target.value });
                if (previousSceneLocation !== null) setPreviousSceneLocation(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Where does this scene take place?"
            />
          </div>

          {/* Description Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="scene-description" className="block text-sm font-medium text-gray-700">Description</label>
              <div className="flex items-center space-x-2">
                {previousSceneDescription !== null && (
                  <button type="button" onClick={() => handleUndoForSceneField('description')} className="text-xs text-gray-500 hover:text-gray-700">Undo</button>
                )}
                <button
                  type="button"
                  onClick={() => handleSuggestForSceneField('description')}
                  className="p-1 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                  title="Suggest Description with AI"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
            <textarea
              id="scene-description"
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                if (previousSceneDescription !== null) setPreviousSceneDescription(null);
              }}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="What happens in this scene?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Characters in Scene</label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {characters.map(character => (
                <label key={character.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.characters.includes(character.id)}
                    onChange={() => toggleCharacter(character.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{character.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="scene-notes" className="block text-sm font-medium text-gray-700">Notes</label>
              <div className="flex items-center space-x-2">
                {previousSceneNotes !== null && (
                  <button type="button" onClick={() => handleUndoForSceneField('notes')} className="text-xs text-gray-500 hover:text-gray-700">Undo</button>
                )}
                <button
                  type="button"
                  onClick={() => handleSuggestForSceneField('notes')}
                  className="p-1 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                  title="Suggest Notes with AI"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
            <textarea
              id="scene-notes"
              value={formData.notes}
              onChange={(e) => {
                setFormData({ ...formData, notes: e.target.value });
                if (previousSceneNotes !== null) setPreviousSceneNotes(null);
              }}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Additional notes about this scene..."
            />
          </div>
        </form>

        <div className="flex justify-end space-x-3 p-4 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Save Scene
          </button>
        </div>
      </div>
    </div>
  );
}

interface StoryArcFormProps {
  storyArc: StoryArc | null;
  characters: Character[];
  onSave: (arc: Omit<StoryArc, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function StoryArcForm({ storyArc, characters, onSave, onCancel, onDelete }: StoryArcFormProps) {
  const { generateContent } = useAI();
  const [formData, setFormData] = useState({
    title: storyArc?.title || '',
    type: storyArc?.type || 'subplot' as const,
    description: storyArc?.description || '',
    status: storyArc?.status || 'planning' as const,
    notes: storyArc?.notes || '',
    characters: storyArc?.characters || [],
  });

  const [previousTitle, setPreviousTitle] = useState<string | null>(null);
  const [previousDescription, setPreviousDescription] = useState<string | null>(null);
  const [previousNotes, setPreviousNotes] = useState<string | null>(null);

  const handleSuggestForArcField = async (fieldName: 'title' | 'description' | 'notes') => {
    let prompt = '';
    let currentValue = '';

    switch (fieldName) {
      case 'title':
        currentValue = formData.title;
        prompt = `Generate a compelling story arc title.
Existing Type: ${formData.type}
Existing Description: ${formData.description}
Existing Notes: ${formData.notes}
Current Title (if any): ${currentValue}
New Title Suggestion:`;
        break;
      case 'description':
        currentValue = formData.description;
        prompt = `Generate a compelling story arc description based on the following details:
Title: ${formData.title}
Type: ${formData.type}
Notes: ${formData.notes}
Existing Description (if any): ${currentValue}
New Description:`;
        break;
      case 'notes':
        currentValue = formData.notes;
        prompt = `Suggest additional notes or expand on existing notes for a story arc:
Title: ${formData.title}
Type: ${formData.type}
Description: ${formData.description}
Existing Notes (if any): ${currentValue}
New/Expanded Notes:`;
        break;
    }

    console.log(`Generating suggestion for ${fieldName} with prompt:`, prompt);
    try {
      const aiResponse = await generateContent(prompt); // Assuming generateContent takes string prompt
      if (aiResponse) {
        if (fieldName === 'title') {
          setPreviousTitle(currentValue);
          setFormData({ ...formData, title: aiResponse });
        } else if (fieldName === 'description') {
          setPreviousDescription(currentValue);
          setFormData({ ...formData, description: aiResponse });
        } else if (fieldName === 'notes') {
          setPreviousNotes(currentValue);
          setFormData({ ...formData, notes: aiResponse });
        }
      } else {
        console.log("AI did not return a suggestion.");
      }
    } catch (error) {
      console.error(`Error generating ${fieldName} for story arc:`, error);
      // Optionally, show an error message to the user
    }
  };

  const handleUndoForArcField = (fieldName: 'title' | 'description' | 'notes') => {
    if (fieldName === 'title' && previousTitle !== null) {
      setFormData({ ...formData, title: previousTitle });
      setPreviousTitle(null);
    } else if (fieldName === 'description' && previousDescription !== null) {
      setFormData({ ...formData, description: previousDescription });
      setPreviousDescription(null);
    } else if (fieldName === 'notes' && previousNotes !== null) {
      setFormData({ ...formData, notes: previousNotes });
      setPreviousNotes(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      acts: storyArc?.acts || [],
    });
  };

  const toggleCharacter = (characterId: string) => {
    const updated = formData.characters.includes(characterId)
      ? formData.characters.filter(id => id !== characterId)
      : [...formData.characters, characterId];
    setFormData({ ...formData, characters: updated });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {storyArc ? 'Edit Story Arc' : 'New Story Arc'}
        </h3>
        <div className="flex space-x-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
            >
              Delete
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-3 py-1 text-gray-600 hover:bg-gray-50 rounded"
          >
            Cancel
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="arc-title" className="block text-sm font-medium text-gray-700">Title</label>
            <div className="flex items-center space-x-2">
              {previousTitle !== null && (
                <button
                  type="button"
                  onClick={() => handleUndoForArcField('title')}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSuggestForArcField('title')}
                className="p-1 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                title="Suggest Title with AI"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
          <input
            id="arc-title"
            type="text"
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.target.value });
              if (previousTitle !== null) setPreviousTitle(null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="main">Main Plot</option>
              <option value="subplot">Subplot</option>
              <option value="character">Character Arc</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="arc-description" className="block text-sm font-medium text-gray-700">Description</label>
            <div className="flex items-center space-x-2">
              {previousDescription !== null && (
                <button
                  type="button"
                  onClick={() => handleUndoForArcField('description')}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSuggestForArcField('description')}
                className="p-1 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                title="Suggest Description with AI"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
          <textarea
            id="arc-description"
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              if (previousDescription !== null) setPreviousDescription(null);
            }}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Describe the arc's purpose, conflicts, and resolution..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Involved Characters
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-3">
            {characters.map(character => (
              <label key={character.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.characters.includes(character.id)}
                  onChange={() => toggleCharacter(character.id)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{character.name}</span>
              </label>
            ))}
            {characters.length === 0 && (
              <p className="text-sm text-gray-500 col-span-2">No characters created yet</p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="arc-notes" className="block text-sm font-medium text-gray-700">Notes</label>
            <div className="flex items-center space-x-2">
              {previousNotes !== null && (
                <button
                  type="button"
                  onClick={() => handleUndoForArcField('notes')}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSuggestForArcField('notes')}
                className="p-1 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100"
                title="Suggest Notes with AI"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
          <textarea
            id="arc-notes"
            value={formData.notes}
            onChange={(e) => {
              setFormData({ ...formData, notes: e.target.value });
              if (previousNotes !== null) setPreviousNotes(null);
            }}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Additional notes, ideas, connections..."
          />
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save Story Arc
          </button>
        </div>
      </form>
    </div>
  );
}