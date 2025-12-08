'use client';

import { FileText } from 'lucide-react';

interface DocumentViewerProps {
    fileUrl: string | null;
    fileType: string | null;
}

export default function DocumentViewer({ fileUrl, fileType }: DocumentViewerProps) {
    if (!fileUrl) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p>No document available</p>
            </div>
        );
    }

    // Handle PDF
    if (fileType === 'application/pdf') {
        return (
            <div className="h-full w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
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
            <div className="h-full w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center p-4">
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
        <div className="h-full w-full bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-8 overflow-auto">
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <FileText className="w-16 h-16 mb-4 text-slate-300" />
                <p className="text-lg font-medium mb-2">Preview not available</p>
                <p className="text-sm mb-6">This file type ({fileType}) cannot be previewed directly.</p>
                <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-700 underline"
                >
                    Download File
                </a>
            </div>
        </div>
    );
}
