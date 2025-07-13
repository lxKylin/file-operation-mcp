import { z } from 'zod';
import fs from 'fs-extra';

import { server, username } from '@/index';

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
