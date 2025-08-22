import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { parse } from '@babel/parser';
// @ts-ignore
import _traverse from '@babel/traverse';

// 处理 ES module 和 CommonJS 的兼容性
const traverse = _traverse.default || _traverse;
import * as t from '@babel/types';
import { GitManager } from './git.js';
import { LLMManager } from './llm.js';
import { CodeParser } from './parser.js';
import { ReportGenerator } from './reporter.js';
import { 
  AnalysisConfig, 
  AnalysisReport, 
  ComponentInfo, 
  LibraryInfo,
  FileInfo 
} from './types.js';
import { DEFAULT_COMPONENT_EXTRACTION_PROMPT } from './prompts.js';

/**
 * 组件库分析器
 */
export class ComponentAnalyzer {
  private gitManager: GitManager;
  private llmManager: LLMManager;
  private codeParser: CodeParser;
  private reportGenerator: ReportGenerator;
  private config: AnalysisConfig;

  constructor(config: AnalysisConfig) {
    this.config = config;
    this.gitManager = new GitManager(config.tempDir);
    this.llmManager = new LLMManager(config.llm);
    this.codeParser = new CodeParser(config.parseStrategy);
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * 执行完整的组件库分析
   */
  async analyze(): Promise<AnalysisReport> {
    const startTime = Date.now();
    let projectDir: string | null = null;

    try {
      console.log(chalk.bold.cyan('🚀 开始组件库分析...\n'));

      // 1. 克隆仓库
      console.log(chalk.yellow('步骤 1/5: 克隆仓库'));
      projectDir = await this.gitManager.cloneRepository(this.config.repositoryUrl);

      // 2. 分析组件库基本信息
      console.log(chalk.yellow('\n步骤 2/5: 分析组件库信息'));
      const libraryInfo = await this.analyzeLibraryInfo(projectDir);

      // 3. 扫描和解析组件文件
      console.log(chalk.yellow('\n步骤 3/5: 扫描组件文件'));
      const componentFiles = await this.scanComponents(projectDir);

      // 4. 使用AI分析组件
      console.log(chalk.yellow('\n步骤 4/5: AI分析组件'));
      const components = await this.analyzeComponents(componentFiles);

      // 5. 生成报告
      console.log(chalk.yellow('\n步骤 5/5: 生成报告'));
      const report = await this.reportGenerator.generateReport(
        libraryInfo,
        components,
        this.config
      );

      // 保存报告
      if (this.config.outputPath) {
        await this.reportGenerator.saveReport(report, this.config.outputPath);
      }

      // 显示控制台报告
      // this.reportGenerator.printConsoleReport(report);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const stats = this.llmManager.getStats();
      
      console.log(chalk.green(`\n✨ 分析完成! 耗时 ${duration}s`));
      console.log(chalk.gray(`API调用: ${stats.requestCount} 次, Token使用: ${stats.totalTokens}`));

      return report;

    } catch (error) {
      console.error(chalk.red('\n❌ 分析失败:'), error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      // 清理临时目录
      if (projectDir) {
        await this.gitManager.cleanup(projectDir);
      }
    }
  }

  /**
   * 分析组件库基本信息
   */
  private async analyzeLibraryInfo(projectDir: string): Promise<LibraryInfo> {
    const spinner = ora('分析组件库信息...').start();

    try {
      const targetPath = this.config.entryPath 
        ? path.join(projectDir, this.config.entryPath)
        : projectDir;

      // 读取 package.json
      const packageJsonPath = path.join(targetPath, 'package.json');
      let packageJson: any = {};
      
      if (await fs.pathExists(packageJsonPath)) {
        packageJson = await fs.readJSON(packageJsonPath);
      } else {
        // 尝试在根目录查找
        const rootPackageJsonPath = path.join(projectDir, 'package.json');
        if (await fs.pathExists(rootPackageJsonPath)) {
          packageJson = await fs.readJSON(rootPackageJsonPath);
        }
      }



      // 读取 README
      let readmeContent: string | undefined;
      const readmeFiles = ['README.md', 'README.zh.md', 'README.zh-CN.md', 'readme.md'];
      
      for (const readmeFile of readmeFiles) {
        const readmePath = path.join(targetPath, readmeFile);
        if (await fs.pathExists(readmePath)) {
          readmeContent = await fs.readFile(readmePath, 'utf-8');
          break;
        }
      }

      // 使用AI分析
      const libraryInfo = await this.llmManager.analyzeLibraryInfo(packageJson, readmeContent);
      
      // 补充版本和作者信息
      (libraryInfo as any).version = packageJson.version;
      (libraryInfo as any).author = packageJson.author;

      spinner.succeed(chalk.green(`组件库信息分析完成: ${libraryInfo.chineseName}`));
      return libraryInfo;

    } catch (error) {
      spinner.fail(chalk.red('组件库信息分析失败'));
      throw error;
    }
  }

  /**
   * 扫描组件文件
   */
  private async scanComponents(projectDir: string): Promise<Array<{
    name: string;
    code: string;
    path: string;
    file: FileInfo;
		dependencies?: FileInfo[];
  }>> {
    const spinner = ora('扫描组件文件...').start();

    try {
      // 扫描所有文件
      const allFiles = await this.codeParser.scanDirectory(projectDir, this.config.entryPath);
      
      // 基于 /src/index.ts 文件识别组件
      const componentResults = await this.identifyComponentsFromIndex(projectDir, allFiles);
      
      spinner.succeed(chalk.green(`找到 ${componentResults.length} 个组件文件`));

      // 提取组件信息
      const components = componentResults.map(result => {
        return {
          name: result.name, // 使用从 index.ts 解析出的原始组件名
          code: result.file.content,
          path: result.file.path,
          file: result.file,
          dependencies: result.dependencies
        };
      });

      // 按组件名排序
      components.sort((a, b) => a.name.localeCompare(b.name));

      console.log(chalk.green(`组件列表: ${components.map(c => c.name).join(', ')}`));
      
      return components;

    } catch (error) {
      spinner.fail(chalk.red('组件文件扫描失败'));
      throw error;
    }
  }

  /**
   * 使用AI分析组件
   */
  private async analyzeComponents(componentFiles: Array<{
    name: string;
    code: string;
    path: string;
    file: FileInfo;
		dependencies?: FileInfo[];
  }>): Promise<ComponentInfo[]> {
    const spinner = ora('AI分析组件中...').start();
    let abortController: AbortController | null = null;
    let isAborted = false;

    // 监听进程中断信号
    const handleInterrupt = () => {
      if (abortController && !isAborted) {
        console.log(chalk.yellow('\n\n⚠️  检测到中断信号，正在取消当前批处理...'));
        isAborted = true;
        abortController.abort();
        spinner.fail(chalk.red('分析被用户取消'));
        process.exit(130); // 130 = 128 + 2 (SIGINT)
      }
    };

    process.on('SIGINT', handleInterrupt);
    process.on('SIGTERM', handleInterrupt);

    try {
      if (componentFiles.length === 0) {
        spinner.warn(chalk.yellow('没有找到组件文件'));
        return [];
      }

      // 限制组件数量，避免过多的API调用
      const maxComponents = 100;
      const componentsToAnalyze = componentFiles.slice(0, maxComponents);
      
      if (componentFiles.length > maxComponents) {
        console.log(chalk.yellow(`注意: 组件数量过多，只分析前 ${maxComponents} 个组件`));
      }

      const components: ComponentInfo[] = [];

      // 动态调整批次大小
      const batchSize = this.calculateOptimalBatchSize(componentsToAnalyze.length);
        const totalBatches = Math.ceil(componentsToAnalyze.length / batchSize);
        
      console.log(chalk.gray(`使用批次大小: ${batchSize}，总批次: ${totalBatches}`));

      for (let i = 0; i < componentsToAnalyze.length; i += batchSize) {
        if (isAborted) break;

        const batch = componentsToAnalyze.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        
        abortController = new AbortController();
        
        spinner.text = `AI分析组件 (批次 ${batchNumber}/${totalBatches}, 进度: ${Math.round((i / componentsToAnalyze.length) * 100)}%)...`;

        try {
          const batchResults = await this.processBatchWithDependencies(
            batch, 
            componentFiles, 
            abortController.signal
          );
          
        const validResults = batchResults.filter(result => result !== null) as ComponentInfo[];
        components.push(...validResults);

          // 显示批次完成信息
          console.log(chalk.green(`✓ 批次 ${batchNumber}/${totalBatches} 完成 (${validResults.length}/${batch.length} 成功)`));

          // 批次间添加延迟，避免API限流（仅在有后续批次时）
          if (i + batchSize < componentsToAnalyze.length && !isAborted) {
            await this.interruptibleDelay(800, abortController.signal);
          }
        } catch (error: any) {
          if (error.name === 'AbortError' || isAborted) {
            console.log(chalk.yellow(`批次 ${batchNumber} 被取消`));
            break;
          }
          console.warn(chalk.yellow(`批次 ${batchNumber} 处理失败: ${error.message}`));
          // 继续处理下一批次
        }
      }

      if (isAborted) {
        spinner.fail(chalk.red(`分析被取消，已完成 ${components.length} 个组件`));
      } else {
      spinner.succeed(chalk.green(`AI分析完成，成功分析 ${components.length} 个组件`));
      }
      
      return components;

    } catch (error) {
      spinner.fail(chalk.red('AI分析失败'));
      throw error;
    } finally {
      // 清理事件监听器
      process.removeListener('SIGINT', handleInterrupt);
      process.removeListener('SIGTERM', handleInterrupt);
    }
  }

  /**
   * 基于 /src/index.ts 文件识别组件
   */
  private async identifyComponentsFromIndex(projectDir: string, allFiles: FileInfo[]): Promise<Array<{
    name: string;
    file: FileInfo;
    dependencies?: FileInfo[];
  }>> {
    const targetPath = this.config.entryPath 
      ? path.join(projectDir, this.config.entryPath)
      : projectDir;
    
    const indexPath = path.join(targetPath, 'src', 'index.ts');
    
    // 检查 index.ts 文件是否存在
    if (!await fs.pathExists(indexPath)) {
      console.log(chalk.yellow('未找到 /src/index.ts 文件，回退到传统识别模式'));
      return this.fallbackToTraditionalIdentification(allFiles);
    }

    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const componentInfoMap = await this.extractComponentInfoFromIndex(indexContent, indexPath, allFiles);
      
      if (componentInfoMap.size === 0) {
        console.log(chalk.yellow('index.ts 中未找到符合条件的组件导出，回退到传统识别模式'));
        return this.fallbackToTraditionalIdentification(allFiles);
      }

      const componentNames = Array.from(componentInfoMap.keys());
      console.log(chalk.gray(`从 index.ts 识别到的组件: ${componentNames.join(', ')}`));
      
      // 深度追踪组件的真实实现位置并收集依赖
      const componentFiles: Array<{
        name: string;
        file: FileInfo;
        dependencies?: FileInfo[];
      }> = [];
      
      for (const [componentName, filePath] of componentInfoMap.entries()) {
        console.log(chalk.gray(`追踪组件 ${componentName} 的实现...`));
        
        const componentInfo = await this.traceComponentImplementation(componentName, filePath, allFiles);
        if (componentInfo) {
          componentFiles.push({
            name: componentName, // 使用原始导出的组件名
            file: componentInfo.file,
            dependencies: componentInfo.dependencies
          });
        } else {
          console.log(chalk.yellow(`未能追踪到组件 ${componentName} 的实现`));
        }
      }

      // 返回包含组件名和文件信息的结构
      return componentFiles;
      
    } catch (error) {
      console.log(chalk.yellow(`解析 index.ts 文件失败: ${error instanceof Error ? error.message : String(error)}，回退到传统识别模式`));
      return this.fallbackToTraditionalIdentification(allFiles);
    }
  }

  /**
   * 深度追踪组件的真实实现位置并收集依赖文件
   */
  private async traceComponentImplementation(
    componentName: string, 
    filePath: string, 
    allFiles: FileInfo[]
  ): Promise<{
    name: string;
    code: string;
    path: string;
    file: FileInfo;
    dependencies: FileInfo[];
  } | null> {
    const visited = new Set<string>(); // 避免循环引用
    const dependencies = new Set<FileInfo>(); // 收集所有依赖文件
    
    // 递归追踪组件实现
    const traceImplementation = async (
      currentComponentName: string,
      currentFilePath: string,
      depth: number = 0
    ): Promise<FileInfo | null> => {
      if (depth > 10) {
        console.log(chalk.yellow(`  追踪深度过深，可能存在循环引用: ${currentComponentName}`));
        return null;
      }
      
      if (visited.has(currentFilePath)) {
        return null;
      }
      
      visited.add(currentFilePath);
      
      const currentFile = allFiles.find(file => file.path === currentFilePath);
      if (!currentFile) {
        console.log(chalk.yellow(`  文件不存在: ${currentFilePath}`));
        return null;
      }
      
      dependencies.add(currentFile);
      console.log(chalk.gray(`  ${'  '.repeat(depth)}检查文件: ${currentFilePath}`));
      
      try {
        // 解析当前文件的 AST
        const ast = parse(currentFile.content, {
          sourceType: 'module',
          plugins: [
            'typescript',
            'jsx',
            'decorators-legacy',
            'classProperties',
            'objectRestSpread',
            'asyncGenerators',
            'functionBind',
            'exportDefaultFrom',
            'exportNamespaceFrom',
            'dynamicImport'
          ]
        });

        let foundImplementation = false;
        let nextTraceTarget: { name: string; path: string } | null = null;
        let defaultAsTarget: FileInfo | null = null; // 用于处理 default as 的情况

        // 遍历 AST 查找组件实现或重新导出
        traverse(ast, {
          // 检查是否有组件的实际实现
          FunctionDeclaration: (path: any) => {
            const node = path.node;
            if (node.id && node.id.name === currentComponentName) {
              console.log(chalk.green(`  ${'  '.repeat(depth)}✓ 找到函数实现: ${currentComponentName}`));
              foundImplementation = true;
            }
          },
          
          VariableDeclarator: (path: any) => {
            const node = path.node;
            if (t.isIdentifier(node.id) && node.id.name === currentComponentName) {
              // 检查是否是组件定义 (函数、箭头函数、JSX)
              if (t.isFunctionExpression(node.init) || 
                  t.isArrowFunctionExpression(node.init) ||
                  (t.isCallExpression(node.init) && this.looksLikeComponentCall(node.init))) {
                console.log(chalk.green(`  ${'  '.repeat(depth)}✓ 找到变量实现: ${currentComponentName}`));
                foundImplementation = true;
              }
            }
          },
          
          ClassDeclaration: (path: any) => {
            const node = path.node;
            if (node.id && node.id.name === currentComponentName) {
              console.log(chalk.green(`  ${'  '.repeat(depth)}✓ 找到类实现: ${currentComponentName}`));
              foundImplementation = true;
            }
          },

          // 检查重新导出
          ExportNamedDeclaration: (path: any) => {
            const node = path.node;
            
            if (node.specifiers && node.source && t.isStringLiteral(node.source)) {
              for (const specifier of node.specifiers) {
                if (t.isExportSpecifier(specifier)) {
                  let exportedName: string;
                  let localName: string;
                  
                  if (t.isIdentifier(specifier.exported)) {
                    exportedName = specifier.exported.name;
                  } else if (t.isStringLiteral(specifier.exported)) {
                    exportedName = specifier.exported.value;
                  } else {
                    continue;
                  }
                  
                  if (t.isIdentifier(specifier.local)) {
                    localName = specifier.local.name;
                  } else {
                    localName = exportedName;
                  }
                  
                  if (exportedName === currentComponentName) {
                    const targetPath = this.resolveFilePath(node.source.value, currentFilePath, allFiles);
                    if (targetPath) {
                      // 特殊处理 export { default as ComponentName } from './file' 的情况
                      if (localName === 'default') {
                        console.log(chalk.cyan(`  ${'  '.repeat(depth)}→ 默认导出重命名: ${currentComponentName} 来自 ${node.source.value} (直接使用目标文件)`));
                        // 对于 default as 的情况，直接将目标文件作为实现，不需要继续追踪
                        const targetFile = allFiles.find(file => file.path === targetPath);
                        if (targetFile) {
                          dependencies.add(targetFile);
                          console.log(chalk.green(`  ${'  '.repeat(depth)}✓ 找到默认导出实现: ${currentComponentName} -> ${targetPath}`));
                          defaultAsTarget = targetFile;
                          foundImplementation = true;
                        }
                      } else {
                        console.log(chalk.cyan(`  ${'  '.repeat(depth)}→ 重新导出: ${currentComponentName} 来自 ${node.source.value}`));
                        nextTraceTarget = { name: localName, path: targetPath } as { name: string; path: string };
                      }
                    }
                  }
                }
              }
            }
          },

          // 检查 export * from 的情况
          ExportAllDeclaration: (path: any) => {
            const node = path.node;
            
            if (node.source && t.isStringLiteral(node.source)) {
              const targetPath = this.resolveFilePath(node.source.value, currentFilePath, allFiles);
              if (targetPath) {
                console.log(chalk.cyan(`  ${'  '.repeat(depth)}→ 可能的重新导出: ${currentComponentName} 来自 ${node.source.value}`));
                nextTraceTarget = { name: currentComponentName, path: targetPath } as { name: string; path: string };
              }
            }
          },

          // 检查默认导出
          ExportDefaultDeclaration: (path: any) => {
            const node = path.node;
            
            if (t.isIdentifier(node.declaration) && node.declaration.name === currentComponentName) {
              console.log(chalk.green(`  ${'  '.repeat(depth)}✓ 找到默认导出实现: ${currentComponentName}`));
              foundImplementation = true;
            } else if (t.isFunctionDeclaration(node.declaration) && 
                      node.declaration.id && 
                      node.declaration.id.name === currentComponentName) {
              console.log(chalk.green(`  ${'  '.repeat(depth)}✓ 找到默认函数导出实现: ${currentComponentName}`));
              foundImplementation = true;
            }
          }
        });

        // 如果找到实现，返回对应的文件
        if (foundImplementation) {
          // 优先返回 default as 的目标文件
          if (defaultAsTarget) {
            return defaultAsTarget;
          }
          return currentFile;
        }

        // 如果有重新导出，继续追踪
        if (nextTraceTarget) {
          const target = nextTraceTarget as { name: string; path: string };
          return await traceImplementation(target.name, target.path, depth + 1);
        }

        // 没有找到实现或重新导出，返回当前文件作为最终结果
        console.log(chalk.yellow(`  ${'  '.repeat(depth)}⚠ 未找到明确实现，使用当前文件: ${currentComponentName}`));
        return currentFile;

      } catch (error) {
        console.log(chalk.yellow(`  ${'  '.repeat(depth)}解析文件失败 ${currentFilePath}: ${error instanceof Error ? error.message : String(error)}`));
        return currentFile; // 解析失败时返回当前文件
      }
    };

    const implementationFile = await traceImplementation(componentName, filePath);
    
    if (implementationFile) {
      return {
        name: componentName,
        code: implementationFile.content,
        path: implementationFile.path,
        file: implementationFile,
        dependencies: Array.from(dependencies)
      };
    }

    return null;
  }

  /**
   * 检查调用表达式是否像组件调用（如 React.forwardRef, React.memo 等）
   */
  private looksLikeComponentCall(node: any): boolean {
    if (!t.isCallExpression(node)) return false;
    
    // React.forwardRef, React.memo, styled.div 等
    if (t.isMemberExpression(node.callee)) {
      const object = node.callee.object;
      const property = node.callee.property;
      
      if (t.isIdentifier(object) && t.isIdentifier(property)) {
        const objectName = object.name;
        const propertyName = property.name;
        
        // 常见的 React 高阶组件
        if (objectName === 'React' && ['forwardRef', 'memo', 'lazy'].includes(propertyName)) {
          return true;
        }
        
        // styled-components
        if (objectName === 'styled') {
          return true;
        }
      }
    }
    
    // 直接调用 forwardRef, memo 等
    if (t.isIdentifier(node.callee)) {
      const name = node.callee.name;
      if (['forwardRef', 'memo', 'lazy'].includes(name)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 从 index.ts 内容中提取组件信息（使用 Babel AST 解析）
   * @returns 组件名和文件路径的映射
   */
  private async extractComponentInfoFromIndex(content: string, indexPath: string, allFiles: FileInfo[]): Promise<Map<string, string>> {
    const componentToFileMap = new Map<string, string>();
    
    try {
      // 使用 Babel 解析 AST
      const ast = parse(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport'
        ]
      });

      // 存储需要异步处理的 export * from 语句
      const exportStarPromises: Promise<Map<string, string>>[] = [];

      // 遍历 AST 节点
      traverse(ast, {
        // 处理 export { A, B } from './module' 和 export { A, B }
        ExportNamedDeclaration: (path: any) => {
          const node = path.node;
          
          // 跳过类型导出（export type { ... }）
          if (node.exportKind === 'type') {
            return;
          }
          
          if (node.specifiers && node.source && t.isStringLiteral(node.source)) {
            // export { A, B } from './module' - 有 from 子句
            const sourceFilePath = this.resolveFilePath(node.source.value, indexPath, allFiles);
            
            for (const specifier of node.specifiers) {
              if (t.isExportSpecifier(specifier)) {
                // 跳过类型导出的 specifier
                if (specifier.exportKind === 'type') {
                  continue;
                }
                
                let exportedName: string;
                
                // 处理 export { default as ComponentName }
                if (t.isIdentifier(specifier.exported)) {
                  exportedName = specifier.exported.name;
                } else if (t.isStringLiteral(specifier.exported)) {
                  exportedName = specifier.exported.value;
                } else {
                  continue;
                }
                
                if (this.isPascalCase(exportedName) && sourceFilePath) {
                  componentToFileMap.set(exportedName, sourceFilePath);
                }
              }
            }
          } else if (node.specifiers && !node.source) {
            // export { A, B } - 没有 from 子句，组件在当前文件中定义
            for (const specifier of node.specifiers) {
              if (t.isExportSpecifier(specifier)) {
                // 跳过类型导出的 specifier
                if (specifier.exportKind === 'type') {
                  continue;
                }
                
                let exportedName: string;
                
                if (t.isIdentifier(specifier.exported)) {
                  exportedName = specifier.exported.name;
                } else if (t.isStringLiteral(specifier.exported)) {
                  exportedName = specifier.exported.value;
                } else {
                  continue;
                }
                
                if (this.isPascalCase(exportedName)) {
                  componentToFileMap.set(exportedName, indexPath);
                }
              }
            }
          }
        },

        // 处理 export * from './module'
        ExportAllDeclaration: (path: any) => {
          const node = path.node;
          
          if (node.source && t.isStringLiteral(node.source)) {
            const relativePath = node.source.value;
            console.log(chalk.gray(`发现重新导出: ${relativePath}`));
            
            // 将异步操作添加到数组中，稍后处理
            exportStarPromises.push(
              this.extractComponentsFromReExportWithPaths(relativePath, indexPath, allFiles)
            );
          }
        },

        // 处理 export default ComponentName
        ExportDefaultDeclaration: (path: any) => {
          const node = path.node;
          
          if (t.isIdentifier(node.declaration)) {
            const name = node.declaration.name;
            if (this.isPascalCase(name)) {
              componentToFileMap.set(name, indexPath);
            }
          } else if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
            const name = node.declaration.id.name;
            if (this.isPascalCase(name)) {
              componentToFileMap.set(name, indexPath);
            }
          }
        }
      });

      // 等待所有 export * from 语句的处理完成
      const reExportedResults = await Promise.all(exportStarPromises);
      for (const reExportedMap of reExportedResults) {
        for (const [componentName, filePath] of reExportedMap.entries()) {
          componentToFileMap.set(componentName, filePath);
        }
      }

      // 过滤出符合条件的组件
      const filteredMap = new Map<string, string>();
      for (const [componentName, filePath] of componentToFileMap.entries()) {
        if (this.isPascalCase(componentName) && this.isLikelyComponent(componentName, content)) {
          filteredMap.set(componentName, filePath);
        }
      }

      return filteredMap;

    } catch (error) {
      console.log(chalk.yellow(`Babel 解析失败，回退到正则表达式解析: ${error instanceof Error ? error.message : String(error)}`));
      
      // 回退到原来的正则表达式方法
      const componentNames = await this.extractComponentNamesFromIndexRegex(content, indexPath, allFiles);
      const fallbackMap = new Map<string, string>();
      
      // 为回退的组件名查找对应文件
      for (const componentName of componentNames) {
        const componentFile = this.findComponentFile(componentName, allFiles);
        if (componentFile) {
          fallbackMap.set(componentName, componentFile.path);
        }
      }
      
      return fallbackMap;
    }
  }

  /**
   * 解析文件路径
   */
  private resolveFilePath(relativePath: string, indexPath: string, allFiles: FileInfo[]): string | null {
    // 处理 ./ 开头的相对路径
    const cleanRelativePath = relativePath.startsWith('./') ? relativePath.substring(2) : relativePath;
    const absolutePath = path.resolve(path.dirname(indexPath), cleanRelativePath);
    
    // 尝试多种可能的文件扩展名
    const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
    
    for (const ext of possibleExtensions) {
      const fullPath = absolutePath + ext;
      const foundFile = allFiles.find(file => file.path === fullPath);
      if (foundFile) {
        return foundFile.path;
      }
    }
    
    return null;
  }

  /**
   * 从重新导出的文件中提取组件名称和路径映射
   */
  private async extractComponentsFromReExportWithPaths(relativePath: string, indexPath: string, allFiles: FileInfo[]): Promise<Map<string, string>> {
    try {
      const sourceFilePath = this.resolveFilePath(relativePath, indexPath, allFiles);
      
      if (!sourceFilePath) {
        console.log(chalk.yellow(`警告: 未找到重新导出的文件: ${relativePath}`));
        return new Map();
      }
      
      const targetFile = allFiles.find(file => file.path === sourceFilePath);
      if (!targetFile) {
        return new Map();
      }
      
      // 递归解析该文件的导出
      const componentMap = await this.extractComponentInfoFromIndex(targetFile.content, targetFile.path, allFiles);
      console.log(chalk.gray(`从 ${relativePath} 中提取到组件: ${Array.from(componentMap.keys()).join(', ')}`));
      
      return componentMap;
      
    } catch (error) {
      console.log(chalk.yellow(`解析重新导出文件 ${relativePath} 失败: ${error instanceof Error ? error.message : String(error)}`));
      return new Map();
    }
  }

  /**
   * 从 index.ts 内容中提取组件名称（正则表达式回退方法）
   */
  private async extractComponentNamesFromIndexRegex(content: string, indexPath: string, allFiles: FileInfo[]): Promise<string[]> {
    const componentNames: string[] = [];
    
    // 匹配各种导出形式
    const exportPatterns = [
      // export { ComponentA, ComponentB } from './components'
      /export\s*\{\s*([^}]+)\s*\}\s*from/g,
      // export { ComponentA, ComponentB }
      /export\s*\{\s*([^}]+)\s*\}(?!\s*from)/g,
      // export ComponentA from './ComponentA'
      /export\s+([A-Z][a-zA-Z0-9]*)\s+from/g,
      // export { default as ComponentA } from './ComponentA'
      /export\s*\{\s*default\s+as\s+([A-Z][a-zA-Z0-9]*)\s*\}/g
    ];

    for (const pattern of exportPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          if (match[1].includes(',')) {
            // 处理 export { A, B, C } 的情况
            const items = match[1].split(',').map(item => {
              // 处理 "default as ComponentName" 的情况
              const asMatch = item.match(/default\s+as\s+([A-Z][a-zA-Z0-9]*)/);
              if (asMatch) {
                return asMatch[1];
              }
              // 处理普通的导出名
              return item.trim().replace(/\s+as\s+.*/, '');
            });
            componentNames.push(...items);
          } else {
            componentNames.push(match[1].trim());
          }
        }
      }
    }

    // 处理 export * from './xxx' 的情况
    const exportStarPattern = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
    let starMatch;
    while ((starMatch = exportStarPattern.exec(content)) !== null) {
      const relativePath = starMatch[1];
      const reExportedComponents = await this.extractComponentsFromReExport(relativePath, indexPath, allFiles);
      componentNames.push(...reExportedComponents);
    }

    // 过滤出大驼峰命名的变量，排除类型定义
    return componentNames
      .filter(name => this.isPascalCase(name))
      .filter(name => this.isLikelyComponent(name, content))
      .filter((name, index, arr) => arr.indexOf(name) === index); // 去重
  }

  /**
   * 从重新导出的文件中提取组件名称
   */
  private async extractComponentsFromReExport(relativePath: string, indexPath: string, allFiles: FileInfo[]): Promise<string[]> {
    try {
      // 解析相对路径到绝对路径
      // 处理 ./ 开头的相对路径
      const cleanRelativePath = relativePath.startsWith('./') ? relativePath.substring(2) : relativePath;
      const absolutePath = path.resolve(path.dirname(indexPath), cleanRelativePath);
      
      // 尝试多种可能的文件扩展名
      const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      let targetFile: FileInfo | null = null;
      
      for (const ext of possibleExtensions) {
        const fullPath = absolutePath + ext;
        const foundFile = allFiles.find(file => file.path === fullPath);
        if (foundFile) {
          targetFile = foundFile;
          break;
        }
      }
      
      if (!targetFile) {
        console.log(chalk.yellow(`警告: 未找到重新导出的文件: ${relativePath}`));
        return [];
      }
      
      // 递归解析该文件的导出
      const componentInfoMap = await this.extractComponentInfoFromIndex(targetFile.content, targetFile.path, allFiles);
      const componentNames = Array.from(componentInfoMap.keys());
      console.log(chalk.gray(`从 ${relativePath} 中提取到组件: ${componentNames.join(', ')}`));
      
      return componentNames;
      
    } catch (error) {
      console.log(chalk.yellow(`解析重新导出文件 ${relativePath} 失败: ${error instanceof Error ? error.message : String(error)}`));
      return [];
    }
  }

  /**
   * 检查是否为大驼峰命名（PascalCase）
   */
  private isPascalCase(name: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(name);
  }

  /**
   * 判断是否可能是组件（排除类型和工具函数）
   */
  private isLikelyComponent(name: string, indexContent: string): boolean {
    // 检查是否是纯类型定义导出（只导出类型，没有导出实际组件）
    const isOnlyTypeExport = new RegExp(`export\\s+type\\s+${name}\\s*=`, 'i').test(indexContent) ||
                            new RegExp(`export\\s+interface\\s+${name}`, 'i').test(indexContent);
    
    // 检查是否有对应的组件导出
    const hasComponentExport = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`, 'i').test(indexContent) ||
                              new RegExp(`export\\s+default\\s+${name}`, 'i').test(indexContent);
    
    // 如果只是类型导出，没有组件导出，则排除
    if (isOnlyTypeExport && !hasComponentExport) {
      return false;
    }

    // 排除一些常见的工具函数名模式，但要更精确
    const utilPatterns = [
      /^(create|make|build|generate|get|set|is|has|can|should|will|use)[A-Z]/,
      /^(format|parse|validate|transform|convert)[A-Z]/,
      /^[a-z]+Utils?$/i,
      /^[a-z]+Helper$/i,
      /^[a-z]+Manager$/i,
      /^[a-z]+Service$/i,
      // 注意：移除了 Provider 模式，因为很多组件库有 Provider 组件
      /Config$/,
      /Constants?$/i,
      /Types?$/i,
      /Enum$/i
    ];

    for (const pattern of utilPatterns) {
      if (pattern.test(name)) {
        return false;
      }
    }

    // 特殊处理：以 Provider 结尾的，如果不是明显的工具函数，可能是组件
    if (/Provider$/.test(name)) {
      // 检查是否是常见的工具 Provider（如 AuthProvider, ThemeProvider 等可能是组件）
      const utilProviders = [
        /^Api.*Provider$/,
        /^Http.*Provider$/,
        /^Data.*Provider$/,
        /^Service.*Provider$/
      ];
      
      for (const pattern of utilProviders) {
        if (pattern.test(name)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 根据组件名查找对应的文件
   */
  private findComponentFile(componentName: string, allFiles: FileInfo[]): FileInfo | null {
    // 尝试多种可能的文件名模式
    const possiblePatterns = [
      // 精确匹配：ComponentName.tsx
      new RegExp(`/${componentName}\\.(tsx?|jsx?)$`),
      // 小写匹配：componentname.tsx
      new RegExp(`/${componentName.toLowerCase()}\\.(tsx?|jsx?)$`),
      // 短横线命名：component-name.tsx
      new RegExp(`/${componentName.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1)}\\.(tsx?|jsx?)$`),
      // index.tsx in ComponentName folder
      new RegExp(`/${componentName}/index\\.(tsx?|jsx?)$`),
      // 文件内容包含组件定义
      null // 这个用特殊逻辑处理
    ];

    // 先尝试文件名匹配
    for (const pattern of possiblePatterns.slice(0, -1)) {
      if (pattern) {
        const matchedFile = allFiles.find(file => pattern.test(file.path));
        if (matchedFile) {
          return matchedFile;
        }
      }
    }

    // 如果文件名匹配失败，尝试内容匹配
    const contentPatterns = [
      // function ComponentName
      new RegExp(`function\\s+${componentName}\\s*[({]`),
      // const ComponentName = 
      new RegExp(`const\\s+${componentName}\\s*=`),
      // class ComponentName
      new RegExp(`class\\s+${componentName}\\s*[{(]`),
      // export default ComponentName
      new RegExp(`export\\s+default\\s+${componentName}`),
      // export { ComponentName }
      new RegExp(`export\\s*\\{[^}]*\\b${componentName}\\b[^}]*\\}`)
    ];

    for (const file of allFiles) {
      for (const pattern of contentPatterns) {
        if (pattern.test(file.content)) {
          return file;
        }
      }
    }

    return null;
  }

  /**
   * 回退到传统的组件识别方式
   */
  private fallbackToTraditionalIdentification(allFiles: FileInfo[]): Array<{
    name: string;
    file: FileInfo;
    dependencies?: FileInfo[];
  }> {
    const componentFiles = this.config.promptConfig?.componentIdentification
      ? this.codeParser.identifyComponents(allFiles)
      : this.codeParser.identifyComponents(allFiles);
    
    // 转换为新的格式，使用文件名作为组件名
    return componentFiles.map(file => ({
      name: this.codeParser.extractComponentName(file),
      file,
      dependencies: []
    }));
  }



  /**
   * 计算最优批次大小
   */
  private calculateOptimalBatchSize(totalComponents: number): number {
    // 根据组件数量动态调整批次大小
    if (totalComponents <= 10) return 2;
    if (totalComponents <= 30) return 3;
    if (totalComponents <= 60) return 4;
    return 5; // 大型项目使用更大的批次
  }

  /**
   * 可中断的延迟函数
   */
  private async interruptibleDelay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      
      const abortHandler = () => {
        clearTimeout(timeout);
        reject(new Error('Delay aborted'));
      };
      
      if (signal.aborted) {
        clearTimeout(timeout);
        reject(new Error('Delay aborted'));
        return;
      }
      
      signal.addEventListener('abort', abortHandler, { once: true });
      
      setTimeout(() => {
        signal.removeEventListener('abort', abortHandler);
      }, ms);
    });
  }

  /**
   * 处理带依赖关系的批次
   */
  private async processBatchWithDependencies(
    batch: Array<{ name: string; code: string; path: string; file: FileInfo; dependencies?: FileInfo[] }>,
    allComponentFiles: Array<{ name: string; code: string; path: string; file: FileInfo; dependencies?: FileInfo[] }>,
    signal: AbortSignal
  ): Promise<(ComponentInfo | null)[]> {
    const batchPromises = batch.map(async (component, index) => {
      if (signal.aborted) {
        throw new Error('Analysis aborted');
      }

      const componentDisplayName = chalk.cyan(component.name);
      const componentPath = chalk.gray(path.relative(process.cwd(), component.path));
      
      try {
        console.log(chalk.blue(`\n🔍 开始分析组件: ${componentDisplayName}`));
        console.log(chalk.gray(`   文件路径: ${componentPath}`));

        // 构建组件依赖关系（最多3层）
        console.log(chalk.gray('   正在分析依赖关系...'));
        const dependencyContext = await this.buildDependencyContext(
          component,
          allComponentFiles,
          3 // 最大深度3层
        );

        // 打印依赖文件路径
        if (dependencyContext.dependencyPaths && dependencyContext.dependencyPaths.length > 0) {
          console.log(chalk.gray(`   找到 ${dependencyContext.dependencyPaths.length} 个依赖文件:`));
          dependencyContext.dependencyPaths.forEach((depPath, idx) => {
            const relativePath = path.relative(process.cwd(), depPath);
            const depth = dependencyContext.dependencyDepths?.[idx] || 1;
            const indent = '     ' + '  '.repeat(depth - 1);
            console.log(chalk.gray(`${indent}└─ ${relativePath} (深度: ${depth})`));
          });
        } else {
          console.log(chalk.gray('   未找到依赖文件'));
        }

        console.log(chalk.gray('   正在调用 LLM 进行分析...'));
        const analysisResult = await this.llmManager.analyzeComponent(
          component.code,
          component.name,
          dependencyContext.relatedFiles,
          this.config.promptConfig?.componentIdentification || DEFAULT_COMPONENT_EXTRACTION_PROMPT
        );

        const componentInfo: ComponentInfo = {
          ...analysisResult,
          filePath: path.relative(process.cwd(), component.path)
        };

        console.log(chalk.green(`✅ 组件 ${componentDisplayName} 分析成功`));
        console.log(chalk.gray(`   中文名称: ${componentInfo.chineseName || '未识别'}`));
        console.log(chalk.gray(`   是否容器组件: ${componentInfo.isContainer ? '是' : '否'}`));
        console.log(chalk.gray(`   属性数量: ${componentInfo.properties?.length || 0}`));
        
        return componentInfo;
      } catch (error: any) {
        if (signal.aborted || error.name === 'AbortError') {
          throw error;
        }
        
        const errorMessage = error.message || String(error);
        console.log(chalk.red(`❌ 组件 ${componentDisplayName} 分析失败`));
        console.log(chalk.red(`   错误信息: ${errorMessage}`));
        console.log(chalk.gray(`   文件路径: ${componentPath}`));
        
        // 如果是 API 相关错误，提供更多信息
        if (errorMessage.includes('API') || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
          console.log(chalk.yellow('   💡 建议: 检查 API 配置或稍后重试'));
        }
        
        return null;
      }
    });

    return Promise.all(batchPromises);
  }

  /**
   * 构建组件依赖上下文（支持多层依赖）
   */
  private async buildDependencyContext(
    component: { name: string; code: string; path: string; file: FileInfo; dependencies?: FileInfo[] },
    allComponentFiles: Array<{ name: string; code: string; path: string; file: FileInfo; dependencies?: FileInfo[] }>,
    maxDepth: number = 3
  ): Promise<{ 
    relatedFiles: string[]; 
    dependencyTree: any; 
    dependencyPaths: string[]; 
    dependencyDepths: number[] 
  }> {
    const relatedFiles: string[] = [];
    const dependencyPaths: string[] = [];
    const dependencyDepths: number[] = [];
    const processedPaths = new Set<string>();
    const dependencyTree: any = { name: component.name, path: component.path, dependencies: [] };

    // 递归收集依赖
    const collectDependencies = async (
      currentComponent: { file: FileInfo; dependencies?: FileInfo[] },
      currentDepth: number,
      parentNode: any
    ): Promise<void> => {
      if (currentDepth >= maxDepth || processedPaths.has(currentComponent.file.path)) {
        return;
      }

      processedPaths.add(currentComponent.file.path);

      // 使用现有的依赖信息或分析新的依赖
      let dependencies: string[] = [];
      
      if (currentComponent.dependencies && currentComponent.dependencies.length > 0) {
        // 使用预先收集的依赖信息
        dependencies = currentComponent.dependencies.map(dep => dep.path);
      } else {
        // 动态分析依赖关系
        dependencies = this.codeParser.analyzeDependencies(
          currentComponent.file,
          allComponentFiles.map(c => c.file)
        );
      }

      // 处理每个依赖
      for (const depPath of dependencies.slice(0, 5)) { // 限制每层最多5个依赖
        const depComponent = allComponentFiles.find(c => c.path === depPath);
        if (!depComponent || processedPaths.has(depPath)) continue;

        // 记录依赖路径和深度
        dependencyPaths.push(depPath);
        dependencyDepths.push(currentDepth + 1);

        // 添加到相关文件列表
        if (depComponent.code.length < 8000) { // 限制文件大小
          const truncatedCode = depComponent.code.length > 3000 
            ? depComponent.code.substring(0, 3000) + '\n// ... (文件内容已截断)'
            : depComponent.code;

          relatedFiles.push(
            `// 依赖文件: ${path.basename(depPath)} (深度: ${currentDepth + 1})\n${truncatedCode}`
          );
        }

        // 构建依赖树
        const depNode = {
          name: depComponent.name,
          path: depPath,
          depth: currentDepth + 1,
          dependencies: []
        };
        parentNode.dependencies.push(depNode);

        // 递归收集下一层依赖
        await collectDependencies(
          { file: depComponent.file, dependencies: depComponent.dependencies },
          currentDepth + 1,
          depNode
        );
      }
    };

    // 开始收集依赖
    await collectDependencies(
      { file: component.file, dependencies: component.dependencies },
      0,
      dependencyTree
    );

    // 限制相关文件数量和总大小
    const maxFiles = 8;
    const limitedFiles = relatedFiles.slice(0, maxFiles);
    
    if (relatedFiles.length > maxFiles) {
      limitedFiles.push(`// ... 还有 ${relatedFiles.length - maxFiles} 个依赖文件未显示`);
    }

    return {
      relatedFiles: limitedFiles,
      dependencyTree,
      dependencyPaths,
      dependencyDepths
    };
  }

  /**
   * 获取相关文件内容（保留原方法作为后备）
   */
  private getRelatedFiles(
    currentFile: FileInfo,
    allComponentFiles: Array<{ name: string; code: string; path: string; file: FileInfo }>
  ): string[] {
    const relatedFiles: string[] = [];
    
    // 分析依赖关系
    const dependencies = this.codeParser.analyzeDependencies(
      currentFile,
      allComponentFiles.map(c => c.file)
    );

    // 获取相关文件的内容（限制数量和大小）
    for (const depPath of dependencies.slice(0, 3)) { // 最多3个相关文件
      const relatedComponent = allComponentFiles.find(c => c.path === depPath);
      if (relatedComponent && relatedComponent.code.length < 5000) { // 限制文件大小
        relatedFiles.push(`// ${path.basename(depPath)}\n${relatedComponent.code.substring(0, 2000)}`);
      }
    }

    return relatedFiles;
  }

  /**
   * 获取分析统计信息
   */
  async getAnalysisStats() {
    return {
      llm: this.llmManager.getStats(),
      parser: this.codeParser.getCacheStats()
    };
  }

  /**
   * 清理资源
   */
  async cleanup() {
    this.codeParser.clearCache();
    this.llmManager.resetStats();
  }
}
