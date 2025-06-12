/**
 * Real-time Collaboration Service
 * Provides multi-user editing, presence awareness, and conflict resolution
 */

import { io, Socket } from 'socket.io-client';
import { ErrorSanitizer } from '../utils/errorSanitization';

// Collaboration types
export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  cursor?: {
    position: number;
    selection?: { start: number; end: number };
  };
  lastSeen: Date;
  isOnline: boolean;
}

export interface CollaborationSession {
  id: string;
  projectId: string;
  users: CollaborationUser[];
  createdAt: Date;
  lastActivity: Date;
}

export interface CollaborationOperation {
  id: string;
  type: 'insert' | 'delete' | 'retain' | 'format';
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, unknown>;
  userId: string;
  timestamp: Date;
}

export interface ProjectUpdate {
  type: 'content' | 'character' | 'story_arc' | 'timeline_event' | 'metadata';
  operation: 'create' | 'update' | 'delete';
  entityId?: string;
  data: unknown;
  userId: string;
  timestamp: Date;
}

export interface ConflictResolution {
  conflictId: string;
  type: 'auto_resolve' | 'manual_review' | 'user_choice';
  resolution: 'accept_mine' | 'accept_theirs' | 'merge' | 'custom';
  resolvedData?: unknown;
  userId: string;
  timestamp: Date;
}

// Event callbacks
export interface CollaborationEventCallbacks {
  onUserJoined?: (user: CollaborationUser) => void;
  onUserLeft?: (userId: string) => void;
  onUserCursorUpdate?: (userId: string, cursor: CollaborationUser['cursor']) => void;
  onProjectUpdate?: (update: ProjectUpdate) => void;
  onOperationReceived?: (operation: CollaborationOperation) => void;
  onConflictDetected?: (conflict: { id: string; description: string; operations: CollaborationOperation[] }) => void;
  onConnectionStatusChanged?: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
  onError?: (error: string) => void;
}

export class CollaborationService {
  private static instance: CollaborationService;
  private socket: Socket | null = null;
  private currentSession: CollaborationSession | null = null;
  private currentUser: CollaborationUser | null = null;
  private callbacks: CollaborationEventCallbacks = {};
  private operationQueue: CollaborationOperation[] = [];
  private isOnline = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Operational Transform state
  private localOperations: CollaborationOperation[] = [];
  private acknowledgedOperations: Set<string> = new Set();

  private constructor() {}

  static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService();
    }
    return CollaborationService.instance;
  }

  /**
   * Initialize collaboration service
   */
  async initialize(
    serverUrl: string = 'ws://localhost:3001',
    callbacks: CollaborationEventCallbacks = {}
  ): Promise<void> {
    try {
      this.callbacks = callbacks;

      // Initialize Socket.IO connection
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        retries: this.maxReconnectAttempts
      });

      this.setupSocketListeners();
      
      console.log('✅ Collaboration service initialized');
    } catch (error) {
      const sanitizedError = ErrorSanitizer.sanitizeForUser(error, {
        component: 'CollaborationService',
        action: 'initialize'
      });
      throw new Error(`Collaboration service initialization failed: ${sanitizedError.message}`);
    }
  }

  /**
   * Join a collaboration session for a project
   */
  async joinSession(
    projectId: string,
    user: Omit<CollaborationUser, 'id' | 'lastSeen' | 'isOnline'>
  ): Promise<CollaborationSession> {
    if (!this.socket) {
      throw new Error('Collaboration service not initialized');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Join session timeout'));
      }, 10000);

      this.socket!.emit('join_session', {
        projectId,
        user: {
          ...user,
          id: this.generateUserId(),
          lastSeen: new Date(),
          isOnline: true
        }
      });

      this.socket!.once('session_joined', (session: CollaborationSession) => {
        clearTimeout(timeout);
        this.currentSession = session;
        this.currentUser = session.users.find(u => u.name === user.name) || null;
        this.isOnline = true;
        resolve(session);
      });

      this.socket!.once('join_error', (error: string) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to join session: ${error}`));
      });
    });
  }

  /**
   * Leave current collaboration session
   */
  async leaveSession(): Promise<void> {
    if (!this.socket || !this.currentSession) return;

    return new Promise((resolve) => {
      this.socket!.emit('leave_session', {
        sessionId: this.currentSession!.id,
        userId: this.currentUser?.id
      });

      this.socket!.once('session_left', () => {
        this.currentSession = null;
        this.currentUser = null;
        this.isOnline = false;
        this.operationQueue = [];
        this.localOperations = [];
        this.acknowledgedOperations.clear();
        resolve();
      });

      // Auto-resolve after timeout
      setTimeout(resolve, 2000);
    });
  }

  /**
   * Send a text operation (for operational transform)
   */
  async sendOperation(operation: Omit<CollaborationOperation, 'id' | 'userId' | 'timestamp'>): Promise<void> {
    if (!this.socket || !this.currentUser || !this.currentSession) {
      throw new Error('Not connected to collaboration session');
    }

    const fullOperation: CollaborationOperation = {
      ...operation,
      id: this.generateOperationId(),
      userId: this.currentUser.id,
      timestamp: new Date()
    };

    // Add to local operations for operational transform
    this.localOperations.push(fullOperation);

    if (this.isOnline) {
      this.socket.emit('operation', {
        sessionId: this.currentSession.id,
        operation: fullOperation
      });
    } else {
      // Queue operation for when connection is restored
      this.operationQueue.push(fullOperation);
    }
  }

  /**
   * Send project update
   */
  async sendProjectUpdate(update: Omit<ProjectUpdate, 'userId' | 'timestamp'>): Promise<void> {
    if (!this.socket || !this.currentUser || !this.currentSession) {
      throw new Error('Not connected to collaboration session');
    }

    const fullUpdate: ProjectUpdate = {
      ...update,
      userId: this.currentUser.id,
      timestamp: new Date()
    };

    if (this.isOnline) {
      this.socket.emit('project_update', {
        sessionId: this.currentSession.id,
        update: fullUpdate
      });
    }
  }

  /**
   * Update user cursor position
   */
  async updateCursor(cursor: CollaborationUser['cursor']): Promise<void> {
    if (!this.socket || !this.currentUser || !this.currentSession) return;

    // Throttle cursor updates
    clearTimeout(this.cursorUpdateTimeout);
    this.cursorUpdateTimeout = setTimeout(() => {
      this.socket!.emit('cursor_update', {
        sessionId: this.currentSession!.id,
        userId: this.currentUser!.id,
        cursor
      });
    }, 100);
  }

  private cursorUpdateTimeout: NodeJS.Timeout | undefined;

  /**
   * Send presence heartbeat
   */
  private sendPresenceHeartbeat(): void {
    if (!this.socket || !this.currentUser || !this.currentSession) return;

    this.socket.emit('presence_heartbeat', {
      sessionId: this.currentSession.id,
      userId: this.currentUser.id,
      timestamp: new Date()
    });
  }

  /**
   * Get current session information
   */
  getCurrentSession(): CollaborationSession | null {
    return this.currentSession;
  }

  /**
   * Get current user information
   */
  getCurrentUser(): CollaborationUser | null {
    return this.currentUser;
  }

  /**
   * Check if currently connected to a session
   */
  isConnected(): boolean {
    return this.isOnline && this.currentSession !== null;
  }

  /**
   * Get online users in current session
   */
  getOnlineUsers(): CollaborationUser[] {
    return this.currentSession?.users.filter(u => u.isOnline) || [];
  }

  /**
   * Resolve conflict with specified resolution
   */
  async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
    if (!this.socket || !this.currentSession) {
      throw new Error('Not connected to collaboration session');
    }

    this.socket.emit('resolve_conflict', {
      sessionId: this.currentSession.id,
      conflictId,
      resolution
    });
  }

  /**
   * Disconnect from collaboration service
   */
  async disconnect(): Promise<void> {
    if (this.currentSession) {
      await this.leaveSession();
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.callbacks = {};
    this.isOnline = false;
  }

  // PRIVATE METHODS

  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.isOnline = true;
      this.reconnectAttempts = 0;
      this.callbacks.onConnectionStatusChanged?.(this.isOnline ? 'connected' : 'disconnected');
      
      // Send queued operations
      this.processOperationQueue();
      
      // Start presence heartbeat
      this.startPresenceHeartbeat();
    });

    this.socket.on('disconnect', () => {
      this.isOnline = false;
      this.callbacks.onConnectionStatusChanged?.('disconnected');
      this.stopPresenceHeartbeat();
    });

    this.socket.on('reconnect_attempt', () => {
      this.reconnectAttempts++;
      this.callbacks.onConnectionStatusChanged?.('reconnecting');
    });

    // Collaboration events
    this.socket.on('user_joined', (user: CollaborationUser) => {
      if (this.currentSession) {
        this.currentSession.users.push(user);
        this.callbacks.onUserJoined?.(user);
      }
    });

    this.socket.on('user_left', (userId: string) => {
      if (this.currentSession) {
        this.currentSession.users = this.currentSession.users.filter(u => u.id !== userId);
        this.callbacks.onUserLeft?.(userId);
      }
    });

    this.socket.on('cursor_update', ({ userId, cursor }: { userId: string; cursor: CollaborationUser['cursor'] }) => {
      if (this.currentSession) {
        const user = this.currentSession.users.find(u => u.id === userId);
        if (user) {
          if (cursor === undefined) {
            delete user.cursor;
          } else {
            user.cursor = cursor;
          }
          this.callbacks.onUserCursorUpdate?.(userId, cursor);
        }
      }
    });

    this.socket.on('operation', ({ operation }: { operation: CollaborationOperation }) => {
      // Apply operational transform
      const transformedOperation = this.transformOperation(operation);
      this.callbacks.onOperationReceived?.(transformedOperation);
    });

    this.socket.on('project_update', ({ update }: { update: ProjectUpdate }) => {
      this.callbacks.onProjectUpdate?.(update);
    });

    this.socket.on('operation_ack', ({ operationId }: { operationId: string }) => {
      this.acknowledgedOperations.add(operationId);
      this.localOperations = this.localOperations.filter(op => op.id !== operationId);
    });

    this.socket.on('conflict_detected', (conflict: { id: string; description: string; operations: CollaborationOperation[] }) => {
      this.callbacks.onConflictDetected?.(conflict);
    });

    this.socket.on('error', (error: string) => {
      this.callbacks.onError?.(error);
    });
  }

  private processOperationQueue(): void {
    if (!this.isOnline || !this.socket || !this.currentSession) return;

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift()!;
      this.socket.emit('operation', {
        sessionId: this.currentSession.id,
        operation
      });
    }
  }

  private transformOperation(operation: CollaborationOperation): CollaborationOperation {
    // Simple operational transform implementation
    // In production, use a more sophisticated OT library like ShareJS or Yjs
    
    let transformedOperation = { ...operation };
    
    // Transform against unacknowledged local operations
    for (const localOp of this.localOperations) {
      if (!this.acknowledgedOperations.has(localOp.id)) {
        transformedOperation = this.transformOperationPair(transformedOperation, localOp);
      }
    }
    
    return transformedOperation;
  }

  private transformOperationPair(op1: CollaborationOperation, op2: CollaborationOperation): CollaborationOperation {
    // Basic operational transform rules
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position <= op2.position) {
        return { ...op1, position: op1.position + (op2.content?.length || 0) };
      }
    } else if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position >= op2.position) {
        return { ...op1, position: op1.position + (op2.content?.length || 0) };
      }
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position > op2.position) {
        return { ...op1, position: Math.max(op2.position, op1.position - (op2.length || 0)) };
      }
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position >= op2.position + (op2.length || 0)) {
        return { ...op1, position: op1.position - (op2.length || 0) };
      } else if (op1.position + (op1.length || 0) <= op2.position) {
        return op1;
      } else {
        // Overlapping deletes - complex case
        return op1;
      }
    }
    
    return op1;
  }

  private presenceHeartbeatInterval: NodeJS.Timeout | undefined;

  private startPresenceHeartbeat(): void {
    this.stopPresenceHeartbeat();
    this.presenceHeartbeatInterval = setInterval(() => {
      this.sendPresenceHeartbeat();
    }, 30000); // Every 30 seconds
  }

  private stopPresenceHeartbeat(): void {
    if (this.presenceHeartbeatInterval) {
      clearInterval(this.presenceHeartbeatInterval);
      this.presenceHeartbeatInterval = undefined;
    }
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const collaborationService = CollaborationService.getInstance();