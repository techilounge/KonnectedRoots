
"use client";
import type { Person, RelationshipType } from '@/types';
import Image from 'next/image';
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Edit, Trash2, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';


interface FamilyTreeCanvasPlaceholderProps {
  people: Person[];
  onNodeClick: (person: Person) => void;
  onNodeDoubleClick: (person: Person) => void;
  onNodeDeleteRequest: (person: Person) => void;
  onNodeMove: (personId: string, x: number, y: number) => void;
  onCreateRelationship: (fromId: string, toId: string, type: RelationshipType) => void;
  zoomLevel: number;
  selectedPersonId: string | null;
  isLinkingMode: boolean;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const CLICK_THRESHOLD = 5;
const CANVAS_PADDING = 500; // Extra space around the outermost nodes

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

export default function FamilyTreeCanvasPlaceholder({ 
    people, 
    onNodeClick, 
    onNodeDoubleClick,
    onNodeDeleteRequest, 
    onNodeMove, 
    onCreateRelationship, 
    zoomLevel,
    selectedPersonId,
    isLinkingMode
}: FamilyTreeCanvasPlaceholderProps) {
  const [draggingState, setDraggingState] = useState<{ personId: string; offsetX: number; offsetY: number; clickStartX: number; clickStartY: number; moved: boolean } | null>(null);
  const [linkingState, setLinkingState] = useState<LinkingState | null>(null);
  const [popoverState, setPopoverState] = useState<PopoverState | null>(null);
  const [panState, setPanState] = useState<{ isPanning: boolean; startX: number; startY: number; }>({ isPanning: false, startX: 0, startY: 0 });
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const lastClickTimeRef = useRef(0);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const transformGroupRef = useRef<SVGGElement>(null);


  const canvasDimensions = useMemo(() => {
    if (people.length === 0) {
      return { width: 1200, height: 800, minX: 0, minY: 0 };
    }
    const allX = people.map(p => p.x ?? 0);
    const allY = people.map(p => p.y ?? 0);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);
    
    return {
      width: Math.max(maxX - minX + NODE_WIDTH + CANVAS_PADDING * 2, 1200),
      height: Math.max(maxY - minY + NODE_HEIGHT + CANVAS_PADDING * 2, 800),
      minX: minX,
      minY: minY
    };
  }, [people]);

  const getSVGPoint = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const transformGroup = transformGroupRef.current;
    if (!transformGroup) return null;

    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    
    const svgRect = svg.getBoundingClientRect();
    pt.x -= svgRect.left;
    pt.y -= svgRect.top;
    
    const ctm = transformGroup.getCTM();
    if (ctm) {
        return pt.matrixTransform(ctm.inverse());
    }
    return null;
}, []);
  
  const handleNodeMouseDown = (event: React.MouseEvent<HTMLDivElement>, person: Person) => {
    event.stopPropagation();
    if (event.button === 2) return; // Ignore right-click for dragging
    if (isLinkingMode) {
        onNodeClick(person); // Pass click to parent handler for linking
        return;
    }

    const point = getSVGPoint(event.clientX, event.clientY);
    if (!point) return;

    setDraggingState({
      personId: person.id,
      offsetX: point.x - (person.x ?? 0),
      offsetY: point.y - (person.y ?? 0),
      clickStartX: event.clientX,
      clickStartY: event.clientY,
      moved: false,
    });
  };


  const handleConnectorMouseDown = (event: React.MouseEvent, fromPerson: Person, position: 'top' | 'bottom' | 'left' | 'right') => {
      event.stopPropagation();
      const point = getSVGPoint(event.clientX, event.clientY);
      if (!point) return;
      
      const fromCoords = {
          x: (fromPerson.x || 0) + (position === 'left' ? 0 : position === 'right' ? NODE_WIDTH : NODE_WIDTH / 2),
          y: (fromPerson.y || 0) + (position === 'top' ? 0 : position === 'bottom' ? NODE_HEIGHT : NODE_HEIGHT / 2)
      };

      setLinkingState({ fromId: fromPerson.id, fromConnector: fromCoords, toConnector: fromCoords });
  };
  
  const handleCanvasMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if (event.target === svgRef.current || (event.target as HTMLElement).closest('g[data-panning-surface]')) {
      setPanState({ isPanning: true, startX: event.clientX - viewOffset.x, startY: event.clientY - viewOffset.y });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (panState.isPanning) {
        setViewOffset({
            x: event.clientX - panState.startX,
            y: event.clientY - panState.startY
        });
        return;
    }
    
    const point = getSVGPoint(event.clientX, event.clientY);
    if (!point) return;
    
    if (draggingState) {
      const deltaX = Math.abs(event.clientX - draggingState.clickStartX);
      const deltaY = Math.abs(event.clientY - draggingState.clickStartY);
      
      if (deltaX > CLICK_THRESHOLD || deltaY > CLICK_THRESHOLD) {
          setDraggingState(prev => prev ? { ...prev, moved: true } : null);
      }

      const newX = point.x - draggingState.offsetX;
      const newY = point.y - draggingState.offsetY;
      onNodeMove(draggingState.personId, newX, newY);
    } else if (linkingState) {
        setLinkingState(prev => prev ? { ...prev, toConnector: { x: point.x, y: point.y } } : null);
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    if (panState.isPanning) {
        setPanState({ ...panState, isPanning: false });
    }

    if (linkingState) {
      const targetElement = (event.target as HTMLElement).closest('[data-person-id]');
      const toId = targetElement?.getAttribute('data-person-id');
      if (toId && toId !== linkingState.fromId) {
        setPopoverState({
          open: true,
          fromId: linkingState.fromId,
          toId: toId,
          x: event.clientX,
          y: event.clientY
        });
      }
    }
    
    if (draggingState && !draggingState.moved) {
        const person = people.find(p => p.id === draggingState.personId);
        if (person) {
            const now = Date.now();
            if (now - lastClickTimeRef.current < 300) { // 300ms for double click
                onNodeDoubleClick(person);
            } else {
                onNodeClick(person);
            }
            lastClickTimeRef.current = now;
        }
    }

    setDraggingState(null);
    setLinkingState(null);
  };
  
  const handleRelationshipSelect = (type: RelationshipType) => {
      if (popoverState) {
          onCreateRelationship(popoverState.fromId, popoverState.toId, type);
          setPopoverState(null);
      }
  };

  const renderLines = () => {
    const elements: React.ReactNode[] = [];
    const drawnSpouseConnections = new Set<string>();
    const peopleMap = new Map(people.map(p => [p.id, p]));

    const families = new Map<string, string[]>(); 
    people.forEach(person => {
        if (person.parentId1 && person.parentId2) {
            const parentKey = [person.parentId1, person.parentId2].sort().join('--');
            if (!families.has(parentKey)) {
                families.set(parentKey, []);
            }
            families.get(parentKey)!.push(person.id);
        }
    });

    families.forEach((childrenIds, parentKey) => {
        const [p1Id, p2Id] = parentKey.split('--');
        const parent1 = peopleMap.get(p1Id);
        const parent2 = peopleMap.get(p2Id);

        if (!parent1 || !parent2) return;
        
        const areSpouses = parent1.spouseIds?.includes(p2Id) && parent2.spouseIds?.includes(p1Id);
        if(!areSpouses) return;

        const p1x = (parent1.x ?? 0);
        const p1y = (parent1.y ?? 0);
        const p2x = (parent2.x ?? 0);
        const p2y = (parent2.y ?? 0);

        const spouseKey = [p1Id, p2Id].sort().join('--');
        drawnSpouseConnections.add(spouseKey);
        elements.push(
            <line
                key={`spouse-${spouseKey}`}
                x1={Math.min(p1x, p2x) + NODE_WIDTH}
                y1={p1y + NODE_HEIGHT / 2}
                x2={Math.max(p1x, p2x)}
                y2={p2y + NODE_HEIGHT / 2}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="1.5"
                strokeDasharray="4,4"
            />
        );

        const children = childrenIds.map(id => peopleMap.get(id)).filter((p): p is Person => !!p);
        if (children.length === 0) return;

        const coupleMidX = (p1x + NODE_WIDTH / 2 + p2x + NODE_WIDTH / 2) / 2;
        const coupleY = p1y + NODE_HEIGHT / 2;
        const SIBLING_BAR_Y_OFFSET = 40;
        const childNodeY = Math.min(...children.map(c => (c.y ?? 0)));
        const siblingBarY = childNodeY - SIBLING_BAR_Y_OFFSET;
        
        elements.push(
          <circle
            key={`family-node-${parentKey}`}
            data-family-line-parents={`${p1Id}--${p2Id}`}
            cx={coupleMidX}
            cy={coupleY}
            r="6"
            fill="hsl(var(--primary))"
            className="cursor-pointer hover:fill-accent"
            stroke="hsl(var(--card))"
            strokeWidth="2"
          />
        );

        elements.push(
            <line
                key={`family-v-drop-${parentKey}`}
                x1={coupleMidX} y1={coupleY}
                x2={coupleMidX} y2={siblingBarY}
                stroke="hsl(var(--muted-foreground))" strokeWidth="2"
            />
        );

        const childrenXCoords = children.map(c => ((c.x ?? 0)) + NODE_WIDTH / 2);
        const minChildX = Math.min(...childrenXCoords);
        const maxChildX = Math.max(...childrenXCoords);
        if(children.length > 1) {
            elements.push(
                <line
                    key={`family-h-bar-${parentKey}`}
                    x1={minChildX} y1={siblingBarY}
                    x2={maxChildX} y2={siblingBarY}
                    stroke="hsl(var(--muted-foreground))" strokeWidth="2"
                />
            );
        }

        children.forEach(child => {
            elements.push(
                <line
                    key={`child-v-connect-${child.id}`}
                    x1={((child.x ?? 0)) + NODE_WIDTH / 2} y1={siblingBarY}
                    x2={((child.x ?? 0)) + NODE_WIDTH / 2} y2={(child.y ?? 0)}
                    stroke="hsl(var(--muted-foreground))" strokeWidth="2"
                />
            );
        });
    });
    
    people.forEach(p => {
        (p.spouseIds || []).forEach(spouseId => {
            const key = [p.id, spouseId].sort().join('--');
            if(!drawnSpouseConnections.has(key)) {
                const spouse = peopleMap.get(spouseId);
                if(spouse) {
                    elements.push(<line key={`spouse-${key}`} x1={((p.x??0))+NODE_WIDTH} y1={((p.y??0))+NODE_HEIGHT/2} x2={((spouse.x??0))} y2={((spouse.y??0))+NODE_HEIGHT/2} stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="4,4" />);
                    drawnSpouseConnections.add(key);
                }
            }
        });
    });

    people.forEach(person => {
        const hasBothParentsInFamilyUnit = person.parentId1 && person.parentId2 && families.has([person.parentId1, person.parentId2].sort().join('--'));
        if(hasBothParentsInFamilyUnit) return;

        [person.parentId1, person.parentId2].forEach(parentId => {
            if(parentId) {
                const parent = peopleMap.get(parentId);
                if(parent) {
                    elements.push(<line key={`single-parent-${person.id}-${parentId}`} x1={((parent.x??0)) + NODE_WIDTH/2} y1={((parent.y??0)) + NODE_HEIGHT} x2={((person.x??0)) + NODE_WIDTH/2} y2={((person.y??0))} stroke="hsl(var(--muted-foreground))" strokeWidth="2" />);
                }
            }
        });
    });


    return elements;
  };


  return (
    <div 
      className={cn(
        `w-full h-full relative border border-dashed border-border rounded-lg bg-slate-50 overflow-hidden`,
        isLinkingMode ? 'cursor-crosshair' : 'cursor-default'
      )}
    >
      <Popover open={popoverState?.open} onOpenChange={() => setPopoverState(null)}>
        <PopoverTrigger asChild>
            <div 
                style={{ position: 'absolute', left: popoverState?.x, top: popoverState?.y, zIndex: 100 }} 
                className="w-0 h-0"
            />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
            <div className="flex flex-col space-y-1">
                <p className="p-2 text-xs font-semibold text-muted-foreground">Set relationship to:</p>
                <Button variant="ghost" size="sm" onClick={() => handleRelationshipSelect('parent')}>Parent</Button>
                <Button variant="ghost" size="sm" onClick={() => handleRelationshipSelect('child')}>Child</Button>
                <Button variant="ghost" size="sm" onClick={() => handleRelationshipSelect('spouse')}>Spouse</Button>
            </div>
        </PopoverContent>
      </Popover>

      <svg 
        ref={svgRef}
        width="100%"
        height="100%"
        className={cn(
            isLinkingMode ? 'cursor-crosshair' : panState.isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          minWidth: `${canvasDimensions.width}px`,
          minHeight: `${canvasDimensions.height}px`,
        }}
      >
        <g 
          ref={transformGroupRef}
          transform={`translate(${viewOffset.x}, ${viewOffset.y}) scale(${zoomLevel})`}
        >
          <g data-panning-surface transform={`translate(${-canvasDimensions.minX + CANVAS_PADDING}, ${-canvasDimensions.minY + CANVAS_PADDING})`}>
            {renderLines()}

            {linkingState && (
            <line
                x1={linkingState.fromConnector.x} y1={linkingState.fromConnector.y}
                x2={linkingState.toConnector.x} y2={linkingState.toConnector.y}
                stroke="hsl(var(--primary))" strokeWidth="2"
                className="pointer-events-none"
            />
            )}

            {people.map((person) => (
            <foreignObject 
                key={person.id} 
                x={person.x ?? 0}
                y={person.y ?? 0}
                width={NODE_WIDTH} 
                height={NODE_HEIGHT}
                className={cn(
                    draggingState?.personId === person.id ? 'cursor-grabbing' : 'cursor-grab',
                    isLinkingMode && 'cursor-crosshair'
                )}
            >
                <ContextMenu>
                <ContextMenuTrigger>
                    <div 
                    className="group/node relative w-full h-full select-none"
                    onMouseDown={(e) => handleNodeMouseDown(e, person)}
                    data-person-id={person.id}
                    >
                    <div className={cn(
                      "w-full h-full p-2 bg-card rounded-md shadow-md border-2 border-primary group-hover/node:border-accent group-hover/node:shadow-lg transition-all duration-200 flex items-center space-x-2 overflow-hidden",
                      selectedPersonId === person.id && "border-accent ring-2 ring-accent",
                      isLinkingMode && selectedPersonId !== person.id && "hover:border-green-500 hover:ring-2 hover:ring-green-500"
                    )}>
                        <Image
                        src={person.profilePictureUrl || `https://placehold.co/40x40.png?text=${person.firstName?.[0]}`}
                        alt={person.firstName || 'Person'}
                        width={40}
                        height={40}
                        unoptimized
                        className="rounded-full flex-shrink-0"
                        data-ai-hint="person avatar"
                        />
                        <div className="truncate"> 
                        <p className="text-sm font-semibold text-foreground truncate">{person.firstName || 'Unnamed'} {person.lastName || ''}</p>
                        <p className="text-xs text-muted-foreground truncate">{person.birthDate || 'Unknown birth'}</p>
                        </div>
                    </div>

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
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onSelect={() => onNodeDoubleClick(person)} className="cursor-pointer">
                        <Edit className="mr-2 h-4 w-4" />
                        <span>Edit Person</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem 
                        onSelect={() => onNodeDeleteRequest(person)} 
                        className="text-destructive focus:text-destructive cursor-pointer"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete Person</span>
                    </ContextMenuItem>
                </ContextMenuContent>
                </ContextMenu>
            </foreignObject>
            ))}
          </g>
        </g>
      </svg>
       <div className="absolute top-4 right-4 p-2 bg-card/80 rounded-md text-xs text-muted-foreground pointer-events-none">
        {isLinkingMode 
            ? "Linking Mode: Click a person to connect."
            : "Click to select, Double-click to edit. Drag connectors to link people."
        }
      </div>
    </div>
  );
}
