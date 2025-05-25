"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface FlickeringGridProps extends React.HTMLAttributes<HTMLDivElement> {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  maxOpacity?: number;
}

export const FlickeringGrid: React.FC<FlickeringGridProps> = ({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  color = "rgb(0, 0, 0)",
  width,
  height,
  className,
  maxOpacity = 0.3,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const w = width || rect.width;
      const h = height || rect.height;
      
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      
      return { w, h };
    };

    const { w, h } = updateCanvasSize();
    
    // Calculate grid
    const cols = Math.floor(w / (squareSize + gridGap));
    const rows = Math.floor(h / (squareSize + gridGap));
    
    // Create squares array
    const squares: number[][] = [];
    for (let i = 0; i < cols; i++) {
      squares[i] = [];
      for (let j = 0; j < rows; j++) {
        squares[i][j] = Math.random() * maxOpacity;
      }
    }

    // Animation loop
    let animationId: number;
    
    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, w, h);
      
      // Update and draw squares
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          // Randomly flicker
          if (Math.random() < flickerChance * 0.016) { // Approximate 60fps delta
            squares[i][j] = Math.random() * maxOpacity;
          }
          
          // Draw square
          const opacity = squares[i][j];
          ctx.fillStyle = `rgba(107, 114, 128, ${opacity})`; // Using gray-500 color
          ctx.fillRect(
            i * (squareSize + gridGap),
            j * (squareSize + gridGap),
            squareSize,
            squareSize
          );
        }
      }
      
      animationId = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [squareSize, gridGap, flickerChance, width, height, maxOpacity]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full", className)}
      {...props}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none w-full h-full"
      />
    </div>
  );
};
