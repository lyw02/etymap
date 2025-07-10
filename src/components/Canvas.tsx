import { useEffect, useRef } from "react";
import type { GrapgEdge, GraphNode } from "../utils/types";

// Internal node type for the algorithm
interface ProcessedNode {
  id: string; // Use label as ID
  label: string;
  x: number;
  y: number;
  layer: number;
  isDummy: boolean;
  inEdges: ProcessedEdge[];
  outEdges: ProcessedEdge[];
}

// Internal edge type for the algorithm
interface ProcessedEdge {
  id: string;
  source: string; // source node ID
  target: string; // target node ID
}

// class ProcessedNode implements ProcessedNode {
//   id: string; // Use label as ID
//   label: string;
//   x: number;
//   y: number;
//   layer: number;
//   isDummy: boolean;
//   inEdges: ProcessedEdge[];
//   outEdges: ProcessedEdge[];
//   constructor({
//     id,
//     label,
//     x,
//     y,
//     layer,
//     isDummy,
//     inEdges,
//     outEdges,
//   }: {
//     id: string;
//     label: string;
//     x: number;
//     y: number;
//     layer: number;
//     isDummy: boolean;
//     inEdges: ProcessedEdge[];
//     outEdges: ProcessedEdge[];
//   }) {
//     this.id = id;
//     this.label = label;
//     this.x = x;
//     this.y = y;
//     this.layer = layer;
//     this.isDummy = isDummy;
//     this.inEdges = inEdges;
//     this.outEdges = outEdges;
//   }
// }
// class ProcessedEdge implements ProcessedEdge {}

const LAYER_SPACING = 260; // x-axis spacing between layers
const NODE_SPACING = 190; // y-axis spacing between nodes in a layer

function transformGraph(
  graphNodes: GraphNode[],
  graphEdges: GrapgEdge[]
): { nodes: ProcessedNode[]; edges: ProcessedEdge[] } {
  const nodes: ProcessedNode[] = graphNodes.map((n) => ({
    id: n.label, // Use the unique label as the ID
    label: n.label,
    x: 0,
    y: 0,
    layer: -1,
    isDummy: false,
    inEdges: [],
    outEdges: [],
  }));

  const nodeMap = new Map<string, ProcessedNode>(nodes.map((n) => [n.id, n]));

  const edges: ProcessedEdge[] = graphEdges
    .map((edge, i) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      const processedEdge: ProcessedEdge = {
        id: `e-${edge.source}-${edge.target}-${i}`, // Add index to ensure unique edge IDs
        source: edge.source,
        target: edge.target,
      };

      if (sourceNode && targetNode) {
        sourceNode.outEdges.push(processedEdge);
        targetNode.inEdges.push(processedEdge);
      }

      return processedEdge;
    })
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target)); // Filter out edges with invalid nodes

  return { nodes, edges };
}

/**
 * 阶段1: 节点分层 (最长路径算法)
 * Phase 1: Layer Assignment (Longest Path Algorithm)
 */
function assignLayers(nodes: ProcessedNode[]): ProcessedNode[][] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map(nodes.map((n) => [n.id, n.inEdges.length]));

  const queue = nodes.filter((node) => inDegree.get(node.id) === 0);
  queue.forEach((node) => (node.layer = 0));

  let head = 0;
  while (head < queue.length) {
    const u = queue[head];
    u.outEdges.forEach((edge) => {
      const v = nodeMap.get(edge.target)!;
      v.layer = Math.max(v.layer, u.layer + 1);
      const newInDegree = inDegree.get(v.id)! - 1;
      inDegree.set(v.id, newInDegree);
      if (newInDegree === 0) {
        queue.push(v);
      }
    });
    head++;
  }

  const layers: ProcessedNode[][] = [];
  nodes.forEach((node) => {
    if (node.layer === -1) node.layer = 0; // Handle isolated nodes
    if (!layers[node.layer]) layers[node.layer] = [];
    layers[node.layer].push(node);
  });
  console.log("111", layers);
  return layers;
}

/**
 * 阶段2: 为长边添加虚拟节点
 * Phase 2: Add Dummy Nodes for long edges
 */
function addDummyNodes(
  layers: ProcessedNode[][],
  nodes: ProcessedNode[],
  edges: ProcessedEdge[]
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const dummyNodes: ProcessedNode[] = [];
  const edgesToRemove: Set<string> = new Set();
  const edgesToAdd: ProcessedEdge[] = [];
  let dummyCount = 0;

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source)!;
    const targetNode = nodeMap.get(edge.target)!;
    const layerDiff = targetNode.layer - sourceNode.layer;

    if (layerDiff > 1) {
      edgesToRemove.add(edge.id);
      let current = sourceNode;
      for (let i = 1; i < layerDiff; i++) {
        const dummy: ProcessedNode = {
          id: `dummy_${dummyCount++}`,
          label: "",
          x: 0,
          y: 0,
          layer: sourceNode.layer + i,
          isDummy: true,
          inEdges: [],
          outEdges: [],
        };
        dummyNodes.push(dummy);
        if (!layers[dummy.layer]) layers[dummy.layer] = [];
        layers[dummy.layer].push(dummy);

        const newEdge = {
          id: `${current.id}->${dummy.id}`,
          source: current.id,
          target: dummy.id,
        };
        edgesToAdd.push(newEdge);
        current = dummy;
      }
      const finalEdge = {
        id: `${current.id}->${targetNode.id}`,
        source: current.id,
        target: targetNode.id,
      };
      edgesToAdd.push(finalEdge);
    }
  }

  nodes.push(...dummyNodes);
  const finalEdges = edges.filter((e) => !edgesToRemove.has(e.id));
  finalEdges.push(...edgesToAdd);

  const newNodeMap = new Map(nodes.map((n) => [n.id, n]));
  nodes.forEach((n) => {
    n.inEdges = [];
    n.outEdges = [];
  });
  finalEdges.forEach((e) => {
    const source = newNodeMap.get(e.source)!;
    const target = newNodeMap.get(e.target)!;
    source.outEdges.push(e);
    target.inEdges.push(e);
  });

  return finalEdges;
}

/**
 * 阶段3: 分配坐标
 * Phase 3: Coordinate Assignment
 */
function assignCoordinates(
  layers: ProcessedNode[][],
  canvasWidth: number,
  canvasHeight: number
) {
  const maxLayerWidth =
    layers.length > 0 ? (layers.length - 1) * LAYER_SPACING : 0;
  const startX = (canvasWidth - maxLayerWidth) / 2;

  layers.forEach((layer, i) => {
    const totalHeight = (layer.length - 1) * NODE_SPACING;
    const startY = (canvasHeight - totalHeight) / 2;

    layer.forEach((node, j) => {
      node.x = i * LAYER_SPACING + startX;
      node.y = j * NODE_SPACING + startY;
    });
  });
}

function draw(
  ctx: CanvasRenderingContext2D,
  nodes: ProcessedNode[],
  edges: ProcessedEdge[]
) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  edges.forEach((edge) => {
    drawEdge(ctx, nodeMap, edge);
  });

  nodes.forEach((node) => {
    drawNode(ctx, node);
  });
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  nodeMap: Map<string, ProcessedNode>,
  edge: ProcessedEdge
) {
  // 为线条和箭头设置样式
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 3;
  // 为实心箭头设置填充颜色
  ctx.fillStyle = "#9ca3af";

  const sourceNode = nodeMap.get(edge.source)!;
  const targetNode = nodeMap.get(edge.target)!;

  // 1. 定义贝塞尔曲线的四个点
  const p0 = { x: sourceNode.x, y: sourceNode.y }; // 起点
  const cp1x = (sourceNode.x + targetNode.x) / 2; // 控制点1的X坐标
  const p1 = { x: cp1x, y: sourceNode.y }; // 控制点1
  const p2 = { x: cp1x, y: targetNode.y }; // 控制点2
  const p3 = { x: targetNode.x, y: targetNode.y }; // 终点

  // 2. 绘制贝塞尔曲线
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  ctx.stroke();

  // 3. 计算曲线中点 (t=0.5) 的坐标
  const t = 0.5;
  const midX =
    (1 - t) ** 3 * p0.x +
    3 * (1 - t) ** 2 * t * p1.x +
    3 * (1 - t) * t ** 2 * p2.x +
    t ** 3 * p3.x;
  const midY =
    (1 - t) ** 3 * p0.y +
    3 * (1 - t) ** 2 * t * p1.y +
    3 * (1 - t) * t ** 2 * p2.y +
    t ** 3 * p3.y;

  // 4. 计算曲线中点的切线方向（导数）
  const dx =
    3 * (1 - t) ** 2 * (p1.x - p0.x) +
    6 * (1 - t) * t * (p2.x - p1.x) +
    3 * t ** 2 * (p3.x - p2.x);
  const dy =
    3 * (1 - t) ** 2 * (p1.y - p0.y) +
    6 * (1 - t) * t * (p2.y - p1.y) +
    3 * t ** 2 * (p3.y - p2.y);

  // 5. 根据切线计算旋转角度
  const angle = Math.atan2(dy, dx);

  // 6. 绘制实心箭头
  ctx.save(); // 保存当前画布状态
  ctx.translate(midX, midY); // 将画布原点移动到曲线中点
  ctx.rotate(angle); // 旋转画布以匹配切线方向
  ctx.beginPath(); // 开始绘制箭头路径

  // 绘制一个三角形作为箭头，箭头尖端在 (0,0)
  ctx.moveTo(0, 0);
  ctx.lineTo(-12, -6); // 箭头的后端点1（可调整大小）
  ctx.lineTo(-12, 6); // 箭头的后端点2

  ctx.closePath(); // 闭合路径形成一个封闭的三角形
  ctx.fill(); // 填充路径，形成实心箭头
  ctx.restore(); // 恢复之前保存的画布状态
}

function drawNode(ctx: CanvasRenderingContext2D, node: ProcessedNode) {
  if (node.isDummy) return;

  drawTextWithAutoSizeRect(ctx, node.label, node.x, node.y)
}

function drawTextWithAutoSizeRect(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, // center x
  y: number, // center y
  options = {}
) {
  ctx.save();

  // --- 设置默认值和配置 ---
  const config = {
    maxWidth: 100,
    padding: 15,
    font: "16px sans-serif",
    lineHeightRatio: 1.4,
    textColor: "#111827",
    bgColor: "#e5e7eb",
    borderRadius: 8,
    ...options,
  };

  // 应用字体设置，这对于准确测量至关重要
  ctx.font = config.font;

  // 高度测量比较复杂，一个简便且有效的方法是直接使用字体大小
  // 'actualBoundingBoxAscent' 和 'actualBoundingBoxDescent' 可以提供更精确的高度，但为了简单起见，我们用字体大小
  const fontHeight = parseInt(config.font, 10);
  const lineHeight = fontHeight * config.lineHeightRatio;

  // --- 处理文本换行（核心逻辑） ---
  const lines = [];
  const paragraphs = text.split("\n"); // 首先按用户指定的换行符分割

  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      const testWidth = ctx.measureText(testLine).width; // 测量文字尺寸，实现自适应的核心方法

      if (testWidth > config.maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
  }

  // --- 计算整体尺寸 ---
  // 找到最长的一行来确定矩形宽度
  let maxTextWidth = 0;
  for (const line of lines) {
    const lineWidth = ctx.measureText(line).width;
    if (lineWidth > maxTextWidth) {
      maxTextWidth = lineWidth;
    }
  }

  const rectWidth = maxTextWidth + config.padding * 2;
  const rectHeight = lines.length * lineHeight + config.padding * 2;

  // --- 计算矩形左上角坐标（根据中心点）---
  const rectX = x - rectWidth / 2;
  const rectY = y - rectHeight / 2;

  // --- 绘制带圆角的背景矩形 ---
  ctx.fillStyle = config.bgColor;
  ctx.beginPath();
  ctx.moveTo(rectX + config.borderRadius, rectY);
  ctx.lineTo(rectX + rectWidth - config.borderRadius, rectY);
  ctx.quadraticCurveTo(
    rectX + rectWidth,
    rectY,
    rectX + rectWidth,
    rectY + config.borderRadius
  );
  ctx.lineTo(rectX + rectWidth, rectY + rectHeight - config.borderRadius);
  ctx.quadraticCurveTo(
    rectX + rectWidth,
    rectY + rectHeight,
    rectX + rectWidth - config.borderRadius,
    rectY + rectHeight
  );
  ctx.lineTo(rectX + config.borderRadius, rectY + rectHeight);
  ctx.quadraticCurveTo(
    rectX,
    rectY + rectHeight,
    rectX,
    rectY + rectHeight - config.borderRadius
  );
  ctx.lineTo(rectX, rectY + config.borderRadius);
  ctx.quadraticCurveTo(rectX, rectY, rectX + config.borderRadius, rectY);
  ctx.closePath();
  ctx.fill();

  // --- 6. 逐行绘制文字 ---
  ctx.fillStyle = config.textColor;
  ctx.textBaseline = "top"; // 基线设置为顶部，方便计算

  const initialTextY = rectY + config.padding;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const textX = rectX + config.padding;
    // 每行的 Y 坐标 = 初始Y + 行数 * 行高
    const textY = initialTextY + i * lineHeight;
    ctx.fillText(line, textX, textY);
  }

  ctx.restore();
}

function Canvas({
  graphNodes,
  graphEdges,
}: {
  graphNodes: GraphNode[];
  graphEdges: GrapgEdge[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 800 * dpr;
    canvas.height = 500 * dpr;

    let { nodes, edges } = transformGraph(graphNodes, graphEdges);
    const layers = assignLayers(nodes);
    edges = addDummyNodes(layers, nodes, edges);
    assignCoordinates(layers, canvas.width, canvas.height);
    draw(ctx, nodes, edges);

    // ctx.fillStyle = "yellow";
    // ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="w-[1000px] h-[500px]">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}

export default Canvas;
