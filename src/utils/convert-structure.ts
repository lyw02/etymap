import { GraphEdge, GraphNode } from "./graph.types";

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

export { parseGraphStructure };
