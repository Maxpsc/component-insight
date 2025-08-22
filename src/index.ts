/**
 * Component Insight - AI-powered frontend component library analyzer
 * 
 * 主要功能：
 * 1. 分析前端组件库代码结构
 * 2. 使用AI提炼组件特征和属性
 * 3. 生成详细的分析报告
 */

export * from './types.js';
export { ModelEnum } from './types.js';
export { ComponentAnalyzer } from './analyzer.js';
export { GitManager } from './git.js';
export { LLMManager } from './llm.js';
export { CodeParser } from './parser.js';
export { ReportGenerator } from './reporter.js';

import { ComponentAnalyzer } from './analyzer.js';
import { 
  AnalysisConfig, 
  AnalysisReport, 
  ComponentInfo, 
  LibraryInfo,
  ParseStrategy,
  LLMConfig
} from './types.js';

/**
 * 主要的分析函数 - 函数式API
 */
export async function insight(config: AnalysisConfig): Promise<AnalysisReport> {
  const analyzer = new ComponentAnalyzer(config);
  
  try {
    const report = await analyzer.analyze();
    return report;
  } finally {
    // 确保清理资源
    await analyzer.cleanup();
  }
}

/**
 * 批量分析多个仓库
 */
export async function batchAnalysis(
  repositories: Array<{
    url: string;
    entryPath?: string;
    name?: string;
  }>,
  llmConfig: LLMConfig,
  options?: {
    outputDir?: string;
    parseStrategy?: Partial<ParseStrategy>;
    maxConcurrency?: number;
  }
): Promise<AnalysisReport[]> {
  const { maxConcurrency = 3 } = options || {};
  const results: AnalysisReport[] = [];
  
  // 分批处理，避免同时进行太多分析
  for (let i = 0; i < repositories.length; i += maxConcurrency) {
    const batch = repositories.slice(i, i + maxConcurrency);
    
    const batchPromises = batch.map(async repo => {
      const config: AnalysisConfig = {
        repositoryUrl: repo.url,
        entryPath: repo.entryPath || '',
        llm: llmConfig,
        outputPath: options?.outputDir 
          ? `${options.outputDir}/${repo.name || `repo-${i}`}.json`
          : undefined,
        parseStrategy: {
          includeExtensions: ['.tsx', '.ts', '.jsx', '.js'],
          excludeDirs: ['node_modules', 'dist', 'build', '.git', 'coverage', 'docs'],
          excludePatterns: ['*.test.*', '*.spec.*', '*.stories.*', '*.d.ts'],
          maxFileSize: 500,
          parseTypeScript: true,
          parseJSDoc: true,
          ...options?.parseStrategy
        }
      };

      try {
        return await insight(config);
      } catch (error) {
        console.error(`分析仓库 ${repo.url} 失败:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(result => result !== null) as AnalysisReport[]);
  }

  return results;
}

/**
 * 验证配置
 */
export function validateConfig(config: AnalysisConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 必需字段检查
  if (!config.repositoryUrl) {
    errors.push('缺少仓库URL');
  }

  if (!config.llm.apiKey) {
    errors.push('缺少API密钥');
  }

  if (!config.llm.baseUrl) {
    errors.push('缺少API基础URL');
  }

  if (!config.llm.model) {
    errors.push('缺少模型名称');
  }

  // 警告检查
  if (!config.entryPath) {
    warnings.push('未指定入口路径，将分析整个仓库');
  }

  if (!config.outputPath) {
    warnings.push('未指定输出路径，报告将不会保存到文件');
  }

  if (config.parseStrategy.maxFileSize > 1000) {
    warnings.push('最大文件大小设置过大，可能影响性能');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 创建默认配置
 */
export function createDefaultConfig(overrides: Partial<AnalysisConfig> = {}): AnalysisConfig {
  return {
    repositoryUrl: '',
    entryPath: '',
    llm: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      timeout: 30000,
    },
    parseStrategy: {
      includeExtensions: ['.tsx', '.ts', '.jsx', '.js'],
      excludeDirs: ['node_modules', 'dist', 'build', '.git', 'coverage', 'docs'],
      excludePatterns: ['*.test.*', '*.spec.*', '*.stories.*', '*.d.ts'],
      maxFileSize: 500,
      parseTypeScript: true,
      parseJSDoc: true
    },
    enableCache: true,
    ...overrides
  };
}

/**
 * 工具函数：从环境变量创建LLM配置
 */
export function createLLMConfigFromEnv(overrides: Partial<LLMConfig> = {}): LLMConfig {
  return {
    baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
    timeout: parseInt(process.env.LLM_TIMEOUT || '30000'),
    ...overrides
  };
}

/**
 * 工具函数：比较两个分析报告
 */
export function compareReports(
  report1: AnalysisReport,
  report2: AnalysisReport
): {
  libraryChanges: {
    name: boolean;
    description: boolean;
    useCases: boolean;
  };
  componentChanges: {
    added: string[];
    removed: string[];
    modified: Array<{
      name: string;
      changes: string[];
    }>;
  };
} {
  const libraryChanges = {
    name: report1.library.name !== report2.library.name,
    description: report1.library.description !== report2.library.description,
    useCases: JSON.stringify(report1.library.useCases) !== JSON.stringify(report2.library.useCases)
  };

  const components1 = new Map(report1.components.map(c => [c.name, c]));
  const components2 = new Map(report2.components.map(c => [c.name, c]));

  const added = Array.from(components2.keys()).filter(name => !components1.has(name));
  const removed = Array.from(components1.keys()).filter(name => !components2.has(name));
  
  const modified: Array<{ name: string; changes: string[] }> = [];
  
  for (const [name, component2] of components2.entries()) {
    const component1 = components1.get(name);
    if (component1) {
      const changes: string[] = [];
      
      if (component1.chineseName !== component2.chineseName) {
        changes.push('中文名变更');
      }
      
      if (JSON.stringify(component1.functions) !== JSON.stringify(component2.functions)) {
        changes.push('功能变更');
      }
      
      if (JSON.stringify(component1.useCases) !== JSON.stringify(component2.useCases)) {
        changes.push('使用场景变更');
      }
      
      if (component1.uiFeatures !== component2.uiFeatures) {
        changes.push('UI特征变更');
      }
      
      if (component1.properties.length !== component2.properties.length) {
        changes.push('属性数量变更');
      }
      
      if (changes.length > 0) {
        modified.push({ name, changes });
      }
    }
  }

  return {
    libraryChanges,
    componentChanges: {
      added,
      removed,
      modified
    }
  };
}

// 默认导出主函数
export default insight;
