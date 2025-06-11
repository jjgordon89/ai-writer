import React from 'react';
import { AIPanel } from './AIPanelOptimized';
import { useAI, useUI } from '../../contexts';

export function AIPanelContainer() {
  const { state: aiState, actions: aiActions } = useAI();
  const { actions: uiActions } = useUI();

  const handleShowSettings = () => {
    uiActions.openModal('settings');
  };

  // Create a simplified service interface for the panel
  const aiService = {
    generateContent: aiActions.generateContent,
    getSettings: () => aiState.settings
  };

  return (
    <AIPanel
      aiService={aiService}
      onShowSettings={handleShowSettings}
    />
  );
}