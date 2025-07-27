import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

/**
 * 工具：合并PDF文件
 * 注册工具到MCP服务器
 * @param server MCP服务器实例
 */
const registerTool = (server: McpServer) => {
  server.registerTool(
    'merge-pdf',
    {
      title: '合并PDF',
      description:
        '将多个PDF文件合并成一个PDF文件。参数：inputPaths - PDF文件路径数组 (必需)；outputPath - 输出PDF文件路径 (必需)；title - 合并后PDF的标题 (可选)',
      inputSchema: {
        inputPaths: z.array(z.string()),
        outputPath: z.string(),
        title: z.string().optional()
      }
    },
    async ({ inputPaths, outputPath, title }) => {
      try {
        // 验证输入参数
        if (!inputPaths || inputPaths.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '错误：至少需要提供一个PDF文件路径'
              }
            ],
            isError: true
          };
        }

        if (inputPaths.length === 1) {
          return {
            content: [
              {
                type: 'text',
                text: '警告：只有一个PDF文件，建议直接复制而不是合并'
              }
            ],
            isError: true
          };
        }

        // 检查所有输入文件是否存在且为PDF格式
        for (const inputPath of inputPaths) {
          if (!(await fs.pathExists(inputPath))) {
            return {
              content: [
                {
                  type: 'text',
                  text: `错误：文件不存在 - ${inputPath}`
                }
              ],
              isError: true
            };
          }

          if (!inputPath.toLowerCase().endsWith('.pdf')) {
            return {
              content: [
                {
                  type: 'text',
                  text: `错误：文件不是PDF格式 - ${inputPath}`
                }
              ],
              isError: true
            };
          }
        }

        // 检查输出路径
        if (!outputPath.toLowerCase().endsWith('.pdf')) {
          outputPath = outputPath + '.pdf';
        }

        // 确保输出目录存在
        const outputDir = path.dirname(outputPath);
        await fs.ensureDir(outputDir);

        // 创建新的PDF文档
        const mergedPdf = await PDFDocument.create();

        // 设置文档元数据
        if (title) {
          mergedPdf.setTitle(title);
        }
        mergedPdf.setProducer('File Operation MCP');
        mergedPdf.setCreator('PDF Merger Tool');
        mergedPdf.setCreationDate(new Date());

        let totalPages = 0;
        const fileInfo: Array<{ path: string; pages: number; size: number }> =
          [];

        // 逐个读取并合并PDF文件
        for (const inputPath of inputPaths) {
          try {
            // 读取PDF文件
            const pdfBytes = await fs.readFile(inputPath);
            const pdf = await PDFDocument.load(pdfBytes);

            // 获取所有页面
            const pageCount = pdf.getPageCount();
            const pages = await mergedPdf.copyPages(
              pdf,
              Array.from({ length: pageCount }, (_, i) => i)
            );

            // 添加页面到合并文档
            pages.forEach((page) => mergedPdf.addPage(page));

            totalPages += pageCount;

            // 收集文件信息
            const stats = await fs.stat(inputPath);
            fileInfo.push({
              path: path.basename(inputPath),
              pages: pageCount,
              size: stats.size
            });
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `错误：无法处理PDF文件 ${inputPath} - ${error instanceof Error ? error.message : String(error)}`
                }
              ],
              isError: true
            };
          }
        }

        // 保存合并后的PDF
        const pdfBytes = await mergedPdf.save();
        await fs.writeFile(outputPath, pdfBytes);

        // 获取输出文件信息
        const outputStats = await fs.stat(outputPath);
        const outputSizeKB = Math.round(outputStats.size / 1024);

        // 生成详细报告
        const fileListText = fileInfo
          .map(
            (info, index) =>
              `  ${index + 1}. ${info.path} (${info.pages}页, ${Math.round(info.size / 1024)}KB)`
          )
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `PDF合并成功！\n\n📁 输出文件: ${outputPath}\n📊 合并统计:\n  - 输入文件: ${inputPaths.length} 个\n  - 总页数: ${totalPages} 页\n  - 输出大小: ${outputSizeKB}KB\n\n📋 文件详情:\n${fileListText}\n\n✅ 所有PDF文件已成功合并到一个文件中`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `合并PDF时发生错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
};

export default registerTool;
