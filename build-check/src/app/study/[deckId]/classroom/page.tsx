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
            <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Plus className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Create Classroom</h2>
                        <p className="text-sm text-muted-foreground">Start a collaborative study session or quiz</p>
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
                            className="bg-muted"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                            id="description"
                            placeholder="What will you study in this session?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-muted min-h-[100px]"
                        />
                    </div>

                    <Button
                        onClick={handleCreateSession}
                        disabled={!sessionName.trim()}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Session
                    </Button>
                </div>
            </div>

            {/* Classroom History Section */}
            <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-(--brand-secondary)/10 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-(--brand-secondary)" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Classroom History</h2>
                        <p className="text-sm text-muted-foreground">Your past study sessions</p>
                    </div>
                </div>

                {classroomHistory.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground mb-2">No sessions yet</h3>
                        <p className="text-muted-foreground">Create your first classroom session to get started!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {classroomHistory.map((session) => (
                            <div
                                key={session.id}
                                className="p-6 bg-muted rounded-xl border border-border hover:border-primary/30 transition-all cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-foreground mb-1">
                                            {session.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(session.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Users className="w-4 h-4" />
                                        <span>{session.participants} participants</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
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
