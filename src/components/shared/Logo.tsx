
import type { SVGProps } from 'react';

export default function Logo(props: SVGProps<SVGSVGElement>) {
  // Approximate colors from the provided logo image
  const lightGreen = "#8CC63F"; // For K and R
  const darkGreen = "#1A643F";  // For onnected and oots

  return (
    <svg
      width="360" // Increased width
      height="40"
      viewBox="0 0 360 40" // Increased viewBox width
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KonnectedRoots Logo"
      {...props}
    >
      <text
        x="0"
        y="28" // Adjusted y for better vertical centering with dominantBaseline
        fontFamily="Verdana, Arial, sans-serif"
        fontSize="30"
        fontWeight="bold"
        dominantBaseline="middle" // Ensures y is the vertical center
        textAnchor="start"
      >
        <tspan fill={lightGreen}>K</tspan>
        <tspan fill={darkGreen}>onnected</tspan>
        <tspan fill={lightGreen}>R</tspan>
        <tspan fill={darkGreen}>oots</tspan>
      </text>
    </svg>
  );
}
