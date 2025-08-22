/**
 * Vitest 测试设置文件
 */

import { vi } from 'vitest';

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.LLM_BASE_URL = 'https://api.test.com/v1';

// Mock console methods for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  // 在每个测试前重置所有 mocks
  vi.clearAllMocks();
  
  // Mock console methods to reduce noise in tests
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

afterEach(() => {
  // 恢复 console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// 全局测试超时设置
vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000
});
