import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // 测试环境
    environment: 'node',
    
    // 全局设置
    globals: true,
    
    // 测试文件匹配模式
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/__tests__/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    
    // 排除文件
    exclude: [
      'node_modules',
      'dist',
      '.git',
      '.cache',
      'build'
    ],
    
    // 测试超时时间
    testTimeout: 30000,
    
    // 钩子超时时间
    hookTimeout: 30000,
    
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.{js,ts}'
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{js,ts}',
        'src/**/*.spec.{js,ts}',
        'src/cli.ts', // CLI文件通常不需要覆盖率测试
        'dist/**',
        'node_modules/**'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    
    // 设置
    setupFiles: ['./tests/setup.ts'],
    
    // 并发设置
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests')
    }
  }
});
