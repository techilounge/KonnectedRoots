
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
        y="28"
        fontFamily="Verdana, Arial, sans-serif"
        fontSize="30"
        fontWeight="bold"
        dominantBaseline="middle"
        textAnchor="start"
      >
        <tspan fill="#3E7D3B">K</tspan>
        <tspan fill="#5A8F57">onnected</tspan>
        <tspan fill="#3E7D3B">R</tspan>
        <tspan fill="#5A8F57">oots</tspan>
      </text>
    </svg>
  );
}
