#!/usr/bin/env node

/**
 * Component Insight 使用示例
 * 
 * 这个例子演示如何使用 Component Insight 分析一个简单的组件库
 */

import { insight, ModelEnum } from './src/index';
import config from './insight.config.example.ts';

async function example() {
  console.log('🚀 Component Insight 使用示例\n');

  try {
    // 完整配置分析
    console.log('完整配置分析');
    const fullReport = await insight(config);

    console.log('✅ 完整分析完成');
    // console.log(JSON.stringify(fullReport, null, 2));

  } catch (error) {
    console.error('❌ 分析失败:', error.message);
    
    if (error.message.includes('API')) {
      console.log('\n💡 提示:');
      console.log('1. 请确保设置了正确的 OPENAI_API_KEY 环境变量');
      console.log('2. 或者在代码中直接提供 apiKey');
      console.log('3. 检查网络连接和API配额');
    }
  }
}

// 检查是否作为脚本直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  example().catch(console.error);
}

export default example;
