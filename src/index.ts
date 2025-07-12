import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';
import express from 'express';

// 创建MCP服务器
const server = new McpServer({
  name: 'file-operation-server',
  version: '1.0.0'
});

// 获取用户名
const username = os.userInfo().username;

// 工具1：统计文件夹中的文件数量
server.registerTool(
  'count-files',
  {
    title: '统计文件数量',
    description:
      '统计指定文件夹中的文件数量。参数：folderPath (可选) - 文件夹路径，默认为桌面',
    inputSchema: {
      folderPath: z.string().optional()
    }
  },
  async ({ folderPath }) => {
    try {
      // 默认使用桌面路径
      const targetPath = folderPath || `/Users/${username}/Desktop`;

      // 检查路径是否存在
      if (!(await fs.pathExists(targetPath))) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：路径 ${targetPath} 不存在`
            }
          ],
          isError: true
        };
      }

      // 读取目录
      const items = await fs.readdir(targetPath);
      const fileCount = items.length;

      return {
        content: [
          {
            type: 'text',
            text: `文件夹 ${targetPath} 中共有 ${fileCount} 个文件/文件夹`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `统计文件时发生错误: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// 工具2：获取文件名称列表
server.registerTool(
  'list-files',
  {
    title: '获取文件名称',
    description:
      '获取指定文件夹中的所有文件名称。参数：folderPath (可选) - 文件夹路径，默认为桌面；includeHidden (可选) - 是否包含隐藏文件，默认为false',
    inputSchema: {
      folderPath: z.string().optional(),
      includeHidden: z.boolean().optional()
    }
  },
  async ({ folderPath, includeHidden = false }) => {
    try {
      // 默认使用桌面路径
      const targetPath = folderPath || `/Users/${username}/Desktop`;

      // 检查路径是否存在
      if (!(await fs.pathExists(targetPath))) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：路径 ${targetPath} 不存在`
            }
          ],
          isError: true
        };
      }

      // 读取目录
      const items = await fs.readdir(targetPath);

      // 过滤隐藏文件
      const filteredItems = includeHidden
        ? items
        : items.filter((item) => !item.startsWith('.'));

      // 获取详细信息
      const fileDetails = await Promise.all(
        filteredItems.map(async (item) => {
          const itemPath = path.join(targetPath, item);
          const stats = await fs.stat(itemPath);
          return {
            name: item,
            type: stats.isDirectory() ? '文件夹' : '文件',
            size: stats.isFile() ? `${Math.round(stats.size / 1024)}KB` : '-'
          };
        })
      );

      const resultText =
        fileDetails.length > 0
          ? `文件夹 ${targetPath} 中的内容：\n` +
            fileDetails
              .map((item) => `- ${item.name} (${item.type}, ${item.size})`)
              .join('\n')
          : `文件夹 ${targetPath} 为空`;

      return {
        content: [
          {
            type: 'text',
            text: resultText
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `获取文件列表时发生错误: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// 工具3：压缩图片
server.registerTool(
  'compress-image',
  {
    title: '压缩图片',
    description: '压缩指定的图片文件',
    inputSchema: {
      imagePath: z.string().describe('图片文件路径'),
      quality: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('压缩质量 (1-100)，默认为80'),
      maxWidth: z.number().optional().describe('最大宽度，默认不限制'),
      maxHeight: z.number().optional().describe('最大高度，默认不限制'),
      outputPath: z
        .string()
        .optional()
        .describe('输出路径，默认为原文件名加_compressed后缀')
    }
  },
  async ({ imagePath, quality = 80, maxWidth, maxHeight, outputPath }) => {
    try {
      // 检查文件是否存在
      if (!(await fs.pathExists(imagePath))) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：图片文件 ${imagePath} 不存在`
            }
          ],
          isError: true
        };
      }

      // 检查是否为图片文件
      const validExtensions = [
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
        '.tiff',
        '.gif'
      ];
      const fileExtension = path.extname(imagePath).toLowerCase();
      if (!validExtensions.includes(fileExtension)) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：不支持的图片格式 ${fileExtension}`
            }
          ],
          isError: true
        };
      }

      // 生成输出路径
      const finalOutputPath =
        outputPath ||
        (() => {
          const dir = path.dirname(imagePath);
          const name = path.basename(imagePath, fileExtension);
          return path.join(dir, `${name}_compressed${fileExtension}`);
        })();

      // 获取原始文件大小
      const originalStats = await fs.stat(imagePath);
      const originalSize = Math.round(originalStats.size / 1024);

      // 压缩图片
      let sharpInstance = sharp(imagePath);

      // 设置尺寸限制
      if (maxWidth || maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // 根据文件类型设置压缩参数
      switch (fileExtension) {
        case '.jpg':
        case '.jpeg':
          sharpInstance = sharpInstance.jpeg({ quality });
          break;
        case '.png':
          sharpInstance = sharpInstance.png({
            compressionLevel: Math.floor((100 - quality) / 10),
            quality
          });
          break;
        case '.webp':
          sharpInstance = sharpInstance.webp({ quality });
          break;
        default:
          sharpInstance = sharpInstance.jpeg({ quality });
          break;
      }

      // 保存压缩后的图片
      await sharpInstance.toFile(finalOutputPath);

      // 获取压缩后文件大小
      const compressedStats = await fs.stat(finalOutputPath);
      const compressedSize = Math.round(compressedStats.size / 1024);
      const compressionRatio = Math.round(
        (1 - compressedSize / originalSize) * 100
      );

      return {
        content: [
          {
            type: 'text',
            text: `图片压缩成功！\n原始大小: ${originalSize}KB\n压缩后大小: ${compressedSize}KB\n压缩率: ${compressionRatio}%\n输出路径: ${finalOutputPath}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `压缩图片时发生错误: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

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
