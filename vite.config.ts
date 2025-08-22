import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        cli: resolve(__dirname, 'src/cli.ts')
      },
      name: 'ComponentInsight',
      formats: ['es', 'cjs']
    },
    outDir: 'dist',
    rollupOptions: {
      external: [
        'fs',
        'path',
        'os',
        'crypto',
        'child_process',
        'url',
        'util',
        'stream',
        'events',
        'buffer',
        'fs-extra',
        'simple-git',
        'commander',
        'chalk',
        'ora',
        'glob',
        '@langchain/openai',
        '@langchain/core',
        'langchain'
      ],
      output: {
        exports: 'named' // 禁用默认导出警告
      }
    },
    minify: false, // 保持代码可读性
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
