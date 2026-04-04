/**
 * 日志系统
 * 支持多级别日志、彩色输出、文件记录
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  module?: string;
  timestamp?: boolean;
  color?: boolean;
}

const LOG_COLORS = {
  debug: '\x1b[36m',    // Cyan
  info: '\x1b[32m',     // Green
  warn: '\x1b[33m',     // Yellow
  error: '\x1b[31m',    // Red
  reset: '\x1b[0m',
  time: '\x1b[90m',     // Gray
  module: '\x1b[35m',   // Purple
};

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

let currentLevel: LogLevel = 'debug';
let logToFile = false;
let fileStreams: any[] = [];

/**
 * 设置日志级别
 */
export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

/**
 * 启用文件日志
 */
export function enableFileLog(filePath: string) {
  logToFile = true;
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const stream = fs.createWriteStream(filePath, { flags: 'a' });
    fileStreams.push(stream);
  } catch (error) {
    console.error('[Logger] 启用文件日志失败:', error);
  }
}

/**
 * 核心日志函数
 */
function log(level: LogLevel, message: string, meta?: any, options: LogOptions = {}) {
  // 检查日志级别
  if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(currentLevel)) {
    return;
  }

  const { module, timestamp = true, color = true } = options;
  const parts: string[] = [];

  // 时间戳
  if (timestamp) {
    const time = new Date().toISOString();
    parts.push(color ? `${LOG_COLORS.time}[${time}]${LOG_COLORS.reset}` : `[${time}]`);
  }

  // 日志级别
  parts.push(color ? `${LOG_COLORS[level]}[${level.toUpperCase()}]${LOG_COLORS.reset}` : `[${level.toUpperCase()}]`);

  // 模块名
  if (module) {
    parts.push(color ? `${LOG_COLORS.module}[${module}]${LOG_COLORS.reset}` : `[${module}]`);
  }

  // 消息
  parts.push(message);

  // 元数据
  if (meta !== undefined) {
    const metaStr = typeof meta === 'object' ? JSON.stringify(meta, null, 2) : String(meta);
    parts.push(color ? `${LOG_COLORS.time}${metaStr}${LOG_COLORS.reset}` : metaStr);
  }

  const logLine = parts.join(' ');

  // 输出到控制台
  console.log(logLine);

  // 输出到文件
  if (logToFile && fileStreams.length > 0) {
    const plainLine = `${new Date().toISOString()} [${level.toUpperCase()}]${module ? `[${module}]` : ''} ${message}${meta ? ' ' + JSON.stringify(meta) : ''}\n`;
    fileStreams.forEach(stream => stream.write(plainLine));
  }

  // 错误日志额外输出到 stderr
  if (level === 'error') {
    console.error(logLine);
  }
}

/**
 * 日志 API
 */
export const logger = {
  debug: (message: string, meta?: any, options?: LogOptions) =>
    log('debug', message, meta, options),

  info: (message: string, meta?: any, options?: LogOptions) =>
    log('info', message, meta, options),

  warn: (message: string, meta?: any, options?: LogOptions) =>
    log('warn', message, meta, options),

  error: (message: string, error?: any, options?: LogOptions) => {
    const meta = error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : undefined;
    log('error', message, meta, options);
  },

  /**
   * 创建带模块名的日志实例
   */
  create(module: string) {
    return {
      debug: (message: string, meta?: any) => log('debug', message, meta, { module }),
      info: (message: string, meta?: any) => log('info', message, meta, { module }),
      warn: (message: string, meta?: any) => log('warn', message, meta, { module }),
      error: (message: string, error?: any) => log('error', message, error, { module }),
    };
  },
};

// 导出默认
export default logger;
