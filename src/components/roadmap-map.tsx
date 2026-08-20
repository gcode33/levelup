"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";

export type LevelStatus = "locked" | "current" | "completed";

type LevelNodeData = {
  title: string;
  description: string;
  status: LevelStatus;
  selected?: boolean;
};

type LevelNode = Node<LevelNodeData, "level">;

const NODE_WIDTH = 240;
const NODE_HEIGHT = 100;

function LevelNodeComponent({ data }: NodeProps<LevelNode>) {
  const { status, title, description, selected } = data;
  const locked = status === "locked";
  const completed = status === "completed";

  const box = locked
    ? "border-zinc-300 bg-zinc-100 text-zinc-400"
    : completed
      ? "border-green-400 bg-green-50 text-black"
      : "border-blue-500 bg-blue-50 text-black shadow-md";

  const ring = selected ? "ring-2 ring-blue-500 ring-offset-2" : "";
  const icon = locked ? "🔒" : completed ? "✅" : "▶";

  return (
    <div className={`w-[220px] rounded-xl border-2 px-4 py-3 text-sm transition-all ${box} ${ring}`}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#a1a1aa", width: 8, height: 8 }}
      />
      <div className="flex items-center gap-2 font-semibold">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      {!locked && <p className="mt-1 text-xs text-zinc-600">{description}</p>}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#a1a1aa", width: 8, height: 8 }}
      />
    </div>
  );
}

const nodeTypes = { level: LevelNodeComponent };

function layoutNodes(nodes: LevelNode[], edges: Edge[]): LevelNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 90 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    return { ...n, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } };
  });
}

export default function RoadmapMap({
  levels,
  currentLevelIndex,
  selectedIndex,
  onNodeClick,
}: {
  levels: { index: number; title: string; description: string }[];
  currentLevelIndex: number;
  selectedIndex?: number | null;
  onNodeClick?: (index: number) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const statusOf = (i: number): LevelStatus =>
      i < currentLevelIndex ? "completed" : i === currentLevelIndex ? "current" : "locked";

    const rawNodes: LevelNode[] = levels.map((lv) => ({
      id: String(lv.index),
      type: "level",
      position: { x: 0, y: 0 },
      data: {
        title: lv.title,
        description: lv.description,
        status: statusOf(lv.index),
        selected: selectedIndex === lv.index,
      },
    }));

    const rawEdges: Edge[] = levels.slice(1).map((lv) => ({
      id: `e-${lv.index - 1}-${lv.index}`,
      source: String(lv.index - 1),
      target: String(lv.index),
      animated: statusOf(lv.index) !== "locked",
      style: { stroke: statusOf(lv.index) === "locked" ? "#d4d4d8" : "#3b82f6" },
    }));

    return { nodes: layoutNodes(rawNodes, rawEdges), edges: rawEdges };
  }, [levels, currentLevelIndex, selectedIndex]);

  return (
    <div className="h-[560px] w-full rounded-xl border border-black/10">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onNodeClick={(_, node) => onNodeClick?.(Number(node.id))}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
