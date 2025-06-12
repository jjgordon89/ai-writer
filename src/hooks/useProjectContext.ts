import { useContext } from 'react';
import { ProjectContext } from '../contexts/ProjectContextWithDatabase';

// Custom hook to use the project context
export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}