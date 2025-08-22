import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import { ParseStrategy, FileInfo, ParseContext, ComponentInfo } from './types.js';
import { DEFAULT_COMPONENT_IDENTIFICATION_PROMPT } from './prompts.js';
import { getStructuredDataFromMessage } from './utils/format.js';

/**
 * 代码解析器
 */
export class CodeParser {
  private strategy: ParseStrategy;
  private cache: Map<string, FileInfo> = new Map();

  constructor(strategy: ParseStrategy) {
    const defaultStrategy: ParseStrategy = {
      includeExtensions: ['.tsx', '.ts', '.jsx', '.js'],
      excludeDirs: ['node_modules', 'dist', 'build', '.git', 'coverage', 'docs'],
      excludePatterns: ['*.test.*', '*.spec.*', '*.stories.*', '*.d.ts'],
      maxFileSize: 500, // KB
      parseTypeScript: true,
      parseJSDoc: true
    };
    
    this.strategy = { ...defaultStrategy, ...strategy };
  }

  /**
   * 扫描目录，获取所有相关文件
   */
  async scanDirectory(rootPath: string, entryPath: string = ''): Promise<FileInfo[]> {
    const spinner = ora('正在扫描文件...').start();
    
    try {
      const targetPath = entryPath ? path.join(rootPath, entryPath) : rootPath;
      
      if (!await fs.pathExists(targetPath)) {
        throw new Error(`路径不存在: ${targetPath}`);
      }

      // 构建glob模式
      const patterns = this.strategy.includeExtensions.map(ext => 
        `**/*${ext}`
      );

      const files: FileInfo[] = [];
      
      for (const pattern of patterns) {
        const matchedFiles = await glob(pattern, {
          cwd: targetPath,
          ignore: [
            ...this.strategy.excludeDirs.map(dir => `**/${dir}/**`),
            ...this.strategy.excludePatterns
          ],
          absolute: true
        });

        for (const filePath of matchedFiles) {
          try {
            const stats = await fs.stat(filePath);
            const sizeKB = stats.size / 1024;
            
            // 跳过过大的文件
            if (sizeKB > this.strategy.maxFileSize) {
              console.log(chalk.yellow(`跳过大文件: ${path.relative(targetPath, filePath)} (${sizeKB.toFixed(1)}KB)`));
              continue;
            }

            const content = await fs.readFile(filePath, 'utf-8');
            const fileInfo: FileInfo = {
              path: filePath,
              content,
              size: stats.size,
              type: path.extname(filePath),
              lastModified: stats.mtime
            };

            files.push(fileInfo);
            this.cache.set(filePath, fileInfo);
          } catch (error) {
            console.warn(chalk.yellow(`读取文件失败: ${filePath}`));
          }
        }
      }

      spinner.succeed(chalk.green(`扫描完成，找到 ${files.length} 个文件`));
      return files;
    } catch (error) {
      spinner.fail(chalk.red('文件扫描失败'));
      throw error;
    }
  }

  /**
   * 识别React组件文件（基于规则）
   */
  identifyComponents(files: FileInfo[]): FileInfo[] {
    return files.filter(file => {
      const content = file.content;
      
      // 检查是否包含React组件的特征
      const hasReactImport = /import\s+.*React.*from\s+['"]react['"]/.test(content) ||
                            /import\s+React/.test(content);
      
      const hasJSXReturn = /return\s*\(\s*</.test(content) ||
                          /return\s+</.test(content);
      
      const hasExportComponent = /export\s+(default\s+)?(function|const|class)/.test(content) ||
                                /export\s+\{.*\}/.test(content);
      
      const hasComponentNaming = /^[A-Z][a-zA-Z0-9]*\.(tsx?|jsx?)$/.test(path.basename(file.path));
      
      // React组件通常满足以下条件之一：
      // 1. 有React导入 + JSX返回 + 导出
      // 2. 文件名符合组件命名规范 + JSX返回
      return (hasReactImport && hasJSXReturn && hasExportComponent) ||
             (hasComponentNaming && hasJSXReturn);
    });
  }

  /**
   * 使用LLM识别组件文件（更智能的识别方式）
   */
  async identifyComponentsWithLLM(
    files: FileInfo[], 
    llmManager: any,
    customPrompt?: string
  ): Promise<FileInfo[]> {
    const spinner = ora('使用AI识别组件文件...').start();
    
    try {
      const componentFiles: FileInfo[] = [];
      const batchSize = 5; // 每批处理5个文件
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (file) => {
          try {
            const systemPrompt = customPrompt || DEFAULT_COMPONENT_IDENTIFICATION_PROMPT;
            
            const messages = [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: `文件路径: ${file.path}
文件大小: ${file.size} bytes

文件内容:
\`\`\`
${file.content.substring(0, 3000)} ${file.content.length > 3000 ? '...(内容过长，已截断)' : ''}
\`\`\`

请分析这个文件是否包含React组件，并返回识别结果。`
              }
            ];

            const response = await llmManager.chat(messages);
            const result = getStructuredDataFromMessage(response);
            
            
            // 检查是否识别到组件
            if (Array.isArray(result) && result.length > 0) {
              const hasValidComponent = result.some(item => 
                item.isComponent === true && item.confidence > 0.7
              );
              
              if (hasValidComponent) {
                return file;
              }
            }
            
            return null;
          } catch (error) {
            console.warn(chalk.yellow(`LLM识别文件 ${file.path} 失败: ${error instanceof Error ? error.message : String(error)}`));
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validFiles = batchResults.filter(file => file !== null) as FileInfo[];
        componentFiles.push(...validFiles);
        
        // 批次间添加延迟
        if (i + batchSize < files.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      spinner.succeed(chalk.green(`AI识别完成，找到 ${componentFiles.length} 个组件文件`));
      return componentFiles;
      
    } catch (error) {
      spinner.fail(chalk.red('AI识别失败'));
      console.warn(chalk.yellow('回退到规则识别模式'));
      return this.identifyComponents(files);
    }
  }

  /**
   * 提取组件名称
   */
  extractComponentName(file: FileInfo): string {
    const content = file.content;
    const fileName = path.basename(file.path, path.extname(file.path));
    
    // 尝试从导出语句中提取组件名
    const exportMatches = [
      // export default function ComponentName
      /export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/,
      // export default ComponentName
      /export\s+default\s+([A-Z][a-zA-Z0-9]*)/,
      // const ComponentName = ... export default ComponentName
      /const\s+([A-Z][a-zA-Z0-9]*)\s*=.*export\s+default\s+\1/s,
      // export { ComponentName }
      /export\s*\{\s*([A-Z][a-zA-Z0-9]*)\s*\}/,
    ];

    for (const regex of exportMatches) {
      const match = content.match(regex);
      if (match && match[1]) {
        return match[1];
      }
    }

    // 如果没有找到，使用文件名（首字母大写）
    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }

  /**
   * 分析组件依赖关系
   */
  analyzeDependencies(file: FileInfo, allFiles: FileInfo[]): string[] {
    const content = file.content;
    const dependencies: string[] = [];
    
    // 提取import语句
    const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      // 跳过node_modules的依赖
      if (!importPath.startsWith('.')) {
        continue;
      }
      
      // 解析相对路径
      const resolvedPath = path.resolve(path.dirname(file.path), importPath);
      const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx'];
      
      for (const ext of possibleExtensions) {
        const fullPath = resolvedPath + ext;
        if (allFiles.some(f => f.path === fullPath)) {
          dependencies.push(fullPath);
          break;
        }
      }
    }
    
    return dependencies;
  }

  /**
   * 提取TypeScript接口定义
   */
  extractTypeScriptInterfaces(content: string): Array<{
    name: string;
    properties: Array<{
      name: string;
      type: string;
      optional: boolean;
      description?: string;
    }>;
  }> {
    if (!this.strategy.parseTypeScript) {
      return [];
    }

    const interfaces: Array<{
      name: string;
      properties: Array<{
        name: string;
        type: string;
        optional: boolean;
        description?: string;
      }>;
    }> = [];

    // 匹配interface定义
    const interfaceRegex = /interface\s+([A-Z][a-zA-Z0-9]*)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let match;

    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      const interfaceBody = match[2];
      
      const properties = this.parseInterfaceProperties(interfaceBody);
      
      interfaces.push({
        name: interfaceName,
        properties
      });
    }

    return interfaces;
  }

  /**
   * 解析接口属性
   */
  private parseInterfaceProperties(interfaceBody: string): Array<{
    name: string;
    type: string;
    optional: boolean;
    description?: string;
  }> {
    const properties: Array<{
      name: string;
      type: string;
      optional: boolean;
      description?: string;
    }> = [];

    // 分割属性行
    const lines = interfaceBody.split('\n').map(line => line.trim()).filter(line => line);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 跳过注释和空行
      if (line.startsWith('//') || line.startsWith('/*') || !line) {
        continue;
      }

      // 匹配属性定义: name?: type;
      const propMatch = line.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)(\?)?:\s*([^;]+);?/);
      if (propMatch) {
        const [, name, optional, type] = propMatch;
        
        // 查找前面的注释作为描述
        let description: string | undefined;
        if (i > 0) {
          const prevLine = lines[i - 1];
          const commentMatch = prevLine.match(/\/\*\*?\s*(.*?)\s*\*?\//);
          if (commentMatch) {
            description = commentMatch[1];
          }
        }

        properties.push({
          name,
          type: type.trim(),
          optional: !!optional,
          description
        });
      }
    }

    return properties;
  }

  /**
   * 提取JSDoc注释
   */
  extractJSDocComments(content: string): Array<{
    target: string;
    description: string;
    params?: Array<{ name: string; type: string; description: string }>;
  }> {
    if (!this.strategy.parseJSDoc) {
      return [];
    }

    const comments: Array<{
      target: string;
      description: string;
      params?: Array<{ name: string; type: string; description: string }>;
    }> = [];

    // 匹配JSDoc注释块
    const jsdocRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+)?(?:default\s+)?(?:function|const|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;

    while ((match = jsdocRegex.exec(content)) !== null) {
      const [, commentBody, targetName] = match;
      
      const lines = commentBody.split('\n').map(line => 
        line.replace(/^\s*\*\s?/, '').trim()
      ).filter(line => line);

      let description = '';
      const params: Array<{ name: string; type: string; description: string }> = [];

      for (const line of lines) {
        if (line.startsWith('@param')) {
          const paramMatch = line.match(/@param\s+\{([^}]+)\}\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*-?\s*(.*)/);
          if (paramMatch) {
            const [, type, name, desc] = paramMatch;
            params.push({ name, type, description: desc });
          }
        } else if (!line.startsWith('@')) {
          description += line + ' ';
        }
      }

      comments.push({
        target: targetName,
        description: description.trim(),
        params: params.length > 0 ? params : undefined
      });
    }

    return comments;
  }

  /**
   * 创建解析上下文
   */
  createParseContext(file: FileInfo, allFiles: FileInfo[]): ParseContext {
    const dependencies = this.analyzeDependencies(file, allFiles);
    const relatedFiles = dependencies.map(dep => 
      allFiles.find(f => f.path === dep)
    ).filter(Boolean) as FileInfo[];

    // 提取导出信息
    const exports = this.extractExports(file.content);

    return {
      currentFile: file,
      relatedFiles,
      dependencies,
      exports
    };
  }

  /**
   * 提取导出信息
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // 匹配各种导出形式
    const exportPatterns = [
      /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
      /export\s+\{\s*([^}]+)\s*\}/g,
      /export\s+(function|const|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
    ];

    for (const pattern of exportPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          if (match[1].includes(',')) {
            // 处理 export { a, b, c } 的情况
            const items = match[1].split(',').map(item => item.trim());
            exports.push(...items);
          } else {
            exports.push(match[1]);
          }
        }
        if (match[2]) {
          exports.push(match[2]);
        }
      }
    }

    return [...new Set(exports)]; // 去重
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      totalSize: Array.from(this.cache.values()).reduce((sum, file) => sum + file.size, 0)
    };
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.cache.clear();
  }
}
