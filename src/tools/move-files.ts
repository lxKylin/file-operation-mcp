import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';

/**
 * 工具：移动文件或文件夹
 * 注册工具到MCP服务器
 * @param server MCP服务器实例
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'move-files',
    {
      title: '移动文件',
      description:
        '移动文件或文件夹到目标位置。参数：sourcePath - 源文件/文件夹路径 (必需)；targetPath - 目标路径 (必需)；overwrite - 是否覆盖已存在文件 (可选，默认false)',
      inputSchema: {
        sourcePath: z.string(),
        targetPath: z.string(),
        overwrite: z.boolean().optional()
      }
    },
    async ({ sourcePath, targetPath, overwrite = false }) => {
      try {
        // 检查源文件是否存在
        if (!(await fs.pathExists(sourcePath))) {
          return {
            content: [
              {
                type: 'text',
                text: `错误：源文件或文件夹 ${sourcePath} 不存在`
              }
            ],
            isError: true
          };
        }

        // 检查源路径和目标路径是否相同
        const absoluteSource = path.resolve(sourcePath);
        const absoluteTarget = path.resolve(targetPath);
        if (absoluteSource === absoluteTarget) {
          return {
            content: [
              {
                type: 'text',
                text: '错误：源路径和目标路径不能相同'
              }
            ],
            isError: true
          };
        }

        // 检查目标是否已存在
        const targetExists = await fs.pathExists(targetPath);
        if (targetExists && !overwrite) {
          return {
            content: [
              {
                type: 'text',
                text: `错误：目标路径 ${targetPath} 已存在，请设置 overwrite=true 来覆盖`
              }
            ],
            isError: true
          };
        }

        // 获取源文件信息（在移动前）
        const sourceStats = await fs.stat(sourcePath);
        const isDirectory = sourceStats.isDirectory();
        const sourceSize = isDirectory
          ? await calculateDirectorySize(sourcePath)
          : sourceStats.size;

        // 计算文件数量（如果是目录）
        let fileCount = 1;
        if (isDirectory) {
          fileCount = await countFilesInDirectory(sourcePath);
        }

        // 确保目标目录存在
        const targetDir = isDirectory
          ? path.dirname(targetPath)
          : path.dirname(targetPath);
        await fs.ensureDir(targetDir);

        // 执行移动操作
        await fs.move(sourcePath, targetPath, { overwrite: overwrite });

        // 验证移动是否成功
        if (!(await fs.pathExists(targetPath))) {
          return {
            content: [
              {
                type: 'text',
                text: '错误：移动操作完成但目标文件未找到'
              }
            ],
            isError: true
          };
        }

        // 验证源文件已被移除
        if (await fs.pathExists(sourcePath)) {
          return {
            content: [
              {
                type: 'text',
                text: '警告：移动操作完成但源文件仍然存在'
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `移动完成！\n源路径: ${sourcePath}\n目标路径: ${targetPath}\n类型: ${isDirectory ? '文件夹' : '文件'}\n大小: ${Math.round(sourceSize / 1024)}KB\n${isDirectory ? `包含文件: ${fileCount} 个` : ''}\n操作: ${targetExists && overwrite ? '覆盖移动' : '新建移动'}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `移动文件时发生错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

/**
 * 计算目录大小
 */
async function calculateDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  const calculateSize = async (itemPath: string): Promise<void> => {
    try {
      const stats = await fs.stat(itemPath);
      if (stats.isDirectory()) {
        const items = await fs.readdir(itemPath);
        for (const item of items) {
          await calculateSize(path.join(itemPath, item));
        }
      } else {
        totalSize += stats.size;
      }
    } catch {
      // 忽略无法访问的文件
    }
  };

  await calculateSize(dirPath);
  return totalSize;
}

/**
 * 统计目录中的文件数量
 */
async function countFilesInDirectory(dirPath: string): Promise<number> {
  let fileCount = 0;

  const countFiles = async (itemPath: string): Promise<void> => {
    try {
      const stats = await fs.stat(itemPath);
      if (stats.isDirectory()) {
        const items = await fs.readdir(itemPath);
        for (const item of items) {
          await countFiles(path.join(itemPath, item));
        }
      } else {
        fileCount++;
      }
    } catch {
      // 忽略无法访问的文件
    }
  };

  await countFiles(dirPath);
  return fileCount;
}

export default registerTool;
