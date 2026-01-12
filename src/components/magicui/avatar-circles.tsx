"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface Avatar {
    imageUrl: string;
    profileUrl?: string;
}

interface AvatarCirclesProps {
    className?: string;
    numPeople?: number;
    avatarUrls: Avatar[];
}

export function AvatarCircles({
    className,
    numPeople,
    avatarUrls,
}: AvatarCirclesProps) {
    return (
        <div className={cn("z-10 flex -space-x-4", className)}>
            {avatarUrls.map((avatar, index) => (
                <a
                    key={index}
                    href={avatar.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative"
                >
                    {/* Optimized by Vercel Edge */}
                    <Image
                        className="h-10 w-10 rounded-full border-2 border-slate-800 hover:scale-110 transition-transform object-cover"
                        src={avatar.imageUrl}
                        width={40}
                        height={40}
                        alt={`Avatar ${index + 1}`}
                        unoptimized={avatar.imageUrl.startsWith('http')} // Only optimize if whitelisted
                    />
                </a>
            ))}
            {numPeople && numPeople > 0 && (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-800 bg-slate-900 text-center text-xs font-medium text-white">
                    +{numPeople}
                </div>
            )}
        </div>
    );
}
