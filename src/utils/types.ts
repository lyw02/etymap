interface IGraphNode {
  label: string;
}

interface IGraphEdge {
  label?: string;
  source: string;
  target: string;
}

// Internal node type for the algorithm
interface IProcessedNode {
  id: string; // Use label as ID
  label: string;
  x: number;
  y: number;
  layer: number;
  isDummy: boolean;
  inEdges: IProcessedEdge[];
  outEdges: IProcessedEdge[];
  isHovered: (clientX: number, clientY: number) => boolean;
}

// Internal edge type for the algorithm
interface IProcessedEdge {
  id: string;
  source: string; // source node ID
  target: string; // target node ID
  isHovered: (clientX: number, clientY: number) => boolean;
}

export type { IGraphNode, IGraphEdge, IProcessedNode, IProcessedEdge };
