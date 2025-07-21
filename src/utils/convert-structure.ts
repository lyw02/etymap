import { GraphEdge, GraphNode } from "./graph.models";
import type { NodeContent, RichTextSpan } from "./types";

function parseGraphStructure(plainText: string) {
  // 1. 从<structure>标签中提取内容
  const match = plainText.match(/<structure>([\s\S]*?)<\/structure>/);
  if (!match || !match[1]) {
    // 如果没有匹配项或内容为空，返回空数组
    return { nodes: [], edges: [] };
  }

  // 2. 按行分割并过滤空行
  const lines = match[1]
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "");

  const nodeLabels = new Set<string>();
  const edges = [];

  // 3. 遍历每一行
  for (const line of lines) {
    // 3.1 根据 " - " 分割成一个关系链
    const parts = line.split(" - ").map((p) => p.trim());

    // 3.2 从右到左处理关系链，建立边
    // 例如 A - B - C， 先处理 C -> B，再处理 B -> A
    for (let i = parts.length - 1; i > 0; i--) {
      const currentTarget = parts[i - 1];
      let sourcesExpr = parts[i];

      // 目标节点不可能是节点组，直接添加
      nodeLabels.add(currentTarget);

      let sourceLabels;

      // 3.3 检查是否为括号内的节点组
      if (sourcesExpr.startsWith("(") && sourcesExpr.endsWith(")")) {
        // 如果是，移除括号并只按 '+' 分割
        const innerExpr = sourcesExpr.slice(1, -1).trim();
        sourceLabels = innerExpr.split(/\s*\+\s*/);
      } else {
        // 否则，整个表达式（包括'&'）是单个节点的标签
        sourceLabels = [sourcesExpr];
      }

      // 3.4 为每个源节点创建一条边
      for (const sourceLabel of sourceLabels) {
        const trimmedSource = sourceLabel.trim();
        if (trimmedSource) {
          nodeLabels.add(trimmedSource);
          edges.push(new GraphEdge(trimmedSource, currentTarget));
        }
      }
    }
  }

  // 4. 将Set转换为要求的格式
  const nodes = Array.from(nodeLabels).map((label) => new GraphNode(label));

  return { nodes, edges };
}

function parseGraphContent(plainText: string): NodeContent[] {
  const match = plainText.match(/<content>([\s\S]*?)<\/content>/);
  if (!match || !match[1]) {
    return [];
  }

  const results: NodeContent[] = [];
  const sections = match[1].trim().split(/\n@/);

  if (sections.length > 0 && sections[0].startsWith("@")) {
    sections[0] = sections[0].substring(1);
  }

  for (const section of sections) {
    const firstColonIndex = section.indexOf(":");
    if (firstColonIndex === -1) {
      continue;
    }

    const label = section.substring(0, firstColonIndex).trim();
    const contentString = section.substring(firstColonIndex + 1).trim();

    // --- 全新的解析逻辑开始 ---

    let generatedSpans: RichTextSpan[] = [];

    // 1. 定义基础样式和样式栈
    const baseStyle: RichTextSpan = {
      text: "",
      font: "Times New Roman",
      weight: "normal",
      fontStyle: "normal",
      size: 16,
      color: "#000000",
    };
    const styleStack: RichTextSpan[] = [baseStyle];

    // 2. 新的分词正则表达式：它会切分字符串，并保留所有的标记作为独立的词元
    const tokens = contentString
      .split(/(\{\{|\}\}|<|>|\(\(|\)\)|@\(|\)|\({|}|\[|\])/g)
      .filter(Boolean); // filter(Boolean) 用于移除分割产生的空字符串

    // 3. 遍历所有词元（包括标记和文本）
    for (const token of tokens) {
      const currentStyle = styleStack[styleStack.length - 1]; // 获取栈顶的当前样式

      switch (token) {
        // --- 处理开启标记 ---
        case "<":
        case "@(":
          // 继承当前样式，并修改 weight，然后压入栈
          styleStack.push({ ...currentStyle, weight: "bold" });
          break;
        case "{{":
          styleStack.push({ ...currentStyle, fontStyle: "italic" });
          break;
        case "((":
          styleStack.push({ ...currentStyle, weight: "lighter" });
          break;
        case "({":
          styleStack.push({ ...currentStyle, weight: 100 });
          break;
        case "[":
          // [ ] 标记不改变样式，但我们依然需要一个占位的栈层级
          styleStack.push({ ...currentStyle });
          break;

        // --- 处理闭合标记 ---
        case ">":
        case ")":
        case "}}":
        case "))":
        case "})":
        case "]":
          // 弹出一个样式，回到上一层
          if (styleStack.length > 1) {
            // 保证基础样式不会被弹出
            styleStack.pop();
          }
          break;

        // --- 处理纯文本 ---
        default:
          if (token.trim()) {
            // 使用栈顶的样式创建文本片段
            generatedSpans.push({ ...currentStyle, text: token });
          }
          break;
      }
    }

    // 4. 合并逻辑：在所有片段生成后，进行最后一次合并
    const content: RichTextSpan[] = [];
    for (const span of generatedSpans) {
      const lastSpan = content.length > 0 ? content[content.length - 1] : null;
      if (
        lastSpan &&
        lastSpan.font === span.font &&
        lastSpan.weight === span.weight &&
        lastSpan.fontStyle === span.fontStyle &&
        lastSpan.size === span.size &&
        lastSpan.color === span.color
      ) {
        // 如果样式完全相同，则合并文本
        lastSpan.text += span.text;
      } else {
        // 否则，添加一个新的片段
        content.push(span);
      }
    }

    results.push({
      label,
      content,
    });
  }
  return results;
}

export { parseGraphStructure, parseGraphContent };
