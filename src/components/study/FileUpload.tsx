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
import { useErrorModal } from '@/components/ErrorModal';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes (Free Beta limit)

export default function FileUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [sizeError, setSizeError] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const router = useRouter();
    const { startLoading, stopLoading } = useGlobalLoader();
    const { showError } = useErrorModal();

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
                    showError(
                        'Daily limit reached',
                        errorData.details || 'You have reached your daily limit. Please try again tomorrow.',
                        'limit'
                    );
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
        <div className="w-full max-w-full box-border p-4 sm:p-6 bg-card rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors overflow-hidden">
            {!file ? (
                <div className="text-center space-y-4 py-6">
                    <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                        <Upload className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Upload your material</h3>
                        <p className="text-muted-foreground mt-1">Drag & drop or click to browse</p>
                        <p className="text-xs text-muted-foreground/70 mt-2">📄 PDF, DOCX, PPT, TXT • Max 10MB</p>
                    </div>
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".pdf,.docx,.pptx,.txt"
                        onChange={handleFileChange}
                    />
                    <Button asChild variant="outline" className="mt-4 border-border hover:bg-muted">
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
                        <div className="flex items-start gap-2 p-3 bg-amber/10 dark:bg-amber/20 border border-amber/30 dark:border-amber/30 rounded-lg w-full max-w-full overflow-hidden box-border">
                            <div className="w-8 h-8 bg-amber/20 dark:bg-amber/30 text-amber rounded-md flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <p className="text-sm font-semibold text-amber">
                                    File too large
                                </p>
                                <p className="text-xs text-amber/80 mt-0.5 wrap-break-word">
                                    Your file is {(file.size / 1024 / 1024).toFixed(1)} MB. Max size is 10MB.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* File Info Card - proper overflow constraints */}
                    <div className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border w-full max-w-full overflow-hidden box-border",
                        sizeError
                            ? "bg-destructive/10 dark:bg-destructive/20 border-destructive/30 dark:border-destructive/30"
                            : "bg-muted border-border"
                    )}>
                        {/* Icon - fixed size, never shrink */}
                        <div className={cn(
                            "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                            sizeError
                                ? "bg-destructive/20 dark:bg-destructive/30 text-destructive"
                                : "bg-primary/10 text-primary"
                        )}>
                            <File className="w-4 h-4" />
                        </div>

                        {/* File name and size - flex-1 min-w-0 for truncation */}
                        <div className="flex-1 min-w-0 overflow-hidden">
                            <p
                                className={cn(
                                    "text-sm font-medium truncate",
                                    sizeError
                                        ? "text-destructive"
                                        : "text-foreground"
                                )}
                                title={file.name}
                            >
                                {file.name}
                            </p>
                            <p className={cn(
                                "text-xs",
                                sizeError
                                    ? "text-destructive/80"
                                    : "text-muted-foreground"
                            )}>
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>

                        {/* Close button - fixed size, never shrink */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClearFile}
                            className="w-8 h-8 text-muted-foreground hover:text-destructive shrink-0"
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
                                ? "bg-muted text-muted-foreground cursor-not-allowed"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
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

        </div>
    );
}
