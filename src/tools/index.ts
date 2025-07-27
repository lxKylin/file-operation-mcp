import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import countFiles from './count-files';
import listFiles from './list-files';
import compressImage from './compress-image';
import createArchive from './create-archive';
import extractArchive from './extract-archive';
import copyFiles from './copy-files';
import moveFiles from './move-files';

export default function registryTools(server: McpServer) {
  [
    countFiles,
    listFiles,
    compressImage,
    createArchive,
    extractArchive,
    copyFiles,
    moveFiles
  ].forEach((registryFn) => {
    registryFn(server);
  });
}
