'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, CheckCircle2, FileAudio, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useErrorModal } from '@/components/ErrorModal';

type RecordingStep = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'generating' | 'complete' | 'error';

interface AudioNoteCreatorProps {
    onNotesGenerated: (notes: string, transcript: string) => void;
    onCancel?: () => void;
}

const STEP_LABELS: Record<RecordingStep, string> = {
    idle: 'Ready to Record',
    recording: 'Recording...',
    uploading: 'Uploading Audio...',
    transcribing: 'Transcribing with AI...',
    generating: 'Generating Notes...',
    complete: 'Complete!',
    error: 'Error Occurred',
};

export default function AudioNoteCreator({ onNotesGenerated, onCancel }: AudioNoteCreatorProps) {
    const [step, setStep] = useState<RecordingStep>('idle');
    const [error, setError] = useState<string | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const { showError } = useErrorModal();

    // Get supported MIME type
    const getSupportedMimeType = (): string => {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/wav',
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return 'audio/webm'; // fallback
    };

    // Draw waveform visualization
    const drawWaveform = useCallback(() => {
        if (!analyserRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (step !== 'recording') return;

            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            // Clear canvas
            ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw bars
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

                // Gradient color from indigo to purple
                const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
                gradient.addColorStop(0, '#818cf8');
                gradient.addColorStop(1, '#6366f1');

                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

                x += barWidth;
            }
        };

        draw();
    }, [step]);

    // Start recording
    const startRecording = async () => {
        try {
            setError(null);
            audioChunksRef.current = [];

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100,
                    channelCount: 1,
                },
            });

            streamRef.current = stream;

            // Set up audio analyser for visualization
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            // Create MediaRecorder
            const mimeType = getSupportedMimeType();
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const mimeType = getSupportedMimeType();
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                setAudioBlob(audioBlob);
            };

            mediaRecorder.start(100); // Collect data every 100ms
            setStep('recording');
            setRecordingTime(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            // Start visualization
            drawWaveform();

        } catch (err) {
            console.error('Error starting recording:', err);
            setError('Could not access microphone. Please check permissions.');
            setStep('error');
        }
    };

    // Stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && step === 'recording') {
            mediaRecorderRef.current.stop();

            // Stop all tracks
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            // Stop timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }

            // Stop animation
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            setStep('uploading');
        }
    };

    // Process audio - send to API
    const processAudio = useCallback(async (blob: Blob) => {
        try {
            setStep('transcribing');

            // Convert blob to file
            const extension = blob.type.includes('webm') ? 'webm' :
                blob.type.includes('mp4') ? 'm4a' : 'wav';
            const file = new File([blob], `recording.${extension}`, { type: blob.type });

            const formData = new FormData();
            formData.append('audio', file);

            const response = await fetch('/api/generate-audio-notes', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 429 && (errorData.upgradeRequired || errorData.error === 'Daily limit reached')) {
                    showError(
                        'Daily limit reached',
                        errorData.details || 'You have reached your daily limit. Please try again tomorrow.',
                        'limit'
                    );
                    throw new Error(errorData.details || errorData.error || 'Daily limit reached');
                }
                throw new Error(errorData.error || errorData.details || 'Failed to process audio');
            }

            setStep('generating');

            const data = await response.json();

            setStep('complete');

            // Small delay to show complete state
            setTimeout(() => {
                onNotesGenerated(data.notes, data.transcript);
            }, 500);

        } catch (err) {
            console.error('Error processing audio:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to process audio';
            setError(errorMessage);
            setStep('error');
        }
    }, [onNotesGenerated]);

    // Process audio when blob is ready
    useEffect(() => {
        if (audioBlob && step === 'uploading') {
            processAudio(audioBlob);
        }
    }, [audioBlob, step, processAudio]);

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Reset to idle
    const handleReset = () => {
        setStep('idle');
        setError(null);
        setAudioBlob(null);
        setRecordingTime(0);
        audioChunksRef.current = [];
    };

    return (
        <div className="w-full max-w-xl mx-auto p-6 bg-card rounded-2xl border border-border shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-linear-to-br from-(--brand-primary) to-(--brand-secondary) rounded-full flex items-center justify-center">
                        <Mic className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Audio Notes</h3>
                        <p className="text-xs text-muted-foreground">Record voice, get study notes</p>
                    </div>
                </div>
                {onCancel && step === 'idle' && (
                    <Button variant="ghost" size="icon" onClick={onCancel}>
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Progress Stepper */}
            <div className="flex items-center justify-between mb-6 px-2">
                {(['recording', 'uploading', 'transcribing', 'generating'] as RecordingStep[]).map((s, i) => (
                    <div key={s} className="flex items-center">
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                            step === s && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                            ['uploading', 'transcribing', 'generating', 'complete'].indexOf(step) > ['recording', 'uploading', 'transcribing', 'generating'].indexOf(s)
                                ? "bg-emerald text-white"
                                : step !== s && "bg-muted text-muted-foreground"
                        )}>
                            {['uploading', 'transcribing', 'generating', 'complete'].indexOf(step) > ['recording', 'uploading', 'transcribing', 'generating'].indexOf(s) ? (
                                <CheckCircle2 className="w-4 h-4" />
                            ) : (
                                i + 1
                            )}
                        </div>
                        {i < 3 && (
                            <div className={cn(
                                "w-12 h-0.5 mx-1",
                                ['uploading', 'transcribing', 'generating', 'complete'].indexOf(step) > i
                                ? "bg-success"
                                : "bg-muted"
                            )} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step Labels */}
            <div className="text-center mb-6">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={step}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                            "text-sm font-medium",
                            step === 'error' ? "text-destructive" : "text-muted-foreground"
                        )}
                    >
                        {step === 'recording' ? `${STEP_LABELS[step]} ${formatTime(recordingTime)}` : STEP_LABELS[step]}
                    </motion.p>
                </AnimatePresence>
            </div>

            {/* Waveform Visualizer */}
            <div className="relative mb-6 h-24 bg-muted rounded-xl overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    width={400}
                    height={96}
                />
                {step === 'idle' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <FileAudio className="w-8 h-8 text-muted-foreground" />
                    </div>
                )}
                {(step === 'uploading' || step === 'transcribing' || step === 'generating') && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                )}
                {step === 'complete' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald/10">
                        <CheckCircle2 className="w-8 h-8 text-emerald" />
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                {step === 'idle' && (
                    <Button
                        onClick={startRecording}
                        className="flex-1 bg-linear-to-r from-(--brand-primary) to-(--brand-secondary) hover:from-(--brand-primary)/90 hover:to-(--brand-secondary)/90 text-white h-12"
                    >
                        <Mic className="w-5 h-5 mr-2" />
                        Start Recording
                    </Button>
                )}

                {step === 'recording' && (
                    <Button
                        onClick={stopRecording}
                        className="flex-1 bg-destructive hover:bg-destructive/90 text-white h-12"
                    >
                        <Square className="w-5 h-5 mr-2" />
                        Stop Recording
                    </Button>
                )}

                {(step === 'uploading' || step === 'transcribing' || step === 'generating') && (
                    <Button
                        disabled
                        className="flex-1 bg-muted text-muted-foreground h-12"
                    >
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                    </Button>
                )}

                {step === 'error' && (
                    <Button
                        onClick={handleReset}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white h-12"
                    >
                        Try Again
                    </Button>
                )}
            </div>

            {/* Tips */}
            {step === 'idle' && (
                <p className="text-xs text-muted-foreground text-center mt-4">
                    Tip: Speak clearly and at a normal pace for best results
                </p>
            )}
        </div>
    );
}
