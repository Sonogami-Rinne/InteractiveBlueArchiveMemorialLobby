import fs from 'fs';
import path from 'path';

/**
 * Vite 插件：以 Latin1 (ASCII) 字符串方式导入二进制文件
 * 使用：import file from './xxx.skel?binary'
 */
export default function binaryAsAsciiPlugin() {
  return {
    name: 'vite-plugin-binary-as-ascii',
    enforce: 'pre',

    resolveId(source) {
      if (source.endsWith('?binary')) return source;
    },

    load(id) {
      if (id.endsWith('?binary')) {
        const filePath = id.split('?')[0];
        const absPath = path.resolve(filePath);
        const content = fs.readFileSync(absPath, 'latin1'); // latin1 = 1字节=1字符

        // 输出为 JS 模块
        return `export default ${JSON.stringify(content)};`;
      }
    }
  };
}
