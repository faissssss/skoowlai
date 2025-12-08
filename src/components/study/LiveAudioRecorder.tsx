'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, CheckCircle2, AlertCircle, Volume2, Pause, Play, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

type RecordingState = 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';

interface LiveAudioRecorderProps {
    onComplete: (notes: string, transcript: string, title?: string) => void;
    onCancel?: () => void;
}

const getBrowserInfo = () => {
    if (typeof window === 'undefined') return { name: 'unknown', supportsNativeSpeech: false };
    const ua = navigator.userAgent;
    const w = window as any;
    const hasSpeechRecognition = !!(w.SpeechRecognition || w.webkitSpeechRecognition);

    if (ua.includes('Chrome') && !ua.includes('Edg')) return { name: 'Chrome', supportsNativeSpeech: hasSpeechRecognition };
    if (ua.includes('Edg')) return { name: 'Edge', supportsNativeSpeech: hasSpeechRecognition };
    if (ua.includes('Safari') && !ua.includes('Chrome')) return { name: 'Safari', supportsNativeSpeech: false };
    if (ua.includes('Firefox')) return { name: 'Firefox', supportsNativeSpeech: false };
    return { name: 'unknown', supportsNativeSpeech: hasSpeechRecognition };
};

export default function LiveAudioRecorder({ onComplete }: LiveAudioRecorderProps) {
    const [state, setState] = useState<RecordingState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [finalTranscript, setFinalTranscript] = useState('');
    const [audioLevel, setAudioLevel] = useState(0);
    const [browserInfo, setBrowserInfo] = useState({ name: 'unknown', supportsNativeSpeech: false });
    const [transcriptionActive, setTranscriptionActive] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const transcriptBoxRef = useRef<HTMLDivElement>(null);
    const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { setBrowserInfo(getBrowserInfo()); }, []);

    const getSupportedMimeType = (): string => {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        for (const type of types) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
        }
        return 'audio/webm';
    };

    const startAudioLevelMonitoring = useCallback(() => {
        if (!analyserRef.current) return;
        const analyser = analyserRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        audioLevelIntervalRef.current = setInterval(() => {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(Math.min(100, (avg / 128) * 100));
        }, 100);
    }, []);

    const stopAudioLevelMonitoring = useCallback(() => {
        if (audioLevelIntervalRef.current) clearInterval(audioLevelIntervalRef.current);
        setAudioLevel(0);
    }, []);

    const drawWaveform = useCallback(() => {
        if (!analyserRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (state !== 'recording' && state !== 'paused') return;
            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / bufferLength) * 3;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = state === 'paused' ? 5 : (dataArray[i] / 255) * canvas.height * 0.9;
                ctx.fillStyle = state === 'paused' ? '#94a3b8' : '#818cf8';
                ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
                x += barWidth;
            }
        };
        draw();
    }, [state]);

    useEffect(() => {
        if (transcriptBoxRef.current) transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }, [liveTranscript, interimTranscript]);

    // Start browser speech recognition
    const startSpeechRecognition = useCallback(() => {
        const w = window as any;
        const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;

        if (!SpeechRecognitionAPI) {
            console.warn('Speech recognition not supported');
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            console.log('✅ Speech recognition started');
            setTranscriptionActive(true);
        };

        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }

            if (final) {
                setLiveTranscript(prev => prev + final);
                setInterimTranscript('');
            } else {
                setInterimTranscript(interim);
            }
        };

        recognition.onerror = (event: any) => {
            console.warn('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                // Restart on no-speech error
                try { recognition.start(); } catch { }
            }
        };

        recognition.onend = () => {
            console.log('Speech recognition ended');
            // Restart if still recording
            if (state === 'recording' && recognitionRef.current) {
                try { recognition.start(); } catch { }
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
        } catch (e) {
            console.error('Failed to start speech recognition:', e);
        }
    }, [state]);

    const startRecording = async () => {
        try {
            setError(null);
            setLiveTranscript('');
            setInterimTranscript('');
            setFinalTranscript('');
            audioChunksRef.current = [];
            setTranscriptionActive(false);

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000, channelCount: 1 },
            });
            streamRef.current = stream;

            const audioContext = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            startAudioLevelMonitoring();

            const mimeType = getSupportedMimeType();
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            // Start speech recognition for live transcription
            startSpeechRecognition();

            mediaRecorder.start(250);
            setState('recording');
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
            drawWaveform();

        } catch (err) {
            console.error('Recording error:', err);
            setError('Could not access microphone.');
            setState('error');
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && state === 'recording') {
            mediaRecorderRef.current.pause();
            if (timerRef.current) clearInterval(timerRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch { }
            }
            stopAudioLevelMonitoring();
            setState('paused');
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && state === 'paused') {
            mediaRecorderRef.current.resume();
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
            startSpeechRecognition();
            startAudioLevelMonitoring();
            setState('recording');
        }
    };

    const stopRecording = async () => {
        setState('processing');
        stopAudioLevelMonitoring();
        setTranscriptionActive(false);

        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch { }
            recognitionRef.current = null;
        }
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            return new Promise<void>(resolve => {
                mediaRecorderRef.current!.onstop = async () => {
                    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
                    const audioBlob = new Blob(audioChunksRef.current, { type: getSupportedMimeType() });
                    await processAudio(audioBlob);
                    resolve();
                };
                mediaRecorderRef.current!.stop();
            });
        }
    };

    const processAudio = async (blob: Blob) => {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

            const response = await fetch('/api/generate-audio-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: base64, mimeType: blob.type, fileName: `recording-${Date.now()}.webm` }),
            });

            if (!response.ok) throw new Error('Failed to process audio');

            const data = await response.json();
            setFinalTranscript(data.transcript);
            setState('complete');
            onComplete(data.notes, data.transcript, data.title);
        } catch (err) {
            setError('Failed to process audio. Please try again.');
            setState('error');
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (timerRef.current) clearInterval(timerRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { } }
        };
    }, []);

    const handleReset = () => {
        setState('idle');
        setError(null);
        setLiveTranscript('');
        setInterimTranscript('');
        setFinalTranscript('');
        setRecordingTime(0);
        setAudioLevel(0);
        setTranscriptionActive(false);
        audioChunksRef.current = [];
    };

    return (
        <div className="w-full space-y-6">
            {/* Browser info */}
            {state === 'idle' && !browserInfo.supportsNativeSpeech && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                    <Globe className="w-4 h-4" />
                    <span><strong>{browserInfo.name}</strong> doesn't support live transcription. Recording will still work - transcript will be generated after.</span>
                </div>
            )}

            {/* Status badge */}
            {(state === 'recording' || state === 'paused') && (
                <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                    transcriptionActive ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400")}>
                    <div className={cn("w-2 h-2 rounded-full", transcriptionActive ? "bg-green-500" : "bg-amber-500 animate-pulse")} />
                    {transcriptionActive ? 'Live Transcription Active' : 'Recording (no live preview)'}
                </div>
            )}

            {/* Audio Level */}
            {(state === 'recording' || state === 'paused') && (
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>Audio Level</span>
                        <span className={cn(audioLevel < 10 ? "text-red-500" : audioLevel < 30 ? "text-amber-500" : "text-green-500")}>
                            {audioLevel < 10 ? '🔇 Too quiet' : audioLevel < 30 ? '🔉 Low' : '🔊 Good'}
                        </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={cn("h-full transition-all rounded-full", audioLevel < 10 ? "bg-red-500" : audioLevel < 30 ? "bg-amber-500" : "bg-green-500")} style={{ width: `${audioLevel}%` }} />
                    </div>
                </div>
            )}

            {/* Waveform */}
            <div className="relative h-24 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl overflow-hidden border border-indigo-100 dark:border-indigo-900/50">
                <canvas ref={canvasRef} className="w-full h-full" width={600} height={96} />
                {state === 'idle' && (<div className="absolute inset-0 flex items-center justify-center"><div className="flex items-center gap-2 text-slate-400"><Volume2 className="w-5 h-5" /><span className="text-sm">Ready to record</span></div></div>)}
                {state === 'paused' && (<div className="absolute inset-0 flex items-center justify-center bg-slate-100/60 dark:bg-slate-800/60"><div className="flex items-center gap-2 text-slate-500"><Pause className="w-6 h-6" /><span>Paused</span></div></div>)}
                {state === 'processing' && (<div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-800/80"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>)}
                {state === 'complete' && (<div className="absolute inset-0 flex items-center justify-center bg-green-50/80 dark:bg-green-900/20"><CheckCircle2 className="w-8 h-8 text-green-500" /></div>)}
                {(state === 'recording' || state === 'paused') && (
                    <div className={cn("absolute top-2 right-2 flex items-center gap-2 px-3 py-1 rounded-full text-sm font-mono text-white", state === 'paused' ? "bg-slate-500" : "bg-red-500")}>
                        {state === 'recording' && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                        {formatTime(recordingTime)}
                    </div>
                )}
            </div>

            {/* Transcript */}
            {(state === 'recording' || state === 'paused' || state === 'processing' || finalTranscript) && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        {(state === 'recording' || state === 'paused') && (<><div className={cn("w-2 h-2 rounded-full", state === 'paused' ? "bg-slate-400" : "bg-red-500 animate-pulse")} />Live Transcript</>)}
                        {state === 'processing' && 'Processing...'}
                        {finalTranscript && state === 'complete' && (<><CheckCircle2 className="w-4 h-4 text-green-500" />Final Transcript</>)}
                    </label>
                    <div ref={transcriptBoxRef} className={cn("h-32 overflow-y-auto p-4 rounded-xl border text-sm", state === 'processing' ? "bg-slate-50 dark:bg-slate-800/50 animate-pulse" : "bg-white dark:bg-slate-900")}>
                        {state === 'processing' ? (<div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Perfecting transcript & generating notes...</div>)
                            : finalTranscript ? (<p className="text-slate-700 dark:text-slate-300">{finalTranscript}</p>)
                                : (liveTranscript || interimTranscript) ? (
                                    <p className="text-slate-700 dark:text-slate-300">
                                        {liveTranscript}
                                        <span className="text-slate-400">{interimTranscript}</span>
                                    </p>
                                )
                                    : (<p className="text-slate-400 italic">Start speaking... your words will appear here.</p>)}
                    </div>
                </div>
            )}

            {error && (<div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" /><p className="text-sm text-red-600 dark:text-red-400">{error}</p></div>)}

            {/* Buttons */}
            <div className="flex gap-3">
                {state === 'idle' && (<Button onClick={startRecording} className="flex-1 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-lg"><Mic className="w-6 h-6 mr-3" />Start Recording</Button>)}
                {state === 'recording' && (<><Button onClick={pauseRecording} variant="outline" className="h-14 px-6"><Pause className="w-5 h-5" /></Button><Button onClick={stopRecording} className="flex-1 h-14 bg-red-500 hover:bg-red-600 text-white text-lg"><Square className="w-6 h-6 mr-3 fill-current" />Stop Recording</Button></>)}
                {state === 'paused' && (<><Button onClick={resumeRecording} className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white text-lg"><Play className="w-6 h-6 mr-3 fill-current" />Resume</Button><Button onClick={stopRecording} variant="outline" className="h-14 px-6 text-red-600"><Square className="w-5 h-5 fill-current" /></Button></>)}
                {state === 'processing' && (<Button disabled className="flex-1 h-14 bg-slate-200 dark:bg-slate-700 text-slate-500"><Loader2 className="w-6 h-6 mr-3 animate-spin" />Processing...</Button>)}
                {state === 'error' && (<Button onClick={handleReset} className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white text-lg">Try Again</Button>)}
                {state === 'complete' && (<Button onClick={handleReset} variant="outline" className="flex-1 h-14 text-lg">Record Another</Button>)}
            </div>

            {state === 'idle' && (<p className="text-xs text-slate-400 text-center">💡 Use Chrome or Edge for live transcription. Recording works in all browsers.</p>)}
        </div>
    );
}
