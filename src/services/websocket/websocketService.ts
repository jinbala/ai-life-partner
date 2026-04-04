/**
 * WebSocket 服务
 * 提供实时通信能力
 */

import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { logger } from '../../utils/logger';

export interface WSMessage {
  type: 'chat' | 'heartbeat' | 'error' | 'success';
  payload: any;
  requestId?: string;
}

interface WSClient {
  ws: WebSocket;
  userId: string;
  isAlive: boolean;
}

/**
 * WebSocket 服务
 */
export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * 初始化 WebSocket 服务器
   */
  init(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => {
      const userId = this.getUserIdFromRequest(req);
      this.handleConnection(ws, userId);
    });

    // 心跳检测
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, id) => {
        if (!client.isAlive) {
          this.disconnect(id);
          return;
        }
        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000);

    logger.info('[WebSocket] 服务已启动');
  }

  /**
   * 从请求中获取用户 ID
   */
  private getUserIdFromRequest(req: any): string {
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('userId') || 'anonymous';
  }

  /**
   * 处理连接
   */
  private handleConnection(ws: WebSocket, userId: string): void {
    const clientId = `${userId}_${Date.now()}`;

    const client: WSClient = {
      ws,
      userId,
      isAlive: true,
    };

    this.clients.set(clientId, client);
    logger.info('[WebSocket] 新连接', { clientId, userId, total: this.clients.size });

    // 发送欢迎消息
    this.send(clientId, {
      type: 'success',
      payload: { message: '连接成功', clientId },
    });

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (data) => {
      this.handleMessage(clientId, data.toString());
    });

    ws.on('close', () => {
      this.disconnect(clientId);
    });

    ws.on('error', (error) => {
      logger.error('[WebSocket] 错误', { clientId, error });
      this.disconnect(clientId);
    });
  }

  /**
   * 处理消息
   */
  private handleMessage(clientId: string, data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);
      logger.debug('[WebSocket] 收到消息', { clientId, type: message.type });

      // 这里可以添加消息处理逻辑
      // 目前只是简单地广播给其他客户端
    } catch (error) {
      this.send(clientId, {
        type: 'error',
        payload: { message: '无效的消息格式' },
      });
    }
  }

  /**
   * 断开连接
   */
  private disconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.close();
      this.clients.delete(clientId);
      logger.info('[WebSocket] 连接断开', { clientId, remaining: this.clients.size });
    }
  }

  /**
   * 发送消息
   */
  send(clientId: string, message: WSMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('[WebSocket] 发送失败', { clientId, error });
      return false;
    }
  }

  /**
   * 广播消息
   */
  broadcast(message: WSMessage, excludeClientId?: string): void {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        this.send(clientId, message);
      }
    });
  }

  /**
   * 发送给特定用户的所有连接
   */
  sendToUser(userId: string, message: WSMessage): number {
    let count = 0;
    this.clients.forEach((client, clientId) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        if (this.send(clientId, message)) {
          count++;
        }
      }
    });
    return count;
  }

  /**
   * 获取连接数
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * 获取在线用户数
   */
  getUserCount(): number {
    const users = new Set(Array.from(this.clients.values()).map(c => c.userId));
    return users.size;
  }

  /**
   * 关闭服务
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.clients.forEach((client, id) => {
      client.ws.close();
    });
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    logger.info('[WebSocket] 服务已关闭');
  }
}
