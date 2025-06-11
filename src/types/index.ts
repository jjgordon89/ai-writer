export enum StoryNodeType {
  IDEA = 'idea',
  SCENE = 'scene',
  CHARACTER_SKETCH = 'characterSketch',
  PLOT_POINT = 'plotPoint',
  LOCATION_SKETCH = 'locationSketch',
  NOTE = 'note',
}

export interface StoryNode {
  id: string;
  type: StoryNodeType;
  label: string;
  content?: string;
  position: { x: number; y: number };
  color?: string;
  linkedCharacterId?: string;
  linkedStoryArcId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryPlannerData {
  nodes: StoryNode[];
  edges: StoryEdge[];
  // viewport?: { x: number, y: number, zoom: number }; // Future consideration
}

export interface Character {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  age?: number;
  description: string;
  backstory: string;
  traits: string[];
  relationships: CharacterRelationship[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterRelationship {
  characterId: string;
  relationship: string;
  description: string;
}

export interface StoryArc {
  id: string;
  title: string;
  type: 'main' | 'subplot' | 'character';
  description: string;
  acts: StoryAct[];
  characters: string[];
  status: 'planning' | 'active' | 'completed';
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryAct {
  id: string;
  title: string;
  description: string;
  scenes: Scene[];
  order: number;
}

export interface Scene {
  id: string;
  title: string;
  description: string;
  characters: string[];
  location: string;
  notes: string;
  order: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  genre: string;
  targetWordCount: number;
  currentWordCount: number;
  content: string;
  characters: Character[];
  storyArcs: StoryArc[];
  storyPlannerData?: StoryPlannerData;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIProvider {
  id: string;
  name: string;
  type: 'cloud' | 'local';
  apiKey?: string;
  endpoint?: string;
  models: string[];
  isActive: boolean;
}

export interface AIPrompt {
  id: string;
  title: string;
  prompt: string;
  category: 'character' | 'plot' | 'dialogue' | 'description' | 'custom';
  isFavorite: boolean;
}