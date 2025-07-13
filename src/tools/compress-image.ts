import { z } from 'zod';
import fs from 'fs-extra';
import * as path from 'path';
import sharp from 'sharp';

import { server } from '@/index';

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
