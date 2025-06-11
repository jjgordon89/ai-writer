import React from 'react';
import { StoryEdge, StoryNode } from '../../types';

interface StoryEdgeComponentProps {
  edge: StoryEdge;
  sourceNode: StoryNode | undefined;
  targetNode: StoryNode | undefined;
}

const StoryEdgeComponent: React.FC<StoryEdgeComponentProps> = ({ edge, sourceNode, targetNode }) => {
  if (!sourceNode || !targetNode) {
    return null;
  }

  // Simplified line drawing. Assumes nodes have some dimensions.
  // For better accuracy, node dimensions should be known or calculated.
  // Let's estimate node center more generically.
  // These would ideally come from actual rendered dimensions or a layout engine.
  const sourceCenterX = sourceNode.position.x + 60; // Approx center of a 120px wide node
  const sourceCenterY = sourceNode.position.y + 30; // Approx center of a node with some height
  const targetCenterX = targetNode.position.x + 60;
  const targetCenterY = targetNode.position.y + 30;

  // Ensure the SVG container covers the entire drawing area.
  // The SVG element itself does not need to be positioned absolutely if it's a child of the main canvas div.
  // However, if it is, its L/T should be 0,0.
  // For simplicity here, we'll assume it's part of the flow and its coordinates are relative to its own top-left.
  // This will need to be adjusted based on how it's placed in StoryPlannerView.
  // The current StoryPlannerView places this absolutely, so this should be fine.

  const markerId = `arrowhead-${edge.id}`;

  // Basic offset to avoid line starting/ending exactly at node center if nodes are small
  // A more robust solution would use node dimensions and geometry.

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Edges should not capture mouse events meant for nodes
        overflow: 'visible' // Important for SVG lines that might go outside initial viewport
      }}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8" // Offset to sit on the line end
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#555" />
        </marker>
      </defs>
      <line
        x1={sourceCenterX}
        y1={sourceCenterY}
        x2={targetCenterX}
        y2={targetCenterY}
        stroke="#555" // Darker grey for the line
        strokeWidth="1.5"
        markerEnd={`url(#${markerId})`}
      />
      {edge.label && (
        <text
          x={(sourceCenterX + targetCenterX) / 2} // Center text on the line
          y={(sourceCenterY + targetCenterY) / 2} // Center text on the line
          fill="#333"
          fontSize="10px"
          textAnchor="middle"
          dy="-5px" // Offset text slightly above the line
          style={{ pointerEvents: 'auto' }} // Allow text to be interactive if needed later
        >
          {edge.label}
        </text>
      )}
    </svg>
  );
};

export default StoryEdgeComponent;
