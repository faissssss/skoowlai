'use client';

import React from "react";
import { motion, AnimatePresence, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface DraggableCardContainerProps {
    children: React.ReactNode;
    className?: string;
    isDragging?: boolean;
}

export const DraggableCardContainer = ({
    children,
    className,
    isDragging
}: DraggableCardContainerProps) => {
    return (
        <div className={cn("relative h-full w-full", className)}>
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1.05 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 rounded-xl bg-indigo-500/10 border-2 border-indigo-500 border-dashed pointer-events-none z-0"
                    />
                )}
            </AnimatePresence>
            {children}
        </div>
    );
};

interface DraggableCardBodyProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    isDragging?: boolean;
}

export const DraggableCardBody = ({
    children,
    className,
    isDragging,
    ...props
}: DraggableCardBodyProps) => {
    return (
        <motion.div
            layout
            dragSnapToOrigin
            dragElastic={0.8}
            whileDrag={{
                scale: 1.05,
                rotate: 2,
                zIndex: 50
            }}
            whileHover={isDragging ? {} : { y: -3, scale: 1.02 }}
            whileTap={isDragging ? {} : { scale: 0.98 }}
            transition={{
                type: "spring",
                stiffness: 700,
                damping: 40,
                mass: 0.5
            }}
            className={cn(
                "relative w-full h-full rounded-xl z-20 overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-200",
                isDragging
                    ? "border-indigo-500 ring-4 ring-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.3)] z-50"
                    : "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xl hover:shadow-indigo-500/10",
                className
            )}
            {...props}
        >
            {/* Glowing background effect during drag */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none"
                    />
                )}
            </AnimatePresence>
            {children}
        </motion.div>
    );
};
