import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import { fromPath } from 'pdf2pic';

/**
 * 工具：PDF转图片
 * 注册工具到MCP服务器
 * @param server MCP服务器实例
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'pdf-to-image',
    {
      title: 'PDF转图片',
      description:
        '将PDF文件转换为图片格式。参数：inputPath - 输入PDF文件路径 (必需)；outputDir - 输出目录 (必需)；format - 图片格式: jpeg, png (可选，默认jpeg)；quality - 图片质量 1-100 (可选，默认80)；dpi - 分辨率DPI (可选，默认150)；pages - 页面范围，格式如 "1-3" 或 "1,3,5" (可选，默认全部)；prefix - 输出文件名前缀 (可选)',
      inputSchema: {
        inputPath: z.string(),
        outputDir: z.string(),
        format: z.enum(['jpeg', 'png']).optional(),
        quality: z.number().min(1).max(100).optional(),
        dpi: z.number().min(50).max(600).optional(),
        pages: z.string().optional(),
        prefix: z.string().optional()
      }
    },
    async ({
      inputPath,
      outputDir,
      format = 'jpeg',
      quality = 80,
      dpi = 150,
      pages,
      prefix
    }) => {
      try {
        // 检查输入文件是否存在
        if (!(await fs.pathExists(inputPath))) {
          return {
            content: [
              {
                type: 'text',
                text: `错误：输入文件不存在 - ${inputPath}`
              }
            ],
            isError: true
          };
        }

        // 检查文件格式
        if (!inputPath.toLowerCase().endsWith('.pdf')) {
          return {
            content: [
              {
                type: 'text',
                text: '错误：输入文件不是PDF格式'
              }
            ],
            isError: true
          };
        }

        // 确保输出目录存在
        await fs.ensureDir(outputDir);

        // 生成输出文件名前缀
        const baseName = prefix || path.basename(inputPath, '.pdf');

        // 配置pdf2pic
        const options = {
          density: dpi,
          saveFilename: `${baseName}`,
          savePath: outputDir,
          format: format,
          width: undefined,
          height: undefined,
          quality: format === 'jpeg' ? quality : undefined
        };

        const converter = fromPath(inputPath, options);

        let pageNumbers: number[] = [];

        // 解析页面范围
        if (pages) {
          try {
            if (pages.includes('-')) {
              // 范围格式，如 "1-5"
              const parts = pages.split('-');
              if (parts.length === 2) {
                const start = parseInt(parts[0].trim());
                const end = parseInt(parts[1].trim());
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                  pageNumbers = Array.from(
                    { length: end - start + 1 },
                    (_, i) => start + i
                  );
                } else {
                  throw new Error('Invalid range format');
                }
              } else {
                throw new Error('Invalid range format');
              }
            } else if (pages.includes(',')) {
              // 逗号分隔格式，如 "1,3,5"
              pageNumbers = pages.split(',').map((p) => {
                const num = parseInt(p.trim());
                if (isNaN(num)) {
                  throw new Error('Invalid page number');
                }
                return num;
              });
            } else {
              // 单页
              const num = parseInt(pages.trim());
              if (isNaN(num)) {
                throw new Error('Invalid page number');
              }
              pageNumbers = [num];
            }
          } catch {
            return {
              content: [
                {
                  type: 'text',
                  text: `错误：无效的页面格式 "${pages}"，支持格式: "1-5"、"1,3,5" 或 "3"`
                }
              ],
              isError: true
            };
          }
        }

        // 执行转换
        let result;
        const outputFiles: string[] = [];

        if (pageNumbers.length > 0) {
          // 转换指定页面
          for (const pageNum of pageNumbers) {
            try {
              const pageResult = await converter(pageNum, {
                responseType: 'image'
              });
              if (pageResult && pageResult.path) {
                outputFiles.push(pageResult.path);
              }
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `错误：转换第${pageNum}页时失败 - ${error instanceof Error ? error.message : String(error)}`
                  }
                ],
                isError: true
              };
            }
          }
        } else {
          // 转换所有页面
          try {
            result = await converter.bulk(-1, { responseType: 'image' });
            if (result && Array.isArray(result)) {
              outputFiles.push(
                ...result
                  .map((r) => r.path)
                  .filter((path): path is string => Boolean(path))
              );
            }
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `错误：批量转换失败 - ${error instanceof Error ? error.message : String(error)}`
                }
              ],
              isError: true
            };
          }
        }

        if (outputFiles.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '错误：没有生成任何图片文件'
              }
            ],
            isError: true
          };
        }

        // 统计输出文件信息
        let totalSize = 0;
        const fileDetails: Array<{ name: string; size: number }> = [];

        for (const filePath of outputFiles) {
          try {
            const stats = await fs.stat(filePath);
            const size = stats.size;
            totalSize += size;
            fileDetails.push({
              name: path.basename(filePath),
              size: Math.round(size / 1024) // KB
            });
          } catch {
            // 忽略无法统计的文件
          }
        }

        // 生成详细报告
        const fileListText = fileDetails
          .map((file, index) => `  ${index + 1}. ${file.name} (${file.size}KB)`)
          .join('\n');

        const pageRangeText = pages ? ` (页面: ${pages})` : ' (全部页面)';

        return {
          content: [
            {
              type: 'text',
              text: `PDF转图片成功！\n\n📁 输入文件: ${inputPath}\n📁 输出目录: ${outputDir}\n📊 转换设置:\n  - 格式: ${format.toUpperCase()}\n  - 质量: ${quality}%\n  - 分辨率: ${dpi} DPI${pageRangeText}\n\n📋 输出结果:\n  - 生成图片: ${outputFiles.length} 个\n  - 总大小: ${Math.round(totalSize / 1024)}KB\n\n📄 文件详情:\n${fileListText}\n\n✅ PDF页面已成功转换为图片文件`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `PDF转图片时发生错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
