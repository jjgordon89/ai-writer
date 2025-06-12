export enum DateType {
  ABSOLUTE = 'absolute',
  RELATIVE = 'relative',
}

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  dateType: DateType;
  dateValue: string; // ISO string for absolute, descriptive string for relative
  endDateValue?: string; // Optional, for event duration
  linkedCharacterIds?: string[];
  linkedStoryArcIds?: string[];
  tags?: string[];
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

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
  timelineEvents?: TimelineEvent[];
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

// Template Types

export type TemplateSubEntity<T extends { id: string; createdAt: Date; updatedAt: Date }> =
  Omit<T, 'id' | 'createdAt' | 'updatedAt'> & {
    templateId?: string; // Used for internal reference within the template, e.g., for edges
  };

// For StoryPlannerData edges, we need a specific type for template edges
// as they will link nodes using templateId before actual IDs are generated.
export interface TemplateStoryEdge extends Omit<StoryEdge, 'id' | 'createdAt' | 'updatedAt' | 'sourceNodeId' | 'targetNodeId'> {
  sourceNodeTemplateId: string;
  targetNodeTemplateId: string;
}

export interface ProjectTemplate {
  templateId: string; // Unique ID for the template itself (e.g., 'fantasy-adventure-01')
  templateName: string;
  templateDescription: string;
  genre?: string;

  title?: string;
  description?: string;
  targetWordCount?: number;
  content?: string; // Initial manuscript content or outline text

  characters?: Array<TemplateSubEntity<Character> & { name: string }>; // Name is essential
  storyArcs?: Array<TemplateSubEntity<StoryArc> & { title: string }>; // Title is essential
  timelineEvents?: Array<TemplateSubEntity<TimelineEvent> & { title: string }>; // Title is essential

  storyPlannerData?: {
    nodes: Array<TemplateSubEntity<StoryNode> & { label: string }>; // Label is essential
    edges: Array<TemplateStoryEdge>;
  };

  // worldBuildingPrompts?: string[]; // Example for simple world-building guidance
}