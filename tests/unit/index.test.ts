/**
 * 主要函数式API测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateConfig,
  createDefaultConfig,
  createLLMConfigFromEnv,
  compareReports
} from '@/index.js';
import { ModelEnum } from '@/types.js';
import { createTestConfig, createTestReport, mockEnvVars } from '@tests/utils/helpers.js';

describe('函数式API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateConfig', () => {
    it('应该验证有效的配置', () => {
      const config = createTestConfig();
      const result = validateConfig(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测缺少的必需字段', () => {
      const invalidConfig = {
        repositoryUrl: '',
        llm: {
          baseUrl: '',
          apiKey: '',
          model: ''
        }
      };
      
      const result = validateConfig(invalidConfig as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('缺少仓库URL');
      expect(result.errors).toContain('缺少API密钥');
      expect(result.errors).toContain('缺少模型名称');
    });

    it('应该生成警告信息', () => {
      const configWithWarnings = createTestConfig({
        entryPath: '',
        outputPath: undefined
      });
      
      const result = validateConfig(configWithWarnings);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('未指定入口路径，将分析整个仓库');
      expect(result.warnings).toContain('未指定输出路径，报告将不会保存到文件');
    });
  });

  describe('createDefaultConfig', () => {
    it('应该创建默认配置', () => {
      const config = createDefaultConfig();
      
      expect(config.repositoryUrl).toBe('');
      expect(config.entryPath).toBe('');
      expect(config.llm.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.llm.model).toBe('gpt-3.5-turbo');
      expect(config.parseStrategy.includeExtensions).toEqual(['.tsx', '.ts', '.jsx', '.js']);
      expect(config.enableCache).toBe(true);
    });

    it('应该支持覆盖默认值', () => {
      const overrides = {
        repositoryUrl: 'https://github.com/test/repo.git',
        llm: {
          baseUrl: 'https://custom-api.com/v1',
          apiKey: 'custom-key',
          model: ModelEnum.GPT_4
        }
      };
      
      const config = createDefaultConfig(overrides);
      
      expect(config.repositoryUrl).toBe(overrides.repositoryUrl);
      expect(config.llm.baseUrl).toBe(overrides.llm.baseUrl);
      expect(config.llm.apiKey).toBe(overrides.llm.apiKey);
      expect(config.llm.model).toBe(ModelEnum.GPT_4);
    });
  });

  describe('createLLMConfigFromEnv', () => {
    it('应该从环境变量创建LLM配置', () => {
      const restoreEnv = mockEnvVars({
        LLM_BASE_URL: 'https://custom-api.com/v1',
        LLM_API_KEY: 'env-api-key',
        LLM_MODEL: 'custom-model',
        LLM_TIMEOUT: '45000',
        LLM_MAX_RETRIES: '5'
      });

      try {
        const config = createLLMConfigFromEnv();
        
        expect(config.baseUrl).toBe('https://custom-api.com/v1');
        expect(config.apiKey).toBe('env-api-key');
        expect(config.model).toBe('custom-model');
        expect(config.timeout).toBe(45000);
        expect(config.maxRetries).toBe(5);
      } finally {
        restoreEnv();
      }
    });

    it('应该使用默认值当环境变量不存在时', () => {
      const restoreEnv = mockEnvVars({});

      try {
        const config = createLLMConfigFromEnv();
        
        expect(config.baseUrl).toBe('https://api.openai.com/v1');
        expect(config.apiKey).toBe('');
        expect(config.model).toBe('gpt-3.5-turbo');
        expect(config.timeout).toBe(30000);
        expect(config.maxRetries).toBe(3);
      } finally {
        restoreEnv();
      }
    });

    it('应该支持覆盖参数', () => {
      const overrides = {
        model: ModelEnum.CLAUDE_3_7_SONNET,
        temperature: 0.2,
        maxTokens: 8000
      };
      
      const config = createLLMConfigFromEnv(overrides);
      
      expect(config.model).toBe(ModelEnum.CLAUDE_3_7_SONNET);
      expect(config.temperature).toBe(0.2);
      expect(config.maxTokens).toBe(8000);
    });
  });

  describe('compareReports', () => {
    it('应该检测库信息变更', () => {
      const report1 = createTestReport();
      const report2 = createTestReport({
        library: {
          ...report1.library,
          name: 'new-name',
          description: 'new description'
        }
      });
      
      const comparison = compareReports(report1, report2);
      
      expect(comparison.libraryChanges.name).toBe(true);
      expect(comparison.libraryChanges.description).toBe(true);
      expect(comparison.libraryChanges.useCases).toBe(false);
    });

    it('应该检测组件变更', () => {
      const report1 = createTestReport();
      const report2 = createTestReport({
        components: [
          {
            ...report1.components[0],
            chineseName: '新按钮',
            functions: ['新功能1', '新功能2']
          },
          {
            name: 'NewComponent',
            chineseName: '新组件',
            functions: [],
            useCases: [],
            uiFeatures: '',
            isContainer: false,
            properties: [],
            filePath: 'src/NewComponent.tsx'
          }
        ]
      });
      
      const comparison = compareReports(report1, report2);
      
      expect(comparison.componentChanges.added).toEqual(['NewComponent']);
      expect(comparison.componentChanges.removed).toEqual([]);
      expect(comparison.componentChanges.modified).toHaveLength(1);
      expect(comparison.componentChanges.modified[0].name).toBe('Button');
      expect(comparison.componentChanges.modified[0].changes).toContain('中文名变更');
      expect(comparison.componentChanges.modified[0].changes).toContain('功能变更');
    });

    it('应该检测组件删除', () => {
      const report1 = createTestReport({
        components: [
          createTestReport().components[0],
          {
            name: 'RemovedComponent',
            chineseName: '被删除的组件',
            functions: [],
            useCases: [],
            uiFeatures: '',
            isContainer: false,
            properties: [],
            filePath: 'src/RemovedComponent.tsx'
          }
        ]
      });
      const report2 = createTestReport();
      
      const comparison = compareReports(report1, report2);
      
      expect(comparison.componentChanges.removed).toEqual(['RemovedComponent']);
      expect(comparison.componentChanges.added).toEqual([]);
    });

    it('应该检测相同报告无变更', () => {
      const report1 = createTestReport();
      const report2 = createTestReport();
      
      const comparison = compareReports(report1, report2);
      
      expect(comparison.libraryChanges.name).toBe(false);
      expect(comparison.libraryChanges.description).toBe(false);
      expect(comparison.libraryChanges.useCases).toBe(false);
      expect(comparison.componentChanges.added).toEqual([]);
      expect(comparison.componentChanges.removed).toEqual([]);
      expect(comparison.componentChanges.modified).toEqual([]);
    });
  });
});
