import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const SkillGraph = ({ skills, credibilityScore }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!skills || skills.length === 0 || !svgRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const width = 600;
    const height = 400;
    const radius = Math.min(width, height) / 2 - 40;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Prepare data
    const nodes = skills.map(skill => ({
      id: skill._id,
      name: skill.name,
      credibility: skill.credibilityScore || 0,
      proficiency: skill.proficiencyLevel || 0,
      radius: 20 + (skill.proficiencyLevel || 0) * 3
    }));

    // Create links between related skills (by category)
    const links = [];
    skills.forEach((skill, i) => {
      skills.slice(i + 1).forEach((otherSkill, j) => {
        if (skill.category === otherSkill.category) {
          links.push({
            source: skill._id,
            target: otherSkill._id,
            strength: 0.5
          });
        }
      });
    });

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(d => d.radius + 10));

    // Draw links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6);

    // Draw nodes
    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => getCredibilityColor(d.credibility))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add labels
    const labels = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.radius + 15)
      .attr('font-size', '10px')
      .attr('fill', '#475569');

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labels
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    // Drag functions
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Color function based on credibility
    function getCredibilityColor(score) {
      if (score >= 80) return '#10b981'; // Green - Expert
      if (score >= 60) return '#3b82f6'; // Blue - Advanced
      if (score >= 40) return '#f59e0b'; // Yellow - Intermediate
      if (score >= 20) return '#f97316'; // Orange - Beginner
      return '#ef4444'; // Red - Low
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [skills]);

  return (
    <div className="skill-graph-container">
      <svg ref={svgRef}></svg>
      <div className="legend mt-4">
        <div className="flex justify-center gap-4 text-xs">
          <span className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span>
            0-19
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-orange-500 mr-1"></span>
            20-39
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>
            40-59
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
            60-79
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
            80-100
          </span>
        </div>
      </div>
    </div>
  );
};

export default SkillGraph;
