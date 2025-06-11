import React, { useState } from 'react';
import { Character, CharacterRelationship } from '../../types';
import { useAI } from '../../contexts/AIContext';
import { Plus, Edit2, Users, Heart, Sword, User, Link, Trash2, ArrowRight } from 'lucide-react';

interface CharactersPanelProps {
  characters: Character[];
  onAddCharacter: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
  onDeleteCharacter: (id: string) => void;
}

const roleIcons = {
  protagonist: Heart,
  antagonist: Sword,
  supporting: Users,
  minor: User,
};

const roleColors = {
  protagonist: 'text-red-600 bg-red-100',
  antagonist: 'text-gray-900 bg-gray-100',
  supporting: 'text-blue-600 bg-blue-100',
  minor: 'text-gray-600 bg-gray-50',
};

export function CharactersPanel({ 
  characters, 
  onAddCharacter, 
  onUpdateCharacter, 
  onDeleteCharacter 
}: CharactersPanelProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showRelationships, setShowRelationships] = useState(false);

  const handleCreateCharacter = () => {
    const newCharacter = {
      name: 'New Character',
      role: 'supporting' as const,
      description: '',
      backstory: '',
      traits: [],
      relationships: [],
      notes: '',
    };
    onAddCharacter(newCharacter);
    setIsCreating(false);
  };

  if (showRelationships) {
    return (
      <RelationshipMapView
        characters={characters}
        onUpdateCharacter={onUpdateCharacter}
        onBack={() => setShowRelationships(false)}
      />
    );
  }

  if (isCreating || selectedCharacter) {
    return (
      <CharacterForm
        character={selectedCharacter}
        allCharacters={characters}
        onSave={(character) => {
          if (selectedCharacter) {
            onUpdateCharacter(selectedCharacter.id, character);
          } else {
            onAddCharacter(character);
          }
          setSelectedCharacter(null);
          setIsCreating(false);
        }}
        onCancel={() => {
          setSelectedCharacter(null);
          setIsCreating(false);
        }}
        onDelete={selectedCharacter ? () => {
          onDeleteCharacter(selectedCharacter.id);
          setSelectedCharacter(null);
        } : undefined}
        onUpdateCharacter={onUpdateCharacter}
      />
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Characters</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowRelationships(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Link className="w-4 h-4" />
            <span>Map</span>
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {characters.map((character) => {
          const RoleIcon = roleIcons[character.role];
          return (
            <div
              key={character.id}
              onClick={() => setSelectedCharacter(character)}
              className="p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium text-gray-900">{character.name}</h4>
                    <div className={`p-1 rounded-full ${roleColors[character.role]}`}>
                      <RoleIcon className="w-3 h-3" />
                    </div>
                    {character.relationships.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Link className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{character.relationships.length}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {character.description || 'No description'}
                  </p>
                  {character.traits.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {character.traits.slice(0, 3).map((trait, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                        >
                          {trait}
                        </span>
                      ))}
                      {character.traits.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                          +{character.traits.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Edit2 className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          );
        })}

        {characters.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No characters yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create your first character
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface RelationshipMapViewProps {
  characters: Character[];
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
  onBack: () => void;
}

function RelationshipMapView({ characters, onUpdateCharacter, onBack }: RelationshipMapViewProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Link className="w-5 h-5 text-purple-600" />
          <span>Character Relationships</span>
        </h3>
        <button
          onClick={onBack}
          className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Back
        </button>
      </div>

      <div className="space-y-4">
        {characters.map((character) => (
          <div key={character.id} className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">{character.name}</h4>
              <button
                onClick={() => setSelectedCharacter(character)}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                Edit Relationships
              </button>
            </div>
            
            {character.relationships.length > 0 ? (
              <div className="space-y-2">
                {character.relationships.map((rel, index) => {
                  const relatedCharacter = characters.find(c => c.id === rel.characterId);
                  return (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      <span className="text-gray-600">{character.name}</span>
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-900">{relatedCharacter?.name || 'Unknown'}</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        {rel.relationship}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No relationships defined</p>
            )}
          </div>
        ))}
      </div>

      {selectedCharacter && (
        <RelationshipEditor
          character={selectedCharacter}
          allCharacters={characters}
          onSave={(relationships) => {
            onUpdateCharacter(selectedCharacter.id, { relationships });
            setSelectedCharacter(null);
          }}
          onCancel={() => setSelectedCharacter(null)}
        />
      )}
    </div>
  );
}

interface RelationshipEditorProps {
  character: Character;
  allCharacters: Character[];
  onSave: (relationships: CharacterRelationship[]) => void;
  onCancel: () => void;
}

function RelationshipEditor({ character, allCharacters, onSave, onCancel }: RelationshipEditorProps) {
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([...character.relationships]);

  const addRelationship = () => {
    const availableCharacters = allCharacters.filter(
      c => c.id !== character.id && !relationships.some(r => r.characterId === c.id)
    );
    
    if (availableCharacters.length > 0) {
      setRelationships([
        ...relationships,
        {
          characterId: availableCharacters[0].id,
          relationship: '',
          description: ''
        }
      ]);
    }
  };

  const updateRelationship = (index: number, updates: Partial<CharacterRelationship>) => {
    const updated = [...relationships];
    updated[index] = { ...updated[index], ...updates };
    setRelationships(updated);
  };

  const removeRelationship = (index: number) => {
    setRelationships(relationships.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Edit Relationships for {character.name}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-4">
            {relationships.map((rel, index) => {
              const relatedCharacter = allCharacters.find(c => c.id === rel.characterId);
              return (
                <div key={index} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <select
                      value={rel.characterId}
                      onChange={(e) => updateRelationship(index, { characterId: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mr-2"
                    >
                      {allCharacters
                        .filter(c => c.id !== character.id)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <button
                      onClick={() => removeRelationship(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={rel.relationship}
                    onChange={(e) => updateRelationship(index, { relationship: e.target.value })}
                    placeholder="Relationship type (e.g., friend, enemy, sibling)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-2"
                  />
                  
                  <textarea
                    value={rel.description}
                    onChange={(e) => updateRelationship(index, { description: e.target.value })}
                    placeholder="Describe their relationship..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              );
            })}
            
            <button
              onClick={addRelationship}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              + Add Relationship
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-4 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(relationships)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Save Relationships
          </button>
        </div>
      </div>
    </div>
  );
}

interface CharacterFormProps {
  character: Character | null;
  allCharacters: Character[];
  onSave: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
}

function CharacterForm({ character, allCharacters, onSave, onCancel, onDelete }: CharacterFormProps) {
  const { generateContent } = useAI();
  const [formData, setFormData] = useState({
    name: character?.name || '',
    role: character?.role || 'supporting' as const,
    age: character?.age || undefined,
    description: character?.description || '',
    backstory: character?.backstory || '',
    traits: character?.traits.join(', ') || '',
    notes: character?.notes || '',
  });

  const [previousDescription, setPreviousDescription] = useState<string | null>(null);
  const [previousBackstory, setPreviousBackstory] = useState<string | null>(null);
  const [previousTraits, setPreviousTraits] = useState<string | null>(null);

  const handleSuggestWithAI = async (fieldName: "Description" | "Backstory" | "Traits") => {
    let prompt = `Generate a short and compelling ${fieldName.toLowerCase()} for a character named "${formData.name}", who is a ${formData.role}.`;

    // Add existing fields to the prompt for better context
    if (fieldName === "Description") {
      if (formData.backstory) prompt += `\nCharacter's current backstory: ${formData.backstory}`;
      if (formData.traits) prompt += `\nCharacter's current traits: ${formData.traits}`;
    } else if (fieldName === "Backstory") {
      if (formData.description) prompt += `\nCharacter's current description: ${formData.description}`;
      if (formData.traits) prompt += `\nCharacter's current traits: ${formData.traits}`;
    } else if (fieldName === "Traits") {
      prompt = `Suggest a comma-separated list of 3-5 traits for a character named "${formData.name}", who is a ${formData.role}.`;
      if (formData.description) prompt += `\nCharacter's current description: ${formData.description}`;
      if (formData.backstory) prompt += `\nCharacter's current backstory: ${formData.backstory}`;
    }
    if (formData.age) prompt += `\nThe character is ${formData.age} years old.`;

    console.log(`Generating ${fieldName} with prompt:`, prompt);
    try {
      const suggestion = await generateContent(prompt);
      if (suggestion) {
        if (fieldName === "Description") {
          setPreviousDescription(formData.description);
          setFormData({ ...formData, description: suggestion });
        } else if (fieldName === "Backstory") {
          setPreviousBackstory(formData.backstory);
          setFormData({ ...formData, backstory: suggestion });
        } else if (fieldName === "Traits") {
          setPreviousTraits(formData.traits);
          setFormData({ ...formData, traits: suggestion });
        }
      } else {
        console.log("AI did not return a suggestion.");
      }
    } catch (error) {
      console.error(`Error generating ${fieldName}:`, error);
      // Optionally, show an error message to the user
    }
  };

  const handleGenerateFullProfile = async () => {
    if (!formData.name || !formData.role) {
      alert("Please enter a Name and Role before generating a full profile.");
      return;
    }
    // Prompt for a JSON object
    const prompt = `Generate a full character profile for a character named "${formData.name}", who is a ${formData.role}. Return the response as a JSON object with the following keys: "description" (string), "backstory" (string), and "traits" (string, comma-separated). Example: {"description": "A brave knight", "backstory": "Born in a small village...", "traits": "brave, loyal, kind"}`;
    console.log("Generating full profile with prompt:", prompt);
    try {
      const fullProfileJSON = await generateContent(prompt);
      if (fullProfileJSON) {
        console.log("AI Generated Full Profile (Raw JSON):", fullProfileJSON);
        try {
          const parsedProfile = JSON.parse(fullProfileJSON);

          setPreviousDescription(formData.description);
          setPreviousBackstory(formData.backstory);
          setPreviousTraits(formData.traits);

          setFormData({
            ...formData,
            description: parsedProfile.description || formData.description,
            backstory: parsedProfile.backstory || formData.backstory,
            traits: parsedProfile.traits || formData.traits,
          });
        } catch (parseError) {
          console.error("Error parsing AI response JSON:", parseError);
          alert("Received an invalid format from AI. Please try again.");
        }
      } else {
        console.log("AI did not return a full profile.");
      }
    } catch (error) {
      console.error("Error generating full profile:", error);
      alert("Failed to generate full profile. Please check console for details.");
    }
  };

  const handleUndo = (fieldName: "Description" | "Backstory" | "Traits") => {
    if (fieldName === "Description" && previousDescription !== null) {
      setFormData({ ...formData, description: previousDescription });
      setPreviousDescription(null);
    } else if (fieldName === "Backstory" && previousBackstory !== null) {
      setFormData({ ...formData, backstory: previousBackstory });
      setPreviousBackstory(null);
    } else if (fieldName === "Traits" && previousTraits !== null) {
      setFormData({ ...formData, traits: previousTraits });
      setPreviousTraits(null);
    }
  };

  const handleUndoAll = () => {
    let changesMade = false;
    const newFormData = { ...formData };

    if (previousDescription !== null) {
      newFormData.description = previousDescription;
      changesMade = true;
    }
    if (previousBackstory !== null) {
      newFormData.backstory = previousBackstory;
      changesMade = true;
    }
    if (previousTraits !== null) {
      newFormData.traits = previousTraits;
      changesMade = true;
    }

    if (changesMade) {
      setFormData(newFormData);
      setPreviousDescription(null);
      setPreviousBackstory(null);
      setPreviousTraits(null);
    }
  };

  const showUndoAll = previousDescription !== null || previousBackstory !== null || previousTraits !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      traits: formData.traits.split(',').map(t => t.trim()).filter(Boolean),
      relationships: character?.relationships || [],
    });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {character ? 'Edit Character' : 'New Character'}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="protagonist">Protagonist</option>
              <option value="antagonist">Antagonist</option>
              <option value="supporting">Supporting</option>
              <option value="minor">Minor</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Age
            </label>
            <input
              type="number"
              value={formData.age || ''}
              onChange={(e) => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <div className="flex space-x-2">
              {previousDescription !== null && (
                <button
                  type="button"
                  onClick={() => handleUndo("Description")}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSuggestWithAI("Description")}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Suggest with AI
              </button>
            </div>
          </div>
          <textarea
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              // If user types, AI suggestion is stale, so clear previous state for this field
              if (previousDescription !== null) setPreviousDescription(null);
            }}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Physical appearance, personality overview..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Backstory
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Backstory
            </label>
            <div className="flex space-x-2">
              {previousBackstory !== null && (
                <button
                  type="button"
                  onClick={() => handleUndo("Backstory")}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSuggestWithAI("Backstory")}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Suggest with AI
              </button>
            </div>
          </div>
          <textarea
            value={formData.backstory}
            onChange={(e) => {
              setFormData({ ...formData, backstory: e.target.value });
              if (previousBackstory !== null) setPreviousBackstory(null);
            }}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Character history, motivations, key events..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Traits
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Traits
            </label>
            <div className="flex space-x-2">
              {previousTraits !== null && (
                <button
                  type="button"
                  onClick={() => handleUndo("Traits")}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSuggestWithAI("Traits")}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Suggest with AI
              </button>
            </div>
          </div>
          <input
            type="text"
            value={formData.traits}
            onChange={(e) => {
              setFormData({ ...formData, traits: e.target.value });
              if (previousTraits !== null) setPreviousTraits(null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="brave, stubborn, witty (separate with commas)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Additional notes, development ideas..."
          />
        </div>

        {!character && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerateFullProfile}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Generate Full Profile with AI
            </button>
          </div>
        )}

        {showUndoAll && !character && ( // Only show Undo All for new characters where profile was generated
          <div className="pt-2">
            <button
              type="button"
              onClick={handleUndoAll}
              className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Undo All AI Changes
            </button>
          </div>
        )}

        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save Character
          </button>
        </div>
      </form>
    </div>
  );
}