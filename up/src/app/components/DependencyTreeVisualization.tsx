import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

interface TreeNode {
  name: string;
  type: "root" | "dependency";
  children?: TreeNode[];
  depth?: number;
  size?: number;
  version?: string;
  description?: string;
  license?: string;
  maintainers?: number;
  fileType?: string;
}

interface DependencyTreeVisualizationProps {
  data: TreeNode;
  mainPackage?: string;
}

interface Dimensions {
  width: number;
  height: number;
}

// Properly extend D3's hierarchy node type
interface D3Node extends d3.HierarchyNode<TreeNode> {
  x: number;
  y: number;
}

interface D3Link extends d3.HierarchyLink<TreeNode> {
  source: D3Node;
  target: D3Node;
}

const DependencyTreeVisualization: React.FC<
  DependencyTreeVisualizationProps
> = ({ data, mainPackage }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 800,
    height: 600,
  });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(800, rect.width - 40),
          height: Math.max(600, rect.height - 40),
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;
    drawDependencyTree();
  }, [data, dimensions]);

  const drawDependencyTree = (): void => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.4;

    // Create hierarchy from data
    const root = d3.hierarchy<TreeNode>(data) as D3Node;

    // Count total nodes to adjust spacing
    const totalNodes = root.descendants().length;

    // Dynamic radius calculation based on tree structure
    const getRadiusForDepth = (depth: number) => {
      if (depth === 0) return 0;
      // Progressive radius increase with better spacing for many nodes
      const baseRadius = maxRadius / Math.max(3, root.height);
      return baseRadius * depth * (1 + Math.log(totalNodes) * 0.1);
    };

    // Improved radial tree layout
    const treeLayout = d3
      .tree<TreeNode>()
      .size([2 * Math.PI, maxRadius])
      .separation((a, b) => {
        if (!a.parent || !b.parent) return 1;

        // Calculate dynamic separation based on sibling count and depth
        const siblingCount = a.parent.children?.length || 1;
        const depthFactor = Math.max(1, 3 - a.depth!);
        const densityFactor = Math.min(3, Math.max(1, siblingCount / 8));

        // More space for nodes with many siblings
        const baseSeparation = a.parent === b.parent ? 1 : 2;
        return baseSeparation * depthFactor * densityFactor;
      });

    const treeRoot = treeLayout(root);

    // Use D3's coordinate system consistently
    treeRoot.descendants().forEach((d: any) => {
      // D3 tree gives us (x=angle, y=radius)
      const angle = d.x;
      const radius = getRadiusForDepth(d.depth);

      // Convert to cartesian coordinates
      d.cartesianX = radius * Math.cos(angle - Math.PI / 2) + centerX;
      d.cartesianY = radius * Math.sin(angle - Math.PI / 2) + centerY;
    });

    // Append group for pan and zoom transformations
    const g = svg.append("g").attr("class", "graph-container");

    // Create gradient definitions
    const defs = svg.append("defs");
    const gradientColors = {
      root: ["#8B5CF6", "#A78BFA"],
      dependency: ["#3B82F6", "#60A5FA"],
      deep: ["#10B981", "#34D399"],
    };

    Object.entries(gradientColors).forEach(([type, colors]) => {
      const gradient = defs
        .append("linearGradient")
        .attr("id", `gradient-${type}`)
        .attr("gradientUnits", "objectBoundingBox")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 1)
        .attr("y2", 1);

      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colors[0]);

      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colors[1]);
    });

    // Add depth rings for visual hierarchy
    const depths = [
      ...new Set(treeRoot.descendants().map((d) => d.depth)),
    ].filter((d) => d > 0);
    depths.forEach((depth) => {
      const radius = getRadiusForDepth(depth);
      g.append("circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("stroke", "#E5E7EB")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "5,5")
        .attr("opacity", 0.15);
    });

    // Create smooth curved links
    const links = g
      .selectAll<SVGPathElement, D3Link>(".link")
      .data(treeRoot.links() as D3Link[])
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", (d) => {
        const depth = d.target.depth || 0;
        if (depth === 1) return "#8B5CF6";
        if (depth === 2) return "#3B82F6";
        return "#10B981";
      })
      .attr("stroke-width", (d) =>
        Math.max(1.5, 4 - (d.target.depth || 0) * 0.5)
      )
      .attr("opacity", 0.8)
      .attr("d", (d) => {
        const source = d.source as any;
        const target = d.target as any;

        // Use the cartesian coordinates we calculated
        const sx = source.cartesianX;
        const sy = source.cartesianY;
        const tx = target.cartesianX;
        const ty = target.cartesianY;

        // Create smooth curved path
        const dx = tx - sx;
        const dy = ty - sy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Control point for smooth curves
        const controlDistance = distance * 0.3;
        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;

        // Slight curve for better visual appeal
        const cx = sx + dx * 0.5 + Math.cos(perpAngle) * controlDistance * 0.2;
        const cy = sy + dy * 0.5 + Math.sin(perpAngle) * controlDistance * 0.2;

        return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
      })
      .style("stroke-dasharray", function () {
        return this.getTotalLength().toString();
      })
      .style("stroke-dashoffset", function () {
        return this.getTotalLength().toString();
      });

    // Animate links growing
    links
      .transition()
      .duration(1500)
      .delay((d, i) => i * 50)
      .ease(d3.easeQuadOut)
      .style("stroke-dashoffset", "0");

    // Draw nodes
    const nodes = g
      .selectAll<SVGGElement, D3Node>(".node")
      .data(treeRoot.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr(
        "transform",
        (d: any) => `translate(${d.cartesianX},${d.cartesianY})`
      )
      .style("cursor", "pointer")
      .on("click", (event: MouseEvent, d: D3Node) => {
        setSelectedNode(d.data);
        setIsPanelOpen(true);
      })
      .on("mouseover", function (event: MouseEvent, d: D3Node) {
        const currentRadius =
          d.data.type === "root" ? 18 : Math.max(6, 12 - d.depth! * 1.5);

        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("r", currentRadius * 1.3)
          .attr("stroke-width", 3);

        // Highlight connected paths
        g.selectAll<SVGPathElement, D3Link>(".link")
          .filter((link: D3Link) => link.source === d || link.target === d)
          .transition()
          .duration(200)
          .attr("stroke-width", 6)
          .attr("opacity", 1);
      })
      .on("mouseout", function (event: MouseEvent, d: D3Node) {
        const currentRadius =
          d.data.type === "root" ? 18 : Math.max(6, 12 - d.depth! * 1.5);

        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("r", currentRadius)
          .attr("stroke-width", d.data.type === "root" ? 3 : 2);

        // Reset path highlighting
        g.selectAll<SVGPathElement, D3Link>(".link")
          .transition()
          .duration(200)
          .attr("stroke-width", (link: D3Link) =>
            Math.max(1.5, 4 - (link.target.depth || 0) * 0.5)
          )
          .attr("opacity", 0.8);
      });

    // Add circles for nodes
    nodes
      .append("circle")
      .attr("r", 0)
      .attr("fill", (d: D3Node) => {
        if (d.data.type === "root") return "url(#gradient-root)";
        if ((d.depth || 0) <= 2) return "url(#gradient-dependency)";
        return "url(#gradient-deep)";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", (d: D3Node) => (d.data.type === "root" ? 3 : 2))
      .transition()
      .duration(1000)
      .delay((d: any, i: number) => i * 40)
      .attr("r", (d: D3Node) => {
        if (d.data.type === "root") return 18;
        // Dynamic sizing based on depth, smaller for deeper nodes
        return Math.max(6, 12 - d.depth! * 1.5);
      });

    // Add labels with better positioning
    const labels = nodes
      .append("text")
      .attr("dy", (d: D3Node) => {
        if (d.data.type === "root") return 5;
        const radius = Math.max(6, 12 - d.depth! * 1.5);
        return -(radius + 8);
      })
      .attr("text-anchor", "middle")
      .attr("font-size", (d: D3Node) => {
        if (d.data.type === "root") return "14px";
        const baseSize = Math.max(9, 12 - d.depth! * 1);
        return `${baseSize}px`;
      })
      .attr("font-weight", (d: D3Node) =>
        d.data.type === "root" ? "600" : "500"
      )
      .attr("fill", "#374151")
      .attr("opacity", 0)
      .text((d: D3Node) => {
        if (d.data.type === "root") return mainPackage || "Your Project";

        const name = d.data.name;
        const maxLength = Math.max(8, 20 - d.depth! * 3);
        return name.length > maxLength
          ? name.substring(0, maxLength - 3) + "..."
          : name;
      });

    // Add background for labels
    labels.each(function (d: D3Node) {
      const textElement = this as SVGTextElement;
      const bbox = textElement.getBBox();

      if (bbox.width > 0) {
        d3.select(textElement.parentNode as SVGGElement)
          .insert("rect", "text")
          .attr("x", bbox.x - 4)
          .attr("y", bbox.y - 2)
          .attr("width", bbox.width + 8)
          .attr("height", bbox.height + 4)
          .attr("fill", "rgba(255, 255, 255, 0.9)")
          .attr("rx", 3)
          .attr("opacity", 0);
      }
    });

    // Animate labels
    labels
      .transition()
      .duration(800)
      .delay((d: any, i: number) => i * 40 + 500)
      .attr("opacity", 1);

    nodes
      .selectAll("rect")
      .transition()
      .duration(800)
      .delay((d: any, i: number) => i * 40 + 500)
      .attr("opacity", 1);

    // Add version labels
    nodes
      .filter((d: D3Node) => d.data.type !== "root" && !!d.data.version)
      .append("text")
      .attr("dy", (d: D3Node) => {
        const radius = Math.max(6, 12 - d.depth! * 1.5);
        return radius + 16;
      })
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
      .attr("fill", "#6B7280")
      .attr("opacity", 0)
      .text((d: D3Node) => d.data.version || "")
      .transition()
      .duration(800)
      .delay((d: any, i: number) => i * 40 + 1000)
      .attr("opacity", 0.7);

    // Floating particles
    const particleCount = Math.min(30, totalNodes * 2);
    const particles = svg
      .selectAll(".particle")
      .data(d3.range(particleCount))
      .enter()
      .append("circle")
      .attr("class", "particle")
      .attr("r", () => Math.random() * 1.5 + 0.5)
      .attr("fill", () => {
        const colors = ["#A78BFA", "#60A5FA", "#34D399"];
        return colors[Math.floor(Math.random() * colors.length)];
      })
      .attr("opacity", 0.2);

    const animateParticles = () => {
      particles
        .attr("cx", () => Math.random() * width)
        .attr("cy", () => Math.random() * height)
        .transition()
        .duration(() => 6000 + Math.random() * 4000)
        .ease(d3.easeLinear)
        .attr("cx", () => Math.random() * width)
        .attr("cy", () => Math.random() * height)
        .on("end", animateParticles);
    };
    setTimeout(animateParticles, 2000);

    // Zoom and pan
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior as any);
  };

  const onPanelClick = () => {
    if (isPanelOpen) {
      setIsPanelOpen(false);
      setTimeout(() => setSelectedNode(null), 300);
    }
  };

  const panelStyle: React.CSSProperties = {
    maxHeight: isPanelOpen ? "85vh" : 0,
    overflow: "hidden",
    opacity: isPanelOpen ? 1 : 0,
    transition: "max-height 300ms ease-in-out, opacity 300ms ease-in-out",
    cursor: "pointer",
  };

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full border rounded-lg bg-gradient-to-br from-gray-50 to-gray-100"
        style={{ cursor: "grab" }}
      />

      {selectedNode && (
        <div
          onClick={onPanelClick}
          className="absolute top-6 right-6 w-96 bg-white rounded-xl shadow-2xl p-6 border border-gray-200"
          style={panelStyle}
          aria-expanded={isPanelOpen}
          role="region"
        >
          <h4 className="font-semibold text-gray-900 mb-4">
            Package Information
          </h4>

          <div className="space-y-4">
            <div>
              <h5
                className={`font-medium text-lg ${
                  selectedNode
                    ? selectedNode.type === "root"
                      ? "text-purple-700"
                      : "text-blue-700"
                    : ""
                }`}
              >
                {selectedNode.name}
              </h5>
              {selectedNode.version && (
                <p className="text-sm text-gray-500">v{selectedNode.version}</p>
              )}
            </div>

            {selectedNode.description && (
              <div>
                <h6 className="font-medium text-gray-700 text-sm">
                  Description
                </h6>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedNode.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {selectedNode.license && (
                <div>
                  <span className="font-medium text-gray-700">License:</span>
                  <p className="text-gray-600">{selectedNode.license}</p>
                </div>
              )}

              {selectedNode.maintainers !== undefined && (
                <div>
                  <span className="font-medium text-gray-700">
                    Maintainers:
                  </span>
                  <p className="text-gray-600">{selectedNode.maintainers}</p>
                </div>
              )}
            </div>

            {selectedNode.children && selectedNode.children.length > 0 && (
              <div>
                <h6 className="font-medium text-gray-700 text-sm">
                  Dependencies ({selectedNode.children.length})
                </h6>
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {selectedNode.children.map((child, index) => (
                    <div
                      key={index}
                      className="text-xs text-gray-600 py-1 px-2 rounded hover:bg-gray-50"
                    >
                      {child.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 pt-4 border-t">
            <h6 className="font-medium text-gray-700 text-sm mb-2">Legend</h6>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-400"></div>
                <span className="text-gray-900">Root Project</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400"></div>
                <span className="text-gray-900">Direct Dependencies</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-green-400"></div>
                <span className="text-gray-900">Sub-dependencies</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedNode && (
        <div className="absolute top-6 right-6 w-80 bg-white rounded-xl shadow-lg p-6 border border-gray-200 text-center text-gray-500">
          <p className="text-sm">Click on any node to view package details</p>
        </div>
      )}

      <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
        <p className="text-xs text-gray-600">
          <strong>Drag</strong> to pan • <strong>Scroll</strong> to zoom •{" "}
          <strong>Click nodes</strong> for details
        </p>
      </div>
    </div>
  );
};

export default DependencyTreeVisualization;
