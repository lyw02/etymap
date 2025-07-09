import { useEffect, useRef } from "react";
import type { GraphNode } from "../types";

// 算法内部使用的节点类型 (Internal node type for the algorithm)
interface ProcessedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  layer: number;
  isDummy: boolean;
  inEdges: ProcessedEdge[];
  outEdges: ProcessedEdge[];
  originalNode: GraphNode | null;
}

// 算法内部使用的边类型 (Internal edge type for the algorithm)
interface ProcessedEdge {
  id: string;
  source: string; // source node ID
  target: string; // target node ID
}

const NODE_RADIUS = 20;
const LAYER_SPACING = 160; // x-axis spacing between layers
const NODE_SPACING = 90; // y-axis spacing between nodes in a layer

function Canvas({ graph }: { graph: GraphNode[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ctx.fillStyle = "yellow";
    // ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="w-[1000px] h-96">
      <canvas ref={canvasRef} className="w-full h-full"></canvas>
    </div>
  );
}

export default Canvas;
