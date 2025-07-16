import { useEffect, useRef } from "react";
import {
  GraphNode,
  GraphEdge,
  ProcessedNode,
  ProcessedEdge,
} from "../utils/graph.types";
import { drawRectWithText } from "../utils/canvas-utils";

const LAYER_SPACING = 260; // x-axis spacing between layers
const NODE_SPACING = 190; // y-axis spacing between nodes in a layer

function transformGraph(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[]
): { nodes: ProcessedNode[]; edges: ProcessedEdge[] } {
  const nodes: ProcessedNode[] = graphNodes.map(
    (n) =>
      new ProcessedNode({
        id: n.label, // Use the unique label as the ID
        label: n.label,
        x: 0,
        y: 0,
        layer: -1,
        isDummy: false,
        inEdges: [],
        outEdges: [],
      })
  );

  const nodeMap = new Map<string, ProcessedNode>(nodes.map((n) => [n.id, n]));

  const edges: ProcessedEdge[] = graphEdges
    .map((edge, i) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      const processedEdge = new ProcessedEdge({
        id: `e-${edge.source}-${edge.target}-${i}`, // Add index to ensure unique edge IDs
        source: edge.source,
        target: edge.target,
      });

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
        const dummy: ProcessedNode = new ProcessedNode({
          id: `dummy_${dummyCount++}`,
          label: "",
          x: 0,
          y: 0,
          layer: sourceNode.layer + i,
          isDummy: true,
          inEdges: [],
          outEdges: [],
        });
        dummyNodes.push(dummy);
        if (!layers[dummy.layer]) layers[dummy.layer] = [];
        layers[dummy.layer].push(dummy);

        const newEdge = new ProcessedEdge({
          id: `${current.id}->${dummy.id}`,
          source: current.id,
          target: dummy.id,
        });
        edgesToAdd.push(newEdge);
        current = dummy;
      }
      const finalEdge = new ProcessedEdge({
        id: `${current.id}->${targetNode.id}`,
        source: current.id,
        target: targetNode.id,
      });
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
 * 阶段3: 减少交叉 (重心启发式算法)
 * Phase 3: Crossing Reduction (Barycenter Heuristic)
 */
function reduceCrossings(layers: ProcessedNode[][]) {
  const nodeMap = new Map(layers.flat().map((n) => [n.id, n]));

  for (let iter = 0; iter < 24; iter++) {
    // More iterations for better result
    for (let i = 1; i < layers.length; i++) {
      // Downward pass
      layers[i].sort((a, b) => {
        const aCenter =
          a.inEdges.reduce(
            (sum, e) =>
              sum + layers[a.layer - 1].indexOf(nodeMap.get(e.source)!),
            0
          ) / (a.inEdges.length || 1);
        const bCenter =
          b.inEdges.reduce(
            (sum, e) =>
              sum + layers[b.layer - 1].indexOf(nodeMap.get(e.source)!),
            0
          ) / (b.inEdges.length || 1);
        return aCenter - bCenter;
      });
    }
    for (let i = layers.length - 2; i >= 0; i--) {
      // Upward pass
      layers[i].sort((a, b) => {
        const aCenter =
          a.outEdges.reduce(
            (sum, e) =>
              sum + layers[a.layer + 1].indexOf(nodeMap.get(e.target)!),
            0
          ) / (a.outEdges.length || 1);
        const bCenter =
          b.outEdges.reduce(
            (sum, e) =>
              sum + layers[b.layer + 1].indexOf(nodeMap.get(e.target)!),
            0
          ) / (b.outEdges.length || 1);
        return aCenter - bCenter;
      });
    }
  }
}

/**
 * 阶段4: 分配坐标
 * Phase 4: Coordinate Assignment
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
    edge.draw(ctx, nodeMap, edge);
  });

  nodes.forEach((node) => {
    if (!node.isDummy) node.draw(ctx, node);
  });
}

function handleMouseMove(
  e: React.MouseEvent<HTMLCanvasElement, MouseEvent>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  ctxRef: React.RefObject<CanvasRenderingContext2D | null>,
  nodesRef: React.RefObject<ProcessedNode[] | null>
) {
  if (!canvasRef.current || !ctxRef.current || !nodesRef.current) return;

  const x = e.nativeEvent.offsetX;
  const y = e.nativeEvent.offsetY;

  let hoveredNode = null;
  // 从上到下遍历节点，找到第一个被悬停的
  for (const node of nodesRef.current) {
    if (!node.isDummy && node.isHovered(x, y)) {
      hoveredNode = node;
      break;
    }
  }

  ctxRef.current.clearRect(
    0,
    0,
    canvasRef.current.width,
    canvasRef.current.height
  );

  if (hoveredNode) {
    const tooltipText = `节点信息: ${hoveredNode.label}`;
    // 在鼠标指针右下方绘制浮窗
    drawRectWithText(ctxRef.current, tooltipText, x + 50, y + 15);
  }
}

function handleMouseLeave(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  ctxRef: React.RefObject<CanvasRenderingContext2D | null>
) {
  const canvas = canvasRef.current;
  const ctx = ctxRef.current;
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function Canvas({
  graphNodes,
  graphEdges,
}: {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasLayer2Ref = useRef<HTMLCanvasElement>(null);
  // const ctxRef = useRef<CanvasRenderingContext2D>(null);
  const ctxLayer2Ref = useRef<CanvasRenderingContext2D>(null);
  const nodesRef = useRef<ProcessedNode[]>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const canvasLayer2 = canvasLayer2Ref.current;
    if (!canvas || !canvasLayer2) return;

    const ctx = canvas.getContext("2d");
    const ctxLayer2 = canvasLayer2.getContext("2d");
    if (!ctx || !ctxLayer2) return;
    ctxLayer2Ref.current = ctxLayer2;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 800 * dpr;
    canvas.height = 500 * dpr;
    canvasLayer2.width = 800 * dpr;
    canvasLayer2.height = 500 * dpr;

    let { nodes, edges } = transformGraph(graphNodes, graphEdges);
    const layers = assignLayers(nodes);
    edges = addDummyNodes(layers, nodes, edges);
    reduceCrossings(layers);
    assignCoordinates(layers, canvas.width, canvas.height);
    draw(ctx, nodes, edges);

    nodesRef.current = nodes;
  }, []);

  return (
    <div className="relative w-[1000px] h-[500px] bg-gray-50 rounded-lg overflow-hidden shadow-lg">
      <canvas
        id="layer-2"
        className="absolute top-0 left-0 z-20"
        ref={canvasLayer2Ref}
        onMouseMove={(e) =>
          handleMouseMove(e, canvasLayer2Ref, ctxLayer2Ref, nodesRef)
        }
        onMouseLeave={() => handleMouseLeave(canvasLayer2Ref, ctxLayer2Ref)}
      />
      <canvas id="layer-1" className="absolute top-0 left-0" ref={canvasRef} />
    </div>
  );
}

export default Canvas;
