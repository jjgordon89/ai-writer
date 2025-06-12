import React, { useState, useEffect } from 'react';
import { Users, Wifi, WifiOff, Circle, Mouse, MessageCircle, AlertTriangle, Settings } from 'lucide-react';
import { collaborationService, CollaborationUser, CollaborationSession } from '../../services/collaborationService';
import { useProjectContext } from '../../hooks/useProjectContext';
import { useAsyncErrorHandler } from '../../hooks/useAsyncErrorHandler';

interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'reconnecting';
  message: string;
}

interface ConflictInfo {
  id: string;
  description: string;
  timestamp: Date;
}

export function CollaborationPanel() {
  const { state } = useProjectContext();
  const { wrapAsync } = useAsyncErrorHandler({ component: 'CollaborationPanel' });
  
  const [isCollaborationEnabled, setIsCollaborationEnabled] = useState(false);
  const [currentSession, setCurrentSession] = useState<CollaborationSession | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<CollaborationUser[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'disconnected',
    message: 'Not connected'
  });
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [collaborationConfig, setCollaborationConfig] = useState({
    serverUrl: 'ws://localhost:3001',
    username: '',
    userColor: '#3B82F6'
  });

  useEffect(() => {
    // Initialize collaboration service
    const initializeCollaboration = async () => {
      try {
        await collaborationService.initialize(collaborationConfig.serverUrl, {
          onUserJoined: (user) => {
            setOnlineUsers(prev => [...prev, user]);
          },
          onUserLeft: (userId) => {
            setOnlineUsers(prev => prev.filter(u => u.id !== userId));
          },
          onConnectionStatusChanged: (status) => {
            setConnectionStatus({
              status,
              message: getStatusMessage(status)
            });
          },
          onConflictDetected: (conflict) => {
            setConflicts(prev => [...prev, {
              id: conflict.id,
              description: conflict.description,
              timestamp: new Date()
            }]);
          },
          onError: (error) => {
            console.error('Collaboration error:', error);
          }
        });
      } catch (error) {
        console.warn('Collaboration service not available:', error);
      }
    };

    if (isCollaborationEnabled) {
      initializeCollaboration();
    }

    return () => {
      if (isCollaborationEnabled) {
        collaborationService.disconnect();
      }
    };
  }, [isCollaborationEnabled, collaborationConfig.serverUrl]);

  const getStatusMessage = (status: ConnectionStatus['status']): string => {
    switch (status) {
      case 'connected': return 'Connected to collaboration server';
      case 'disconnected': return 'Disconnected from collaboration server';
      case 'reconnecting': return 'Reconnecting to collaboration server...';
      default: return 'Unknown status';
    }
  };

  const handleStartCollaboration = async () => {
    if (!state.currentProject || !collaborationConfig.username.trim()) {
      alert('Please select a project and enter a username');
      return;
    }

    await wrapAsync(async () => {
      // Additional null check inside async wrapper for TypeScript safety
      if (!state.currentProject) {
        throw new Error('No project selected');
      }

      const session = await collaborationService.joinSession(state.currentProject.id, {
        name: collaborationConfig.username,
        email: '', // Could be filled from user profile
        color: collaborationConfig.userColor
      });

      setCurrentSession(session);
      setOnlineUsers(session.users);
      setIsCollaborationEnabled(true);
    });
  };

  const handleStopCollaboration = async () => {
    await wrapAsync(async () => {
      await collaborationService.leaveSession();
      setCurrentSession(null);
      setOnlineUsers([]);
      setIsCollaborationEnabled(false);
    });
  };

  const getUserInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusIcon = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      case 'reconnecting':
        return <div className="w-4 h-4 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-500" />;
    }
  };

  const resolveConflict = async (conflictId: string, resolution: 'accept_mine' | 'accept_theirs') => {
    await wrapAsync(async () => {
      await collaborationService.resolveConflict(conflictId, {
        conflictId,
        type: 'user_choice',
        resolution,
        userId: collaborationService.getCurrentUser()?.id || '',
        timestamp: new Date()
      });

      setConflicts(prev => prev.filter(c => c.id !== conflictId));
    });
  };

  if (!state.currentProject) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Selected</h3>
          <p className="text-gray-600">
            Select a project to enable real-time collaboration features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Collaboration</h2>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-gray-900">Collaboration Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={collaborationConfig.username}
                onChange={(e) => setCollaborationConfig(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter your name"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Color
              </label>
              <input
                type="color"
                value={collaborationConfig.userColor}
                onChange={(e) => setCollaborationConfig(prev => ({ ...prev, userColor: e.target.value }))}
                className="block w-full h-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Collaboration Server URL
              </label>
              <input
                type="text"
                value={collaborationConfig.serverUrl}
                onChange={(e) => setCollaborationConfig(prev => ({ ...prev, serverUrl: e.target.value }))}
                placeholder="ws://localhost:3001"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Connection Status</h3>
          {getStatusIcon()}
        </div>
        
        <div className="flex items-center space-x-3 mb-4">
          <Circle 
            className={`w-3 h-3 ${
              connectionStatus.status === 'connected' ? 'text-green-500' :
              connectionStatus.status === 'reconnecting' ? 'text-yellow-500' : 
              'text-red-500'
            }`}
            fill="currentColor"
          />
          <span className="text-sm text-gray-600">{connectionStatus.message}</span>
        </div>

        {!currentSession ? (
          <button
            onClick={handleStartCollaboration}
            disabled={!collaborationConfig.username.trim()}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>Start Collaboration</span>
          </button>
        ) : (
          <button
            onClick={handleStopCollaboration}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <WifiOff className="w-4 h-4" />
            <span>Stop Collaboration</span>
          </button>
        )}
      </div>

      {/* Online Users */}
      {currentSession && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-4">
            Online Users ({onlineUsers.length})
          </h3>
          
          {onlineUsers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No other users online
            </p>
          ) : (
            <div className="space-y-3">
              {onlineUsers.map((user) => (
                <div key={user.id} className="flex items-center space-x-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: user.color }}
                  >
                    {getUserInitials(user.name)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">{user.name}</span>
                      {user.isOnline && (
                        <Circle className="w-2 h-2 text-green-500" fill="currentColor" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      {user.cursor && (
                        <div className="flex items-center space-x-1">
                          <Mouse className="w-3 h-3" />
                          <span>Editing</span>
                        </div>
                      )}
                      <span>Last seen: {new Date(user.lastSeen).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-medium text-gray-900">Merge Conflicts ({conflicts.length})</h3>
          </div>
          
          <div className="space-y-3">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 mb-2">{conflict.description}</p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => resolveConflict(conflict.id, 'accept_mine')}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                  >
                    Keep Mine
                  </button>
                  <button
                    onClick={() => resolveConflict(conflict.id, 'accept_theirs')}
                    className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                  >
                    Keep Theirs
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {conflict.timestamp.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collaboration Features Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <MessageCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">Collaboration Features</h4>
            <ul className="text-sm text-blue-700 mt-1 space-y-1">
              <li>• Real-time editing with conflict resolution</li>
              <li>• Live cursor positions and user presence</li>
              <li>• Automatic saving and synchronization</li>
              <li>• Character and story arc collaboration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}