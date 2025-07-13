import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import countFiles from './count-files';
import listFiles from './list-files';
import compressImage from './compress-image';

export default function registryTools(server: McpServer) {
  [countFiles, listFiles, compressImage].forEach((registryFn) => {
    registryFn(server);
  });
}
