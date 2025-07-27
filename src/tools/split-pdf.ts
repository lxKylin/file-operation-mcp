import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

/**
 * 工具：拆分PDF文件
 * 注册工具到MCP服务器
 * @param server MCP服务器实例
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'split-pdf',
    {
      title: '拆分PDF',
      description:
        '将PDF文件拆分成多个文件。参数：inputPath - 输入PDF文件路径 (必需)；outputDir - 输出目录 (必需)；splitMode - 拆分模式: pages(每页一个文件) 或 ranges(按范围拆分) (可选，默认pages)；ranges - 页面范围数组，格式如 ["1-3", "4-6"] (splitMode为ranges时必需)；prefix - 输出文件名前缀 (可选，默认为original)',
      inputSchema: {
        inputPath: z.string(),
        outputDir: z.string(),
        splitMode: z.enum(['pages', 'ranges']).optional(),
        ranges: z.array(z.string()).optional(),
        prefix: z.string().optional()
      }
    },
    async ({ inputPath, outputDir, splitMode = 'pages', ranges, prefix }) => {
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

        // 读取PDF文件
        const inputBytes = await fs.readFile(inputPath);
        const inputPdf = await PDFDocument.load(inputBytes);
        const totalPages = inputPdf.getPageCount();

        if (totalPages === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '错误：PDF文件没有页面内容'
              }
            ],
            isError: true
          };
        }

        // 生成输出文件名前缀
        const baseName = prefix || path.basename(inputPath, '.pdf');
        const outputFiles: string[] = [];

        if (splitMode === 'pages') {
          // 按页面拆分 - 每页一个文件
          for (let i = 0; i < totalPages; i++) {
            const outputPdf = await PDFDocument.create();
            const [copiedPage] = await outputPdf.copyPages(inputPdf, [i]);
            outputPdf.addPage(copiedPage);

            // 设置元数据
            outputPdf.setTitle(`${baseName} - Page ${i + 1}`);
            outputPdf.setProducer('File Operation MCP');
            outputPdf.setCreator('PDF Splitter Tool');

            const outputPath = path.join(
              outputDir,
              `${baseName}_page_${String(i + 1).padStart(3, '0')}.pdf`
            );
            const pdfBytes = await outputPdf.save();
            await fs.writeFile(outputPath, pdfBytes);
            outputFiles.push(outputPath);
          }

          return {
            content: [
              {
                type: 'text',
                text: `PDF拆分成功（按页面）！\n\n📁 输入文件: ${inputPath}\n📁 输出目录: ${outputDir}\n📊 拆分结果:\n  - 原文件页数: ${totalPages} 页\n  - 生成文件数: ${outputFiles.length} 个\n  - 文件命名: ${baseName}_page_001.pdf 到 ${baseName}_page_${String(totalPages).padStart(3, '0')}.pdf\n\n✅ 每页已拆分为独立的PDF文件`
              }
            ]
          };
        } else if (splitMode === 'ranges') {
          // 按范围拆分
          if (!ranges || ranges.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: '错误：ranges 模式需要提供页面范围数组，例如: ["1-3", "4-6"]'
                }
              ],
              isError: true
            };
          }

          const rangeInfo: Array<{
            range: string;
            startPage: number;
            endPage: number;
            outputFile: string;
          }> = [];

          for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex++) {
            const range = ranges[rangeIndex];

            // 解析页面范围，例如 "1-3" 或 "5"
            let startPage: number, endPage: number;

            if (range.includes('-')) {
              const parts = range.split('-');
              if (parts.length !== 2) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `错误：无效的页面范围格式 "${range}"，应该是 "开始页-结束页" 格式`
                    }
                  ],
                  isError: true
                };
              }
              startPage = parseInt(parts[0].trim());
              endPage = parseInt(parts[1].trim());
            } else {
              // 单页
              startPage = endPage = parseInt(range.trim());
            }

            // 验证页面范围
            if (isNaN(startPage) || isNaN(endPage)) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `错误：页面范围包含非数字 "${range}"`
                  }
                ],
                isError: true
              };
            }

            if (startPage < 1 || endPage > totalPages || startPage > endPage) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `错误：页面范围 "${range}" 超出有效范围 (1-${totalPages})`
                  }
                ],
                isError: true
              };
            }

            // 创建新的PDF并复制指定页面
            const outputPdf = await PDFDocument.create();
            const pageIndices = Array.from(
              { length: endPage - startPage + 1 },
              (_, i) => startPage - 1 + i
            );
            const copiedPages = await outputPdf.copyPages(
              inputPdf,
              pageIndices
            );

            copiedPages.forEach((page) => outputPdf.addPage(page));

            // 设置元数据
            outputPdf.setTitle(`${baseName} - Pages ${startPage}-${endPage}`);
            outputPdf.setProducer('File Operation MCP');
            outputPdf.setCreator('PDF Splitter Tool');

            const outputPath = path.join(
              outputDir,
              `${baseName}_pages_${startPage}-${endPage}.pdf`
            );
            const pdfBytes = await outputPdf.save();
            await fs.writeFile(outputPath, pdfBytes);

            outputFiles.push(outputPath);
            rangeInfo.push({
              range,
              startPage,
              endPage,
              outputFile: path.basename(outputPath)
            });
          }

          // 生成详细报告
          const rangeListText = rangeInfo
            .map(
              (info, index) =>
                `  ${index + 1}. ${info.outputFile} (页面 ${info.startPage}-${info.endPage}, ${info.endPage - info.startPage + 1} 页)`
            )
            .join('\n');

          return {
            content: [
              {
                type: 'text',
                text: `PDF拆分成功（按范围）！\n\n📁 输入文件: ${inputPath}\n📁 输出目录: ${outputDir}\n📊 拆分结果:\n  - 原文件页数: ${totalPages} 页\n  - 生成文件数: ${outputFiles.length} 个\n\n📋 文件详情:\n${rangeListText}\n\n✅ 按指定范围拆分完成`
              }
            ]
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: '错误：未知的拆分模式'
            }
          ],
          isError: true
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `拆分PDF时发生错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
