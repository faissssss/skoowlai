'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone'; // Need to install this or implement custom
import { Upload, File, X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useGlobalLoader } from '@/contexts/LoaderContext';
import { toast } from 'sonner';
import NoteConfigModal from '@/components/NoteConfigModal';
import { NoteConfig } from '@/lib/noteConfig/types';
import UsageLimitModal from '@/components/UsageLimitModal';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes (Free Beta limit)

export default function FileUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [sizeError, setSizeError] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [limitInfo, setLimitInfo] = useState({ used: 0, limit: 3 });
    const router = useRouter();
    const { startLoading, stopLoading } = useGlobalLoader();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles?.length > 0) {
            const selectedFile = acceptedFiles[0];
            if (selectedFile.size > MAX_FILE_SIZE) {
                setSizeError(true);
                setFile(selectedFile);
            } else {
                setSizeError(false);
                setFile(selectedFile);
            }
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.size > MAX_FILE_SIZE) {
                setSizeError(true);
                setFile(selectedFile);
            } else {
                setSizeError(false);
                setFile(selectedFile);
            }
        }
    };

    const handleClearFile = () => {
        setFile(null);
        setSizeError(false);
    };

    // Show config modal when user clicks Generate
    const handleGenerateClick = () => {
        if (!file || sizeError) return;
        setShowConfigModal(true);
    };

    // Actual upload with config
    const handleUpload = async (config: NoteConfig) => {
        if (!file || sizeError) return;

        setShowConfigModal(false);
        setIsUploading(true);
        startLoading('Uploading your document...');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('noteConfig', JSON.stringify(config));

        try {
            // Update progress after short delay to show upload started
            const progressTimer = setTimeout(() => {
                startLoading('Analyzing content...');
            }, 1500);

            const analysisTimer = setTimeout(() => {
                startLoading('Generating notes & flashcards...');
            }, 4000);

            const response = await fetch('/api/generate', {
                method: 'POST',
                body: formData,
            });

            clearTimeout(progressTimer);
            clearTimeout(analysisTimer);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                // Handle 429 limit reached - show upgrade modal
                if (response.status === 429 && errorData.upgradeRequired) {
                    setLimitInfo({
                        used: errorData.currentUsage || errorData.used || 3,
                        limit: errorData.limit || 3
                    });
                    setShowLimitModal(true);
                    return;
                }

                throw new Error(errorData.error || errorData.details || 'Upload failed');
            }

            startLoading('Finalizing your study set...');
            const data = await response.json();
            router.push(`/study/${data.deckId}`);
        } catch (error) {
            console.error('Error uploading file:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to process file. Please try again.';
            toast.error('Upload Failed', {
                description: errorMessage,
                duration: 5000,
            });
        } finally {
            setIsUploading(false);
            stopLoading();
        }
    };

    return (
        // Main container: w-full, max-w-full, box-border, overflow-hidden
        <div className="w-full max-w-full box-border p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors overflow-hidden">
            {!file ? (
                <div className="text-center space-y-4 py-6">
                    <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto">
                        <Upload className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upload your material</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Drag & drop or click to browse</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">📄 PDF, DOCX, PPT, TXT • Max 10MB</p>
                    </div>
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".pdf,.docx,.pptx,.txt"
                        onChange={handleFileChange}
                    />
                    <Button asChild variant="outline" className="mt-4 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                        <label htmlFor="file-upload" className="cursor-pointer">
                            Select File
                        </label>
                    </Button>
                </div>
            ) : (
                // File selected state: space-y-3 for tighter spacing, w-full max-w-full overflow-hidden
                <div className="w-full max-w-full space-y-3 overflow-hidden box-border">
                    {/* File Size Warning - shrink text, wrap properly */}
                    {sizeError && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg w-full max-w-full overflow-hidden box-border">
                            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-md flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                                    File too large
                                </p>
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 break-words">
                                    Your file is {(file.size / 1024 / 1024).toFixed(1)} MB. Max size is 10MB.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* File Info Card - proper overflow constraints */}
                    <div className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border w-full max-w-full overflow-hidden box-border",
                        sizeError
                            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                    )}>
                        {/* Icon - fixed size, never shrink */}
                        <div className={cn(
                            "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                            sizeError
                                ? "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400"
                                : "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
                        )}>
                            <File className="w-4 h-4" />
                        </div>

                        {/* File name and size - flex-1 min-w-0 for truncation */}
                        <div className="flex-1 min-w-0 overflow-hidden">
                            <p
                                className={cn(
                                    "text-sm font-medium truncate",
                                    sizeError
                                        ? "text-red-700 dark:text-red-300"
                                        : "text-slate-900 dark:text-slate-100"
                                )}
                                title={file.name}
                            >
                                {file.name}
                            </p>
                            <p className={cn(
                                "text-xs",
                                sizeError
                                    ? "text-red-500 dark:text-red-400"
                                    : "text-slate-500 dark:text-slate-400"
                            )}>
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>

                        {/* Close button - fixed size, never shrink */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClearFile}
                            className="w-8 h-8 text-slate-400 hover:text-red-500 dark:hover:text-red-400 shrink-0"
                            disabled={isUploading}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Action Button */}
                    <Button
                        onClick={handleGenerateClick}
                        className={cn(
                            "w-full h-10",
                            sizeError
                                ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        )}
                        disabled={isUploading || sizeError}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : sizeError ? (
                            'File too large'
                        ) : (
                            'Generate Study Set'
                        )}
                    </Button>
                </div>
            )}

            {/* Note Configuration Modal */}
            <NoteConfigModal
                isOpen={showConfigModal}
                onClose={() => setShowConfigModal(false)}
                onGenerate={handleUpload}
                isLoading={isUploading}
            />

            {/* Usage Limit Modal - shows when deck limit reached */}
            <UsageLimitModal
                isOpen={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                feature="study deck"
                limit={limitInfo.limit}
                used={limitInfo.used}
            />
        </div>
    );
}
