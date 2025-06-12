import React, { useState, useCallback, useRef, CSSProperties } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { StoryNode, StoryEdge, StoryNodeType } from '../../types';
import StoryNodeComponent from './StoryNodeComponent';
import StoryEdgeComponent from './StoryEdgeComponent';

const StoryPlannerView: React.FC = () => {
  const { state, actions } = useProject();
  const { storyPlannerData } = state.currentProject;
  const [zoomLevel, setZoomLevel] = useState(1);
  const plannerRef = useRef<HTMLDivElement>(null); // Ref for the planner canvas area
  const [creatingEdgeFrom, setCreatingEdgeFrom] = useState<string | null>(null);
  // For more complex editing, a modal and state for the node being edited would be needed.
  // const [editingNode, setEditingNode] = useState<StoryNode | null>(null);

  const handleAddNode = () => {
    const newNode: Omit<StoryNode, 'id' | 'createdAt' | 'updatedAt'> = {
      type: StoryNodeType.IDEA,
      label: 'New Idea',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      content: '',
    };
    actions.addStoryNode(newNode);
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (window.confirm('Are you sure you want to delete this node and its connected edges?')) {
      actions.deleteStoryNode(nodeId);
      if (creatingEdgeFrom === nodeId) { // If deleting the source of an edge being created
        setCreatingEdgeFrom(null);
      }
    }
  }, [actions, creatingEdgeFrom]);

  const handleEditNode = useCallback((nodeId: string) => {
    const nodeToEdit = storyPlannerData?.nodes.find(n => n.id === nodeId);
    if (!nodeToEdit) return;

    const newLabel = prompt("Enter new label:", nodeToEdit.label);
    if (newLabel === null) return; // User cancelled

    const newContent = prompt("Enter new content:", nodeToEdit.content || "");
    if (newContent === null) return;

    // In a real app, use a modal with dropdown for type, color picker etc.
    const currentTypes = Object.values(StoryNodeType).join(', ');
    const newTypeStr = prompt(`Enter type (${currentTypes}):`, nodeToEdit.type);
    if (newTypeStr === null || !Object.values(StoryNodeType).includes(newTypeStr as StoryNodeType)) {
      alert("Invalid type or cancelled.");
      // return; // Or keep old type
    }

    actions.updateStoryNode({
      id: nodeId,
      updates: {
        label: newLabel,
        content: newContent,
        type: newTypeStr as StoryNodeType // Add type safety if keeping old type
      }
    });
  }, [actions, storyPlannerData?.nodes]);

  const handleStartEdge = useCallback((nodeId: string) => {
    if (creatingEdgeFrom === nodeId) { // Clicked on the same node again to cancel
      setCreatingEdgeFrom(null);
    } else {
      setCreatingEdgeFrom(nodeId);
    }
  }, [creatingEdgeFrom]);

  const handleCompleteEdge = useCallback((targetNodeId: string) => {
    if (creatingEdgeFrom && creatingEdgeFrom !== targetNodeId) {
      const newEdgeLabel = prompt("Enter label for the new edge (optional):");
      // if (newEdgeLabel === null) return; // User cancelled, but maybe allow unlabelled edges
      actions.addStoryEdge({ sourceNodeId: creatingEdgeFrom, targetNodeId, label: newEdgeLabel || undefined });
      setCreatingEdgeFrom(null);
    }
  }, [actions, creatingEdgeFrom]);

  const handleLinkEntity = useCallback((nodeId: string) => {
    const nodeToLink = storyPlannerData?.nodes.find(n => n.id === nodeId);
    if (!nodeToLink || !storyPlannerData) return;

    const choice = prompt("Link to 'Character' or 'StoryArc'? (Type 'c' or 's', or 'u' to unlink):")?.toLowerCase();

    if (choice === 'c') {
      let charList = "Select Character ID to link (or type 'new'):\n";
      state.currentProject.characters.forEach(char => charList += `${char.id.substring(0,8)}... - ${char.name}\n`);
      const charIdInput = prompt(charList);

      if (charIdInput?.toLowerCase() === 'new' && nodeToLink.type === StoryNodeType.CHARACTER_SKETCH) {
        // Promote to new character
        const newCharAction = actions.addCharacter({ name: nodeToLink.label, description: nodeToLink.content || '' });
        // Assuming addCharacter returns the new character or its ID, or we can find it.
        // For simplicity, this example doesn't directly get the ID back from the action.
        // A more robust way would be for addCharacter to return the created character or use a selector.
        // Here, we'll just link and hope the user finds it, or we find the latest. This part is tricky without action return values.
        alert(`Character '${nodeToLink.label}' created. You may need to manually find and link it if ID is not available immediately, or re-link.`);
        // Ideally, you'd get the new character's ID and then:
        // actions.updateStoryNode({ id: nodeId, updates: { linkedCharacterId: newCharacter.id } });
      } else if (charIdInput) {
        const targetChar = state.currentProject.characters.find(c => c.id.startsWith(charIdInput))
        if (targetChar) {
          actions.updateStoryNode({ id: nodeId, updates: { linkedCharacterId: targetChar.id, linkedStoryArcId: undefined } });
        } else {
          alert("Character not found.");
        }
      }
    } else if (choice === 's') {
      let arcList = "Select Story Arc ID to link:\n";
      state.currentProject.storyArcs.forEach(arc => arcList += `${arc.id.substring(0,8)}... - ${arc.title}\n`);
      const arcIdInput = prompt(arcList);
      if (arcIdInput) {
        const targetArc = state.currentProject.storyArcs.find(sa => sa.id.startsWith(arcIdInput));
        if (targetArc) {
          actions.updateStoryNode({ id: nodeId, updates: { linkedStoryArcId: targetArc.id, linkedCharacterId: undefined } });
        } else {
          alert("Story Arc not found.");
        }
      }
    } else if (choice === 'u') { // Unlink
      actions.updateStoryNode({ id: nodeId, updates: { linkedCharacterId: undefined, linkedStoryArcId: undefined } });
    }
  }, [actions, storyPlannerData, state.currentProject.characters, state.currentProject.storyArcs]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2)); // Max zoom 2x
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5)); // Min zoom 0.5x

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const nodeId = e.dataTransfer.getData('text/plain');
    const offsetData = e.dataTransfer.getData('application/json');
    const { offsetX, offsetY } = offsetData ? JSON.parse(offsetData) : { offsetX: 0, offsetY: 0 };

    if (!nodeId || !plannerRef.current || !storyPlannerData) return;

    const plannerRect = plannerRef.current.getBoundingClientRect();

    // Mouse position relative to the scrollable planner container's viewport
    const mouseXInPlannerViewport = e.clientX - plannerRect.left;
    const mouseYInPlannerViewport = e.clientY - plannerRect.top;

    // Account for scrolling within the planner container
    const mouseXUnscaled = mouseXInPlannerViewport + plannerRef.current.scrollLeft;
    const mouseYUnscaled = mouseYInPlannerViewport + plannerRef.current.scrollTop;

    // Account for zoom level to get logical coordinates within the scaled content
    const logicalX = mouseXUnscaled / zoomLevel;
    const logicalY = mouseYUnscaled / zoomLevel;

    // Subtract the initial drag offset (where on the node the drag started)
    let newX = logicalX - offsetX;
    let newY = logicalY - offsetY;

    // Optional: Snap to grid or constrain to bounds
    // newX = Math.round(newX / 10) * 10; // Snap to 10px grid
    // newY = Math.round(newY / 10) * 10;

    actions.updateStoryNode({ id: nodeId, updates: { position: { x: newX, y: newY } } });
  }, [actions, zoomLevel, storyPlannerData]); // Added zoomLevel and storyPlannerData to dependencies

  if (!storyPlannerData) {
    return <p>Loading story planner data or it's not initialized...</p>;
  }

  return (
    <div
      ref={plannerRef}
      style={{ width: '100%', height: '600px', border: '1px solid #ccc', position: 'relative', overflow: 'auto' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 20, background: 'rgba(248,248,248,0.9)', padding: '8px', borderBottom: '1px solid #ddd' }}>
        <h2>Story Planner View</h2>
        <button onClick={handleAddNode} style={{ marginRight: '10px' }}>Add Idea Node</button>
        <button onClick={handleZoomIn} style={{ marginRight: '5px' }}>Zoom In</button>
        <button onClick={handleZoomOut} style={{ marginRight: '10px' }}>Zoom Out</button>
        <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
      </div>

      {/* This is the container that will be scaled for zoom */}
      <div
        style={{
          position: 'relative', // Important for absolute positioning of nodes
          width: '2000px',
          height: '2000px', /* Large scrollable area */
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
          // transition: 'transform 0.1s ease-out', // Optional: smooth zoom transition
        }}
      >
        {/* Render Edges first so they are behind nodes */}
        {storyPlannerData.edges.map(edge => {
          const sourceNode = storyPlannerData.nodes.find(n => n.id === edge.sourceNodeId);
          const targetNode = storyPlannerData.nodes.find(n => n.id === edge.targetNodeId);
          return (
            <StoryEdgeComponent
              key={edge.id}
              edge={edge}
              sourceNode={sourceNode}
              targetNode={targetNode}
            />
          );
        })}
        {storyPlannerData.nodes.map(node => (
          <StoryNodeComponent
            key={node.id}
            node={node}
            onDelete={handleDeleteNode}
            onEdit={handleEditNode}
            onStartEdge={handleStartEdge}
            onCompleteEdge={handleCompleteEdge}
            isCreatingEdgeFrom={creatingEdgeFrom}
            onLinkEntity={handleLinkEntity}
          />
        ))}
      </div>

      {/* Keep the textual list for debugging, and add edge deletion here */}
      <div style={{position: 'fixed', bottom: '10px', right: '10px', zIndex: 30, background: 'rgba(255,255,255,0.9)', padding: '10px', maxHeight: '200px', overflowY: 'auto', border: '1px solid grey', boxShadow: '0 0 10px rgba(0,0,0,0.2)' }}>
        <h3>Nodes ({storyPlannerData.nodes.length}):</h3>
        <ul>
          {storyPlannerData.nodes.map(node => (
                <li key={node.id} title={node.id}>
                  {node.label.substring(0,20)} ({node.type})
                  <button onClick={() => handleEditNode(node.id)} style={{marginLeft: '5px'}}>E</button>
                  <button onClick={() => handleDeleteNode(node.id)} style={{color: 'red'}}>X</button>
                </li>
          ))}
        </ul>
            <h3>Edges ({storyPlannerData.edges.length}):</h3>
        <ul>
          {storyPlannerData.edges.map(edge => (
                <li key={edge.id} title={edge.id}>
                  {edge.sourceNodeId.substring(0,4)}... -&gt; {edge.targetNodeId.substring(0,4)}... ({edge.label || 'No label'})
                  <button
                    onClick={() => {
                      if(window.confirm('Delete this edge?')) actions.deleteStoryEdge(edge.id);
                    }}
                    style={{color: 'red', marginLeft: '5px'}}
                  >
                    X
                  </button>
                </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default StoryPlannerView;
