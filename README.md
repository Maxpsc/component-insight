# Component Insight

AI驱动的前端组件库分析工具，基于大模型提炼组件库特征和详细信息。

## 🚀 功能特性

- 🤖 **AI智能分析**: 使用大模型深度理解组件代码，提炼UI特征和功能描述
- 📊 **详细报告**: 生成包含组件属性、使用场景、功能描述的完整报告
- 🗂️ **多格式输出**: 支持JSON和Markdown格式的分析报告
- ⚡ **智能缓存**: 内置缓存机制，避免重复分析，提升执行效率
- 🔧 **灵活配置**: 支持配置文件和命令行参数，适应不同项目需求
- 📦 **双重使用**: 支持命令行工具和函数式API两种使用方式

## 📦 安装

> **推荐使用 pnpm** 作为包管理器，获得更快的安装速度和更少的磁盘占用。

### 全局安装（命令行工具）

```bash
# 使用 pnpm（推荐）
pnpm add -g component-insight

# 或使用 npm
npm install -g component-insight

# 或使用 yarn
yarn global add component-insight
```

### 本地安装（函数式API）

```bash
# 使用 pnpm（推荐）
pnpm add component-insight

# 或使用 npm
npm install component-insight

# 或使用 yarn
yarn add component-insight
```

## 🛠️ 使用方法

### 命令行工具

#### 1. 初始化配置文件

```bash
insight init
```

#### 2. 编辑配置文件

编辑生成的 `insight.config.ts` 文件：

```typescript
import { AnalysisConfig } from 'component-insight';

const config: AnalysisConfig = {
  repositoryUrl: 'https://github.com/ant-design/ant-design.git',
  entryPath: 'components',
  llm: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-3.5-turbo'
  },
  outputPath: './reports',
  // ... 其他配置
};

export default config;
```

#### 3. 运行分析

```bash
# 使用配置文件
insight

# 或直接指定参数
insight https://github.com/ant-design/ant-design.git \
  --entry components \
  --api-key your-api-key \
  --output ./reports \
  --markdown
```

#### 4. 其他命令

```bash
# 验证Git仓库URL
insight validate https://github.com/ant-design/ant-design.git

# 查看帮助
insight --help
```

### 函数式API

```typescript
import { insight, quickAnalysis } from 'component-insight';

// 完整配置方式
const report = await insight({
  repositoryUrl: 'https://github.com/ant-design/ant-design.git',
  entryPath: 'components',
  llm: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-3.5-turbo'
  },
  outputPath: './reports',
  parseStrategy: {
    includeExtensions: ['.tsx', '.ts'],
    excludeDirs: ['node_modules', 'dist', '__tests__'],
    excludePatterns: ['*.test.*', '*.stories.*'],
    maxFileSize: 500,
    parseTypeScript: true,
    parseJSDoc: true
  }
});

// 快速分析方式
const quickReport = await quickAnalysis({
  repositoryUrl: 'https://github.com/ant-design/ant-design.git',
  apiKey: process.env.OPENAI_API_KEY!,
  entryPath: 'components'
});

console.log('分析完成:', report.library.chineseName);
console.log('组件数量:', report.components.length);
```

## 📋 分析报告格式

### 组件库信息
```typescript
interface LibraryInfo {
  name: string;           // 包名称
  chineseName: string;    // 中文名称
  description: string;    // 描述
  useCases: string[];     // 使用场景
  version?: string;       // 版本
  author?: string;        // 作者
}
```

### 组件信息
```typescript
interface ComponentInfo {
  name: string;           // 组件名
  chineseName: string;    // 中文名
  functions: string[];    // 具体功能
  useCases: string[];     // 使用场景
  uiFeatures: string;     // UI特征
  isContainer: boolean;   // 是否为容器组件
  properties: ComponentProperty[]; // 组件属性
  filePath: string;       // 文件路径
}
```

### 组件属性
```typescript
interface ComponentProperty {
  name: string;           // 属性标识
  description: string;    // 中文描述
  type: string;          // 数据类型
  defaultValue?: string;  // 默认值
  enum?: string[];       // 枚举值
  required?: boolean;    // 是否必需
}
```

## ⚙️ 配置选项

### 基础配置

| 选项 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `repositoryUrl` | string | ✓ | 目标仓库Git URL |
| `entryPath` | string |  | 解析入口根路径 |
| `outputPath` | string |  | 结果JSON文件存放路径 |

### 大模型配置

| 选项 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `llm.baseUrl` | string | ✓ | - | API基础URL |
| `llm.apiKey` | string | ✓ | - | API密钥 |
| `llm.model` | string\|ModelEnum | ✓ | - | 模型名称 |
| `llm.timeout` | number |  | 30000 | 请求超时时间(ms) |
| `llm.streaming` | boolean |  | false | 是否启用流式输出 |
| `llm.temperature` | number |  | 0.1 | 温度参数(0-1) |
| `llm.maxTokens` | number |  | 4000 | 最大输出token数 |

### 解析策略配置

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `parseStrategy.includeExtensions` | string[] | `['.tsx', '.ts', '.jsx', '.js']` | 包含的文件扩展名 |
| `parseStrategy.excludeDirs` | string[] | `['node_modules', 'dist', ...]` | 排除的目录 |
| `parseStrategy.excludePatterns` | string[] | `['*.test.*', '*.spec.*', ...]` | 排除的文件模式 |
| `parseStrategy.maxFileSize` | number | 500 | 最大文件大小(KB) |
| `parseStrategy.parseTypeScript` | boolean | true | 是否解析TypeScript |
| `parseStrategy.parseJSDoc` | boolean | true | 是否解析JSDoc |

## 🤖 支持的AI模型

基于LangChain集成，支持多种大模型：

### OpenAI系列
- **GPT-3.5-Turbo** - 快速且经济的选择
- **GPT-4** - 更强的理解和分析能力  
- **GPT-4-Turbo** - 更大上下文窗口

### Anthropic Claude系列
- **Claude 3 Haiku** - 快速响应
- **Claude 3 Sonnet** - 平衡性能
- **Claude 3.5 Sonnet** - 最新版本，推荐使用
- **Claude 3 Opus** - 最强性能

### 使用示例

```typescript
import { ModelEnum } from 'component-insight';

// 使用预定义枚举
const config = {
  llm: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: ModelEnum.CLAUDE_3_7_SONNET, // 推荐
    temperature: 0.1,
    maxTokens: 4000
  }
};

// 或使用自定义代理
const proxyConfig = {
  llm: {
    baseUrl: 'https://your-proxy.com/index/api/model/v1/',
    apiKey: 'your-api-key',
    model: ModelEnum.CLAUDE_3_7_SONNET,
    streaming: false
  }
};
```

## 🎯 支持的组件库

已测试支持的知名组件库：

- **Ant Design** - 企业级UI设计语言
- **Material-UI** - React Material Design组件
- **Chakra UI** - 现代化React组件库
- **Arco Design** - 字节跳动企业级设计系统
- **Semi Design** - 抖音企业级设计系统
- 以及其他遵循标准React组件开发规范的组件库

## 📊 示例报告

```json
{
  "library": {
    "name": "antd",
    "chineseName": "蚂蚁设计",
    "description": "企业级UI设计语言和React组件库...",
    "useCases": ["企业后台管理系统", "数据可视化平台", "..."]
  },
  "components": [
    {
      "name": "Button",
      "chineseName": "按钮",
      "functions": ["触发操作", "页面跳转", "表单提交"],
      "useCases": ["表单提交", "页面导航", "操作确认"],
      "uiFeatures": "支持多种类型和尺寸，具有悬停和点击状态",
      "isContainer": false,
      "properties": [
        {
          "name": "type",
          "description": "按钮类型",
          "type": "string",
          "defaultValue": "default",
          "enum": ["default", "primary", "ghost", "dashed", "link", "text"]
        }
      ]
    }
  ]
}
```

## 🚀 性能优化

### 缓存机制

工具内置智能缓存机制：

- **仓库缓存**: 缓存克隆的仓库信息，避免重复克隆
- **组件缓存**: 缓存组件分析结果，相同代码不重复分析  
- **库信息缓存**: 缓存组件库基本信息分析结果

### 配置建议

```typescript
{
  // 启用缓存（推荐）
  enableCache: true,
  cacheDir: './cache',
  
  // 限制文件大小，提升解析速度
  parseStrategy: {
    maxFileSize: 500, // KB
    excludeDirs: ['node_modules', 'dist', 'build', '__tests__'],
    excludePatterns: ['*.test.*', '*.spec.*', '*.stories.*']
  }
}
```

## 🔧 开发

### 环境要求

- Node.js >= 18
- TypeScript >= 5.0

### 本地开发

```bash
# 克隆项目
git clone https://github.com/your-org/component-insight.git
cd component-insight

# 安装依赖（推荐使用 pnpm）
pnpm install

# 开发模式运行
pnpm run dev

# 构建（包含类型定义）
pnpm run build

# 运行测试
pnpm run test

# 清理构建产物
pnpm run clean
```

### 项目结构

```
src/
├── analyzer.ts     # 主分析引擎
├── git.ts         # Git仓库管理
├── llm.ts         # 大模型API调用
├── parser.ts      # 代码解析器
├── reporter.ts    # 报告生成器
├── cache.ts       # 缓存管理器
├── cli.ts         # 命令行工具
├── index.ts       # 函数式API
└── types.ts       # 类型定义
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🔗 相关链接

- [GitHub Repository](https://github.com/your-org/component-insight)
- [NPM Package](https://www.npmjs.com/package/component-insight)
- [Documentation](https://your-org.github.io/component-insight)

---

如果这个工具对你有帮助，请给个 ⭐️ 支持一下！
