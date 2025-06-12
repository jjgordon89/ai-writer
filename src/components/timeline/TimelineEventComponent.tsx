import React from 'react';
import { TimelineEvent, DateType } from '../../types';
import { useProject } from '../../contexts/ProjectContext'; // For linked entity names

interface TimelineEventComponentProps {
  event: TimelineEvent;
  onEdit: (eventId: string) => void;
  onDelete: (eventId: string) => void;
}

const TimelineEventComponent: React.FC<TimelineEventComponentProps> = ({ event, onEdit, onDelete }) => {
  const { state: projectState } = useProject();
  const { characters, storyArcs } = projectState.currentProject;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr; // Return original string if not a valid date
    }
    // Example: "Jan 15, 2024" - adjust format as needed
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '15px',
      marginBottom: '20px', // Increased bottom margin for more separation
      backgroundColor: event.color || '#ffffff',
      boxShadow: '0 2px 5px rgba(0,0,0,0.08)' // Slightly enhanced shadow
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25em', color: '#222' }}>{event.title}</h3> {/* Darker title */}
        <div>
          <button
            onClick={() => onEdit(event.id)}
            style={{ marginRight: '8px', padding: '5px 10px', fontSize: '0.85em', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(event.id)}
            style={{ padding: '5px 10px', fontSize: '0.85em', backgroundColor: '#ffe0e0', border: '1px solid #ffc0c0', color: '#c00', borderRadius: '4px', cursor: 'pointer' }}
          >
            Delete
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.9em', color: '#555', margin: '5px 0' }}>
        <strong>Date:</strong> {event.dateType === DateType.ABSOLUTE ? formatDate(event.dateValue) : event.dateValue}
        {event.dateType === DateType.RELATIVE && <span style={{ fontStyle: 'italic', marginLeft: '5px' }}>(Relative)</span>}
      </p>
      {event.endDateValue && (
        <p style={{ fontSize: '0.9em', color: '#555', margin: '5px 0' }}>
          <strong>End Date:</strong> {event.dateType === DateType.ABSOLUTE ? formatDate(event.endDateValue) : event.endDateValue}
        </p>
      )}

      {event.description && <p style={{ fontSize: '0.95em', margin: '10px 0' }}>{event.description}</p>}

      {event.linkedCharacterIds && event.linkedCharacterIds.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed #eee' }}>
          <strong style={{ fontSize: '0.8em', color: '#4A00E0' }}>Linked Characters:</strong>
          <span style={{ fontSize: '0.8em', marginLeft: '5px', color: '#555' }}>
            {event.linkedCharacterIds.map(id => characters.find(c => c.id === id)?.name || `ID: ${id.substring(0,6)}...`).join(', ')}
          </span>
        </div>
      )}

      {event.linkedStoryArcIds && event.linkedStoryArcIds.length > 0 && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #eee' }}>
          <strong style={{ fontSize: '0.8em', color: '#00701a' }}>Linked Story Arcs:</strong>
          <span style={{ fontSize: '0.8em', marginLeft: '5px', color: '#555' }}>
            {event.linkedStoryArcIds.map(id => storyArcs.find(sa => sa.id === id)?.title || `ID: ${id.substring(0,6)}...`).join(', ')}
          </span>
        </div>
      )}

      {event.tags && event.tags.length > 0 && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #eee' }}>
          <strong style={{ fontSize: '0.8em', color: '#566A7D' }}>Tags:</strong>
          <span style={{ fontSize: '0.8em', marginLeft: '5px', color: '#555' }}>
            {event.tags.join(', ')}
          </span>
        </div>
      )}
    </div>
  );
};

export default TimelineEventComponent;
