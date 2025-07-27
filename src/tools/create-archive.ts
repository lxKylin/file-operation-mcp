import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import archiver from 'archiver';
import * as tar from 'tar';

/**
 * 工具：创建压缩文件
 * 注册工具到MCP服务器
 * @param server MCP服务器实例
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'create-archive',
    {
      title: '创建压缩文件',
      description:
        '将文件或文件夹压缩为ZIP或TAR格式。参数：files - 要压缩的文件/文件夹路径数组 (必需)；outputPath - 输出压缩文件路径 (必需)；format - 压缩格式 (可选，默认zip)；compressionLevel - 压缩级别 (可选，默认6)',
      inputSchema: {
        files: z.array(z.string()),
        outputPath: z.string(),
        format: z.enum(['zip', 'tar', 'tar.gz']).optional(),
        compressionLevel: z.number().min(0).max(9).optional()
      }
    },
    async ({ files, outputPath, format = 'zip', compressionLevel = 6 }) => {
      try {
        // 检查输入文件是否存在
        for (const file of files) {
          if (!(await fs.pathExists(file))) {
            return {
              content: [
                {
                  type: 'text',
                  text: `错误：文件或文件夹 ${file} 不存在`
                }
              ],
              isError: true
            };
          }
        }

        // 确保输出目录存在
        const outputDir = path.dirname(outputPath);
        await fs.ensureDir(outputDir);

        let totalOriginalSize = 0;

        // 计算原始文件总大小
        const calculateSize = async (filePath: string): Promise<number> => {
          const stats = await fs.stat(filePath);
          if (stats.isDirectory()) {
            const items = await fs.readdir(filePath);
            let size = 0;
            for (const item of items) {
              const itemPath = path.join(filePath, item);
              size += await calculateSize(itemPath);
            }
            return size;
          } else {
            return stats.size;
          }
        };

        for (const file of files) {
          totalOriginalSize += await calculateSize(file);
        }

        // 根据格式选择压缩方式
        if (format === 'zip') {
          await createZipArchive(files, outputPath, compressionLevel);
        } else if (format === 'tar') {
          await createTarArchive(files, outputPath, false);
        } else if (format === 'tar.gz') {
          await createTarArchive(files, outputPath, true);
        }

        // 获取压缩后文件大小
        const compressedStats = await fs.stat(outputPath);
        const compressedSize = compressedStats.size;
        const compressionRatio = Math.round(
          (1 - compressedSize / totalOriginalSize) * 100
        );

        return {
          content: [
            {
              type: 'text',
              text: `压缩完成！\n压缩文件: ${outputPath}\n格式: ${format.toUpperCase()}\n原始大小: ${Math.round(totalOriginalSize / 1024)}KB\n压缩后大小: ${Math.round(compressedSize / 1024)}KB\n压缩率: ${compressionRatio}%\n包含文件: ${files.length} 个`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `创建压缩文件时发生错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

/**
 * 创建ZIP压缩文件
 */
async function createZipArchive(
  files: string[],
  outputPath: string,
  compressionLevel: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: compressionLevel }
    });

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err: Error) => {
      reject(err);
    });

    archive.pipe(output);

    // 添加文件到压缩包
    files.forEach((file) => {
      const stats = fs.statSync(file);
      const fileName = path.basename(file);

      if (stats.isDirectory()) {
        archive.directory(file, fileName);
      } else {
        archive.file(file, { name: fileName });
      }
    });

    archive.finalize();
  });
}

/**
 * 创建TAR压缩文件
 */
async function createTarArchive(
  files: string[],
  outputPath: string,
  gzip: boolean
): Promise<void> {
  const tarOptions: any = {
    file: outputPath,
    gzip: gzip
  };

  // 创建文件列表，保持相对路径结构
  const fileList: string[] = [];

  for (const file of files) {
    const stats = await fs.stat(file);
    if (stats.isDirectory()) {
      // 递归添加目录中的所有文件
      const addDirectory = async (dirPath: string) => {
        const items = await fs.readdir(dirPath);
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const itemStats = await fs.stat(itemPath);
          if (itemStats.isDirectory()) {
            await addDirectory(itemPath);
          } else {
            fileList.push(itemPath);
          }
        }
      };
      await addDirectory(file);
    } else {
      fileList.push(file);
    }
  }

  await tar.create(tarOptions, fileList);
}

export default registerTool;
