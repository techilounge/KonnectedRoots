
import type { SVGProps } from 'react';

export default function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="250"
      height="40"
      viewBox="0 0 250 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KonnectedRoots Logo"
      {...props}
    >
      <text
        x="0"
        y="20"
        fontFamily="Verdana, Arial, sans-serif"
        fontSize="26"
        fontWeight="bold"
        dominantBaseline="middle"
        textAnchor="start"
      >
        <tspan fill="hsl(var(--primary))">K</tspan>
        <tspan fill="hsl(var(--foreground))">onnected</tspan>
        <tspan fill="hsl(var(--primary))">R</tspan>
        <tspan fill="hsl(var(--foreground))">oots</tspan>
      </text>
    </svg>
  );
}
