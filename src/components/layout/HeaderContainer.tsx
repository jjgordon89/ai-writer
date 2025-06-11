import React, { useState } from 'react'; // Added useState
import { Header } from './Header';
import { useProject, useUI } from '../../contexts';
import { useAsyncErrorHandler } from '../../hooks/useAsyncErrorHandler';
// Removed: import { defaultTemplates } from '../../templates/defaultTemplates';
import TemplateSelectionModal from '../templates/TemplateSelectionModal'; // Adjust path
import { ProjectTemplate } from '../../types'; // Adjust path

export function HeaderContainer() {
  const { state: projectState, actions: projectActions } = useProject();
  const { actions: uiActions } = useUI();
  const { wrapAsync } = useAsyncErrorHandler({ component: 'HeaderContainer' });
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const handleSave = async () => {
    await wrapAsync(
      () => projectActions.saveProject(),
      { action: 'save-project' }
    );
  };

  const handleNewProject = () => {
    setIsTemplateModalOpen(true);
  };

  const handleTemplateSelectedInModal = (template?: ProjectTemplate) => {
    projectActions.createNewProject(undefined, template);
    setIsTemplateModalOpen(false);
  };

  const handleSettings = () => {
    uiActions.openModal('settings');
  };

  const handleExportImport = () => {
    uiActions.openModal('exportImport');
  };

  return (
    <>
      <Header
        currentProject={projectState.currentProject.title}
        onSave={handleSave}
        onSettings={handleSettings}
        onNewProject={handleNewProject}
        onExportImport={handleExportImport}
        isSaving={projectState.isSaving}
      />
      <TemplateSelectionModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onTemplateSelected={handleTemplateSelectedInModal}
      />
    </>
  );
}