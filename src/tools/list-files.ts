import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';

import * as os from 'os';

// 获取用户名
export const username: string = os.userInfo().username;

/**
 * 工具2：获取文件名称列表
 * 注册工具到MCP服务器
 * @param server MCP服务器实例
 */
const registerTool = (server: McpServer) => {
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
};

export default registerTool;
