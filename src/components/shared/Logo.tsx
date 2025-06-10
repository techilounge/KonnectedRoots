
import type { SVGProps } from 'react';

export default function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="180"
      height="40"
      viewBox="0 0 180 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KonnectedRoots Logo"
      {...props}
    >
      <text
        x="0"
        y="30"
        fontFamily="Playfair Display, serif"
        fontSize="30"
        fontWeight="bold"
      >
        <tspan fill="#94BDBF" fillOpacity="0.7">K</tspan>
        <tspan fill="hsl(var(--primary))">onnected</tspan>
      </text>
      <text
        x="55"
        y="53"
        fontFamily="Playfair Display, serif"
        fontSize="30"
        fontWeight="bold"
        fill="hsl(var(--primary))"
      >
        Roots
      </text>
    </svg>
  );
}
