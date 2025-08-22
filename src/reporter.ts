import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { AnalysisReport, ComponentInfo, LibraryInfo, AnalysisConfig } from './types.js';

/**
 * 报告生成器
 */
export class ReportGenerator {
  /**
   * 生成分析报告
   */
  async generateReport(
    libraryInfo: LibraryInfo,
    components: ComponentInfo[],
    config: AnalysisConfig
  ): Promise<AnalysisReport> {
    const report: AnalysisReport = {
      library: libraryInfo,
      components,
      analyzedAt: new Date().toISOString(),
      config: {
        ...config,
        // 移除敏感信息
        llm: {
          ...config.llm,
          apiKey: '***'
        }
      }
    };

    return report;
  }

  /**
   * 保存报告到JSON文件
   */
  async saveReport(report: AnalysisReport, outputPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFileName = `component-insight-${report.library.name}-${timestamp}.json`;
    
    let filePath: string;
    
    if (outputPath) {
      if (path.extname(outputPath) === '.json') {
        filePath = outputPath;
      } else {
        // 如果提供的是目录路径
        await fs.ensureDir(outputPath);
        filePath = path.join(outputPath, defaultFileName);
      }
    } else {
      filePath = path.join(process.cwd(), defaultFileName);
    }

    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
    
    console.log(chalk.green(`报告已保存: ${filePath}`));
    return filePath;
  }

  /**
   * 生成控制台报告
   */
  printConsoleReport(report: AnalysisReport): void {
    console.log('\n' + '='.repeat(60));
    console.log(chalk.bold.cyan('🔍 组件库分析报告'));
    console.log('='.repeat(60));
    
    // 组件库信息
    console.log(chalk.bold.yellow('\n📦 组件库信息:'));
    console.log(`${chalk.bold('名称:')} ${report.library.name}`);
    console.log(`${chalk.bold('中文名:')} ${report.library.chineseName}`);
    console.log(`${chalk.bold('描述:')} ${report.library.description}`);
    if (report.library.version) {
      console.log(`${chalk.bold('版本:')} ${report.library.version}`);
    }
    if (report.library.author) {
      console.log(`${chalk.bold('作者:')} ${report.library.author}`);
    }
    
    console.log(`${chalk.bold('使用场景:')}`);
    report.library.useCases.forEach((useCase, index) => {
      console.log(`  ${index + 1}. ${useCase}`);
    });

    // 组件统计
    console.log(chalk.bold.yellow('\n📊 组件统计:'));
    console.log(`${chalk.bold('总组件数:')} ${report.components.length}`);
    
    const containerComponents = report.components.filter(c => c.isContainer).length;
    console.log(`${chalk.bold('容器组件:')} ${containerComponents}`);
    console.log(`${chalk.bold('普通组件:')} ${report.components.length - containerComponents}`);

    // 组件列表
    console.log(chalk.bold.yellow('\n🧩 组件详情:'));
    
    report.components.forEach((component, index) => {
      console.log(`\n${chalk.bold(`${index + 1}. ${component.name}`)} ${component.isContainer ? chalk.green('(容器)') : ''}`);
      console.log(`   ${chalk.gray('中文名:')} ${component.chineseName}`);
      console.log(`   ${chalk.gray('文件:')} ${path.basename(component.filePath)}`);
      console.log(`   ${chalk.gray('UI特征:')} ${component.uiFeatures}`);
      
      if (component.functions.length > 0) {
        console.log(`   ${chalk.gray('功能:')}`);
        component.functions.forEach(func => {
          console.log(`     • ${func}`);
        });
      }
      
      if (component.useCases.length > 0) {
        console.log(`   ${chalk.gray('使用场景:')}`);
        component.useCases.forEach(useCase => {
          console.log(`     • ${useCase}`);
        });
      }
      
      if (component.properties.length > 0) {
        console.log(`   ${chalk.gray('属性 (前5个):')}`);
        component.properties.slice(0, 5).forEach(prop => {
          const required = prop.required ? chalk.red('*') : '';
          const defaultVal = prop.defaultValue ? ` = ${prop.defaultValue}` : '';
          console.log(`     • ${prop.name}${required}: ${prop.type}${defaultVal}`);
          if (prop.description) {
            console.log(`       ${chalk.gray(prop.description)}`);
          }
        });
        
        if (component.properties.length > 5) {
          console.log(`     ${chalk.gray(`... 还有 ${component.properties.length - 5} 个属性`)}`);
        }
      }
    });

    // 分析信息
    console.log(chalk.bold.yellow('\n⚡ 分析信息:'));
    console.log(`${chalk.bold('分析时间:')} ${new Date(report.analyzedAt).toLocaleString()}`);
    console.log(`${chalk.bold('仓库地址:')} ${report.config.repositoryUrl}`);
    console.log(`${chalk.bold('入口路径:')} ${report.config.entryPath || '/'}`);
    console.log(`${chalk.bold('使用模型:')} ${report.config.llm.model}`);
    
    console.log('\n' + '='.repeat(60));
  }

  /**
   * 生成Markdown报告
   */
  async generateMarkdownReport(report: AnalysisReport, outputPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFileName = `component-insight-${report.library.name}-${timestamp}.md`;
    
    let filePath: string;
    
    if (outputPath) {
      if (path.extname(outputPath) === '.md') {
        filePath = outputPath;
      } else {
        await fs.ensureDir(outputPath);
        filePath = path.join(outputPath, defaultFileName);
      }
    } else {
      filePath = path.join(process.cwd(), defaultFileName);
    }

    const markdown = this.generateMarkdownContent(report);
    
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, markdown, 'utf-8');
    
    console.log(chalk.green(`Markdown报告已保存: ${filePath}`));
    return filePath;
  }

  /**
   * 生成Markdown内容
   */
  private generateMarkdownContent(report: AnalysisReport): string {
    const { library, components } = report;
    
    let markdown = `# ${library.chineseName} (${library.name}) 组件库分析报告\n\n`;
    
    // 基本信息
    markdown += `## 📦 基本信息\n\n`;
    markdown += `- **名称**: ${library.name}\n`;
    markdown += `- **中文名**: ${library.chineseName}\n`;
    markdown += `- **描述**: ${library.description}\n`;
    if (library.version) {
      markdown += `- **版本**: ${library.version}\n`;
    }
    if (library.author) {
      markdown += `- **作者**: ${library.author}\n`;
    }
    markdown += `- **分析时间**: ${new Date(report.analyzedAt).toLocaleString()}\n\n`;
    
    // 使用场景
    markdown += `## 🎯 使用场景\n\n`;
    library.useCases.forEach((useCase, index) => {
      markdown += `${index + 1}. ${useCase}\n`;
    });
    markdown += `\n`;
    
    // 组件统计
    const containerComponents = components.filter(c => c.isContainer).length;
    markdown += `## 📊 组件统计\n\n`;
    markdown += `- **总组件数**: ${components.length}\n`;
    markdown += `- **容器组件**: ${containerComponents}\n`;
    markdown += `- **普通组件**: ${components.length - containerComponents}\n\n`;
    
    // 组件详情
    markdown += `## 🧩 组件详情\n\n`;
    
    components.forEach((component, index) => {
      markdown += `### ${index + 1}. ${component.name} ${component.isContainer ? '(容器组件)' : ''}\n\n`;
      markdown += `- **中文名**: ${component.chineseName}\n`;
      markdown += `- **文件路径**: \`${component.filePath}\`\n`;
      markdown += `- **UI特征**: ${component.uiFeatures}\n\n`;
      
      if (component.functions.length > 0) {
        markdown += `**功能特性**:\n`;
        component.functions.forEach(func => {
          markdown += `- ${func}\n`;
        });
        markdown += `\n`;
      }
      
      if (component.useCases.length > 0) {
        markdown += `**适用场景**:\n`;
        component.useCases.forEach(useCase => {
          markdown += `- ${useCase}\n`;
        });
        markdown += `\n`;
      }
      
      if (component.properties.length > 0) {
        markdown += `**属性说明**:\n\n`;
        markdown += `| 属性名 | 类型 | 必需 | 默认值 | 描述 |\n`;
        markdown += `|--------|------|------|--------|------|\n`;
        
        component.properties.forEach(prop => {
          const required = prop.required ? '✓' : '';
          const defaultValue = prop.defaultValue || '-';
          const description = prop.description || '';
          const type = prop.type.replace(/\|/g, '\\|'); // 转义表格中的竖线
          
          markdown += `| ${prop.name} | \`${type}\` | ${required} | \`${defaultValue}\` | ${description} |\n`;
        });
        markdown += `\n`;
      }
    });
    
    // 分析配置
    markdown += `## ⚙️ 分析配置\n\n`;
    markdown += `- **仓库地址**: ${report.config.repositoryUrl}\n`;
    markdown += `- **入口路径**: ${report.config.entryPath || '/'}\n`;
    markdown += `- **使用模型**: ${report.config.llm.model}\n`;
    markdown += `- **API地址**: ${report.config.llm.baseUrl}\n\n`;
    
    markdown += `---\n\n`;
    markdown += `*此报告由 [Component Insight](https://github.com/your-repo/component-insight) 自动生成*\n`;
    
    return markdown;
  }

  /**
   * 生成组件索引
   */
  generateComponentIndex(components: ComponentInfo[]): {
    byName: Record<string, ComponentInfo>;
    byType: Record<string, ComponentInfo[]>;
    byFeature: Record<string, ComponentInfo[]>;
  } {
    const byName: Record<string, ComponentInfo> = {};
    const byType: Record<string, ComponentInfo[]> = {
      container: [],
      normal: []
    };
    const byFeature: Record<string, ComponentInfo[]> = {};

    components.forEach(component => {
      // 按名称索引
      byName[component.name] = component;
      
      // 按类型索引
      if (component.isContainer) {
        byType.container.push(component);
      } else {
        byType.normal.push(component);
      }
      
      // 按功能特性索引
      component.functions.forEach(func => {
        if (!byFeature[func]) {
          byFeature[func] = [];
        }
        byFeature[func].push(component);
      });
    });

    return { byName, byType, byFeature };
  }

  /**
   * 验证报告完整性
   */
  validateReport(report: AnalysisReport): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必需字段
    if (!report.library.name) {
      errors.push('缺少组件库名称');
    }
    
    if (!report.library.chineseName) {
      warnings.push('缺少组件库中文名称');
    }
    
    if (report.components.length === 0) {
      warnings.push('未找到任何组件');
    }

    // 检查组件完整性
    report.components.forEach((component, index) => {
      if (!component.name) {
        errors.push(`组件 ${index + 1} 缺少名称`);
      }
      
      if (!component.chineseName) {
        warnings.push(`组件 ${component.name} 缺少中文名称`);
      }
      
      if (component.properties.length === 0) {
        warnings.push(`组件 ${component.name} 没有属性信息`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
