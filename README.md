# File Operation MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)

一个基于 **Model Context Protocol (MCP)** 的文件操作服务器，提供文件统计、列表查询和图片压缩功能。

## ✨ 功能特性

- 📊 **文件统计** - 统计指定文件夹中的文件数量
- 📋 **文件列表** - 获取文件夹中所有文件的详细信息
- 🖼️ **图片压缩** - 高质量图片压缩，支持多种格式
- 🔒 **安全可靠** - 完整的错误处理和参数验证
- ⚡ **高性能** - 基于 Node.js 和 TypeScript 构建

## 🛠️ 技术栈

- **TypeScript** - 类型安全的 JavaScript
- **MCP SDK** - Model Context Protocol 官方 SDK
- **Sharp** - 高性能图像处理库
- **fs-extra** - 增强的文件系统操作
- **Zod** - TypeScript 优先的数据验证

## 📦 安装

### 环境要求

- Node.js >= 18.0.0
- pnpm (推荐) 或 npm

### 克隆项目

```bash
git clone https://github.com/lxKylin/file-operation-mcp.git
cd file-operation-mcp
```

### 安装依赖

```bash
pnpm install
```

### 构建项目

```bash
pnpm build
```

## ⚙️ 配置

### Claude Desktop 配置

将以下配置添加到 Claude Desktop 的配置文件中：

**配置文件位置：**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

**配置内容：**
```json
{
  "mcpServers": {
    "file-operation-mcp": {
      "command": "node",
      "args": ["path/to/file-operation-mcp/dist/index.js"],
      "cwd": "path/to/file-operation-mcp",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

> ⚠️ **注意**: 请将 `path/to/file-operation-mcp` 替换为实际的项目路径

### Cursor IDE 配置

```json
{
  "mcpServers": {
    "file-operation-mcp": {
      "command": "node",
      "args": ["path/to/file-operation-mcp/dist/index.js"]
    }
  }
}
```

## 🚀 使用方法

配置完成后重启 Claude Desktop，即可在对话中使用以下功能：

### 1. 文件统计 (count-files)

统计指定文件夹中的文件数量，默认统计桌面文件。

**参数：**
- `folderPath` (可选): 文件夹路径，默认为桌面

**示例：**
```
请帮我统计一下桌面上有多少个文件
```
```
请统计 /Users/username/Documents 文件夹中的文件数量
```

### 2. 文件列表 (list-files)

获取指定文件夹中所有文件的详细信息，包括文件名、类型和大小。

**参数：**
- `folderPath` (可选): 文件夹路径，默认为桌面
- `includeHidden` (可选): 是否包含隐藏文件，默认为 false

**示例：**
```
请列出桌面上的所有文件
```
```
请显示 /Users/username/Downloads 文件夹中的内容，包括隐藏文件
```

### 3. 图片压缩 (compress-image)

压缩指定的图片文件，支持多种格式和自定义参数。

**参数：**
- `imagePath`: 图片文件路径 (必需)
- `quality` (可选): 压缩质量 (1-100)，默认为 80
- `maxWidth` (可选): 最大宽度限制
- `maxHeight` (可选): 最大高度限制  
- `outputPath` (可选): 输出路径，默认为原文件名加 `_compressed` 后缀

**支持格式：**
- JPEG/JPG
- PNG
- WebP
- TIFF
- GIF

**示例：**
```
请将 /Users/username/Desktop/photo.jpg 压缩到 60% 质量
```
```
请压缩图片 /path/to/image.png，限制最大宽度为 1920 像素
```

## 📸 功能演示

### 文件列表查询
默认查询桌面文件，也可指定具体路径：

![文件列表查询](./src/assets/images/list-files.png)

### 文件数量统计
快速统计指定目录的文件数量：

![文件数量统计](./src/assets/images/count-files.png)

### 图片压缩功能
高质量图片压缩，支持自定义参数：

![图片压缩功能](./src/assets/images/compress-image.png)

![压缩效果展示](./src/assets/images/compress-image-demo.png)

## 🔧 开发

### 开发模式

```bash
pnpm dev
```

### 代码格式化

```bash
pnpm format
```

### 代码检查

```bash
pnpm lint
```

### 启动服务器

```bash
pnpm start
```

## ⚠️ 注意事项

1. **权限要求**: 确保 Node.js 有访问目标文件夹的权限
2. **路径格式**: 
   - macOS/Linux: `/Users/username/path`
   - Windows: `C:\Users\username\path`
3. **图片格式**: 仅支持常见的图片格式 (JPEG, PNG, WebP, TIFF, GIF)
4. **文件大小**: 大文件处理可能需要更长时间
5. **调试输出**: 使用 `console.error()` 而非 `console.log()` 避免干扰 MCP 协议

## 🐛 故障排除

### 常见问题

**1. 服务器启动失败**
```
Error: Cannot find module 'xxx'
```
**解决方案**: 确保运行了 `pnpm install` 和 `pnpm build`

**2. 权限错误**
```
Error: EACCES: permission denied
```
**解决方案**: 检查文件夹访问权限，或使用具有适当权限的路径

**3. 路径不存在**
```
错误：路径 /xxx 不存在
```
**解决方案**: 确认路径正确，使用绝对路径

**4. 图片格式不支持**
```
错误：不支持的图片格式 .xxx
```
**解决方案**: 使用支持的图片格式 (jpg, png, webp, tiff, gif)

### 调试技巧

1. 查看 Claude Desktop 的开发者控制台
2. 检查服务器日志输出
3. 使用 [MCP Inspector](https://github.com/modelcontextprotocol/inspector) 进行调试

