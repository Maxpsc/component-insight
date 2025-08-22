/**
 * 测试Mock工具
 */

import { vi } from 'vitest';
import type { AnalysisConfig, ComponentInfo, LibraryInfo } from '@/types.js';

/**
 * Mock LLM响应
 */
export const mockLLMResponse = {
  content: JSON.stringify({
    name: 'Button',
    chineseName: '按钮',
    functions: ['触发操作', '页面跳转', '表单提交'],
    useCases: ['表单提交', '页面导航', '操作确认'],
    uiFeatures: '支持多种类型和尺寸，具有悬停和点击状态',
    isContainer: false,
    properties: [
      {
        name: 'type',
        description: '按钮类型',
        type: 'string',
        defaultValue: 'default',
        enum: ['default', 'primary', 'ghost'],
        required: false
      }
    ]
  }),
  usage: {
    promptTokens: 100,
    completionTokens: 200,
    totalTokens: 300
  },
  responseTime: 1000
};

/**
 * Mock组件库信息
 */
export const mockLibraryInfo: LibraryInfo = {
  name: 'test-ui',
  chineseName: '测试UI库',
  description: '一个用于测试的UI组件库',
  useCases: ['测试场景1', '测试场景2'],
  version: '1.0.0',
  author: 'Test Author'
};

/**
 * Mock组件信息
 */
export const mockComponentInfo: ComponentInfo = {
  name: 'Button',
  chineseName: '按钮',
  functions: ['触发操作', '页面跳转'],
  useCases: ['表单提交', '页面导航'],
  uiFeatures: '基础按钮组件',
  isContainer: false,
  properties: [
    {
      name: 'type',
      description: '按钮类型',
      type: 'string',
      defaultValue: 'default',
      required: false
    }
  ],
  filePath: 'src/Button/index.tsx'
};

/**
 * Mock分析配置
 */
export const mockAnalysisConfig: AnalysisConfig = {
  repositoryUrl: 'https://github.com/test/test-ui.git',
  entryPath: 'components',
  llm: {
    baseUrl: 'https://api.test.com/v1',
    apiKey: 'test-api-key',
    model: 'gpt-3.5-turbo',
    temperature: 0.1,
    maxTokens: 4000
  },
  outputPath: './test-reports',
  parseStrategy: {
    includeExtensions: ['.tsx', '.ts'],
    excludeDirs: ['node_modules', 'dist'],
    excludePatterns: ['*.test.*'],
    maxFileSize: 500,
    parseTypeScript: true,
    parseJSDoc: true
  },
  enableCache: false // 测试时禁用缓存
};

/**
 * Mock Git仓库信息
 */
export const mockRepoInfo = {
  branch: 'main',
  lastCommit: 'abc12345',
  remoteUrl: 'https://github.com/test/test-ui.git'
};

/**
 * Mock文件内容
 */
export const mockComponentCode = `
import React from 'react';

interface ButtonProps {
  /** 按钮类型 */
  type?: 'default' | 'primary' | 'ghost';
  /** 按钮大小 */
  size?: 'small' | 'medium' | 'large';
  /** 点击事件 */
  onClick?: () => void;
  /** 子元素 */
  children?: React.ReactNode;
}

/**
 * 按钮组件
 * @param props 按钮属性
 */
export const Button: React.FC<ButtonProps> = ({ 
  type = 'default', 
  size = 'medium',
  onClick,
  children 
}) => {
  return (
    <button 
      className={\`btn btn-\${type} btn-\${size}\`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
`;

/**
 * Mock package.json
 */
export const mockPackageJson = {
  name: 'test-ui',
  version: '1.0.0',
  description: 'Test UI Library',
  author: 'Test Author',
  main: 'dist/index.js',
  types: 'dist/index.d.ts'
};

/**
 * 创建Mock函数的工厂
 */
export const createMockFunction = <T extends (...args: any[]) => any>(
  implementation?: T
) => {
  return vi.fn(implementation);
};

/**
 * Mock fs-extra
 */
export const mockFsExtra = {
  pathExists: vi.fn().mockResolvedValue(true),
  readFile: vi.fn().mockResolvedValue(mockComponentCode),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readJSON: vi.fn().mockResolvedValue(mockPackageJson),
  ensureDir: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({
    size: 1024,
    mtime: new Date(),
    isDirectory: () => false,
    isFile: () => true
  })
};

/**
 * Mock simple-git
 */
export const mockSimpleGit = {
  clone: vi.fn().mockResolvedValue(undefined),
  status: vi.fn().mockResolvedValue({ current: 'main' }),
  log: vi.fn().mockResolvedValue({ 
    latest: { hash: 'abc12345' } 
  }),
  getRemotes: vi.fn().mockResolvedValue([
    { name: 'origin', refs: { fetch: 'https://github.com/test/test-ui.git' } }
  ])
};

/**
 * Mock glob
 */
export const mockGlob = vi.fn().mockResolvedValue([
  '/test/src/Button/index.tsx',
  '/test/src/Input/index.tsx'
]);
