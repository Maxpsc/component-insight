/**
 * 测试辅助工具
 */

import { vi } from 'vitest';
import type { AnalysisConfig, AnalysisReport } from '@/types.js';
import { mockAnalysisConfig, mockLibraryInfo, mockComponentInfo } from './mocks.js';

/**
 * 创建临时目录路径
 */
export const createTempPath = (suffix = '') => {
  return `/tmp/component-insight-test-${Date.now()}${suffix}`;
};

/**
 * 等待指定时间
 */
export const sleep = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 创建测试用的分析配置
 */
export const createTestConfig = (overrides: Partial<AnalysisConfig> = {}): AnalysisConfig => {
  return {
    ...mockAnalysisConfig,
    ...overrides,
    tempDir: createTempPath('-config'),
    cacheDir: createTempPath('-cache'),
    outputPath: createTempPath('-output')
  };
};

/**
 * 创建测试用的分析报告
 */
export const createTestReport = (overrides: Partial<AnalysisReport> = {}): AnalysisReport => {
  return {
    library: mockLibraryInfo,
    components: [mockComponentInfo],
    analyzedAt: new Date().toISOString(),
    config: mockAnalysisConfig,
    ...overrides
  };
};

/**
 * 验证配置对象的结构
 */
export const validateConfig = (config: any): config is AnalysisConfig => {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof config.repositoryUrl === 'string' &&
    typeof config.llm === 'object' &&
    typeof config.llm.apiKey === 'string' &&
    typeof config.llm.model === 'string' &&
    typeof config.parseStrategy === 'object'
  );
};

/**
 * 验证报告对象的结构
 */
export const validateReport = (report: any): report is AnalysisReport => {
  return (
    typeof report === 'object' &&
    report !== null &&
    typeof report.library === 'object' &&
    Array.isArray(report.components) &&
    typeof report.analyzedAt === 'string' &&
    typeof report.config === 'object'
  );
};

/**
 * Mock环境变量
 */
export const mockEnvVars = (vars: Record<string, string>) => {
  const originalEnv = { ...process.env };
  
  Object.assign(process.env, vars);
  
  return () => {
    process.env = originalEnv;
  };
};

/**
 * 捕获console输出
 */
export const captureConsole = () => {
  const logs: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.log = vi.fn((...args) => {
    logs.push(args.join(' '));
  });
  
  console.warn = vi.fn((...args) => {
    warnings.push(args.join(' '));
  });
  
  console.error = vi.fn((...args) => {
    errors.push(args.join(' '));
  });
  
  return {
    logs,
    warnings,
    errors,
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };
};

/**
 * 创建测试用的文件信息
 */
export const createTestFileInfo = (overrides: any = {}) => {
  return {
    path: '/test/Button/index.tsx',
    content: 'export const Button = () => <button>Test</button>;',
    size: 1024,
    type: '.tsx',
    lastModified: new Date(),
    ...overrides
  };
};

/**
 * 模拟异步操作的错误
 */
export const createAsyncError = (message: string, delay = 100) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, delay);
  });
};

/**
 * 检查对象是否包含所需属性
 */
export const hasRequiredProperties = (obj: any, properties: string[]): boolean => {
  return properties.every(prop => prop in obj);
};

/**
 * 深度比较两个对象
 */
export const deepEqual = (obj1: any, obj2: any): boolean => {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  
  if (typeof obj1 !== typeof obj2) return false;
  
  if (typeof obj1 !== 'object') return obj1 === obj2;
  
  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => 
    keys2.includes(key) && deepEqual(obj1[key], obj2[key])
  );
};
