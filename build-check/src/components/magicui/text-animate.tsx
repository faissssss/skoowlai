"use client";

import { motion, Variants, useInView } from "framer-motion";
import React, { useRef, useMemo } from "react";
import { cn } from "@/lib/utils";

type AnimationType = "fadeIn" | "slideUp" | "slideDown" | "slideLeft" | "slideRight" | "blurIn";
type AnimateBy = "character" | "word" | "line";

interface TextAnimateProps {
    children: string;
    className?: string;
    animation?: AnimationType;
    by?: AnimateBy;
    duration?: number;
    delay?: number;
    staggerChildren?: number;
    once?: boolean;
}

const animations: Record<AnimationType, Variants> = {
    fadeIn: {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    },
    slideUp: {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
    },
    slideDown: {
        hidden: { opacity: 0, y: -20 },
        visible: { opacity: 1, y: 0 },
    },
    slideLeft: {
        hidden: { opacity: 0, x: 20 },
        visible: { opacity: 1, x: 0 },
    },
    slideRight: {
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 },
    },
    blurIn: {
        hidden: { opacity: 0, filter: "blur(10px)" },
        visible: { opacity: 1, filter: "blur(0px)" },
    },
};

export function TextAnimate({
    children,
    className,
    animation = "fadeIn",
    by = "word",
    duration = 0.5,
    delay = 0,
    staggerChildren = 0.05,
    once = false,
}: TextAnimateProps) {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once, amount: 0.3 });

    const segments = useMemo(() => {
        if (by === "line") {
            return children.split("\n");
        } else if (by === "word") {
            return children.split(" ");
        } else {
            return children.split("");
        }
    }, [children, by]);

    const containerVariants: Variants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren,
                delayChildren: delay,
            },
        },
    };

    const itemVariants: Variants = {
        hidden: animations[animation].hidden,
        visible: {
            ...animations[animation].visible,
            transition: {
                duration,
                ease: "easeOut",
            },
        },
    };

    return (
        <motion.div
            ref={ref}
            className={cn("inline-flex flex-wrap", className)}
            variants={containerVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
        >
            {segments.map((segment, index) => (
                <motion.span
                    key={index}
                    variants={itemVariants}
                    className={by === "line" ? "block w-full" : undefined}
                >
                    {segment}
                    {by === "word" && index < segments.length - 1 && "\u00A0"}
                </motion.span>
            ))}
        </motion.div>
    );
}
