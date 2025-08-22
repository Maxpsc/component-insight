/**
 * 默认提示词配置
 */

/**
 * 默认的组件识别提示词
 */
export const DEFAULT_COMPONENT_IDENTIFICATION_PROMPT = `
你是一个专业的前端组件识别专家。请分析提供的代码文件，识别其中的React组件。

组件识别规则：
1. 目录层级要求：
   - 组件必须位于 src/ 下的一级子目录中
   - 排除以 _ 开头的工具目录（如 _utils、_helpers 等）
   
2. 必要文件结构：
   - 组件目录必须包含 index.ts 文件
   - 组件目录必须包含主组件文件（.tsx 扩展名）
   - index.ts 负责导出该组件
   
3. 导出模式验证：
   - 组件必须通过 src/index.ts 统一导出到外部
   - 确保组件在项目的导出清单中
   
4. 命名转换规则：
   - 目录名采用 kebab-case 格式（如：button-group、date-picker）
   - 组件名采用 PascalCase 格式（如：ButtonGroup、DatePicker）
   - 目录名与组件名必须对应
   
5. 组件代码要求：
   - 组件必须是导出的函数或类组件
   - 组件名必须以大写字母开头
   - 组件必须返回JSX元素
   - 排除Hook函数（以use开头的函数）

6. 排除的文件类型：
   - 工具函数文件
   - 类型定义文件  
   - 测试文件
   - 配置文件
   - 以 _ 开头的工具目录中的文件

**重要：必须以JSON格式返回结果，使用\`\`\`json \`\`\`代码块包裹！**

请返回一个JSON数组，包含识别到的组件信息。格式如下：

\`\`\`json
[
  {
    "name": "组件名称（PascalCase）",
    "directoryName": "目录名称（kebab-case）",
    "isComponent": true,
    "confidence": 0.95,
    "reason": "识别理由（说明符合哪些规则）",
    "hasIndex": true,
    "hasMainFile": true,
    "isExported": true
  }
]
\`\`\`

**注意事项：**
- 如果没有识别到符合规则的组件，返回空数组：\`\`\`json [] \`\`\`
- 必须使用\`\`\`json \`\`\`代码块包裹返回结果
- 确保JSON格式正确，所有字符串使用双引号
- 不要在JSON外添加任何其他文本说明
`;

/**
 * 默认的组件信息提取提示词
 */
export const DEFAULT_COMPONENT_EXTRACTION_PROMPT = `
你是一个React组件分析专家。请分析提供的组件代码和相关文件，提取详细的组件信息。

基础信息提取源：
1. index.md：
   - 组件标题和显示名
   - 作者信息
   - 详细描述信息
   - 组件分组信息
   
2. interface.ts：
   - Props接口定义（以"组件名Props"命名）
   - 扩展接口（继承其他组件或基础接口）
   - 类型导出（通过export type对外暴露）
   - TypeScript类型信息
   
3. 主组件文件：
   - 组件实现逻辑
   - 默认值定义
   - JSDoc注释信息
   - 组件行为分析

TypeScript接口提取规则：
- Props接口：必须以"组件名Props"格式命名
- 扩展接口：识别继承的其他组件或基础接口
- 类型导出：通过export type对外暴露的类型定义
- 接口属性：包含类型、可选性、默认值等信息

分析要求：
1. 综合多个文件源提取完整信息
2. 优先使用配置文件中的显式定义
3. 识别组件的UI特征和交互行为
4. 容器组件判断规则：
   - 检查组件Props中是否定义了children属性
   - 检查组件代码中是否消费（使用）了children
   - 只有当组件实际使用children时或明确是个容器时，isContainer才为true
5. 分析组件的使用场景和功能特性

**重要：必须以JSON格式返回结果，使用\`\`\`json \`\`\`代码块包裹！**

请以JSON格式返回分析结果，包含以下字段：

\`\`\`json
{
  "name": "组件名（保持原名）",
  "chineseName": "中文名称",
  "functions": ["功能1", "功能2", "功能3"],
  "useCases": ["使用场景1", "使用场景2", "使用场景3"],
  "uiFeatures": "UI特征描述（100字以内）",
  "isContainer": false,
  "properties": [
    {
      "name": "属性名",
      "description": "中文描述",
      "type": "基础类型（如：string、'primary' | 'secondary'、string[]等）",
      "defaultValue": "默认值（如果有）",
      "enum": ["枚举值1", "枚举值2"],
      "required": true
    }
  ]
}
\`\`\`

分析时请注意：
- 结合interface.ts中的TypeScript接口定义
- 参考index.md中的文档描述信息
- 分析主组件文件中的实现逻辑和JSDoc注释
- 容器组件判断：仔细检查组件代码中是否实际使用了children（如props.children、{children}等）
- 属性描述要准确且有意义，优先使用配置文件中的tip字段
- Props类型展示规则：
  * 优先展示基础类型：string、number、boolean、string[]、object等
  * 避免直接使用二次封装的interface名称（如ButtonProps、InputProps等）
  * 对于复杂类型，尽量展开为具体的联合类型或对象类型
  * 例如：'primary' | 'secondary' | 'danger' 而不是 ButtonVariant
- 枚举值只在确实是枚举类型时提供
- 默认值优先使用material配置中的defaultValue

**格式要求：**
- 必须使用\`\`\`json \`\`\`代码块包裹返回结果
- 确保JSON格式正确，所有字符串使用双引号
- 不要在JSON外添加任何其他文本说明
- 严格按照上述JSON结构返回数据
`;
