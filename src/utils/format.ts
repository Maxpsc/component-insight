import { AIMessage } from "@langchain/core/messages";

/** 从AIMessage中提取docType类型的内容，即```docType content```中的content */
export function getDocContentsFromMessage(docType: string) {
  return (input: AIMessage) => {
    const text = input.content as string
    const pattern = new RegExp("```" + docType + "(.*?)```", "gs")
    const matches = text.match(pattern)
    const replaceRegex = new RegExp("```" + docType + "|```", "g")
  
    // 仅返回最后一个匹配项
    return matches?.length ? matches[matches.length - 1].replace(replaceRegex, '').trim() : ''
  }
}

/** 格式化llm返回的json */
export const getStructuredDataFromMessage = (input: AIMessage) => {
  if (typeof input.content === 'string' && !input.content.includes('```json')) {
    try {
      return JSON.parse(input.content ?? '{}') as Record<string, any> ?? null
    } catch (err) {
      console.error(`Failed to parse: ${input.content}`, err)
      return null
    }
  }
  const jsonStr = getDocContentsFromMessage('json')(input)
  try {
    return JSON.parse(jsonStr ?? '{}') as Record<string, any> ?? null
  } catch (error) {
    console.error(`Failed to parse: ${jsonStr ?? ''}`, error)
    return null
  }
}