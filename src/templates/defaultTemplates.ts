import { ProjectTemplate, DateType, StoryNodeType } from '../types'; // Adjust path as needed

export const defaultTemplates: ProjectTemplate[] = [
  {
    templateId: 'fantasy-adventure-01',
    templateName: 'Fantasy Adventure',
    templateDescription: 'A classic hero\'s journey template with a quest, a mentor, and a looming threat.',
    genre: 'Fantasy',
    title: 'The {{QuestName}} Quest', // Example placeholder, actual replacement not part of this step
    description: 'An epic fantasy adventure.',
    targetWordCount: 90000,
    content: "# Chapter 1\n\nThe journey begins...\n\n# Chapter 2\n\nMeeting the mentor...",
    characters: [
      { templateId: 'char-hero', name: 'The Chosen One', description: 'A young protagonist destined for greatness.', role: 'protagonist', backstory: 'Mysterious origins.', traits: ['Brave', 'Resourceful'], relationships: [], notes: 'Key to fulfilling the prophecy.' },
      { templateId: 'char-mentor', name: 'Wise Mentor', description: 'Guides the hero.', role: 'supporting', backstory: 'Once a great hero.', traits: ['Wise', 'Patient'], relationships: [], notes: 'Provides crucial aid.' },
      { templateId: 'char-villain', name: 'Dark Lord', description: 'The primary antagonist.', role: 'antagonist', backstory: 'Fallen from grace.', traits: ['Powerful', 'Cruel'], relationships: [], notes: 'Seeks to plunge the world into darkness.' },
    ],
    storyArcs: [
      { templateId: 'arc-call', title: 'The Call to Adventure', description: 'The hero receives their quest.' , acts: [], type: 'main', characters: ['char-hero'], status: 'planning', notes: 'Inciting incident.' },
      { templateId: 'arc-trials', title: 'Trials and Tribulations', description: 'The hero faces challenges.', acts: [], type: 'main', characters: ['char-hero', 'char-mentor'], status: 'planning', notes: 'Rising action.' },
      { templateId: 'arc-climax', title: 'Final Confrontation', description: 'The hero confronts the villain.', acts: [], type: 'main', characters: ['char-hero', 'char-mentor', 'char-villain'], status: 'planning', notes: 'Climax of the story.' },
    ],
    timelineEvents: [
      { templateId: 'event-start', title: 'Quest Begins', dateType: DateType.RELATIVE, dateValue: 'Day 1', description: 'The adventure starts.'},
    ],
    storyPlannerData: {
      nodes: [
        { templateId: 'node-hero-intro', label: 'Hero Introduction', type: StoryNodeType.SCENE, position: { x: 50, y: 50 }, content: 'Scene where the hero is introduced in their ordinary world.' },
        { templateId: 'node-mentor-meet', label: 'Meet Mentor', type: StoryNodeType.SCENE, position: { x: 250, y: 50 }, content: 'Scene where the hero meets their mentor and learns about the quest.' },
      ],
      edges: [
        { sourceNodeTemplateId: 'node-hero-intro', targetNodeTemplateId: 'node-mentor-meet', label: 'leads to' }
      ]
    }
  },
  {
    templateId: 'cozy-mystery-01',
    templateName: 'Cozy Village Mystery',
    templateDescription: 'A charming mystery set in a small, quirky village with an amateur sleuth.',
    genre: 'Mystery',
    title: 'The Case of the Missing Scone',
    description: 'A delightful cozy mystery.',
    targetWordCount: 60000,
    content: "# Chapter 1\n\nA shocking discovery disturbs the peace of Little Puddleton...",
    characters: [
      { templateId: 'char-sleuth', name: 'Amateur Sleuth', description: 'A clever local with a knack for puzzles.', role: 'protagonist', backstory: 'Runs the local bakery/bookshop.', traits: ['Observant', 'Witty'], relationships: [], notes: 'Always gets to the bottom of things.'},
      { templateId: 'char-victim', name: 'The Victim', description: 'Well-known in the village, perhaps a bit too nosy.', role: 'supporting', backstory: 'Had many friends and a few quiet enemies.', traits: ['Wealthy', 'Opinionated'], relationships: [], notes: 'Their death uncovers village secrets.'},
      { templateId: 'char-quirky', name: 'Quirky Villager', description: 'Holds a secret or a clue, perhaps the village gossip.', role: 'supporting', backstory: 'Has lived in Little Puddleton their whole life.', traits: ['Eccentric', 'Talkative'], relationships: [], notes: 'Knows more than they let on.'},
    ],
    storyArcs: [
      { templateId: 'arc-crime', title: 'The Crime', description: 'The mystery is discovered.', acts: [], type: 'main', characters: ['char-victim', 'char-sleuth'], status: 'planning', notes: 'The body is found / the valuable item is reported missing.' },
      { templateId: 'arc-investigation', title: 'Sleuth Investigates', description: 'Clues are gathered, suspects interviewed.', acts: [], type: 'main', characters: ['char-sleuth', 'char-quirky'], status: 'planning', notes: 'Red herrings and real clues emerge.' },
      { templateId: 'arc-reveal', title: 'The Culprit Revealed', description: 'The amateur sleuth unmasks the villain.', acts: [], type: 'main', characters: ['char-sleuth', 'char-villain-placeholder'], status: 'planning', notes: 'The satisfying conclusion where all is explained.' }, // Note: 'char-villain-placeholder' assumes a villain will be added/defined.
    ],
    // No timelineEvents or storyPlannerData for this template for brevity
  }
];
