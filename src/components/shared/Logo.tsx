
import type { SVGProps } from 'react';

export default function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      // Define intrinsic aspect ratio. Actual size controlled by className in Header.
      // Original image ratio roughly 965/155 = 6.22
      // If height is 40, width = 40 * 6.22 = 248.8. Using 250x40.
      width="250"
      height="40"
      viewBox="0 0 250 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KonnectedRoots Logo"
      {...props}
    >
      <text
        x="0" // Start at the beginning
        y="20" // Vertically center (half of viewBox height 40)
        fontFamily="Verdana, Arial, sans-serif" // Common sans-serif bold-ish fonts
        fontSize="26" // Adjusted for better fit and appearance
        fontWeight="bold"
        dominantBaseline="middle" // Better vertical alignment
        textAnchor="start" // Align text from the start
      >
        <tspan fill="#92C83E">K</tspan>
        <tspan fill="#006938">onnected</tspan>
        <tspan fill="#92C83E">R</tspan>
        <tspan fill="#006938">oots</tspan>
      </text>
    </svg>
  );
}
