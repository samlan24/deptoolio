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

    // Append group for pan and zoom transformations
    const g = svg.append("g").attr("class", "graph-container");

    // Create hierarchy from data
    const root = d3.hierarchy<TreeNode>(data) as D3Node;

    // Improved radial tree layout with better spacing
    const treeLayout = d3
      .tree<TreeNode>()
      .size([2 * Math.PI, Math.min(width, height) / 1.6]) // Increased from /3 to /2.2 for more space
      .separation((a, b) => {
        // More intelligent spacing based on depth and sibling count
        const baseSpacing = 6; // Increased from default
        const depthMultiplier = a.depth === 1 ? 3.5 : 2.5; // More space for first level
        return (
          ((a.parent === b.parent ? baseSpacing : baseSpacing * 2) /
            (a.depth || 1)) *
          depthMultiplier
        );
      });

    treeLayout(root);

    // Convert to Cartesian coordinates with proper typing
    root.descendants().forEach((d: D3Node) => {
      const angle = d.x;
      const radius = d.y;
      d.x = radius * Math.cos(angle - Math.PI / 2) + centerX;
      d.y = radius * Math.sin(angle - Math.PI / 2) + centerY;
    });

    // Add depth rings for better visual hierarchy
    const depthRings = [1, 2, 3].map((depth) => {
      const radius = (Math.min(width, height) / 2.2) * (depth / 3);
      return g
        .append("circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("stroke", "#E5E7EB")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "5,5")
        .attr("opacity", 0.2);
    });

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

    // Improved tentacle links with better curves
    const links = g
      .selectAll<SVGPathElement, D3Link>(".link")
      .data(root.links() as D3Link[])
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
      .attr("stroke-width", (d) => Math.max(2, 6 - (d.target.depth || 0))) // Increased thickness
      .attr("opacity", 0.7)
      .attr("d", (d) => {
        // Improved tentacle path generation
        const sourceX = (d.source.x || 0) - centerX;
        const sourceY = (d.source.y || 0) - centerY;
        const targetX = (d.target.x || 0) - centerX;
        const targetY = (d.target.y || 0) - centerY;

        // Calculate angle and distance for better curve control
        const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
        const distance = Math.sqrt(
          (targetX - sourceX) ** 2 + (targetY - sourceY) ** 2
        );

        // Dynamic control points based on distance and depth
        const controlOffset = Math.min(60, distance * 0.4); // Increased curve
        const depthFactor = 1 + (d.target.depth || 0) * 0.15;

        // Create more organic tentacle curves
        const control1X =
          sourceX +
          controlOffset * Math.cos(angle + Math.PI / 2.5) * depthFactor;
        const control1Y =
          sourceY +
          controlOffset * Math.sin(angle + Math.PI / 2.5) * depthFactor;
        const control2X =
          targetX -
          controlOffset * Math.cos(angle - Math.PI / 2.5) * depthFactor;
        const control2Y =
          targetY -
          controlOffset * Math.sin(angle - Math.PI / 2.5) * depthFactor;

        return `M${sourceX + centerX},${sourceY + centerY}
                C${control1X + centerX},${control1Y + centerY}
                 ${control2X + centerX},${control2Y + centerY}
                 ${targetX + centerX},${targetY + centerY}`;
      })
      .style("stroke-dasharray", function () {
        return this.getTotalLength().toString();
      })
      .style("stroke-dashoffset", function () {
        return this.getTotalLength().toString();
      });

    // Animate tentacles growing with staggered timing
    links
      .transition()
      .duration(2500)
      .delay((d, i) => i * 80)
      .ease(d3.easeQuadOut)
      .style("stroke-dashoffset", "0");

    // Draw nodes with improved sizing
    const nodes = g
      .selectAll<SVGGElement, D3Node>(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .style("cursor", "pointer")
      .on("click", (event: MouseEvent, d: D3Node) => {
        setSelectedNode(d.data);
        setIsPanelOpen(true);
      })
      .on("mouseover", function (event: MouseEvent, d: D3Node) {
        const currentRadius =
          d.data.type === "root"
            ? 20
            : (d.depth || 0) === 1
              ? 12
              : (d.depth || 0) === 2
                ? 8
                : 6;

        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("r", currentRadius * 1.4)
          .attr("stroke-width", 4);

        // Highlight connected paths
        g.selectAll<SVGPathElement, D3Link>(".link")
          .filter((link: D3Link) => link.source === d || link.target === d)
          .transition()
          .duration(200)
          .attr("stroke-width", 8)
          .attr("opacity", 1);
      })
      .on("mouseout", function (event: MouseEvent, d: D3Node) {
        const currentRadius =
          d.data.type === "root"
            ? 20
            : (d.depth || 0) === 1
              ? 12
              : (d.depth || 0) === 2
                ? 8
                : 6;

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
            Math.max(2, 6 - (link.target.depth || 0))
          )
          .attr("opacity", 0.7);
      });

    // Add circles for nodes with improved sizing
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
      .duration(1200)
      .delay((d: any, i: number) => i * 60)
      .attr("r", (d: D3Node) => {
        if (d.data.type === "root") return 20;
        if ((d.depth || 0) === 1) return 12;
        if ((d.depth || 0) === 2) return 8;
        return 6;
      });

    // Add improved labels with collision detection
    const labels = nodes
      .append("text")
      .attr("dy", (d: D3Node) => {
        const baseOffset = d.data.type === "root" ? 0 : -22;
        return baseOffset;
      })
      .attr("text-anchor", "middle")
      .attr("font-size", (d: D3Node) => {
        if (d.data.type === "root") return "16px";
        if ((d.depth || 0) === 1) return "13px";
        if ((d.depth || 0) === 2) return "11px";
        return "10px";
      })
      .attr("font-weight", (d: D3Node) =>
        d.data.type === "root" ? "bold" : "500"
      )
      .attr("fill", "#374151")
      .attr("opacity", 0)
      .text((d: D3Node) => {
        const name = d.data.name;
        if (d.data.type === "root") return mainPackage || "Your Project";
        // Adjust truncation based on depth
        const maxLength = (d.depth || 0) === 1 ? 18 : 12;
        if (name.length > maxLength)
          return name.substring(0, maxLength - 3) + "...";
        return name;
      });

    // Add background rectangles for better label visibility
    labels.each(function (d: D3Node) {
      const textElement = this as SVGTextElement;
      const bbox = textElement.getBBox();

      if (bbox.width > 0) {
        // Only add background if text exists
        d3.select(textElement.parentNode as SVGGElement)
          .insert("rect", "text")
          .attr("x", bbox.x - 3)
          .attr("y", bbox.y - 1)
          .attr("width", bbox.width + 6)
          .attr("height", bbox.height + 2)
          .attr("fill", "rgba(255, 255, 255, 0.85)")
          .attr("rx", 4)
          .attr("opacity", 0);
      }
    });

    // Animate labels
    labels
      .transition()
      .duration(1000)
      .delay((d: any, i: number) => i * 60 + 600)
      .attr("opacity", 1);

    // Animate label backgrounds
    nodes
      .selectAll("rect")
      .transition()
      .duration(1000)
      .delay((d: any, i: number) => i * 60 + 600)
      .attr("opacity", 1);

    // Add version labels for non-root nodes with better positioning
    nodes
      .filter((d: D3Node) => d.data.type !== "root" && !!d.data.version)
      .append("text")
      .attr("dy", (d: D3Node) => {
        const baseOffset = (d.depth || 0) > 1 ? 22 : 26;
        return baseOffset;
      })
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("fill", "#6B7280")
      .attr("font-weight", "400")
      .attr("opacity", 0)
      .text((d: D3Node) => d.data.version || "")
      .transition()
      .duration(1000)
      .delay((d: any, i: number) => i * 60 + 1200)
      .attr("opacity", 0.8);

    // Enhanced floating particles effect
    const particleCount = 25;
    const particles = svg
      .selectAll(".particle")
      .data(d3.range(particleCount))
      .enter()
      .append("circle")
      .attr("class", "particle")
      .attr("r", () => Math.random() * 2 + 1)
      .attr("fill", () => {
        const colors = ["#A78BFA", "#60A5FA", "#34D399"];
        return colors[Math.floor(Math.random() * colors.length)];
      })
      .attr("opacity", 0.3);

    const animateParticles = () => {
      particles
        .attr("cx", () => Math.random() * width)
        .attr("cy", () => Math.random() * height)
        .transition()
        .duration(() => 8000 + Math.random() * 4000)
        .ease(d3.easeLinear)
        .attr("cx", () => Math.random() * width)
        .attr("cy", () => Math.random() * height)
        .on("end", animateParticles);
    };
    setTimeout(animateParticles, 3000);

    // Enable zoom and pan with constraints
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 8]) // Extended zoom range
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior as any);
  };

  const getNodeTypeColor = (type: string, depth?: number): string => {
    if (type === "root") return "text-purple-700";
    if (depth === 1) return "text-blue-700";
    if (depth === 2) return "text-blue-600";
    return "text-green-600";
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
      {/* Graph */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full border rounded-lg bg-gradient-to-br from-gray-50 to-gray-100"
        style={{ cursor: "grab" }}
      />

      {/* Floating Panel */}
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
            {/* Package header */}
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

            {/* Description */}
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

            {/* License and Maintainers */}
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

            {/* Dependencies list */}
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

          {/* Legend */}
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

      {/* Instructions overlay */}
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
