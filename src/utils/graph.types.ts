import { drawRectWithText } from "./canvas-utils";
import type {
  IGraphNode,
  IGraphEdge,
  IProcessedNode,
  IProcessedEdge,
} from "./types";

class GraphNode implements IGraphNode {
  label: string;
  constructor(label: string) {
    this.label = label;
  }
}

class GraphEdge implements IGraphEdge {
  label?: string;
  source: string;
  target: string;
  constructor(source: string, target: string, label?: string) {
    this.source = source;
    this.target = target;
    this.label = label;
  }
}

class ProcessedNode implements IProcessedNode {
  id: string; // Use label as ID
  label: string;
  x: number;
  y: number;
  layer: number;
  isDummy: boolean;
  inEdges: ProcessedEdge[];
  outEdges: ProcessedEdge[];
  nodeWidth: number = 0;
  nodeHeight: number = 0;
  constructor({
    id,
    label,
    x,
    y,
    layer,
    isDummy,
    inEdges,
    outEdges,
  }: {
    id: string;
    label: string;
    x: number;
    y: number;
    layer: number;
    isDummy: boolean;
    inEdges: ProcessedEdge[];
    outEdges: ProcessedEdge[];
  }) {
    this.id = id;
    this.label = label;
    this.x = x;
    this.y = y;
    this.layer = layer;
    this.isDummy = isDummy;
    this.inEdges = inEdges;
    this.outEdges = outEdges;
  }

  draw(ctx: CanvasRenderingContext2D, node: ProcessedNode, options = {}) {
    const text = node.label;
    const x = node.x; // center x
    const y = node.y; // center y

    const { rectHeight, rectWidth } = drawRectWithText(
      ctx,
      text,
      x,
      y,
      options
    );
    this.nodeWidth = rectWidth;
    this.nodeHeight = rectHeight;
  }

  isHovered(mouseX: number, mouseY: number): boolean {
    // 如果节点是虚拟的，或者还没有宽度/高度，则不响应悬停
    if (this.id.startsWith("dummy_") || !this.nodeWidth || !this.nodeHeight) {
      return false;
    }

    // 1. 根据中心点和宽高计算出矩形的左上角和右下角坐标
    const x1 = this.x - this.nodeWidth / 2;
    const y1 = this.y - this.nodeHeight / 2;
    const x2 = this.x + this.nodeWidth / 2;
    const y2 = this.y + this.nodeHeight / 2;

    // 2. 判断鼠标坐标是否在计算出的边界框之内
    return mouseX >= x1 && mouseX <= x2 && mouseY >= y1 && mouseY <= y2;
  }
}

class ProcessedEdge implements IProcessedEdge {
  id: string;
  source: string;
  target: string;
  constructor({
    id,
    source,
    target,
  }: {
    id: string;
    source: string;
    target: string;
  }) {
    this.id = id;
    this.source = source;
    this.target = target;
  }

  draw(
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

  isHovered(clientX: number, clientY: number) {
    return false;
  }
}

export { GraphNode, GraphEdge, ProcessedNode, ProcessedEdge };
