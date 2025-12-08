'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Clock, Users, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ClassroomPage() {
    const [sessionName, setSessionName] = useState('');
    const [description, setDescription] = useState('');

    // Mock data for classroom history
    const classroomHistory = [
        {
            id: '1',
            name: 'Physics Study Session',
            date: '2025-11-30',
            participants: 5,
            quizzesTaken: 3,
        },
        {
            id: '2',
            name: 'Math Review',
            date: '2025-11-28',
            participants: 8,
            quizzesTaken: 5,
        },
    ];

    const handleCreateSession = () => {
        // TODO: Implement classroom session creation
        console.log('Creating classroom session:', { sessionName, description });
        alert('Classroom creation feature coming soon!');
        setSessionName('');
        setDescription('');
    };

    return (
        <div className="space-y-8">
            {/* Create Classroom Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center">
                        <Plus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create Classroom</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Start a collaborative study session or quiz</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="session-name">Session Name</Label>
                        <Input
                            id="session-name"
                            placeholder="e.g., Physics Final Review"
                            value={sessionName}
                            onChange={(e) => setSessionName(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-950"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                            id="description"
                            placeholder="What will you study in this session?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-950 min-h-[100px]"
                        />
                    </div>

                    <Button
                        onClick={handleCreateSession}
                        disabled={!sessionName.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Session
                    </Button>
                </div>
            </div>

            {/* Classroom History Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Classroom History</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Your past study sessions</p>
                    </div>
                </div>

                {classroomHistory.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No sessions yet</h3>
                        <p className="text-slate-500 dark:text-slate-400">Create your first classroom session to get started!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {classroomHistory.map((session) => (
                            <div
                                key={session.id}
                                className="p-6 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                                            {session.name}
                                        </h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(session.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 text-sm">
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <Users className="w-4 h-4" />
                                        <span>{session.participants} participants</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <Trophy className="w-4 h-4" />
                                        <span>{session.quizzesTaken} quizzes taken</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
