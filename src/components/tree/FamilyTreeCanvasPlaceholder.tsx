
"use client";
import type { Person } from '@/types';
import Image from 'next/image';

interface FamilyTreeCanvasPlaceholderProps {
  people: Person[];
  onNodeClick: (person: Person) => void;
}

const NODE_WIDTH = 150;
const NODE_HEIGHT = 70;
// const HORIZONTAL_SPACING = 50; // Not used in current layout
// const VERTICAL_SPACING = 100; // Not used in current layout


export default function FamilyTreeCanvasPlaceholder({ people, onNodeClick }: FamilyTreeCanvasPlaceholderProps) {
  return (
    <div className="w-full h-full relative border border-dashed border-border rounded-lg bg-slate-50 overflow-auto p-10">
      <svg width="100%" height="100%" style={{ minWidth: '800px', minHeight: '600px' }}>
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
          // Could add lines for parentId2 and spouses similarly
          return null;
        })}

        {people.map((person) => (
          <foreignObject 
            key={person.id} 
            x={person.x ?? 0} 
            y={person.y ?? 0} 
            width={NODE_WIDTH} 
            height={NODE_HEIGHT}
            className="cursor-pointer group"
            onClick={() => onNodeClick(person)}
          >
            <div className="w-full h-full p-2 bg-card rounded-md shadow-md border border-primary group-hover:border-accent group-hover:shadow-lg transition-all duration-200 flex items-center space-x-2 overflow-hidden">
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
          </foreignObject>
        ))}
      </svg>
       <div className="absolute top-4 right-4 p-2 bg-card/80 rounded-md text-xs text-muted-foreground">
        This is a placeholder canvas. A real implementation would use a library like React Flow or custom SVG rendering for drag-and-drop and complex layouts.
      </div>
    </div>
  );
}
