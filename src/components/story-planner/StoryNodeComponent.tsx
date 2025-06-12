import React from 'react';
import { StoryNode, StoryNodeType } from '../../types';
import { useProject } from '../../contexts/ProjectContext'; // To get character/arc names

interface StoryNodeComponentProps {
  node: StoryNode;
  onEdit: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onStartEdge?: (nodeId: string) => void; // Optional for now
  onCompleteEdge?: (nodeId: string) => void; // Optional for now
  isCreatingEdgeFrom?: string | null; // Optional for now
  onLinkEntity: (nodeId: string) => void;
  // No onDragStart prop needed from parent if using native HTML D&D for position updates primarily on dragEnd
}

const nodeColors: Record<StoryNodeType, string> = {
  [StoryNodeType.IDEA]: '#FFFACD', // LemonChiffon
  [StoryNodeType.SCENE]: '#ADD8E6', // LightBlue
  [StoryNodeType.CHARACTER_SKETCH]: '#FFDAB9', // PeachPuff
  [StoryNodeType.PLOT_POINT]: '#LIGHTGREEN',
  [StoryNodeType.LOCATION_SKETCH]: '#E0FFFF', // LightCyan
  [StoryNodeType.NOTE]: '#F5F5F5', // WhiteSmoke
};

const StoryNodeComponent: React.FC<StoryNodeComponentProps> = ({ node, onEdit, onDelete, onStartEdge, onCompleteEdge, isCreatingEdgeFrom, onLinkEntity }) => {
  const { state: projectState } = useProject(); // Get project state for linked entity names
  const { characters, storyArcs } = projectState.currentProject;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    border: '1px solid #CCC', // Lighter border
    borderRadius: '8px', // More rounded
    padding: '10px 15px', // Increased padding
    backgroundColor: node.color || nodeColors[node.type] || '#E0E0E0',
    cursor: 'grab', // To indicate it's draggable
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)', // Softer shadow
    minWidth: '160px',
    minHeight: '80px', // Ensure a minimum height
    paddingBottom: '55px', // More space for buttons, ID, and link info
    userSelect: 'none', // Prevent text selection when dragging
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', node.id); // Set data to identify the node
    // Calculate offset from mouse pointer to top-left of node
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    e.dataTransfer.setData('application/json', JSON.stringify({ offsetX, offsetY }));
    e.dataTransfer.effectAllowed = 'move';
    // Optional: Set a less obstructive drag image
    // const dragImage = new Image();
    // dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Transparent pixel
    // e.dataTransfer.setDragImage(dragImage, 0, 0);
  };

  return (
    <div
      style={style}
      data-node-id={node.id}
      draggable="true"
      onDragStart={handleDragStart}
    >
      <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05em', color: '#333' }}>{node.label}</h4>
      {node.content && <p style={{ fontSize: '0.85em', whiteSpace: 'pre-wrap', margin: '0 0 8px 0', color: '#555' }}>{node.content}</p>}
      <small style={{ display:'block', fontSize: '0.75em', color: '#777', marginBottom: '5px' }}>Type: {node.type}</small>

      {node.linkedCharacterId && (
        <small style={{ display:'block', fontSize: '0.7em', color: 'purple', marginBottom: '5px' }}>
          Linked Char: {characters.find(c => c.id === node.linkedCharacterId)?.name || 'Unknown'}
        </small>
      )}
      {node.linkedStoryArcId && (
        <small style={{ display:'block', fontSize: '0.7em', color: 'darkgreen', marginBottom: '5px' }}>
          Linked Arc: {storyArcs.find(sa => sa.id === node.linkedStoryArcId)?.title || 'Unknown'}
        </small>
      )}

      <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '6px' }}>
        {[
          { label: 'Link', action: () => onLinkEntity(node.id), styleKey: 'link' },
          { label: 'Edit', action: () => onEdit(node.id), styleKey: 'edit' },
          { label: 'Del', action: () => onDelete(node.id), styleKey: 'delete' },
          ...(onStartEdge && onCompleteEdge ? [{
            label: isCreatingEdgeFrom === node.id ? 'Cancel' : (isCreatingEdgeFrom ? 'Link Here' : '+Link'),
            action: isCreatingEdgeFrom === node.id ? () => onStartEdge(node.id) : (isCreatingEdgeFrom ? () => onCompleteEdge(node.id) : () => onStartEdge(node.id)),
            styleKey: isCreatingEdgeFrom === node.id ? 'cancelLink' : (isCreatingEdgeFrom ? 'completeLink' : 'startLink')
          }] : [])
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.action}
            className={`story-node-btn story-node-btn-${btn.styleKey}`}
            style={{fontSize: '0.75em', padding: '3px 6px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer'}}
          >
            {btn.label}
          </button>
        ))}
      </div>
      <small style={{ position: 'absolute', bottom: '8px', left: '8px', fontSize: '0.65em', color: '#aaa' }}>ID: {node.id.substring(0,8)}</small>
    </div>
  );
};

export default StoryNodeComponent;
