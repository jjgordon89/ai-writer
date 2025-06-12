import React, { useState, useMemo } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { TimelineEvent, DateType } from '../../types';
import TimelineEventComponent from './TimelineEventComponent';
// import AddTimelineEventForm from './AddTimelineEventForm'; // For later

const TimelineView: React.FC = () => {
  const { state, actions } = useProject();
  const timelineEvents = state.currentProject.timelineEvents || [];
  const { characters, storyArcs } = state.currentProject;

  const [filterCharacterId, setFilterCharacterId] = useState('');
  const [filterStoryArcId, setFilterStoryArcId] = useState('');
  const [filterTag, setFilterTag] = useState('');

  const filteredAndSortedEvents = useMemo(() => {
    let filtered = [...timelineEvents];

    if (filterCharacterId) {
      filtered = filtered.filter(event => event.linkedCharacterIds?.includes(filterCharacterId));
    }
    if (filterStoryArcId) {
      filtered = filtered.filter(event => event.linkedStoryArcIds?.includes(filterStoryArcId));
    }
    if (filterTag.trim() !== '') {
      const lowerCaseFilterTag = filterTag.trim().toLowerCase();
      filtered = filtered.filter(event =>
        event.tags?.some(tag => tag.toLowerCase().includes(lowerCaseFilterTag))
      );
    }

    return filtered.sort((a, b) => {
    // Prioritize Absolute dates first
    if (a.dateType === DateType.ABSOLUTE && b.dateType === DateType.RELATIVE) {
      return -1; // a comes first
    }
    if (a.dateType === DateType.RELATIVE && b.dateType === DateType.ABSOLUTE) {
      return 1; // b comes first
    }

    // If both are Absolute, compare by date
    if (a.dateType === DateType.ABSOLUTE && b.dateType === DateType.ABSOLUTE) {
      const dateA = new Date(a.dateValue);
      const dateB = new Date(b.dateValue);
      // Handle invalid dates by pushing them to the end or treating them as equal to other invalid dates
      if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateA.getTime() - dateB.getTime();
    }

    // If both are Relative, compare by their string description (simple alphabetical)
    // This means "Chapter 1", "Chapter 2" will sort correctly if named consistently.
    if (a.dateType === DateType.RELATIVE && b.dateType === DateType.RELATIVE) {
      return a.dateValue.localeCompare(b.dateValue);
    }

    return 0;
    });
  }, [timelineEvents, filterCharacterId, filterStoryArcId, filterTag]);

  const handleAddEvent = () => {
    const title = prompt("Enter event title:");
    if (!title) return;

    const description = prompt("Enter event description (optional):") || undefined;

    let dateTypeStr = prompt("Enter date type ('absolute' or 'relative'):")?.toLowerCase();
    while (dateTypeStr !== DateType.ABSOLUTE && dateTypeStr !== DateType.RELATIVE) {
      if (dateTypeStr === null) return; // User cancelled
      dateTypeStr = prompt("Invalid type. Enter 'absolute' or 'relative':")?.toLowerCase();
    }
    const dateType = dateTypeStr as DateType;

    const dateValue = prompt(dateType === DateType.ABSOLUTE ? "Enter date (e.g., YYYY-MM-DD):" : "Enter relative date description:");
    if (!dateValue) return;

    const endDateValue = prompt("Enter end date (optional, for duration):") || undefined;
    const color = prompt("Enter color (optional, e.g., #RRGGBB or color name):") || undefined;
    const tagsStr = prompt("Enter tags (optional, comma-separated):") || undefined;
    const linkedCharacterIdsStr = prompt("Link characters by ID (optional, comma-separated):") || undefined;
    const linkedStoryArcIdsStr = prompt("Link story arcs by ID (optional, comma-separated):") || undefined;

    const newEvent: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'> = {
      title,
      description,
      dateType,
      dateValue,
      endDateValue,
      color,
      tags: tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : undefined,
      linkedCharacterIds: linkedCharacterIdsStr ? linkedCharacterIdsStr.split(',').map(id => id.trim()).filter(id => id) : undefined,
      linkedStoryArcIds: linkedStoryArcIdsStr ? linkedStoryArcIdsStr.split(',').map(id => id.trim()).filter(id => id) : undefined,
    };
    actions.addTimelineEvent(newEvent);
  };

  const handleEditEvent = (eventId: string) => {
    const eventToEdit = timelineEvents.find(e => e.id === eventId);
    if (!eventToEdit) {
      alert("Event not found!");
      return;
    }

    const title = prompt("Enter event title:", eventToEdit.title);
    if (!title) return; // Keep old title if prompt is cancelled empty, or handle as error

    const description = prompt("Enter event description (optional):", eventToEdit.description) || undefined;

    let dateTypeStr = prompt(`Enter date type ('absolute' or 'relative'):`, eventToEdit.dateType)?.toLowerCase();
    while (dateTypeStr !== DateType.ABSOLUTE && dateTypeStr !== DateType.RELATIVE) {
      if (dateTypeStr === null) return;
      dateTypeStr = prompt("Invalid type. Enter 'absolute' or 'relative':", eventToEdit.dateType)?.toLowerCase();
    }
    const dateType = dateTypeStr as DateType;

    const dateValue = prompt(dateType === DateType.ABSOLUTE ? "Enter date (e.g., YYYY-MM-DD):" : "Enter relative date description:", eventToEdit.dateValue);
    if (!dateValue) return;

    const endDateValue = prompt("Enter end date (optional, for duration):", eventToEdit.endDateValue || "") || undefined;
    const color = prompt("Enter color (optional, e.g., #RRGGBB or color name):", eventToEdit.color || "") || undefined;
    const tagsStr = prompt("Enter tags (optional, comma-separated):", eventToEdit.tags?.join(', ') || "") || undefined;
    const linkedCharacterIdsStr = prompt("Link characters by ID (optional, comma-separated):", eventToEdit.linkedCharacterIds?.join(', ') || "") || undefined;
    const linkedStoryArcIdsStr = prompt("Link story arcs by ID (optional, comma-separated):", eventToEdit.linkedStoryArcIds?.join(', ') || "") || undefined;

    const updatedEventPayload: Partial<TimelineEvent> = {
      title,
      description,
      dateType,
      dateValue,
      endDateValue,
      color,
      tags: tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [], // Send empty array to clear if needed
      linkedCharacterIds: linkedCharacterIdsStr ? linkedCharacterIdsStr.split(',').map(id => id.trim()).filter(id => id) : [],
      linkedStoryArcIds: linkedStoryArcIdsStr ? linkedStoryArcIdsStr.split(',').map(id => id.trim()).filter(id => id) : [],
    };

    actions.updateTimelineEvent({ id: eventId, updates: updatedEventPayload });
  };

  const handleDeleteEvent = (eventId: string) => {
    const eventToDelete = timelineEvents.find(e => e.id === eventId);
    if (!eventToDelete) {
      alert("Event not found!");
      return;
    }
    if (window.confirm(`Are you sure you want to delete the event: "${eventToDelete.title}"?`)) {
      actions.deleteTimelineEvent(eventId);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}> {/* Added a common font */}
      <h2>Interactive Story Timeline</h2>
      <button
        onClick={handleAddEvent}
        style={{
          marginBottom: '20px',
          padding: '8px 15px',
            fontSize: '0.95em',
            backgroundColor: '#007bff', // Example primary button color
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        }}
      >
        Add New Event
      </button>

      <div style={{ marginBottom: '25px', padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#f9f9f9' }}>
        <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1em', color: '#333' }}>Filters</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}> {/* Responsive grid layout for filters */}
          <div>
            <label htmlFor="charFilter" style={{ marginRight: '5px', fontSize: '0.9em', display: 'block', marginBottom: '3px' }}>Character:</label>
            <select
              id="charFilter"
              value={filterCharacterId}
              onChange={e => setFilterCharacterId(e.target.value)}
              style={{ padding: '8px', fontSize: '0.9em', width: '100%', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">All Characters</option>
              {characters.map(char => (
                <option key={char.id} value={char.id}>{char.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="arcFilter" style={{ marginRight: '5px', fontSize: '0.9em', display: 'block', marginBottom: '3px' }}>Story Arc:</label>
            <select
              id="arcFilter"
              value={filterStoryArcId}
              onChange={e => setFilterStoryArcId(e.target.value)}
              style={{ padding: '8px', fontSize: '0.9em', width: '100%', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">All Story Arcs</option>
              {storyArcs.map(arc => (
                <option key={arc.id} value={arc.id}>{arc.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tagFilter" style={{ marginRight: '5px', fontSize: '0.9em', display: 'block', marginBottom: '3px' }}>Tag:</label>
            <input
              type="text"
              id="tagFilter"
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
              placeholder="Enter tag to filter"
              style={{ padding: '8px', fontSize: '0.9em', width: '100%', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
        </div>
      </div>

      <div className="timeline-events-container" style={{ marginTop: '20px' }}>
        {filteredAndSortedEvents.length === 0 && <p>No timeline events match the current filters, or no events have been added yet.</p>}
        {filteredAndSortedEvents.map(event => (
          <TimelineEventComponent
            key={event.id}
            event={event}
            onEdit={handleEditEvent}
            onDelete={handleDeleteEvent}
          />
        ))}
      </div>
    </div>
  );
};

export default TimelineView;
