'use client';

import { FileText } from 'lucide-react';

interface DocumentViewerProps {
    fileUrl: string | null;
    fileType: string | null;
}

export default function DocumentViewer({ fileUrl, fileType }: DocumentViewerProps) {
    if (!fileUrl) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted rounded-xl border-2 border-dashed border-border">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p>No document available</p>
            </div>
        );
    }

    // Handle PDF
    if (fileType === 'application/pdf') {
        return (
            <div className="h-full w-full bg-muted rounded-xl overflow-hidden border border-border">
                <iframe
                    src={`${fileUrl}#toolbar=0`}
                    className="w-full h-full"
                    title="Document Viewer"
                />
            </div>
        );
    }

    // Handle Images
    if (fileType?.startsWith('image/')) {
        return (
            <div className="h-full w-full bg-muted rounded-xl overflow-hidden border border-border flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={fileUrl}
                    alt="Study Material"
                    className="max-w-full max-h-full object-contain shadow-sm"
                />
            </div>
        );
    }

    // Fallback / Text
    return (
        <div className="h-full w-full bg-card rounded-xl border border-border p-8 overflow-auto">
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="w-16 h-16 mb-4 text-muted" />
                <p className="text-lg font-medium mb-2">Preview not available</p>
                <p className="text-sm mb-6">This file type ({fileType}) cannot be previewed directly.</p>
                <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 underline"
                >
                    Download File
                </a>
            </div>
        </div>
    );
}
