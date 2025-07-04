
"use client";
import type { Person, Relationship } from '@/types';
import Image from 'next/image';
import React, { useState, useRef, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface FamilyTreeCanvasPlaceholderProps {
  people: Person[];
  onNodeClick: (person: Person) => void;
  onNodeMove: (personId: string, x: number, y: number) => void;
  onSetRelationship: (fromId: string, toId: string, relationship: Relationship) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const CLICK_THRESHOLD = 5;

type LinkingState = {
  fromId: string;
  fromConnector: { x: number; y: number };
  toConnector: { x: number; y: number };
};

type PopoverState = {
  open: boolean;
  fromId: string;
  toId: string;
  x: number;
  y: number;
};

export default function FamilyTreeCanvasPlaceholder({ people, onNodeClick, onNodeMove, onSetRelationship }: FamilyTreeCanvasPlaceholderProps) {
  const [draggingState, setDraggingState] = useState<{ personId: string; offsetX: number; offsetY: number; clickStartX: number; clickStartY: number; } | null>(null);
  const [linkingState, setLinkingState] = useState<LinkingState | null>(null);
  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const getSVGPoint = useCallback((event: React.MouseEvent | MouseEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return null;
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    return svgPoint.matrixTransform(CTM.inverse());
  }, []);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>, person: Person) => {
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
  
  const handleConnectorMouseDown = (event: React.MouseEvent, fromPerson: Person, position: 'top' | 'bottom' | 'left' | 'right') => {
      event.stopPropagation();
      const fromCoords = {
          x: (fromPerson.x || 0) + (position === 'left' ? 0 : position === 'right' ? NODE_WIDTH : NODE_WIDTH / 2),
          y: (fromPerson.y || 0) + (position === 'top' ? 0 : position === 'bottom' ? NODE_HEIGHT : NODE_HEIGHT / 2)
      };
      setLinkingState({ fromId: fromPerson.id, fromConnector: fromCoords, toConnector: { ...fromCoords } });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const svgMousePos = getSVGPoint(event);
    if (!svgMousePos) return;

    if (draggingState) {
      const newX = svgMousePos.x - draggingState.offsetX;
      const newY = svgMousePos.y - draggingState.offsetY;
      onNodeMove(draggingState.personId, newX, newY);
    } else if (linkingState) {
      setLinkingState(prev => prev ? { ...prev, toConnector: { x: svgMousePos.x, y: svgMousePos.y } } : null);
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    if (draggingState) {
      const person = people.find(p => p.id === draggingState.personId);
      const deltaX = Math.abs(event.clientX - draggingState.clickStartX);
      const deltaY = Math.abs(event.clientY - draggingState.clickStartY);
      if (person && deltaX < CLICK_THRESHOLD && deltaY < CLICK_THRESHOLD) {
        onNodeClick(person);
      }
      setDraggingState(null);
    } else if (linkingState) {
      const targetElement = event.target as HTMLElement;
      // Use closest to find the person card, whether the target is the card itself or a connector on it.
      const targetPersonContainer = targetElement.closest<HTMLElement>('[data-person-id]');
      const targetPersonId = targetPersonContainer?.dataset.personId;

      if (targetPersonId && targetPersonId !== linkingState.fromId) {
          const targetPerson = people.find(p => p.id === targetPersonId);
          if (targetPerson) {
              setPopoverState({ open: true, fromId: linkingState.fromId, toId: targetPerson.id, x: event.clientX, y: event.clientY });
          }
      }
      setLinkingState(null);
    }
  };
  
  const handleRelationshipSelect = (relationship: Relationship) => {
      if (popoverState) {
          onSetRelationship(popoverState.fromId, popoverState.toId, relationship);
          setPopoverState(null);
      }
  };

  const renderLines = () => {
    const lines = new Set<string>();
    people.forEach(person => {
      // Parent lines
      [person.parentId1, person.parentId2].forEach(parentId => {
        if (parentId) {
          const parent = people.find(p => p.id === parentId);
          if (parent) {
            const key = [parent.id, person.id].sort().join('-');
            if (!lines.has(key)) {
                lines.add(key);
                lines.add(
                    <line
                    key={`line-${person.id}-${parent.id}`}
                    x1={(parent.x ?? 0) + NODE_WIDTH / 2}
                    y1={(parent.y ?? 0) + NODE_HEIGHT}
                    x2={(person.x ?? 0) + NODE_WIDTH / 2}
                    y2={person.y ?? 0}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth="2"
                    />
                );
            }
          }
        }
      });
      // Spouse lines
      (person.spouseIds || []).forEach(spouseId => {
        const spouse = people.find(p => p.id === spouseId);
        if (spouse) {
            const key = [person.id, spouse.id].sort().join('-');
            if (!lines.has(key)) {
                lines.add(key);
                lines.add(
                     <line
                        key={`line-spouse-${key}`}
                        x1={(person.x ?? 0) + NODE_WIDTH}
                        y1={(person.y ?? 0) + NODE_HEIGHT / 2}
                        x2={(spouse.x ?? 0)}
                        y2={(spouse.y ?? 0) + NODE_HEIGHT / 2}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="5,5"
                        strokeWidth="2"
                    />
                )
            }
        }
      });
    });
    return Array.from(lines.values()).filter(l => typeof l !== 'string');
  };

  return (
    <div 
      className="w-full h-full relative border border-dashed border-border rounded-lg bg-slate-50 overflow-auto p-10"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <Popover open={popoverState?.open} onOpenChange={() => setPopoverState(null)}>
        <PopoverTrigger asChild>
            <div 
                style={{ position: 'absolute', left: popoverState?.x, top: popoverState?.y }} 
                className="w-0 h-0"
            />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
            <div className="flex flex-col space-y-1">
                <Button variant="ghost" size="sm" onClick={() => handleRelationshipSelect('parent')}>Set as Parent</Button>
                <Button variant="ghost" size="sm" onClick={() => handleRelationshipSelect('child')}>Set as Child</Button>
                <Button variant="ghost" size="sm" onClick={() => handleRelationshipSelect('spouse')}>Set as Spouse</Button>
            </div>
        </PopoverContent>
      </Popover>

      <svg 
        ref={svgRef}
        width="100%" 
        height="100%" 
        style={{ minWidth: '1200px', minHeight: '800px' }}
      >
        {renderLines()}

        {linkingState && (
          <line
            x1={linkingState.fromConnector.x} y1={linkingState.fromConnector.y}
            x2={linkingState.toConnector.x} y2={linkingState.toConnector.y}
            stroke="hsl(var(--primary))" strokeWidth="2"
          />
        )}

        {people.map((person) => (
          <foreignObject 
            key={person.id} 
            x={person.x ?? 0} 
            y={person.y ?? 0} 
            width={NODE_WIDTH} 
            height={NODE_HEIGHT}
            className={`${draggingState?.personId === person.id ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            <div 
              className="group/node relative w-full h-full select-none"
              onMouseDown={(e) => handleMouseDown(e, person)}
              data-person-id={person.id}
            >
              <div className="w-full h-full p-2 bg-card rounded-md shadow-md border-2 border-primary group-hover/node:border-accent group-hover/node:shadow-lg transition-all duration-200 flex items-center space-x-2 overflow-hidden">
                <Image
                  src={person.profilePictureUrl || `https://placehold.co/40x40.png?text=${person.firstName?.[0]}`}
                  alt={person.firstName || 'Person'}
                  width={40}
                  height={40}
                  className="rounded-full flex-shrink-0"
                  data-ai-hint="person avatar"
                />
                <div className="truncate"> 
                  <p className="text-sm font-semibold text-foreground truncate">{person.firstName || 'Unnamed'} {person.lastName || ''}</p>
                  <p className="text-xs text-muted-foreground truncate">{person.birthDate || 'Unknown birth'}</p>
                </div>
              </div>

              {/* Connector Nodes */}
              {['top', 'bottom', 'left', 'right'].map((pos) => (
                 <div
                    key={pos}
                    onMouseDown={(e) => handleConnectorMouseDown(e, person, pos as any)}
                    className="absolute bg-primary/50 border border-primary rounded-full w-3 h-3 cursor-crosshair opacity-0 group-hover/node:opacity-100 transition-opacity"
                    style={{
                        top: pos === 'top' ? '-6px' : pos === 'bottom' ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                        left: pos === 'left' ? '-6px' : pos === 'right' ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                    }}
                 />
              ))}
            </div>
          </foreignObject>
        ))}
      </svg>
       <div className="absolute top-4 right-4 p-2 bg-card/80 rounded-md text-xs text-muted-foreground">
        Drag nodes to move. Drag from circles on border to create relationships.
      </div>
    </div>
  );
}
