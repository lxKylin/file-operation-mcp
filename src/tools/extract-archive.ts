import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import extractZip from 'extract-zip';
import * as tar from 'tar';

/**
 * 工具：解压文件
 * 注册工具到MCP服务器
 * @param server MCP服务器实例
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'extract-archive',
    {
      title: '解压文件',
      description:
        '解压ZIP、TAR或TAR.GZ文件到指定目录。参数：archivePath - 压缩文件路径 (必需)；extractTo - 解压目标目录 (必需)；overwrite - 是否覆盖已存在文件 (可选，默认false)',
      inputSchema: {
        archivePath: z.string(),
        extractTo: z.string(),
        overwrite: z.boolean().optional()
      }
    },
    async ({ archivePath, extractTo, overwrite = false }) => {
      try {
        // 检查压缩文件是否存在
        if (!(await fs.pathExists(archivePath))) {
          return {
            content: [
              {
                type: 'text',
                text: `错误：压缩文件 ${archivePath} 不存在`
              }
            ],
            isError: true
          };
        }

        // 检查文件格式
        const fileExtension = path.extname(archivePath).toLowerCase();
        const supportedFormats = ['.zip', '.tar', '.gz', '.tgz'];

        // 特殊处理 .tar.gz
        const fileName = path.basename(archivePath).toLowerCase();
        const isTarGz =
          fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz');

        if (
          !supportedFormats.some((ext) =>
            archivePath.toLowerCase().endsWith(ext)
          ) &&
          !isTarGz
        ) {
          return {
            content: [
              {
                type: 'text',
                text: `错误：不支持的压缩格式。支持的格式：ZIP, TAR, TAR.GZ, TGZ`
              }
            ],
            isError: true
          };
        }

        // 确保解压目录存在
        await fs.ensureDir(extractTo);

        // 检查目标目录是否为空（如果不覆盖）
        if (!overwrite) {
          const existingFiles = await fs.readdir(extractTo);
          if (existingFiles.length > 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `错误：目标目录 ${extractTo} 不为空，请设置 overwrite=true 来覆盖现有文件`
                }
              ],
              isError: true
            };
          }
        }

        let extractedFiles: string[] = [];
        let format = '';

        // 根据文件格式选择解压方式
        if (fileExtension === '.zip') {
          format = 'ZIP';
          extractedFiles = await extractZipFile(archivePath, extractTo);
        } else if (
          isTarGz ||
          fileExtension === '.gz' ||
          fileExtension === '.tgz'
        ) {
          format = 'TAR.GZ';
          extractedFiles = await extractTarFile(archivePath, extractTo, true);
        } else if (fileExtension === '.tar') {
          format = 'TAR';
          extractedFiles = await extractTarFile(archivePath, extractTo, false);
        }

        // 计算解压后的文件大小
        let totalSize = 0;
        for (const file of extractedFiles) {
          try {
            const stats = await fs.stat(file);
            if (stats.isFile()) {
              totalSize += stats.size;
            }
          } catch {
            // 忽略统计错误
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `解压完成！\n压缩文件: ${archivePath}\n格式: ${format}\n解压到: ${extractTo}\n解压文件数量: ${extractedFiles.length} 个\n总大小: ${Math.round(totalSize / 1024)}KB`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `解压文件时发生错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

/**
 * 解压ZIP文件
 */
async function extractZipFile(
  archivePath: string,
  extractTo: string
): Promise<string[]> {
  await extractZip(archivePath, { dir: path.resolve(extractTo) });

  // 递归获取所有解压的文件
  const getAllFiles = async (dirPath: string): Promise<string[]> => {
    const files: string[] = [];
    const items = await fs.readdir(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        files.push(...(await getAllFiles(itemPath)));
      } else {
        files.push(itemPath);
      }
    }

    return files;
  };

  return await getAllFiles(extractTo);
}

/**
 * 解压TAR文件
 */
async function extractTarFile(
  archivePath: string,
  extractTo: string,
  gzip: boolean
): Promise<string[]> {
  const extractedFiles: string[] = [];

  await tar.extract({
    file: archivePath,
    cwd: extractTo,
    gzip: gzip,
    onentry: (entry: any) => {
      if (entry.type === 'File') {
        extractedFiles.push(path.join(extractTo, entry.path));
      }
    }
  } as any);

  return extractedFiles;
}

export default registerTool;
