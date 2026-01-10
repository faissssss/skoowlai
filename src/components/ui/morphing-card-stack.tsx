"use client"

import { useState, type ReactNode } from "react"
import { motion, AnimatePresence, LayoutGroup, type PanInfo } from "framer-motion"
import { cn } from "@/lib/utils"
import { Grid3X3, Layers, LayoutList } from "lucide-react"

export type LayoutMode = "stack" | "grid" | "list"

export interface CardData {
    id: string
    title: string
    description: string
    icon?: ReactNode
    color?: string
}

export interface MorphingCardStackProps {
    cards?: CardData[]
    className?: string
    defaultLayout?: LayoutMode
    onCardClick?: (card: CardData) => void
}

const layoutIcons = {
    stack: Layers,
    grid: Grid3X3,
    list: LayoutList,
}

const SWIPE_THRESHOLD = 50

export function MorphingCardStack({
    cards = [],
    className,
    defaultLayout = "stack",
    onCardClick,
}: MorphingCardStackProps) {
    const [layout, setLayout] = useState<LayoutMode>(defaultLayout)
    const [expandedCard, setExpandedCard] = useState<string | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)
    const [isDragging, setIsDragging] = useState(false)

    if (!cards || cards.length === 0) {
        return null
    }

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const { offset, velocity } = info
        const swipe = Math.abs(offset.x) * velocity.x

        if (offset.x < -SWIPE_THRESHOLD || swipe < -1000) {
            setActiveIndex((prev) => (prev + 1) % cards.length)
        } else if (offset.x > SWIPE_THRESHOLD || swipe > 1000) {
            setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length)
        }
        setIsDragging(false)
    }

    const getStackOrder = () => {
        const reordered = []
        for (let i = 0; i < cards.length; i++) {
            const index = (activeIndex + i) % cards.length
            reordered.push({ ...cards[index], stackPosition: i })
        }
        return reordered.reverse()
    }

    const getLayoutStyles = (stackPosition: number) => {
        switch (layout) {
            case "stack":
                return {
                    top: stackPosition * 8,
                    left: stackPosition * 8,
                    zIndex: cards.length - stackPosition,
                    rotate: (stackPosition - 1) * 2,
                }
            case "grid":
            case "list":
                return {
                    top: 0,
                    left: 0,
                    zIndex: 1,
                    rotate: 0,
                }
        }
    }

    // Calculate dynamic grid based on card count
    const getGridClass = () => {
        const count = cards.length;
        if (count === 1) return "grid grid-cols-1 gap-4";
        if (count === 2) return "grid grid-cols-2 gap-4";
        if (count === 3) return "grid grid-cols-3 gap-4";
        return "grid grid-cols-2 md:grid-cols-4 gap-4"; // 4+ cards: 2 cols mobile, 4 cols desktop
    };

    const containerStyles = {
        stack: "relative",
        grid: getGridClass(),
        list: "flex flex-col gap-4 w-full",
    }

    const displayCards = layout === "stack" ? getStackOrder() : cards.map((c, i) => ({ ...c, stackPosition: i }))

    return (
        <div className={cn("flex flex-col items-center w-full", className)}>
            {/* Layout Toggle */}
            {cards.length > 0 && (
                <div className="flex items-center justify-center gap-1 rounded-lg bg-slate-800/80 dark:bg-slate-800 p-1 w-fit mb-6">
                    {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
                        const Icon = layoutIcons[mode]
                        return (
                            <button
                                key={mode}
                                onClick={(e) => { e.stopPropagation(); setLayout(mode); }}
                                className={cn(
                                    "rounded-md p-2.5 transition-all",
                                    layout === mode
                                        ? "bg-slate-100 text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/50",
                                )}
                                aria-label={`Switch to ${mode} layout`}
                            >
                                <Icon className="h-4 w-4" />
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Cards Container - wide and proportional, hidden scrollbar */}
            <div
                className="w-full max-w-3xl min-h-[320px] flex items-start justify-center overflow-y-auto overflow-x-hidden p-6"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <LayoutGroup>
                    <motion.div layout className={cn(containerStyles[layout], layout === "stack" ? "w-60 h-48" : "w-full")}>
                        <AnimatePresence mode="popLayout">
                            {displayCards.map((card) => {
                                const styles = getLayoutStyles(card.stackPosition)
                                const isExpanded = expandedCard === card.id
                                const isTopCard = layout === "stack" && card.stackPosition === 0

                                return (
                                    <motion.div
                                        key={card.id}
                                        layoutId={card.id}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{
                                            opacity: 1,
                                            scale: isExpanded ? 1.05 : 1,
                                            x: 0,
                                            ...styles,
                                        }}
                                        exit={{ opacity: 0, scale: 0.8, x: -200 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 25,
                                        }}
                                        drag={isTopCard ? "x" : false}
                                        dragConstraints={{ left: 0, right: 0 }}
                                        dragElastic={0.7}
                                        onDragStart={() => setIsDragging(true)}
                                        onDragEnd={handleDragEnd}
                                        whileDrag={{ scale: 1.02, cursor: "grabbing" }}
                                        onClick={() => {
                                            if (isDragging) return
                                            setExpandedCard(isExpanded ? null : card.id)
                                            onCardClick?.(card)
                                        }}
                                        className={cn(
                                            "cursor-pointer rounded-xl border p-5 shadow-lg",
                                            "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
                                            "hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors",
                                            layout === "stack" && "absolute w-60 h-48",
                                            layout === "stack" && isTopCard && "cursor-grab active:cursor-grabbing",
                                            layout === "grid" && "w-full min-w-[140px] min-h-[160px]",
                                            layout === "list" && "w-full",
                                            isExpanded && "ring-2 ring-indigo-500",
                                        )}
                                    >
                                        {/* Card Content - Only show on top card in stack mode */}
                                        <div className={cn(
                                            "flex flex-col items-start text-left h-full",
                                            layout === "stack" && !isTopCard && "opacity-0"
                                        )}>
                                            {/* Icon */}
                                            {card.icon && (
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 mb-3">
                                                    {card.icon}
                                                </div>
                                            )}
                                            {/* Title */}
                                            <h3 className={cn(
                                                "font-semibold text-slate-900 dark:text-slate-100 mb-1",
                                                layout === "stack" ? "truncate max-w-full" : "line-clamp-2"
                                            )}>
                                                {card.title}
                                            </h3>
                                            {/* Date */}
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {card.description}
                                            </p>
                                        </div>

                                        {isTopCard && layout === "stack" && (
                                            <div className="absolute bottom-3 left-0 right-0 text-center">
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">Swipe</span>
                                            </div>
                                        )}
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </motion.div>
                </LayoutGroup>
            </div>

            {layout === "stack" && cards.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-4">
                    {cards.map((_, index) => (
                        <button
                            key={index}
                            onClick={(e) => { e.stopPropagation(); setActiveIndex(index); }}
                            className={cn(
                                "h-1.5 rounded-full transition-all",
                                index === activeIndex ? "w-4 bg-indigo-500" : "w-1.5 bg-slate-600 hover:bg-slate-500",
                            )}
                            aria-label={`Go to card ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
