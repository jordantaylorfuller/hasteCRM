# WebSocket & Real-time Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [WebSocket Server Setup](#websocket-server-setup)
3. [Authentication & Authorization](#authentication--authorization)
4. [Room Management](#room-management)
5. [Event Handling](#event-handling)
6. [Client Implementation](#client-implementation)
7. [Scaling WebSockets](#scaling-websockets)
8. [Error Handling & Reconnection](#error-handling--reconnection)
9. [Testing WebSocket Functionality](#testing-websocket-functionality)
10. [Production Considerations](#production-considerations)

## Overview

This guide provides complete implementation details for WebSocket-based real-time features in hasteCRM, including live collaboration, notifications, and presence tracking.

## WebSocket Server Setup

### Socket.IO Server Configuration

```typescript
// packages/websocket/src/main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { RedisIoAdapter } from './adapters/redis-io.adapter';
import { WebSocketModule } from './websocket.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as socketio from 'socket.io';

async function bootstrap() {
  const logger = new Logger('WebSocketServer');
  
  const app = await NestFactory.create(WebSocketModule);
  const configService = app.get(ConfigService);
  
  // Configure CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGINS').split(','),
    credentials: true,
  });

  // Use Redis adapter for scaling
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Start the WebSocket server
  const port = configService.get('WS_PORT', 3001);
  await app.listen(port);
  
  logger.log(`WebSocket server is running on port ${port}`);
}

bootstrap();
```

### Redis Adapter for Horizontal Scaling

```typescript
// packages/websocket/src/adapters/redis-io.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { INestApplication, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(
    app: INestApplication,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({
      url: this.configService.get('REDIS_URL'),
      password: this.configService.get('REDIS_PASSWORD'),
    });
    
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    
    this.logger.log('Redis adapter connected');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.configService.get('CORS_ORIGINS').split(','),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 60000,
      upgradeTimeout: 10000,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: true,
      // Custom handshake authentication
      allowRequest: async (req, callback) => {
        try {
          const token = this.extractToken(req);
          if (!token) {
            return callback('Unauthorized', false);
          }
          
          // Verify token (simplified - add your verification logic)
          const jwtService = new JwtService({
            secret: this.configService.get('JWT_SECRET'),
          });
          
          await jwtService.verifyAsync(token);
          callback(null, true);
        } catch (error) {
          callback('Unauthorized', false);
        }
      },
    });

    server.adapter(this.adapterConstructor);
    return server;
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check query params for token (for WebSocket upgrade)
    return request._query?.token || null;
  }
}
```

### WebSocket Gateway

```typescript
// packages/websocket/src/gateways/crm.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { ConnectionManager } from '../services/connection-manager.service';
import { RoomManager } from '../services/room-manager.service';
import { EventBroadcaster } from '../services/event-broadcaster.service';
import { PresenceService } from '../services/presence.service';
import { 
  JoinRoomDto, 
  LeaveRoomDto, 
  BroadcastEventDto,
  UpdatePresenceDto 
} from '../dto';

@WebSocketGateway({
  namespace: '/crm',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
@UseGuards(WsAuthGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class CrmGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CrmGateway.name);

  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly roomManager: RoomManager,
    private readonly eventBroadcaster: EventBroadcaster,
    private readonly presenceService: PresenceService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    
    // Set up middleware
    server.use(async (socket, next) => {
      try {
        const user = await this.authenticateSocket(socket);
        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  async handleConnection(socket: Socket) {
    try {
      const user = socket.data.user;
      
      this.logger.log(`Client connected: ${socket.id} (User: ${user.id})`);
      
      // Register connection
      await this.connectionManager.addConnection(socket.id, user.id, {
        workspaceId: user.workspaceId,
        role: user.role,
        connectedAt: new Date(),
      });

      // Join user's personal room
      socket.join(`user:${user.id}`);
      
      // Join workspace room
      socket.join(`workspace:${user.workspaceId}`);

      // Update presence
      await this.presenceService.setUserOnline(user.id, user.workspaceId);

      // Send connection acknowledgment
      socket.emit('connected', {
        socketId: socket.id,
        userId: user.id,
        workspaceId: user.workspaceId,
      });

      // Broadcast user online to workspace
      this.server.to(`workspace:${user.workspaceId}`).emit('user:online', {
        userId: user.id,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error('Connection error:', error);
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    try {
      const user = socket.data.user;
      
      this.logger.log(`Client disconnected: ${socket.id} (User: ${user?.id})`);
      
      if (user) {
        // Remove connection
        await this.connectionManager.removeConnection(socket.id);

        // Check if user has other active connections
        const hasOtherConnections = await this.connectionManager.userHasOtherConnections(
          user.id,
          socket.id
        );

        if (!hasOtherConnections) {
          // Update presence to offline
          await this.presenceService.setUserOffline(user.id, user.workspaceId);

          // Broadcast user offline to workspace
          this.server.to(`workspace:${user.workspaceId}`).emit('user:offline', {
            userId: user.id,
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      this.logger.error('Disconnect error:', error);
    }
  }

  @SubscribeMessage('join:room')
  async handleJoinRoom(
    @MessageBody() data: JoinRoomDto,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const user = socket.data.user;
      
      // Validate user can join room
      const canJoin = await this.roomManager.canUserJoinRoom(
        user.id,
        data.roomId,
        data.roomType
      );

      if (!canJoin) {
        throw new WsException('Unauthorized to join room');
      }

      // Join the room
      const roomName = `${data.roomType}:${data.roomId}`;
      socket.join(roomName);

      // Track room membership
      await this.roomManager.addUserToRoom(
        user.id,
        data.roomId,
        data.roomType,
        socket.id
      );

      // Get room participants
      const participants = await this.roomManager.getRoomParticipants(
        data.roomId,
        data.roomType
      );

      // Send room joined confirmation
      socket.emit('room:joined', {
        roomId: data.roomId,
        roomType: data.roomType,
        participants,
      });

      // Broadcast to room that user joined
      socket.to(roomName).emit('room:user:joined', {
        userId: user.id,
        roomId: data.roomId,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error('Join room error:', error);
      socket.emit('error', {
        event: 'join:room',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('leave:room')
  async handleLeaveRoom(
    @MessageBody() data: LeaveRoomDto,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const user = socket.data.user;
      const roomName = `${data.roomType}:${data.roomId}`;

      // Leave the room
      socket.leave(roomName);

      // Remove from room tracking
      await this.roomManager.removeUserFromRoom(
        user.id,
        data.roomId,
        data.roomType,
        socket.id
      );

      // Send confirmation
      socket.emit('room:left', {
        roomId: data.roomId,
        roomType: data.roomType,
      });

      // Broadcast to room that user left
      socket.to(roomName).emit('room:user:left', {
        userId: user.id,
        roomId: data.roomId,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error('Leave room error:', error);
    }
  }

  @SubscribeMessage('broadcast')
  async handleBroadcast(
    @MessageBody() data: BroadcastEventDto,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const user = socket.data.user;

      // Validate broadcast permissions
      const canBroadcast = await this.eventBroadcaster.canUserBroadcast(
        user.id,
        data.room,
        data.event
      );

      if (!canBroadcast) {
        throw new WsException('Unauthorized to broadcast');
      }

      // Prepare broadcast data
      const broadcastData = {
        ...data.data,
        _meta: {
          userId: user.id,
          timestamp: new Date(),
          socketId: socket.id,
        },
      };

      // Broadcast to room
      if (data.room) {
        socket.to(data.room).emit(data.event, broadcastData);
      } else {
        // Broadcast to all connections of the user
        socket.broadcast.emit(data.event, broadcastData);
      }

      // Log broadcast for analytics
      await this.eventBroadcaster.logBroadcast(
        user.id,
        data.event,
        data.room
      );

    } catch (error) {
      this.logger.error('Broadcast error:', error);
      socket.emit('error', {
        event: 'broadcast',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(
    @MessageBody() data: UpdatePresenceDto,
    @ConnectedSocket() socket: Socket,
  ) {
    try {
      const user = socket.data.user;

      // Update presence
      await this.presenceService.updatePresence(user.id, {
        status: data.status,
        lastActiveAt: new Date(),
        metadata: data.metadata,
      });

      // Broadcast presence update to workspace
      this.server.to(`workspace:${user.workspaceId}`).emit('presence:updated', {
        userId: user.id,
        status: data.status,
        metadata: data.metadata,
        timestamp: new Date(),
      });

    } catch (error) {
      this.logger.error('Presence update error:', error);
    }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @MessageBody() data: { roomId: string; roomType: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    const roomName = `${data.roomType}:${data.roomId}`;

    socket.to(roomName).emit('typing:started', {
      userId: user.id,
      roomId: data.roomId,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @MessageBody() data: { roomId: string; roomType: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    const roomName = `${data.roomType}:${data.roomId}`;

    socket.to(roomName).emit('typing:stopped', {
      userId: user.id,
      roomId: data.roomId,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('cursor:move')
  async handleCursorMove(
    @MessageBody() data: { roomId: string; x: number; y: number; elementId?: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    const roomName = `document:${data.roomId}`;

    // Throttle cursor events to prevent flooding
    socket.to(roomName).volatile.emit('cursor:moved', {
      userId: user.id,
      x: data.x,
      y: data.y,
      elementId: data.elementId,
      timestamp: Date.now(),
    });
  }

  private async authenticateSocket(socket: Socket): Promise<any> {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      throw new Error('No token provided');
    }

    // Implement your JWT verification logic here
    // Return user object with id, workspaceId, role, etc.
    return {
      id: 'user-id',
      workspaceId: 'workspace-id',
      role: 'user',
    };
  }
}
```

## Authentication & Authorization

### WebSocket Authentication Guard

```typescript
// packages/websocket/src/guards/ws-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const socket: Socket = context.switchToWs().getClient();
      const token = this.extractToken(socket);

      if (!token) {
        throw new WsException('Unauthorized');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // Add user to socket data
      socket.data.user = payload;
      return true;
    } catch (error) {
      throw new WsException('Unauthorized');
    }
  }

  private extractToken(socket: Socket): string | null {
    // Check auth object first (preferred method)
    if (socket.handshake.auth?.token) {
      return socket.handshake.auth.token;
    }

    // Check query params (fallback for older clients)
    if (socket.handshake.query?.token) {
      return socket.handshake.query.token as string;
    }

    // Check authorization header
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}
```

### Permission-based Room Access

```typescript
// packages/websocket/src/services/room-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@hastecrm/prisma';
import { RedisService } from '@hastecrm/redis';

export enum RoomType {
  WORKSPACE = 'workspace',
  CONTACT = 'contact',
  DEAL = 'deal',
  DOCUMENT = 'document',
  CHAT = 'chat',
}

@Injectable()
export class RoomManager {
  private readonly logger = new Logger(RoomManager.name);
  private readonly ROOM_PREFIX = 'room:';
  private readonly ROOM_TTL = 86400; // 24 hours

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canUserJoinRoom(
    userId: string,
    roomId: string,
    roomType: RoomType
  ): Promise<boolean> {
    switch (roomType) {
      case RoomType.WORKSPACE:
        return this.canJoinWorkspace(userId, roomId);
      
      case RoomType.CONTACT:
        return this.canAccessContact(userId, roomId);
      
      case RoomType.DEAL:
        return this.canAccessDeal(userId, roomId);
      
      case RoomType.DOCUMENT:
        return this.canAccessDocument(userId, roomId);
      
      case RoomType.CHAT:
        return this.canJoinChat(userId, roomId);
      
      default:
        return false;
    }
  }

  private async canJoinWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    return !!membership && membership.status === 'ACTIVE';
  }

  private async canAccessContact(userId: string, contactId: string): Promise<boolean> {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        workspace: {
          members: {
            some: {
              userId,
              status: 'ACTIVE',
            },
          },
        },
      },
    });

    return !!contact;
  }

  private async canAccessDeal(userId: string, dealId: string): Promise<boolean> {
    const deal = await this.prisma.deal.findFirst({
      where: {
        id: dealId,
        OR: [
          {
            ownerId: userId,
          },
          {
            collaborators: {
              some: {
                userId,
              },
            },
          },
          {
            workspace: {
              members: {
                some: {
                  userId,
                  role: { in: ['ADMIN', 'MANAGER'] },
                },
              },
            },
          },
        ],
      },
    });

    return !!deal;
  }

  private async canAccessDocument(userId: string, documentId: string): Promise<boolean> {
    // Check document permissions
    const hasAccess = await this.prisma.documentPermission.findFirst({
      where: {
        documentId,
        OR: [
          { userId },
          {
            document: {
              workspace: {
                members: {
                  some: {
                    userId,
                    status: 'ACTIVE',
                  },
                },
              },
            },
          },
        ],
      },
    });

    return !!hasAccess;
  }

  private async canJoinChat(userId: string, chatId: string): Promise<boolean> {
    const participant = await this.prisma.chatParticipant.findFirst({
      where: {
        chatId,
        userId,
        leftAt: null,
      },
    });

    return !!participant;
  }

  async addUserToRoom(
    userId: string,
    roomId: string,
    roomType: RoomType,
    socketId: string
  ): Promise<void> {
    const roomKey = `${this.ROOM_PREFIX}${roomType}:${roomId}`;
    const userKey = `${roomKey}:users`;

    // Add user to room set
    await this.redis.sadd(userKey, userId);
    
    // Track user's socket in room
    await this.redis.hset(`${roomKey}:sockets`, userId, socketId);
    
    // Set TTL
    await this.redis.expire(userKey, this.ROOM_TTL);
    
    // Track user's rooms
    await this.redis.sadd(`user:${userId}:rooms`, `${roomType}:${roomId}`);
  }

  async removeUserFromRoom(
    userId: string,
    roomId: string,
    roomType: RoomType,
    socketId: string
  ): Promise<void> {
    const roomKey = `${this.ROOM_PREFIX}${roomType}:${roomId}`;
    const userKey = `${roomKey}:users`;

    // Remove user from room
    await this.redis.srem(userKey, userId);
    
    // Remove socket tracking
    await this.redis.hdel(`${roomKey}:sockets`, userId);
    
    // Remove from user's rooms
    await this.redis.srem(`user:${userId}:rooms`, `${roomType}:${roomId}`);
  }

  async getRoomParticipants(
    roomId: string,
    roomType: RoomType
  ): Promise<string[]> {
    const roomKey = `${this.ROOM_PREFIX}${roomType}:${roomId}`;
    const userKey = `${roomKey}:users`;

    return this.redis.smembers(userKey);
  }

  async getUserRooms(userId: string): Promise<string[]> {
    return this.redis.smembers(`user:${userId}:rooms`);
  }

  async isUserInRoom(
    userId: string,
    roomId: string,
    roomType: RoomType
  ): Promise<boolean> {
    const roomKey = `${this.ROOM_PREFIX}${roomType}:${roomId}`;
    const userKey = `${roomKey}:users`;

    return this.redis.sismember(userKey, userId);
  }
}
```

## Room Management

### Advanced Room Features

```typescript
// packages/websocket/src/services/room-features.service.ts
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { RoomManager } from './room-manager.service';
import { PresenceService } from './presence.service';
import { MetricsService } from '@hastecrm/metrics';

@Injectable()
export class RoomFeaturesService {
  constructor(
    private readonly roomManager: RoomManager,
    private readonly presenceService: PresenceService,
    private readonly metricsService: MetricsService,
  ) {}

  async broadcastToRoom(
    server: Server,
    roomId: string,
    roomType: string,
    event: string,
    data: any,
    options?: {
      excludeUserId?: string;
      volatile?: boolean;
      compress?: boolean;
    }
  ) {
    const roomName = `${roomType}:${roomId}`;
    let broadcast = server.to(roomName);

    if (options?.excludeUserId) {
      const socketId = await this.getSocketIdForUser(
        options.excludeUserId,
        roomId,
        roomType
      );
      if (socketId) {
        broadcast = broadcast.except(socketId);
      }
    }

    if (options?.volatile) {
      broadcast = broadcast.volatile;
    }

    if (options?.compress) {
      broadcast = broadcast.compress(true);
    }

    broadcast.emit(event, data);

    // Track metrics
    this.metricsService.incrementCounter('websocket.broadcasts', {
      room_type: roomType,
      event,
    });
  }

  async getRoomPresence(roomId: string, roomType: string): Promise<any[]> {
    const participants = await this.roomManager.getRoomParticipants(
      roomId,
      roomType
    );

    const presenceData = await Promise.all(
      participants.map(async (userId) => {
        const presence = await this.presenceService.getUserPresence(userId);
        return {
          userId,
          ...presence,
        };
      })
    );

    return presenceData.filter((p) => p.status === 'online');
  }

  async lockRoom(
    roomId: string,
    roomType: string,
    userId: string,
    duration: number = 300 // 5 minutes default
  ): Promise<boolean> {
    const lockKey = `room:lock:${roomType}:${roomId}`;
    
    // Try to acquire lock
    const acquired = await this.redis.set(
      lockKey,
      userId,
      'NX',
      'EX',
      duration
    );

    return acquired === 'OK';
  }

  async unlockRoom(
    roomId: string,
    roomType: string,
    userId: string
  ): Promise<boolean> {
    const lockKey = `room:lock:${roomType}:${roomId}`;
    
    // Verify user owns the lock
    const lockOwner = await this.redis.get(lockKey);
    if (lockOwner !== userId) {
      return false;
    }

    await this.redis.del(lockKey);
    return true;
  }

  async getRoomLock(
    roomId: string,
    roomType: string
  ): Promise<string | null> {
    const lockKey = `room:lock:${roomType}:${roomId}`;
    return this.redis.get(lockKey);
  }

  private async getSocketIdForUser(
    userId: string,
    roomId: string,
    roomType: string
  ): Promise<string | null> {
    const roomKey = `room:${roomType}:${roomId}`;
    return this.redis.hget(`${roomKey}:sockets`, userId);
  }
}
```

## Event Handling

### Event Types and Handlers

```typescript
// packages/websocket/src/events/event-handlers.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';
import { InjectServer } from '../decorators/inject-server.decorator';

@Injectable()
export class CrmEventHandlers {
  constructor(
    @InjectServer() private readonly server: Server,
  ) {}

  @OnEvent('contact.created')
  async handleContactCreated(payload: {
    contactId: string;
    workspaceId: string;
    createdBy: string;
    data: any;
  }) {
    // Broadcast to workspace
    this.server.to(`workspace:${payload.workspaceId}`).emit('contact:created', {
      id: payload.contactId,
      ...payload.data,
      _meta: {
        createdBy: payload.createdBy,
        timestamp: new Date(),
      },
    });
  }

  @OnEvent('contact.updated')
  async handleContactUpdated(payload: {
    contactId: string;
    workspaceId: string;
    updatedBy: string;
    changes: any;
    previousValues: any;
  }) {
    // Broadcast to contact room and workspace
    this.server.to([
      `contact:${payload.contactId}`,
      `workspace:${payload.workspaceId}`,
    ]).emit('contact:updated', {
      id: payload.contactId,
      changes: payload.changes,
      _meta: {
        updatedBy: payload.updatedBy,
        timestamp: new Date(),
      },
    });
  }

  @OnEvent('deal.stage.changed')
  async handleDealStageChanged(payload: {
    dealId: string;
    workspaceId: string;
    previousStage: string;
    newStage: string;
    changedBy: string;
  }) {
    this.server.to([
      `deal:${payload.dealId}`,
      `workspace:${payload.workspaceId}`,
    ]).emit('deal:stage:changed', {
      dealId: payload.dealId,
      previousStage: payload.previousStage,
      newStage: payload.newStage,
      _meta: {
        changedBy: payload.changedBy,
        timestamp: new Date(),
      },
    });
  }

  @OnEvent('notification.created')
  async handleNotificationCreated(payload: {
    userId: string;
    notification: any;
  }) {
    // Send to user's personal room
    this.server.to(`user:${payload.userId}`).emit('notification:new', {
      ...payload.notification,
      _meta: {
        timestamp: new Date(),
      },
    });
  }

  @OnEvent('email.received')
  async handleEmailReceived(payload: {
    contactId: string;
    workspaceId: string;
    email: any;
  }) {
    this.server.to([
      `contact:${payload.contactId}`,
      `workspace:${payload.workspaceId}`,
    ]).emit('email:received', {
      contactId: payload.contactId,
      ...payload.email,
      _meta: {
        timestamp: new Date(),
      },
    });
  }

  @OnEvent('activity.created')
  async handleActivityCreated(payload: {
    entityType: string;
    entityId: string;
    workspaceId: string;
    activity: any;
  }) {
    const rooms = [
      `workspace:${payload.workspaceId}`,
      `${payload.entityType}:${payload.entityId}`,
    ];

    this.server.to(rooms).emit('activity:created', {
      entityType: payload.entityType,
      entityId: payload.entityId,
      ...payload.activity,
      _meta: {
        timestamp: new Date(),
      },
    });
  }

  @OnEvent('collaboration.invite')
  async handleCollaborationInvite(payload: {
    invitedUserId: string;
    invitedBy: string;
    resourceType: string;
    resourceId: string;
  }) {
    this.server.to(`user:${payload.invitedUserId}`).emit('collaboration:invited', {
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      invitedBy: payload.invitedBy,
      _meta: {
        timestamp: new Date(),
      },
    });
  }
}
```

### Event Rate Limiting

```typescript
// packages/websocket/src/middleware/rate-limiter.middleware.ts
import { Socket } from 'socket.io';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { WsException } from '@nestjs/websockets';

export class WebSocketRateLimiter {
  private limiters: Map<string, RateLimiterMemory> = new Map();

  constructor() {
    // Configure different rate limits for different events
    this.limiters.set('default', new RateLimiterMemory({
      points: 100,
      duration: 60, // per minute
    }));

    this.limiters.set('cursor', new RateLimiterMemory({
      points: 300,
      duration: 1, // per second
    }));

    this.limiters.set('typing', new RateLimiterMemory({
      points: 10,
      duration: 10, // per 10 seconds
    }));

    this.limiters.set('broadcast', new RateLimiterMemory({
      points: 50,
      duration: 60, // per minute
    }));
  }

  async checkLimit(socket: Socket, event: string): Promise<void> {
    const limiterName = this.getLimiterName(event);
    const limiter = this.limiters.get(limiterName);
    const key = `${socket.data.user?.id || socket.id}`;

    try {
      await limiter.consume(key);
    } catch (rejRes) {
      throw new WsException({
        event: 'rate_limit',
        message: 'Too many requests',
        retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 60,
      });
    }
  }

  private getLimiterName(event: string): string {
    if (event.startsWith('cursor:')) return 'cursor';
    if (event.startsWith('typing:')) return 'typing';
    if (event === 'broadcast') return 'broadcast';
    return 'default';
  }
}

// Apply as middleware
export function rateLimitMiddleware(rateLimiter: WebSocketRateLimiter) {
  return async (socket: Socket, next: (err?: any) => void) => {
    const originalEmit = socket.emit;
    
    socket.emit = async function (event: string, ...args: any[]) {
      try {
        await rateLimiter.checkLimit(socket, event);
        return originalEmit.apply(socket, [event, ...args]);
      } catch (error) {
        socket.emit('error', {
          event: 'rate_limit',
          message: error.message,
          retryAfter: error.retryAfter,
        });
        return false;
      }
    };
    
    next();
  };
}
```

## Client Implementation

### TypeScript Client SDK

```typescript
// packages/client-sdk/src/websocket-client.ts
import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';

export interface WebSocketClientOptions {
  url: string;
  token: string;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionAttempts?: number;
  timeout?: number;
}

export class CrmWebSocketClient extends EventEmitter {
  private socket: Socket;
  private reconnectAttempts = 0;
  private isConnected = false;
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private rooms: Set<string> = new Set();

  constructor(private options: WebSocketClientOptions) {
    super();
    this.initializeSocket();
  }

  private initializeSocket() {
    this.socket = io(this.options.url, {
      auth: {
        token: this.options.token,
      },
      transports: ['websocket', 'polling'],
      reconnection: this.options.reconnection ?? true,
      reconnectionDelay: this.options.reconnectionDelay ?? 1000,
      reconnectionAttempts: this.options.reconnectionAttempts ?? 5,
      timeout: this.options.timeout ?? 20000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', { socketId: this.socket.id });
      
      // Rejoin rooms after reconnection
      this.rejoinRooms();
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.emit('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      this.emit('connection_error', { 
        error: error.message,
        attempt: this.reconnectAttempts,
      });
    });

    this.socket.on('error', (error) => {
      this.emit('error', error);
    });

    // Proxy all other events
    this.socket.onAny((event, ...args) => {
      this.emit(event, ...args);
      
      // Call registered handlers
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.forEach(handler => handler(...args));
      }
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.options.timeout || 20000);

      this.socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.socket.connect();
    });
  }

  disconnect() {
    this.socket.disconnect();
    this.rooms.clear();
  }

  async joinRoom(roomId: string, roomType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit('join:room', { roomId, roomType }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          this.rooms.add(`${roomType}:${roomId}`);
          resolve();
        }
      });
    });
  }

  async leaveRoom(roomId: string, roomType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit('leave:room', { roomId, roomType }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          this.rooms.delete(`${roomType}:${roomId}`);
          resolve();
        }
      });
    });
  }

  broadcast(event: string, data: any, room?: string) {
    this.socket.emit('broadcast', {
      event,
      data,
      room,
    });
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
    super.on(event, handler);
  }

  off(event: string, handler?: Function): void {
    if (handler) {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
      super.off(event, handler);
    } else {
      this.eventHandlers.delete(event);
      super.removeAllListeners(event);
    }
  }

  updatePresence(status: string, metadata?: any) {
    this.socket.emit('presence:update', { status, metadata });
  }

  startTyping(roomId: string, roomType: string) {
    this.socket.emit('typing:start', { roomId, roomType });
  }

  stopTyping(roomId: string, roomType: string) {
    this.socket.emit('typing:stop', { roomId, roomType });
  }

  moveCursor(roomId: string, x: number, y: number, elementId?: string) {
    this.socket.volatile.emit('cursor:move', { roomId, x, y, elementId });
  }

  private rejoinRooms() {
    this.rooms.forEach(room => {
      const [roomType, roomId] = room.split(':');
      this.joinRoom(roomId, roomType).catch(error => {
        console.error(`Failed to rejoin room ${room}:`, error);
      });
    });
  }

  getConnectionState() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket.id,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}
```

### React Hooks for WebSocket

```typescript
// packages/client-sdk/src/react/hooks.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { CrmWebSocketClient } from '../websocket-client';

export interface UseWebSocketOptions {
  url: string;
  token: string;
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const clientRef = useRef<CrmWebSocketClient | null>(null);

  useEffect(() => {
    const client = new CrmWebSocketClient({
      url: options.url,
      token: options.token,
    });

    clientRef.current = client;

    client.on('connected', () => {
      setIsConnected(true);
      setConnectionError(null);
      options.onConnect?.();
    });

    client.on('disconnected', ({ reason }) => {
      setIsConnected(false);
      options.onDisconnect?.(reason);
    });

    client.on('error', (error) => {
      setConnectionError(error);
      options.onError?.(error);
    });

    if (options.autoConnect !== false) {
      client.connect().catch(error => {
        setConnectionError(error);
      });
    }

    return () => {
      client.disconnect();
    };
  }, [options.url, options.token]);

  const connect = useCallback(async () => {
    if (clientRef.current && !isConnected) {
      try {
        await clientRef.current.connect();
      } catch (error) {
        setConnectionError(error);
        throw error;
      }
    }
  }, [isConnected]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  return {
    client: clientRef.current,
    isConnected,
    connectionError,
    connect,
    disconnect,
  };
}

export function useWebSocketEvent<T = any>(
  client: CrmWebSocketClient | null,
  event: string,
  handler: (data: T) => void
) {
  useEffect(() => {
    if (!client) return;

    client.on(event, handler);

    return () => {
      client.off(event, handler);
    };
  }, [client, event, handler]);
}

export function useRoom(
  client: CrmWebSocketClient | null,
  roomId: string,
  roomType: string
) {
  const [isJoined, setIsJoined] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!client || !roomId) return;

    let mounted = true;

    const joinRoom = async () => {
      try {
        await client.joinRoom(roomId, roomType);
        if (mounted) {
          setIsJoined(true);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
          setIsJoined(false);
        }
      }
    };

    joinRoom();

    // Listen for room events
    const handleUserJoined = ({ userId }) => {
      setParticipants(prev => [...prev, userId]);
    };

    const handleUserLeft = ({ userId }) => {
      setParticipants(prev => prev.filter(id => id !== userId));
    };

    const handleRoomJoined = ({ participants: roomParticipants }) => {
      setParticipants(roomParticipants);
    };

    client.on('room:user:joined', handleUserJoined);
    client.on('room:user:left', handleUserLeft);
    client.on('room:joined', handleRoomJoined);

    return () => {
      mounted = false;
      if (isJoined) {
        client.leaveRoom(roomId, roomType).catch(console.error);
      }
      client.off('room:user:joined', handleUserJoined);
      client.off('room:user:left', handleUserLeft);
      client.off('room:joined', handleRoomJoined);
    };
  }, [client, roomId, roomType]);

  return {
    isJoined,
    participants,
    error,
  };
}

export function usePresence(
  client: CrmWebSocketClient | null,
  workspaceId: string
) {
  const [presenceMap, setPresenceMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!client) return;

    const handlePresenceUpdate = ({ userId, status, metadata }) => {
      setPresenceMap(prev => {
        const next = new Map(prev);
        next.set(userId, { status, metadata, timestamp: new Date() });
        return next;
      });
    };

    const handleUserOnline = ({ userId }) => {
      setPresenceMap(prev => {
        const next = new Map(prev);
        next.set(userId, { status: 'online', timestamp: new Date() });
        return next;
      });
    };

    const handleUserOffline = ({ userId }) => {
      setPresenceMap(prev => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    };

    client.on('presence:updated', handlePresenceUpdate);
    client.on('user:online', handleUserOnline);
    client.on('user:offline', handleUserOffline);

    return () => {
      client.off('presence:updated', handlePresenceUpdate);
      client.off('user:online', handleUserOnline);
      client.off('user:offline', handleUserOffline);
    };
  }, [client, workspaceId]);

  const updateMyPresence = useCallback(
    (status: string, metadata?: any) => {
      client?.updatePresence(status, metadata);
    },
    [client]
  );

  return {
    presenceMap,
    onlineUsers: Array.from(presenceMap.keys()),
    updateMyPresence,
  };
}
```

## Scaling WebSockets

### Redis Pub/Sub Adapter

```typescript
// packages/websocket/src/adapters/redis-pubsub.adapter.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';

@Injectable()
export class RedisPubSubAdapter extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubAdapter.name);
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private isConnected = false;

  async connect(redisUrl: string): Promise<void> {
    this.publisher = createClient({ url: redisUrl });
    this.subscriber = this.publisher.duplicate();

    await Promise.all([
      this.publisher.connect(),
      this.subscriber.connect(),
    ]);

    this.isConnected = true;
    this.logger.log('Redis PubSub connected');
  }

  async publish(channel: string, message: any): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis PubSub not connected');
    }

    const serialized = JSON.stringify(message);
    await this.publisher.publish(channel, serialized);
  }

  async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis PubSub not connected');
    }

    await this.subscriber.subscribe(channel, (message) => {
      try {
        const parsed = JSON.parse(message);
        handler(parsed);
      } catch (error) {
        this.logger.error(`Failed to parse message from ${channel}:`, error);
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await Promise.all([
        this.publisher.quit(),
        this.subscriber.quit(),
      ]);
      this.isConnected = false;
    }
  }
}
```

### Sticky Sessions Configuration

```yaml
# k8s/websocket-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: websocket-service
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-backend-protocol: tcp
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: 'true'
    service.beta.kubernetes.io/aws-load-balancer-type: 'nlb'
spec:
  type: LoadBalancer
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 86400
  selector:
    app: websocket
  ports:
    - port: 443
      targetPort: 3001
      protocol: TCP
```

## Error Handling & Reconnection

### Client-side Reconnection Logic

```typescript
// packages/client-sdk/src/reconnection-manager.ts
export class ReconnectionManager {
  private attempts = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly maxAttempts: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly factor: number;

  constructor(options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}) {
    this.maxAttempts = options.maxAttempts ?? 5;
    this.baseDelay = options.baseDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 30000;
    this.factor = options.factor ?? 2;
  }

  scheduleReconnect(callback: () => void): void {
    if (this.attempts >= this.maxAttempts) {
      throw new Error('Max reconnection attempts reached');
    }

    const delay = this.calculateDelay();
    this.attempts++;

    this.timer = setTimeout(() => {
      callback();
    }, delay);
  }

  reset(): void {
    this.attempts = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private calculateDelay(): number {
    const delay = Math.min(
      this.baseDelay * Math.pow(this.factor, this.attempts),
      this.maxDelay
    );
    
    // Add jitter
    return delay + Math.random() * 1000;
  }

  getAttempts(): number {
    return this.attempts;
  }

  canRetry(): boolean {
    return this.attempts < this.maxAttempts;
  }
}
```

## Testing WebSocket Functionality

### Unit Tests

```typescript
// packages/websocket/src/gateways/__tests__/crm.gateway.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CrmGateway } from '../crm.gateway';
import { ConnectionManager } from '../../services/connection-manager.service';
import { RoomManager } from '../../services/room-manager.service';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';

describe('CrmGateway', () => {
  let gateway: CrmGateway;
  let connectionManager: jest.Mocked<ConnectionManager>;
  let roomManager: jest.Mocked<RoomManager>;

  const mockSocket = {
    id: 'socket-123',
    data: {
      user: {
        id: 'user-123',
        workspaceId: 'workspace-123',
        role: 'user',
      },
    },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    broadcast: {
      emit: jest.fn(),
    },
    disconnect: jest.fn(),
  } as unknown as Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrmGateway,
        {
          provide: ConnectionManager,
          useValue: {
            addConnection: jest.fn(),
            removeConnection: jest.fn(),
            userHasOtherConnections: jest.fn(),
          },
        },
        {
          provide: RoomManager,
          useValue: {
            canUserJoinRoom: jest.fn(),
            addUserToRoom: jest.fn(),
            removeUserFromRoom: jest.fn(),
            getRoomParticipants: jest.fn(),
          },
        },
        // ... other mocked services
      ],
    }).compile();

    gateway = module.get<CrmGateway>(CrmGateway);
    connectionManager = module.get(ConnectionManager);
    roomManager = module.get(RoomManager);
  });

  describe('handleConnection', () => {
    it('should register new connection', async () => {
      await gateway.handleConnection(mockSocket);

      expect(connectionManager.addConnection).toHaveBeenCalledWith(
        'socket-123',
        'user-123',
        expect.objectContaining({
          workspaceId: 'workspace-123',
          role: 'user',
        })
      );

      expect(mockSocket.join).toHaveBeenCalledWith('user:user-123');
      expect(mockSocket.join).toHaveBeenCalledWith('workspace:workspace-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', expect.any(Object));
    });
  });

  describe('handleJoinRoom', () => {
    it('should allow authorized user to join room', async () => {
      roomManager.canUserJoinRoom.mockResolvedValue(true);
      roomManager.getRoomParticipants.mockResolvedValue(['user-123', 'user-456']);

      await gateway.handleJoinRoom(
        { roomId: 'contact-123', roomType: 'contact' },
        mockSocket
      );

      expect(roomManager.canUserJoinRoom).toHaveBeenCalledWith(
        'user-123',
        'contact-123',
        'contact'
      );
      expect(mockSocket.join).toHaveBeenCalledWith('contact:contact-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('room:joined', expect.any(Object));
    });

    it('should reject unauthorized user', async () => {
      roomManager.canUserJoinRoom.mockResolvedValue(false);

      await gateway.handleJoinRoom(
        { roomId: 'contact-123', roomType: 'contact' },
        mockSocket
      );

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        event: 'join:room',
        message: 'Unauthorized to join room',
      });
    });
  });
});
```

### Integration Tests

```typescript
// packages/websocket/e2e/websocket.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Socket as ClientSocket } from 'socket.io-client';
import { Server } from 'socket.io';
import { WebSocketModule } from '../src/websocket.module';
import { createClient } from './utils/create-client';

describe('WebSocket E2E', () => {
  let app: INestApplication;
  let server: Server;
  let client: ClientSocket;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WebSocketModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(3001);

    // Get auth token (implement your auth logic)
    authToken = 'test-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    client = await createClient('http://localhost:3001', authToken);
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('Connection', () => {
    it('should connect with valid token', (done) => {
      client.on('connected', (data) => {
        expect(data).toHaveProperty('socketId');
        expect(data).toHaveProperty('userId');
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      const invalidClient = createClient('http://localhost:3001', 'invalid-token');
      
      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Unauthorized');
        invalidClient.disconnect();
        done();
      });
    });
  });

  describe('Room Management', () => {
    it('should join and leave rooms', (done) => {
      let joined = false;

      client.on('room:joined', (data) => {
        expect(data.roomId).toBe('test-room');
        joined = true;
        
        // Now leave the room
        client.emit('leave:room', {
          roomId: 'test-room',
          roomType: 'contact',
        });
      });

      client.on('room:left', (data) => {
        expect(joined).toBe(true);
        expect(data.roomId).toBe('test-room');
        done();
      });

      // Join room
      client.emit('join:room', {
        roomId: 'test-room',
        roomType: 'contact',
      });
    });
  });

  describe('Real-time Events', () => {
    it('should broadcast events to room members', (done) => {
      const client2 = createClient('http://localhost:3001', authToken);
      
      client2.on('connected', () => {
        // Both clients join the same room
        client.emit('join:room', {
          roomId: 'broadcast-test',
          roomType: 'contact',
        });
        
        client2.emit('join:room', {
          roomId: 'broadcast-test',
          roomType: 'contact',
        });
      });

      client2.on('room:joined', () => {
        // Client 1 broadcasts
        client.emit('broadcast', {
          room: 'contact:broadcast-test',
          event: 'test:event',
          data: { message: 'Hello' },
        });
      });

      client2.on('test:event', (data) => {
        expect(data.message).toBe('Hello');
        expect(data._meta).toHaveProperty('userId');
        expect(data._meta).toHaveProperty('timestamp');
        client2.disconnect();
        done();
      });
    });
  });

  describe('Presence', () => {
    it('should update and broadcast presence', (done) => {
      client.on('presence:updated', (data) => {
        expect(data.userId).toBeDefined();
        expect(data.status).toBe('busy');
        expect(data.metadata).toEqual({ currentTask: 'testing' });
        done();
      });

      client.emit('presence:update', {
        status: 'busy',
        metadata: { currentTask: 'testing' },
      });
    });
  });
});
```

## Production Considerations

### Health Checks

```typescript
// packages/websocket/src/health/websocket-health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Server } from 'socket.io';
import { InjectServer } from '../decorators/inject-server.decorator';
import { ConnectionManager } from '../services/connection-manager.service';

@Controller('health')
export class WebSocketHealthController {
  constructor(
    @InjectServer() private readonly server: Server,
    private readonly connectionManager: ConnectionManager,
  ) {}

  @Get()
  async health() {
    const sockets = await this.server.fetchSockets();
    const connections = await this.connectionManager.getConnectionStats();

    return {
      status: 'healthy',
      timestamp: new Date(),
      stats: {
        totalSockets: sockets.length,
        uniqueUsers: connections.uniqueUsers,
        rooms: await this.getRoomStats(),
      },
    };
  }

  @Get('/ready')
  async ready() {
    // Check Redis connection
    const redisHealthy = await this.checkRedisHealth();
    
    if (!redisHealthy) {
      throw new Error('Redis not healthy');
    }

    return {
      status: 'ready',
      timestamp: new Date(),
    };
  }

  private async getRoomStats() {
    const rooms = this.server.sockets.adapter.rooms;
    const stats = {
      total: rooms.size,
      types: {
        workspace: 0,
        contact: 0,
        deal: 0,
        document: 0,
        user: 0,
      },
    };

    rooms.forEach((sockets, room) => {
      const [type] = room.split(':');
      if (stats.types[type] !== undefined) {
        stats.types[type]++;
      }
    });

    return stats;
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      // Implement Redis health check
      return true;
    } catch {
      return false;
    }
  }
}
```

### Monitoring and Metrics

```typescript
// packages/websocket/src/monitoring/websocket-metrics.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class WebSocketMetrics {
  private readonly connectionGauge: Gauge;
  private readonly messageCounter: Counter;
  private readonly messageLatency: Histogram;
  private readonly roomGauge: Gauge;
  private readonly errorCounter: Counter;

  constructor() {
    this.connectionGauge = new Gauge({
      name: 'websocket_connections_total',
      help: 'Total number of WebSocket connections',
      labelNames: ['namespace'],
    });

    this.messageCounter = new Counter({
      name: 'websocket_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['event', 'direction'],
    });

    this.messageLatency = new Histogram({
      name: 'websocket_message_duration_seconds',
      help: 'WebSocket message processing duration',
      labelNames: ['event'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    });

    this.roomGauge = new Gauge({
      name: 'websocket_rooms_total',
      help: 'Total number of active rooms',
      labelNames: ['type'],
    });

    this.errorCounter = new Counter({
      name: 'websocket_errors_total',
      help: 'Total number of WebSocket errors',
      labelNames: ['type', 'event'],
    });

    // Register metrics
    register.registerMetric(this.connectionGauge);
    register.registerMetric(this.messageCounter);
    register.registerMetric(this.messageLatency);
    register.registerMetric(this.roomGauge);
    register.registerMetric(this.errorCounter);
  }

  incrementConnections(namespace = 'default') {
    this.connectionGauge.inc({ namespace });
  }

  decrementConnections(namespace = 'default') {
    this.connectionGauge.dec({ namespace });
  }

  recordMessage(event: string, direction: 'in' | 'out') {
    this.messageCounter.inc({ event, direction });
  }

  recordMessageLatency(event: string, duration: number) {
    this.messageLatency.observe({ event }, duration);
  }

  updateRoomCount(type: string, count: number) {
    this.roomGauge.set({ type }, count);
  }

  recordError(type: string, event?: string) {
    this.errorCounter.inc({ type, event: event || 'unknown' });
  }
}
```

This comprehensive WebSocket implementation guide provides all the patterns and code needed for real-time features in hasteCRM.