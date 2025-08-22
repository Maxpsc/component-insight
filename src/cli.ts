#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { ComponentAnalyzer } from './analyzer.js';
import { AnalysisConfig } from './types.js';
import { GitManager } from './git.js';

const program = new Command();

// 版本信息
const packageJsonPath = path.join(process.cwd(), 'package.json');
let version = '1.0.0';
try {
  const packageJson = fs.readJSONSync(packageJsonPath);
  version = packageJson.version;
} catch {
  // 使用默认版本
}

program
  .name('insight')
  .description('AI-powered frontend component library analyzer')
  .version(version);

/**
 * 主命令：分析组件库
 */
program
  .argument('[repository-url]', '目标仓库Git URL')
  .option('-c, --config <path>', '配置文件路径', 'insight.config.ts')
  .option('-e, --entry <path>', '解析入口根路径')
  .option('-o, --output <path>', '结果JSON文件存放路径')
  .option('--api-url <url>', '大模型API基础URL')
  .option('--api-key <key>', '大模型API密钥')
  .option('--model <model>', '大模型名称')
  .option('--temp-dir <path>', '临时目录路径')
  .option('--no-cache', '禁用缓存')
  .option('--max-components <number>', '最大组件分析数量', '20')
  .option('--markdown', '同时生成Markdown报告')
  .option('--verbose', '详细输出')
  .action(async (repositoryUrl: string | undefined, options: any) => {
    try {
      console.log(chalk.bold.cyan('Component Insight - AI组件库分析工具\n'));

      // 加载配置
      const config = await loadConfig(repositoryUrl, options);
      
      if (options.verbose) {
        console.log(chalk.gray('配置信息:'));
        console.log(chalk.gray(JSON.stringify({
          ...config,
          llm: { ...config.llm, apiKey: '***' }
        }, null, 2)));
        console.log('');
      }

      // 验证配置
      validateConfig(config);

      // 创建分析器并执行分析
      const analyzer = new ComponentAnalyzer(config);
      const report = await analyzer.analyze();

      // 生成Markdown报告
      if (options.markdown) {
        const reportGenerator = analyzer['reportGenerator'];
        const markdownPath = config.outputPath 
          ? config.outputPath.replace(/\.json$/, '.md')
          : undefined;
        await reportGenerator.generateMarkdownReport(report, markdownPath);
      }

      // 显示统计信息
      if (options.verbose) {
        const stats = await analyzer.getAnalysisStats();
        console.log(chalk.gray('\n统计信息:'));
        console.log(chalk.gray(`LLM请求: ${stats.llm.requestCount} 次`));
        console.log(chalk.gray(`Token使用: ${stats.llm.totalTokens}`));
        console.log(chalk.gray(`缓存状态: ${stats.cache.enabled ? '启用' : '禁用'}`));
        if (stats.cache.enabled) {
          console.log(chalk.gray(`缓存文件: ${stats.cache.totalFiles} 个`));
          console.log(chalk.gray(`缓存大小: ${(stats.cache.totalSize / 1024).toFixed(2)} KB`));
        }
        console.log(chalk.gray(`解析文件: ${stats.parser.size} 个`));
      }

      // 清理资源
      await analyzer.cleanup();

    } catch (error) {
      console.error(chalk.red('分析失败:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * 初始化配置文件命令
 */
program
  .command('init')
  .description('初始化配置文件')
  .option('-f, --force', '强制覆盖已存在的配置文件')
  .action(async (options: any) => {
    try {
      const configPath = 'insight.config.ts';
      
      if (await fs.pathExists(configPath) && !options.force) {
        console.log(chalk.yellow(`配置文件 ${configPath} 已存在，使用 --force 强制覆盖`));
        return;
      }

      const configTemplate = `import { AnalysisConfig } from 'component-insight';

const config: AnalysisConfig = {
  // 目标仓库Git URL
  repositoryUrl: 'https://github.com/ant-design/ant-design.git',
  
  // 解析入口根路径（适用于多包仓库）
  entryPath: 'components',
  
  // 大模型配置
  llm: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-3.5-turbo',
    timeout: 30000,
    maxRetries: 3
  },
  
  // 结果JSON文件存放路径（可选）
  outputPath: './reports',
  
  // 解析策略配置
  parseStrategy: {
    includeExtensions: ['.tsx', '.ts', '.jsx', '.js'],
    excludeDirs: ['node_modules', 'dist', 'build', '.git', 'coverage', 'docs', '__tests__', 'test'],
    excludePatterns: ['*.test.*', '*.spec.*', '*.stories.*', '*.d.ts'],
    maxFileSize: 500, // KB
    parseTypeScript: true,
    parseJSDoc: true
  },
  
  // 临时目录路径
  tempDir: './temp',
  
  // 是否启用缓存
  enableCache: true,
  
  // 缓存目录
  cacheDir: './cache'
};

export default config;
`;

      await fs.writeFile(configPath, configTemplate, 'utf-8');
      console.log(chalk.green(`配置文件已创建: ${configPath}`));
      console.log(chalk.yellow('请编辑配置文件，设置正确的仓库URL和API密钥'));

    } catch (error) {
      console.error(chalk.red('创建配置文件失败:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * 验证Git URL命令
 */
program
  .command('validate <repository-url>')
  .description('验证Git仓库URL是否有效')
  .action(async (repositoryUrl: string) => {
    try {
      console.log(chalk.blue(`验证仓库URL: ${repositoryUrl}`));
      
      if (!GitManager.validateGitUrl(repositoryUrl)) {
        console.log(chalk.red('❌ URL格式无效'));
        process.exit(1);
      }

      // 尝试克隆验证
      const gitManager = new GitManager();
      const projectDir = await gitManager.cloneRepository(repositoryUrl);
      
      // 获取仓库信息
      const repoInfo = await gitManager.getRepositoryInfo(projectDir);
      
      console.log(chalk.green('✅ 仓库URL有效'));
      console.log(chalk.gray(`分支: ${repoInfo.branch}`));
      console.log(chalk.gray(`最新提交: ${repoInfo.lastCommit}`));
      
      // 清理临时目录
      await gitManager.cleanup(projectDir);

    } catch (error) {
      console.error(chalk.red('❌ 仓库验证失败:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * 加载配置
 */
async function loadConfig(repositoryUrl: string | undefined, options: any): Promise<AnalysisConfig> {
  let config: Partial<AnalysisConfig> = {};

  // 尝试加载配置文件
  if (options.config && await fs.pathExists(options.config)) {
    try {
      // 动态导入配置文件
      const configModule = await import(path.resolve(options.config));
      config = configModule.default || configModule;
      console.log(chalk.green(`已加载配置文件: ${options.config}`));
    } catch (error) {
      console.warn(chalk.yellow(`加载配置文件失败: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  // 命令行参数覆盖配置文件
  const finalConfig: AnalysisConfig = {
    repositoryUrl: repositoryUrl || config.repositoryUrl || '',
    entryPath: options.entry || config.entryPath || '',
    llm: {
      baseUrl: options.apiUrl || config.llm?.baseUrl || 'https://api.openai.com/v1',
      apiKey: options.apiKey || config.llm?.apiKey || process.env.OPENAI_API_KEY || '',
      model: options.model || config.llm?.model || 'gpt-3.5-turbo',
      timeout: config.llm?.timeout || 30000,
    },
    outputPath: options.output || config.outputPath,
    parseStrategy: {
      includeExtensions: ['.tsx', '.ts', '.jsx', '.js'],
      excludeDirs: ['node_modules', 'dist', 'build', '.git', 'coverage', 'docs', '__tests__', 'test'],
      excludePatterns: ['*.test.*', '*.spec.*', '*.stories.*', '*.d.ts'],
      maxFileSize: 500,
      parseTypeScript: true,
      parseJSDoc: true,
      ...config.parseStrategy
    },
    tempDir: options.tempDir || config.tempDir,
    enableCache: options.cache !== false && (config.enableCache !== false),
    cacheDir: config.cacheDir || './cache'
  };

  return finalConfig;
}

/**
 * 验证配置
 */
function validateConfig(config: AnalysisConfig): void {
  const errors: string[] = [];

  if (!config.repositoryUrl) {
    errors.push('缺少仓库URL，请通过参数或配置文件指定');
  }

  if (!GitManager.validateGitUrl(config.repositoryUrl)) {
    errors.push('仓库URL格式无效');
  }

  if (!config.llm.apiKey) {
    errors.push('缺少API密钥，请设置环境变量 OPENAI_API_KEY 或通过配置文件指定');
  }

  if (!config.llm.baseUrl) {
    errors.push('缺少API基础URL');
  }

  if (!config.llm.model) {
    errors.push('缺少模型名称');
  }

  if (errors.length > 0) {
    console.error(chalk.red('配置错误:'));
    errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
    console.log(chalk.yellow('\n使用 "insight init" 创建配置文件模板'));
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error(chalk.red('未处理的Promise拒绝:'), reason);
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  console.error(chalk.red('未捕获的异常:'), error);
  process.exit(1);
});

// 解析命令行参数
program.parse();
