// src/components/templates/TemplateSelectionModal.tsx
import React, { useState, useEffect } from 'react';
import { ProjectTemplate } from '../../types'; // Adjust path
import { getAvailableTemplates } from '../../services/templateService'; // Adjust path
import { useProject } from '../../contexts/ProjectContext'; // For confirmCallback

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateSelected: (template?: ProjectTemplate) => void; // Renamed for clarity
}

const TemplateSelectionModal: React.FC<TemplateSelectionModalProps> = ({ isOpen, onClose, onTemplateSelected }) => {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { state: projectState } = useProject(); // For dirty check confirmation

  useEffect(() => {
    if (isOpen) {
      setTemplates(getAvailableTemplates());
      setSelectedTemplateId(null); // Reset selection when modal opens
    }
  }, [isOpen]);

  const handleTemplateCardClick = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const handleConfirmSelection = () => {
    if (selectedTemplateId) {
      if (selectedTemplateId === "__BLANK__") {
        onTemplateSelected(undefined);
      } else {
        const selected = templates.find(t => t.templateId === selectedTemplateId);
        onTemplateSelected(selected);
      }
    }
    // If nothing is selected, button should be disabled, but as a fallback:
    // else { onTemplateSelected(undefined); }
    onClose();
  };

  const handleSelectBlankProject = () => {
    setSelectedTemplateId("__BLANK__");
  };


  if (!isOpen) {
    return null;
  }

  // Basic Modal Styling (inline for simplicity, ideally use CSS classes)
  const modalStyle: React.CSSProperties = {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
  };
  const contentStyle: React.CSSProperties = {
    background: 'white', padding: '20px', borderRadius: '8px',
    width: '80%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
  };
  const templateCardStyle: React.CSSProperties = {
    border: '1px solid #eee', padding: '15px', borderRadius: '6px',
    marginBottom: '10px', cursor: 'pointer', transition: 'box-shadow 0.2s, border-color 0.2s'
  };
  const selectedCardStyle: React.CSSProperties = {
    ...templateCardStyle,
    borderColor: '#007bff',
    boxShadow: '0 0 0 2px #007bff',
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={contentStyle} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Select a Project Template</h2>

        <div
          style={selectedTemplateId === '__BLANK__' ? selectedCardStyle : templateCardStyle}
          onClick={handleSelectBlankProject}
        >
          <h4>Start with a Blank Project</h4>
          <p style={{fontSize: '0.9em', color: '#555'}}>Begin with an empty project and build your story from scratch.</p>
        </div>

        {templates.map(template => (
          <div
            key={template.templateId}
            style={selectedTemplateId === template.templateId ? selectedCardStyle : templateCardStyle}
            onClick={() => handleTemplateCardClick(template.templateId)}
          >
            <h4 style={{marginTop: 0, marginBottom: '5px'}}>{template.templateName}</h4>
            <p style={{fontSize: '0.9em', color: '#555', margin: 0}}>{template.templateDescription}</p>
            {template.genre && <small style={{fontSize: '0.8em', color: '#777', display: 'block', marginTop: '5px'}}>Genre: {template.genre}</small>}
          </div>
        ))}

        <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{padding: '8px 15px', borderRadius: '4px', border: '1px solid #ccc'}}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSelection}
            disabled={!selectedTemplateId} // Disabled if nothing (not even blank) is chosen
            style={{padding: '8px 15px', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: 'white', cursor: selectedTemplateId ? 'pointer': 'not-allowed', opacity: selectedTemplateId ? 1 : 0.6}}
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateSelectionModal;
