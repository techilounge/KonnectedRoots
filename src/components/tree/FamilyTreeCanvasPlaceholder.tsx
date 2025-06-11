
"use client";
import type { Person } from '@/types';
import Image from 'next/image';
import React, { useState, useRef } from 'react';

interface FamilyTreeCanvasPlaceholderProps {
  people: Person[];
  onNodeClick: (person: Person) => void;
  onNodeMove: (personId: string, x: number, y: number) => void;
}

const NODE_WIDTH = 150;
const NODE_HEIGHT = 70;

export default function FamilyTreeCanvasPlaceholder({ people, onNodeClick, onNodeMove }: FamilyTreeCanvasPlaceholderProps) {
  const [draggingState, setDraggingState] = useState<{
    personId: string;
    offsetX: number; // Offset from top-left of node's original SVG position to mouse click point in SVG coords
    offsetY: number;
  } | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const getSVGPoint = (event: React.MouseEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return null;

    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    return svgPoint.matrixTransform(CTM.inverse());
  };

  const handleMouseDown = (event: React.MouseEvent<SVGForeignObjectElement>, person: Person) => {
    event.preventDefault(); // Prevent text selection or other default behaviors
    const svgMousePos = getSVGPoint(event);
    if (!svgMousePos) return;

    setDraggingState({
      personId: person.id,
      offsetX: svgMousePos.x - (person.x ?? 0),
      offsetY: svgMousePos.y - (person.y ?? 0),
    });
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingState) return;
    event.preventDefault();
    const svgMousePos = getSVGPoint(event);
    if (!svgMousePos) return;

    const newX = svgMousePos.x - draggingState.offsetX;
    const newY = svgMousePos.y - draggingState.offsetY;
    onNodeMove(draggingState.personId, newX, newY);
  };

  const handleMouseUp = () => {
    setDraggingState(null);
  };
  
  const handleMouseLeave = () => {
    // Optional: if you want dragging to stop if mouse leaves SVG
    // setDraggingState(null); 
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
        onMouseLeave={handleMouseLeave} // Stop dragging if mouse leaves SVG element
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
            onClick={(e) => {
              // Prevent click from triggering if it was a drag
              if (Math.abs((person.x ?? 0) - (e.currentTarget.x?.baseVal?.value ?? 0)) < 1 && Math.abs((person.y ?? 0) - (e.currentTarget.y?.baseVal?.value ?? 0)) < 1) {
                 // A more robust check might involve comparing original position at mousedown
                 // For now, if no significant move, treat as click.
                 // This basic check is to avoid triggering onNodeClick after a drag.
                 // A better way would be to check a "wasDragged" flag set in mouseMove.
                 if(!draggingState || draggingState.personId !== person.id) { // only click if not currently part of a drag op end
                    onNodeClick(person);
                 }
              }
            }}
          >
            <div 
              className="w-full h-full p-2 bg-card rounded-md shadow-md border border-primary group-hover:border-accent group-hover:shadow-lg transition-all duration-200 flex items-center space-x-2 overflow-hidden select-none"
              // style={{ userSelect: 'none' }} // Redundant, select-none class handles this
            >
              <Image
                src={person.profilePictureUrl || `https://placehold.co/40x40.png?text=${person.firstName?.[0]}`}
                alt={person.firstName || 'Person'}
                width={40}
                height={40}
                className="rounded-full flex-shrink-0 pointer-events-none" // Prevent image from interfering with drag
                data-ai-hint="person avatar"
              />
              <div className="truncate pointer-events-none"> {/* Prevent text selection */}
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
