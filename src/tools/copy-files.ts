import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';

/**
 * 工具：复制文件或文件夹
 * 注册工具到MCP服务器
 * @param server MCP服务器实例
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'copy-files',
    {
      title: '复制文件',
      description:
        '复制文件或文件夹到目标位置。参数：sourcePath - 源文件/文件夹路径 (必需)；targetPath - 目标路径 (必需)；overwrite - 是否覆盖已存在文件 (可选，默认false)；preserveTimestamps - 是否保留时间戳 (可选，默认true)',
      inputSchema: {
        sourcePath: z.string(),
        targetPath: z.string(),
        overwrite: z.boolean().optional(),
        preserveTimestamps: z.boolean().optional()
      }
    },
    async ({
      sourcePath,
      targetPath,
      overwrite = false,
      preserveTimestamps = true
    }) => {
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

        // 获取源文件信息
        const sourceStats = await fs.stat(sourcePath);
        const isDirectory = sourceStats.isDirectory();
        const sourceSize = isDirectory
          ? await calculateDirectorySize(sourcePath)
          : sourceStats.size;

        // 确保目标目录存在
        const targetDir = isDirectory ? targetPath : path.dirname(targetPath);
        await fs.ensureDir(targetDir);

        // 执行复制操作
        const copyOptions: any = {
          overwrite: overwrite,
          preserveTimestamps: preserveTimestamps
        };

        await fs.copy(sourcePath, targetPath, copyOptions);

        // 验证复制是否成功
        if (!(await fs.pathExists(targetPath))) {
          return {
            content: [
              {
                type: 'text',
                text: '错误：复制操作完成但目标文件未找到'
              }
            ],
            isError: true
          };
        }

        // 验证复制后的文件
        await fs.stat(targetPath);

        // 计算文件数量（如果是目录）
        let fileCount = 1;
        if (isDirectory) {
          fileCount = await countFilesInDirectory(targetPath);
        }

        return {
          content: [
            {
              type: 'text',
              text: `复制完成！\n源路径: ${sourcePath}\n目标路径: ${targetPath}\n类型: ${isDirectory ? '文件夹' : '文件'}\n大小: ${Math.round(sourceSize / 1024)}KB\n${isDirectory ? `包含文件: ${fileCount} 个` : ''}\n保留时间戳: ${preserveTimestamps ? '是' : '否'}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `复制文件时发生错误: ${error instanceof Error ? error.message : String(error)}`
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
    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      const items = await fs.readdir(itemPath);
      for (const item of items) {
        await calculateSize(path.join(itemPath, item));
      }
    } else {
      totalSize += stats.size;
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
    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      const items = await fs.readdir(itemPath);
      for (const item of items) {
        await countFiles(path.join(itemPath, item));
      }
    } else {
      fileCount++;
    }
  };

  await countFiles(dirPath);
  return fileCount;
}

export default registerTool;
