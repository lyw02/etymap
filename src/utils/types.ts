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

type RichTextSpan = {
  text: string;
  font: string;
  size: number;
  color: string;
  weight: "normal" | "bold" | "lighter" | number;
  fontStyle: "normal" | "italic";
};

type RichTextWordChunk = {
  text: string;
  style: Partial<Omit<RichTextSpan, "text">>;
};

type NodeContent = {
  label: string;
  content: RichTextSpan[];
};

export type {
  IGraphNode,
  IGraphEdge,
  IProcessedNode,
  IProcessedEdge,
  RichTextSpan,
  RichTextWordChunk,
  NodeContent,
};
