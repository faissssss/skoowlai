"use client";

import { useCallback, useEffect, useId, useRef, useState, type SVGProps } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type GridPosition = [number, number];
type AnimatedSquare = {
    id: number;
    pos: GridPosition;
};

interface AnimatedGridPatternProps {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    strokeDasharray?: SVGProps<SVGPathElement>["strokeDasharray"];
    numSquares?: number;
    className?: string;
    maxOpacity?: number;
    duration?: number;
    repeatDelay?: number;
}

export function AnimatedGridPattern({
    width = 40,
    height = 40,
    x = -1,
    y = -1,
    strokeDasharray = 0,
    numSquares = 30,
    className,
    maxOpacity = 0.5,
    duration = 4,
    repeatDelay = 0.5,
    ...props
}: AnimatedGridPatternProps) {
    const id = useId();
    const containerRef = useRef<SVGSVGElement | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    
    const generateSquares = useCallback((count: number): AnimatedSquare[] => {
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            pos: [0, 0],
        }));
    }, []);

    const [squares, setSquares] = useState<AnimatedSquare[]>(() => generateSquares(numSquares));

    const getPos = useCallback((): GridPosition => {
        if (!dimensions.width || !dimensions.height) {
            return [0, 0];
        }

        return [
            Math.floor((Math.random() * dimensions.width) / width),
            Math.floor((Math.random() * dimensions.height) / height),
        ];
    }, [dimensions.height, dimensions.width, height, width]);

    const updateSquarePosition = useCallback((id: number) => {
        setSquares((currentSquares) =>
            currentSquares.map((sq) =>
                sq.id === id
                    ? {
                        ...sq,
                        pos: getPos(),
                    }
                    : sq,
            ),
        );
    }, [getPos]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const nextDimensions = {
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                };

                setDimensions(nextDimensions);
                setSquares(
                    generateSquares(numSquares).map((sq) => ({
                        ...sq,
                        pos: [
                            Math.floor((Math.random() * nextDimensions.width) / width),
                            Math.floor((Math.random() * nextDimensions.height) / height),
                        ],
                    })),
                );
            }
        });

        resizeObserver.observe(element);

        return () => {
            resizeObserver.unobserve(element);
            resizeObserver.disconnect();
        };
    }, [generateSquares, height, numSquares, width]);

    return (
        <svg
            ref={containerRef}
            aria-hidden="true"
            className={cn(
                "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-gray-400/30",
                className,
            )}
            {...props}
        >
            <defs>
                <pattern
                    id={id}
                    width={width}
                    height={height}
                    patternUnits="userSpaceOnUse"
                    x={x}
                    y={y}
                >
                    <path
                        d={`M.5 ${height}V.5H${width}`}
                        fill="none"
                        strokeDasharray={strokeDasharray}
                    />
                </pattern>
            </defs>
            <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
            <svg x={x} y={y} className="overflow-visible">
                {squares.map(({ pos: [x, y], id }, index) => (
                    <motion.rect
                        initial={{ opacity: 0 }}
                        animate={{ opacity: maxOpacity }}
                        transition={{
                            duration,
                            repeat: 1,
                            delay: index * 0.1,
                            repeatDelay,
                            repeatType: "reverse",
                        }}
                        onAnimationComplete={() => updateSquarePosition(id)}
                        key={`${x}-${y}-${index}`}
                        width={width - 1}
                        height={height - 1}
                        x={x * width + 1}
                        y={y * height + 1}
                        fill="currentColor"
                        strokeWidth="0"
                    />
                ))}
            </svg>
        </svg>
    );
}
