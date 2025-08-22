# 更新日志

## [1.0.0] - 2024-01-XX

### 🎉 首次发布

#### ✨ 新功能

- **AI智能分析**: 基于大模型深度分析前端组件库代码
- **组件特征提取**: 自动识别组件UI特征、功能和使用场景
- **属性详细解析**: 基于TypeScript和JSDoc提取组件属性信息
- **多格式报告**: 支持JSON和Markdown格式的分析报告
- **命令行工具**: 提供完整的CLI工具，支持全局安装使用
- **函数式API**: 提供编程式API，支持在Node.js项目中集成
- **智能缓存**: 内置缓存机制，避免重复分析，提升性能
- **配置灵活**: 支持配置文件和命令行参数，适应不同需求

#### 🛠️ 核心功能

1. **Git仓库管理**
   - 自动克隆目标仓库到临时目录
   - 支持浅克隆优化性能
   - 自动清理临时文件

2. **代码解析引擎**
   - 智能识别React组件文件
   - 支持TypeScript和JavaScript
   - 解析组件依赖关系
   - 提取TypeScript接口定义
   - 解析JSDoc注释

3. **AI分析引擎**
   - 组件库基本信息分析
   - 单个组件深度分析
   - 批量组件处理优化
   - API调用重试机制
   - Token使用统计

4. **缓存系统**
   - 仓库信息缓存
   - 组件分析结果缓存
   - 组件库信息缓存
   - 自动过期清理
   - 缓存统计信息

5. **报告生成**
   - 详细的JSON格式报告
   - 美观的Markdown报告
   - 控制台友好显示
   - 报告完整性验证
   - 组件索引生成

#### 📊 支持的组件库

- Ant Design
- Material-UI (MUI)
- Chakra UI
- Arco Design
- Semi Design
- 以及其他标准React组件库

#### 🔧 技术栈

- **语言**: TypeScript
- **构建工具**: Vite
- **AI集成**: LangChain + @langchain/openai
- **CLI框架**: Commander.js
- **Git操作**: simple-git
- **文件系统**: fs-extra
- **终端美化**: chalk + ora

#### 📦 安装方式

```bash
# 全局安装（推荐使用 pnpm）
pnpm add -g component-insight

# 本地安装
pnpm add component-insight

# 或使用其他包管理器
npm install -g component-insight
yarn global add component-insight
```

#### 🚀 使用方式

```bash
# 初始化配置
insight init

# 分析组件库
insight https://github.com/ant-design/ant-design.git

# 验证仓库URL
insight validate https://github.com/ant-design/ant-design.git
```

#### 📋 配置选项

- 支持多种大模型API (OpenAI, Azure OpenAI等)
- 灵活的解析策略配置
- 可自定义的文件过滤规则
- 智能缓存控制
- 详细的日志和统计

#### 🎯 性能优化

- 智能文件扫描和过滤
- 批量组件分析
- 多级缓存机制
- API调用优化
- 内存使用控制

#### 📝 报告内容

**组件库信息**:
- 包名称和中文名称
- 详细描述和使用场景
- 版本和作者信息

**组件详情**:
- 组件名称和中文名称
- 具体功能列表
- 适用场景描述
- UI特征总结
- 容器组件识别
- 详细属性说明

**属性信息**:
- 属性名称和描述
- 数据类型定义
- 默认值和枚举
- 必需属性标识

#### 🔄 未来规划

- [ ] 支持更多前端框架 (Vue, Angular)
- [ ] 组件关系图谱生成
- [ ] 组件使用示例自动生成
- [ ] 多语言报告支持
- [ ] Web界面版本
- [ ] 组件变更对比分析
- [ ] 组件质量评分
- [ ] 自定义分析模板

#### 🤝 贡献指南

欢迎提交Issue和Pull Request！

#### 📄 许可证

MIT License
