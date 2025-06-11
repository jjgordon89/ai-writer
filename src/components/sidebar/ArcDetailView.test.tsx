import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArcDetailView } from './StoryArcsPanel'; // Assuming ArcDetailView is exported
import { StoryArc, Character, StoryAct } from '../../types';
import { useAI } from '../../contexts/AIContext';

// Mock the useAI hook
jest.mock('../../contexts/AIContext', () => ({
  useAI: jest.fn(),
}));

const mockGenerateContent = jest.fn();
const mockOnUpdateArc = jest.fn();
const mockOnViewAct = jest.fn();
const mockOnBack = jest.fn();

const mockArc: StoryArc = {
  id: 'arc1',
  title: 'The Main Quest',
  description: 'An epic journey to save the kingdom.',
  type: 'main',
  status: 'active',
  acts: [],
  characters: [],
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockCharacters: Character[] = [
    { id: 'char1', name: 'Hero', role: 'protagonist', description: '', backstory: '', traits: [], relationships: [], notes: '', createdAt: '', updatedAt: '' },
];

const defaultProps = {
  arc: mockArc,
  characters: mockCharacters,
  onUpdateArc: mockOnUpdateArc,
  onViewAct: mockOnViewAct,
  onBack: mockOnBack,
};

describe('ArcDetailView - Suggest Act Structure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAI as jest.Mock).mockReturnValue({
      generateContent: mockGenerateContent,
    });
  });

  test('renders "Suggest Act Structure with AI" button', () => {
    render(<ArcDetailView {...defaultProps} />);
    expect(screen.getByText('Suggest Acts')).toBeInTheDocument(); // Updated text
  });

  describe('AI Suggestion Flow', () => {
    test('clicking button shows loading, then suggestions on valid JSON response', async () => {
      const suggestedActs = [
        { title: 'Act 1: The Call', description: 'The hero is called to adventure.' },
        { title: 'Act 2: Trials', description: 'The hero faces many trials.' },
      ];
      mockGenerateContent.mockResolvedValue(JSON.stringify(suggestedActs));
      render(<ArcDetailView {...defaultProps} />);

      fireEvent.click(screen.getByText('Suggest Acts'));

      expect(screen.getByText('Loading act structure suggestions...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Suggested Act Structure')).toBeInTheDocument();
        expect(screen.getByText('Act 1: The Call')).toBeInTheDocument();
        expect(screen.getByText('The hero is called to adventure.')).toBeInTheDocument();
        expect(screen.getAllByText('Add this Act')).toHaveLength(suggestedActs.length);
      });
      expect(screen.queryByText('Loading act structure suggestions...')).not.toBeInTheDocument();
    });

    test('displays error message on invalid JSON response', async () => {
      mockGenerateContent.mockResolvedValue("This is not JSON");
      render(<ArcDetailView {...defaultProps} />);
      fireEvent.click(screen.getByText('Suggest Acts'));

      await waitFor(() => {
        expect(screen.getByText('Failed to parse AI suggestions. The format was unexpected.')).toBeInTheDocument();
      });
    });

    test('displays error message on AI service error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('AI Service Failure'));
      render(<ArcDetailView {...defaultProps} />);
      fireEvent.click(screen.getByText('Suggest Acts'));

      await waitFor(() => {
        expect(screen.getByText('An error occurred while fetching AI suggestions.')).toBeInTheDocument();
      });
    });
  });

  describe('Adding Suggested Act', () => {
    test('clicking "Add this Act" calls onUpdateArc with the new act', async () => {
      const suggestedActs = [{ title: 'New Suggested Act', description: 'A great new act.' }];
      mockGenerateContent.mockResolvedValue(JSON.stringify(suggestedActs));
      render(<ArcDetailView {...defaultProps} arc={{...mockArc, acts: []}} />); // Ensure no initial acts

      fireEvent.click(screen.getByText('Suggest Acts'));
      await waitFor(() => expect(screen.getByText('New Suggested Act')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Add this Act'));

      expect(mockOnUpdateArc).toHaveBeenCalledWith(
        mockArc.id,
        expect.objectContaining({
          acts: expect.arrayContaining([
            expect.objectContaining({
              title: 'New Suggested Act',
              description: 'A great new act.',
              scenes: [],
              // id and order will be generated, so not strictly checked here unless necessary
            }),
          ]),
        })
      );
      // Check if the new act has an ID and order
      const updatedActs = mockOnUpdateArc.mock.calls[0][1].acts;
      expect(updatedActs[0].id).toBeDefined();
      expect(updatedActs[0].order).toBe(0);
    });
  });

  describe('Dismiss/Clear Buttons', () => {
    test('"Clear Suggestions" button hides suggestions', async () => {
      const suggestedActs = [{ title: 'Act 1', description: 'Desc 1' }];
      mockGenerateContent.mockResolvedValue(JSON.stringify(suggestedActs));
      render(<ArcDetailView {...defaultProps} />);

      fireEvent.click(screen.getByText('Suggest Acts'));
      await waitFor(() => expect(screen.getByText('Suggested Act Structure')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Clear Suggestions'));
      expect(screen.queryByText('Suggested Act Structure')).not.toBeInTheDocument();
    });

    test('"Dismiss" button for error message hides the error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('AI Error'));
      render(<ArcDetailView {...defaultProps} />);
      fireEvent.click(screen.getByText('Suggest Acts'));

      await waitFor(() => expect(screen.getByText('An error occurred while fetching AI suggestions.')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Dismiss'));
      expect(screen.queryByText('An error occurred while fetching AI suggestions.')).not.toBeInTheDocument();
    });
  });
});
