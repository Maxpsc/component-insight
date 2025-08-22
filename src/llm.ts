import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import chalk from 'chalk';
import { LLMConfig, LLMResponse, ModelEnum } from './types.js';
import { DEFAULT_COMPONENT_EXTRACTION_PROMPT } from './prompts.js';
import { getStructuredDataFromMessage } from './utils/format.js';

/**
 * 大模型API管理器
 */
export class LLMManager {
  private client: ChatOpenAI;
  private config: LLMConfig;
  private requestCount = 0;
  private totalTokens = 0;

  constructor(config: LLMConfig) {
    this.config = {
      timeout: 30000,
      temperature: 0.1,
      ...config
    };

    console.log('LLM config', this.config)
    // 使用 ChatOpenAI 初始化客户端
    this.client = new ChatOpenAI({
      model: this.config.model as string,
      apiKey: this.config.apiKey,
      disableStreaming: true,
      configuration: {
        baseURL: this.config.baseUrl,
      },
    });
  }

  /**
   * 调用大模型API
   */
  async chat(messages: Array<{ role: string; content: string }>): Promise<LLMResponse> {
    const startTime = Date.now();

    // 转换消息格式为LangChain格式
    const langchainMessages = messages.map(msg => {
      if (msg.role === 'system') {
        return new SystemMessage(msg.content);
      } else {
        return new HumanMessage(msg.content);
      }
    });

    try {
      // 调用LangChain ChatOpenAI
      const response = await this.client.invoke(langchainMessages);

      const responseTime = Date.now() - startTime;
      this.requestCount++;
      
      // 估算token使用量（LangChain可能不提供详细的usage信息）
      const estimatedTokens = Math.ceil((messages.reduce((sum, msg) => sum + msg.content.length, 0) + response.content.toString().length) / 4);
      this.totalTokens += estimatedTokens;

      console.log(chalk.gray(`LLM请求 #${this.requestCount} 完成 (${responseTime}ms)`));

      return {
        content: response.content.toString(),
        usage: {
          promptTokens: Math.ceil(messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4),
          completionTokens: Math.ceil(response.content.toString().length / 4),
          totalTokens: estimatedTokens
        },
        responseTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`LLM请求失败: ${errorMessage}`);
    }
  }

  /**
   * 分析组件库基本信息
   */
  async analyzeLibraryInfo(packageJson: any, readmeContent?: string): Promise<{
    name: string;
    chineseName: string;
    description: string;
    useCases: string[];
  }> {
    const messages = [
      {
        role: 'system',
        content: `你是一个前端组件库分析专家。请根据提供的package.json和README信息，分析组件库的基本信息。

请以JSON格式返回分析结果，包含以下字段：
- name: 包名称（直接使用package.json中的name）
- chineseName: 中文名称（根据描述推断或翻译）
- description: 详细描述（200字以内）
- useCases: 使用场景数组（3-5个具体场景）

返回格式示例：
{
  "name": "antd",
  "chineseName": "蚂蚁设计",
  "description": "企业级UI设计语言和React组件库，提供高质量的React组件，用于构建企业级中后台产品。",
  "useCases": ["企业后台管理系统", "数据可视化平台", "内容管理系统", "电商管理平台"]
}`
      },
      {
        role: 'user',
        content: `Package.json信息：
${JSON.stringify(packageJson, null, 2)}

${readmeContent ? `README内容：\n${readmeContent.substring(0, 2000)}` : ''}

请分析这个组件库的基本信息。`
      }
    ];

    const response = await this.chat(messages);
    
    try {
      return JSON.parse(response.content);
    } catch (error) {
      throw new Error(`解析组件库信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 分析单个组件
   */
  async analyzeComponent(
    componentCode: string,
    componentName: string,
    relatedFiles?: string[],
    customPrompt?: string
  ): Promise<{
    name: string;
    chineseName: string;
    functions: string[];
    useCases: string[];
    uiFeatures: string;
    isContainer: boolean;
    properties: Array<{
      name: string;
      description: string;
      type: string;
      defaultValue?: string;
      enum?: string[];
      required?: boolean;
    }>;
  }> {
    const systemPrompt = customPrompt || DEFAULT_COMPONENT_EXTRACTION_PROMPT;
    
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `组件名：${componentName}

组件代码：
\`\`\`typescript
${componentCode}
\`\`\`

${relatedFiles && relatedFiles.length > 0 ? `相关文件：\n${relatedFiles.join('\n\n')}` : ''}

请分析这个组件的详细信息。`
      }
    ];

    const response = await this.chat(messages);
    return getStructuredDataFromMessage(response as any) as any
  }

  /**
   * 批量分析多个组件（优化版本）
   */
  async analyzeBatchComponents(
    components: Array<{ name: string; code: string; path: string }>
  ): Promise<Array<{
    name: string;
    chineseName: string;
    functions: string[];
    useCases: string[];
    uiFeatures: string;
    isContainer: boolean;
    properties: any[];
  }>> {
    const results = [];
    const batchSize = 3; // 每批处理3个组件

    for (let i = 0; i < components.length; i += batchSize) {
      const batch = components.slice(i, i + batchSize);
      
      console.log(chalk.blue(`正在分析组件批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(components.length/batchSize)}`));
      
      const batchPromises = batch.map(component => 
        this.analyzeComponent(component.code, component.name)
          .catch(error => {
            console.warn(chalk.yellow(`分析组件 ${component.name} 失败: ${error.message}`));
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null));
      
      // 批次间添加延迟，避免API限流
      if (i + batchSize < components.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      totalTokens: this.totalTokens
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.requestCount = 0;
    this.totalTokens = 0;
  }
}
