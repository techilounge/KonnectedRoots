
"use client";
import type { Person } from '@/types';
import Image from 'next/image';
import React, { useState, useRef } from 'react';

interface FamilyTreeCanvasPlaceholderProps {
  people: Person[];
  onNodeClick: (person: Person) => void;
  onNodeMove: (personId: string, x: number, y: number) => void;
}

const NODE_WIDTH = 180; // Increased width
const NODE_HEIGHT = 70;
const CLICK_THRESHOLD = 5; // Pixels to distinguish click from drag

export default function FamilyTreeCanvasPlaceholder({ people, onNodeClick, onNodeMove }: FamilyTreeCanvasPlaceholderProps) {
  const [draggingState, setDraggingState] = useState<{
    personId: string;
    offsetX: number; 
    offsetY: number;
    // Store initial client mouse coordinates to detect click vs drag
    clickStartX: number;
    clickStartY: number;
  } | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const getSVGPoint = (event: React.MouseEvent | MouseEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return null;

    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    return svgPoint.matrixTransform(CTM.inverse());
  };

  const handleMouseDown = (event: React.MouseEvent<SVGForeignObjectElement>, person: Person) => {
    // event.preventDefault(); // Keep this if needed, but sometimes it interferes with focus
    const svgMousePos = getSVGPoint(event);
    if (!svgMousePos) return;

    setDraggingState({
      personId: person.id,
      offsetX: svgMousePos.x - (person.x ?? 0),
      offsetY: svgMousePos.y - (person.y ?? 0),
      clickStartX: event.clientX,
      clickStartY: event.clientY,
    });
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingState) return;
    // No event.preventDefault() here, could cause issues with native scroll if canvas is larger than viewport
    const svgMousePos = getSVGPoint(event);
    if (!svgMousePos) return;

    const newX = svgMousePos.x - draggingState.offsetX;
    const newY = svgMousePos.y - draggingState.offsetY;
    onNodeMove(draggingState.personId, newX, newY);
  };

  const handleMouseUp = (event: React.MouseEvent<SVGSVGElement>) => {
    if (draggingState) {
      const person = people.find(p => p.id === draggingState.personId);
      const deltaX = Math.abs(event.clientX - draggingState.clickStartX);
      const deltaY = Math.abs(event.clientY - draggingState.clickStartY);

      if (person && deltaX < CLICK_THRESHOLD && deltaY < CLICK_THRESHOLD) {
        // If mouse moved less than threshold, consider it a click
        onNodeClick(person);
      }
      setDraggingState(null);
    }
  };
  
  const handleMouseLeave = (event: React.MouseEvent<SVGSVGElement>) => {
    // If mouse leaves SVG while dragging, stop the drag.
    // This is a common pattern to avoid nodes getting stuck if mouseup happens outside.
    if (draggingState) {
        // Optionally, could also trigger onNodeMove one last time if needed
        // based on last known mouse position *within* SVG bounds, but for now, just cancel.
        // const svgMousePos = getSVGPoint(event); // Careful: event here is onMouseLeave
        // if (svgMousePos) { 
        //    onNodeMove(draggingState.personId, svgMousePos.x - draggingState.offsetX, svgMousePos.y - draggingState.offsetY);
        // }
        setDraggingState(null);
    }
  };

  return (
    <div className="w-full h-full relative border border-dashed border-border rounded-lg bg-slate-50 overflow-auto p-10">
      <svg 
        ref={svgRef}
        width="100%" 
        height="100%" 
        style={{ minWidth: '800px', minHeight: '600px' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave} 
      >
        {/* Render lines first */}
        {people.map(person => {
          if (person.parentId1) {
            const parent1 = people.find(p => p.id === person.parentId1);
            if (parent1) {
              return (
                <line
                  key={`line-${person.id}-p1`}
                  x1={(parent1.x ?? 0) + NODE_WIDTH / 2}
                  y1={(parent1.y ?? 0) + NODE_HEIGHT}
                  x2={(person.x ?? 0) + NODE_WIDTH / 2}
                  y2={person.y ?? 0}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="2"
                />
              );
            }
          }
          return null;
        })}

        {people.map((person) => (
          <foreignObject 
            key={person.id} 
            x={person.x ?? 0} 
            y={person.y ?? 0} 
            width={NODE_WIDTH} 
            height={NODE_HEIGHT}
            className={`group ${draggingState?.personId === person.id ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={(e) => handleMouseDown(e, person)}
            // onClick removed, handled by onMouseUp logic
          >
            <div 
              className="w-full h-full p-2 bg-card rounded-md shadow-md border border-primary group-hover:border-accent group-hover:shadow-lg transition-all duration-200 flex items-center space-x-2 overflow-hidden select-none"
            >
              <Image
                src={person.profilePictureUrl || `https://placehold.co/40x40.png?text=${person.firstName?.[0]}`}
                alt={person.firstName || 'Person'}
                width={40}
                height={40}
                className="rounded-full flex-shrink-0 pointer-events-none" 
                data-ai-hint="person avatar"
              />
              <div className="truncate pointer-events-none"> 
                <p className="text-sm font-semibold text-foreground truncate">{person.firstName || 'Unnamed'} {person.lastName || ''}</p>
                <p className="text-xs text-muted-foreground truncate">{person.birthDate || 'Unknown birth'}</p>
              </div>
            </div>
          </foreignObject>
        ))}
      </svg>
       <div className="absolute top-4 right-4 p-2 bg-card/80 rounded-md text-xs text-muted-foreground">
        Nodes are draggable. Lines are basic placeholders.
      </div>
    </div>
  );
}
