import React from 'react';
import { AIPanel } from './AIPanel';
import { useAI, useUI } from '../../contexts';

export function AIPanelContainer() {
  const { state: aiState, actions: aiActions, rawService } = useAI(); // Retrieve rawService
  const { actions: uiActions } = useUI();

  const handleShowSettings = () => {
    uiActions.openModal('settings');
  };

  // Create an enhanced service interface for the panel, mapping context actions
  const aiServiceForPanel = {
    // Existing methods
    generateContent: aiActions.generateContent,
    getSettings: () => aiState.settings,

    // New methods from AIContext actions
    generatePlot: aiActions.generatePlot,
    developCharacterArc: aiActions.developCharacterArc,
    analyzeStyleTone: aiActions.analyzeStyleTone,
    getEmbeddings: aiActions.getEmbeddings,
    getActiveEmbeddingModelDimension: aiActions.getActiveEmbeddingModelDimension,

    // API key management methods - pass them through if AIPanel needs them
    // (e.g. for provider configuration checks or direct calls, though less likely for AIPanel itself)
    // setApiKey: aiActions.setApiKey,
    // getApiKey: aiActions.getApiKey,
    // removeApiKey: aiActions.removeApiKey,
  };

  return (
    <AIPanel
      aiService={aiServiceForPanel}
      enhancedServiceInstance={rawService} // Pass rawService as a new prop
      onShowSettings={handleShowSettings}
    />
  );
}