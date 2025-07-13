import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import * as os from 'os';
import express from 'express';

import registryTools from './tools';

// 获取用户名
export const username: string = os.userInfo().username;

// 创建MCP服务器
const server = new McpServer({
  name: 'file-operation-server',
  version: '1.0.0'
});

// 注册工具
registryTools(server);

// 启动
async function main() {
  try {
    // Stdio服务器
    // const transport = new StdioServerTransport();
    // await server.connect(transport);
    // console.log('MCP文件操作服务器已启动...');

    // SSE服务器
    const app = express();
    app.use(express.json());

    // 存储传输会话
    const transports: { [sessionId: string]: SSEServerTransport } = {};

    // CORS 配置
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      );

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // SSE 连接端点
    app.get('/sse', async (req, res) => {
      console.log('新的SSE连接');

      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;

      // 清理断开的连接
      res.on('close', () => {
        console.log(`SSE连接断开: ${sessionId}`);
        delete transports[sessionId];
      });

      await server.connect(transport);
    });

    // 消息端点
    app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = transports[sessionId];

      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send('未找到会话ID对应的传输');
      }
    });

    // 健康检查端点
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        message: 'MCP文件操作服务器运行中',
        timestamp: new Date().toISOString()
      });
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`MCP文件操作服务器已启动在端口 ${PORT}`);
      console.log(`SSE端点: http://localhost:${PORT}/sse`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('启动服务器时发生错误:', error);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 启动服务器
main().catch((error) => {
  console.error('启动失败:', error);
  process.exit(1);
});
