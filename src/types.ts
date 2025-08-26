/**
 * 组件属性信息
 */
export interface ComponentProperty {
  /** 属性标识 */
  name: string;
  /** 中文描述 */
  description: string;
  /** 数据类型 */
  type: string;
  /** 类型参考，通常说明继承自三方组件库的类型 */
  typeDesc?: string;
  /** 默认值 */
  defaultValue?: string;
  /** 枚举值 */
  enum?: string[];
  /** 是否必需 */
  required?: boolean;
}

/**
 * 组件信息
 */
export interface ComponentInfo {
  /** 组件名 */
  name: string;
  /** 中文名 */
  chineseName: string;
  /** 具体功能 */
  functions: string[];
  /** 使用场景 */
  useCases: string[];
  /** UI特征 */
  uiFeatures: string;
  /** 是否为容器组件 */
  isContainer: boolean;
  /** 组件属性说明 */
  properties: ComponentProperty[];
  /** 文件路径 */
  filePath: string;
}

/**
 * 组件库信息
 */
export interface LibraryInfo {
  /** 包名称 */
  name: string;
  /** 中文名称 */
  chineseName: string;
  /** 描述 */
  description: string;
  /** 使用场景 */
  useCases: string[];
  /** 版本 */
  version?: string;
  /** 作者 */
  author?: string;
}

/**
 * 分析报告
 */
export interface AnalysisReport {
  /** 组件库信息 */
  library: LibraryInfo;
  /** 各组件信息 */
  components: ComponentInfo[];
  /** 分析时间 */
  analyzedAt: string;
  /** 分析配置 */
  config: AnalysisConfig;
}

/**
 * 支持的模型枚举
 */
export enum ModelEnum {
  GPT4O = 'gpt-4o',
  CLAUDE_3_7_SONNET = 'claude-3.7-sonnet',
  // CLAUDE_4_SONNET = 'claude-4-sonnet',
  DEEPSEEK_R1 = 'deepseek-r1',
}

/**
 * 大模型配置
 */
export interface LLMConfig {
  /** API基础URL */
  baseUrl: string;
  /** API密钥 */
  apiKey: string;
  /** 模型名称 */
  model: string | ModelEnum;
  /** 请求超时时间 */
  timeout?: number;
  /** 温度参数 */
  temperature?: number;
  /** 最大重试次数 */
  maxRetries?: number
}

/**
 * 提示词配置
 */
export interface PromptConfig {
  /** 识别组件的提示词 */
  componentIdentification?: string;
  /** 提取组件信息的提示词 */
  componentExtraction?: string;
}

/**
 * 解析策略配置
 */
export interface ParseStrategy {
  /** 包含的文件扩展名 */
  includeExtensions: string[];
  /** 排除的目录 */
  excludeDirs: string[];
  /** 排除的文件模式 */
  excludePatterns: string[];
  /** 最大文件大小 (KB) */
  maxFileSize: number;
  /** 是否解析TypeScript */
  parseTypeScript: boolean;
  /** 是否解析JSDoc */
  parseJSDoc: boolean;
}

/**
 * 分析配置
 */
export interface AnalysisConfig {
  /** 目标仓库Git URL */
  repositoryUrl: string;
  /** 解析入口根路径 */
  entryPath?: string;
  /** 大模型配置 */
  llm: LLMConfig;
  /** 结果JSON文件存放路径 */
  outputPath?: string;
  /** 解析策略配置 */
  parseStrategy: ParseStrategy;
  /** 提示词配置 */
  promptConfig?: PromptConfig;
  /** 临时目录路径 */
  tempDir?: string;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存目录 */
  cacheDir?: string;
}

/**
 * 文件信息
 */
export interface FileInfo {
  /** 文件路径 */
  path: string;
  /** 文件内容 */
  content: string;
  /** 文件大小 */
  size: number;
  /** 文件类型 */
  type: string;
  /** 最后修改时间 */
  lastModified: Date;
}

/**
 * 解析上下文
 */
export interface ParseContext {
  /** 当前文件信息 */
  currentFile: FileInfo;
  /** 相关文件 */
  relatedFiles: FileInfo[];
  /** 依赖关系 */
  dependencies: string[];
  /** 导出信息 */
  exports: string[];
}

/**
 * LLM响应
 */
export interface LLMResponse {
  /** 响应内容 */
  content: string;
  /** 使用的tokens */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 响应时间 */
  responseTime: number;
}
