import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SceneEditor } from './StoryArcsPanel'; // Assuming SceneEditor is exported
import { Scene, Character } from '../../types';
import { useAI } from '../../contexts/AIContext';

// Mock the useAI hook
jest.mock('../../contexts/AIContext', () => ({
  useAI: jest.fn(),
}));

const mockGenerateContent = jest.fn();
const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

const mockScene: Scene = {
  id: 'scene1',
  title: 'Opening Scene',
  description: 'The adventure begins here.',
  location: 'A Quiet Village',
  characters: ['char1'],
  notes: 'Initial notes for the scene.',
  order: 0,
};

const mockAllCharacters: Character[] = [
  { id: 'char1', name: 'Hero', role: 'protagonist', description: '', backstory: '', traits: [], relationships: [], notes: '', createdAt: '', updatedAt: '' },
  { id: 'char2', name: 'Mentor', role: 'supporting', description: '', backstory: '', traits: [], relationships: [], notes: '', createdAt: '', updatedAt: '' },
];

const defaultProps = {
  scene: mockScene,
  characters: mockAllCharacters,
  onSave: mockOnSave,
  onCancel: mockOnCancel,
};

describe('SceneEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAI as jest.Mock).mockReturnValue({
      generateContent: mockGenerateContent,
    });
  });

  // Helper to get AI and Undo buttons for a field
  const getFieldButtons = (label: RegExp) => {
    const fieldLabel = screen.getByLabelText(label);
    const parentDiv = fieldLabel.closest('div'); // This might need adjustment based on exact DOM structure
    const suggestButton = parentDiv?.parentElement?.querySelector('button[title*="Suggest"]'); // Adjust selector if needed
    const undoButton = Array.from(parentDiv?.parentElement?.querySelectorAll('button[type="button"]') || []).find(btn => btn.textContent === 'Undo');
    return { fieldLabel, parentDiv, suggestButton, undoButton };
  };

  // More precise helper after inspecting component structure from previous tasks
  const getButtonsForField = (labelText: string) => {
    const label = screen.getByLabelText(labelText);
    // Assuming the buttons are siblings of the label within a shared parent `div`
    const controlContainer = label.closest('div');
    if (!controlContainer) throw new Error(`Could not find container for label ${labelText}`);

    const suggestButton = controlContainer.querySelector('button[title*="Suggest"]');
    const undoButton = Array.from(controlContainer.querySelectorAll('button')).find(button => button.textContent === 'Undo');
    return { suggestButton, undoButton };
  };


  describe('Button Rendering', () => {
    test('renders "Suggest with AI" and "Undo" (initially hidden) for fields', () => {
      render(<SceneEditor {...defaultProps} />);

      const fields = ['Title', 'Location', 'Description', 'Notes'];
      fields.forEach(field => {
        const { suggestButton, undoButton } = getButtonsForField(field);
        expect(suggestButton).toBeInTheDocument();
        expect(undoButton).not.toBeInTheDocument();
      });
    });
  });

  describe('AI Suggestions and Undo', () => {
    const testSceneFieldAI = async (
      fieldName: 'title' | 'description' | 'location' | 'notes',
      label: string, // Exact label text
      initialValue: string,
      aiSuggestion: string
    ) => {
      render(<SceneEditor {...defaultProps} />);
      const inputElement = screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
      // Ensure initial value is set if not default from props
      if (inputElement.value !== initialValue) {
          fireEvent.change(inputElement, { target: { value: initialValue } });
      }

      const { suggestButton } = getButtonsForField(label);
      expect(suggestButton).toBeInTheDocument();

      mockGenerateContent.mockResolvedValue(aiSuggestion);
      if (suggestButton) fireEvent.click(suggestButton);

      await waitFor(() => {
        expect(mockGenerateContent).toHaveBeenCalledWith(expect.stringContaining(fieldName));
      });
      expect(inputElement).toHaveValue(aiSuggestion);

      let { undoButton: undoBtn } = getButtonsForField(label);
      expect(undoBtn).toBeInTheDocument();

      if (undoBtn) fireEvent.click(undoBtn);
      await waitFor(() => expect(inputElement).toHaveValue(initialValue));

      undoBtn = getButtonsForField(label).undoButton;
      expect(undoBtn).not.toBeInTheDocument();

      // Test typing hides Undo
      if (suggestButton) fireEvent.click(suggestButton);
      await waitFor(() => expect(inputElement).toHaveValue(aiSuggestion));
      undoBtn = getButtonsForField(label).undoButton;
      expect(undoBtn).toBeInTheDocument();

      fireEvent.change(inputElement, { target: { value: 'User typing...' } });
      undoBtn = getButtonsForField(label).undoButton;
      expect(undoBtn).not.toBeInTheDocument();
    };

    test('works for Title field', async () => {
      await testSceneFieldAI('title', 'Title', defaultProps.scene.title, 'New AI Scene Title');
    });
    test('works for Location field', async () => {
      await testSceneFieldAI('location', 'Location', defaultProps.scene.location, 'New AI Scene Location');
    });
    test('works for Description field', async () => {
      await testSceneFieldAI('description', 'Description', defaultProps.scene.description, 'New AI Scene Description');
    });
    test('works for Notes field', async () => {
      await testSceneFieldAI('notes', 'Notes', defaultProps.scene.notes, 'New AI Scene Notes');
    });

    test('prompt for description includes character names', async () => {
        render(<SceneEditor {...defaultProps} />);
        const { suggestButton } = getButtonsForField('Description');
        mockGenerateContent.mockResolvedValue("AI desc");
        if(suggestButton) fireEvent.click(suggestButton);
        await waitFor(() => {
            expect(mockGenerateContent).toHaveBeenCalledWith(expect.stringContaining("Characters: Hero"));
        });
    });
  });

  describe('onSave Interaction', () => {
    test('onSave is called with AI-modified data', async () => {
      render(<SceneEditor {...defaultProps} />);
      const { suggestButton } = getButtonsForField('Title');
      mockGenerateContent.mockResolvedValue('AI Scene Title');
      if (suggestButton) fireEvent.click(suggestButton);
      await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('AI Scene Title'));

      fireEvent.click(screen.getByText('Save Scene'));
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'AI Scene Title' }));
    });

    test('onSave is called with original data if undone', async () => {
      render(<SceneEditor {...defaultProps} />);
      const { suggestButton, undoButton: initialUndo } = getButtonsForField('Title');
      expect(initialUndo).not.toBeInTheDocument();

      mockGenerateContent.mockResolvedValue('AI Scene Title');
      if (suggestButton) fireEvent.click(suggestButton);
      await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('AI Scene Title'));

      let { undoButton } = getButtonsForField('Title');
      if (undoButton) fireEvent.click(undoButton);
      await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue(defaultProps.scene.title));

      fireEvent.click(screen.getByText('Save Scene'));
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ title: defaultProps.scene.title }));
    });
  });
});
