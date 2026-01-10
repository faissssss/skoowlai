import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import React from "react";

interface AnimatedDockButtonProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
}

export const AnimatedDockButton = React.forwardRef<HTMLDivElement, AnimatedDockButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 1.08, y: -2 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className={cn("inline-block cursor-pointer", className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
AnimatedDockButton.displayName = "AnimatedDockButton";
