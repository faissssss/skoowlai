export default function Loading() {
    return (
        <div className="w-full max-w-5xl mx-auto space-y-8 p-4 md:p-0 animate-pulse">
            {/* Title Area Skeleton */}
            <div className="space-y-4">
                <div className="h-8 bg-muted rounded-lg w-1/4" />
                <div className="h-4 bg-muted rounded-lg w-1/2" />
            </div>

            {/* Main Content Skeleton */}
            <div className="space-y-6">
                {/* Large Card / Editor Area */}
                <div className="h-[60vh] bg-muted rounded-xl w-full border border-border/50" />

                {/* Controls Skeleton */}
                <div className="flex gap-4">
                    <div className="h-10 bg-muted rounded-lg w-32" />
                    <div className="h-10 bg-muted rounded-lg w-32" />
                </div>
            </div>
        </div>
    );
}
