interface GraphNode {
  label: string;
  //   outEdges: GraphNode[];
}

interface GrapgEdge {
  label?: string;
  source: string;
  target: string;
}

export type { GraphNode, GrapgEdge };
