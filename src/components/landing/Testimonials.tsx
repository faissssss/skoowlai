'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Marquee } from '../magicui/marquee';
import { AnimatedGradientText } from '../magicui/animated-gradient-text';
import { useEffect, useRef, useState } from 'react';

// Testimonial data
const testimonials = [
    {
        initial: 'S',
        name: 'Sarah T.',
        role: 'Medical Student',
        text: 'I used to spend 3 hours transcribing a 1-hour anatomy lecture. With Skoowl, I just hit record and get perfect notes instantly.',
    },
    {
        initial: 'D',
        name: 'David K.',
        role: 'Law Student',
        text: "The amount of reading in law school is drowning. I upload 50-page case studies to Skoowl and get the key legal precedents and summaries in seconds. It's like having a superpower.",
    },
    {
        initial: 'E',
        name: 'Emily R.',
        role: 'High School Senior',
        text: "I was failing History because I couldn't memorize dates. The AI-generated quizzes helped me practice exactly what I didn't know. Just got an A- on my final!",
    },
    {
        initial: 'M',
        name: 'Michael B.',
        role: 'Computer Science Major',
        text: "Most AI tools mess up code snippets. Skoowl actually formats the Python code in my notes correctly. The 'Explain Code' feature in the chat is also a huge plus for debugging.",
    },
    {
        initial: 'S',
        name: 'Sofia L.',
        role: 'Design Student • Visual Learner',
        text: 'I hate reading walls of text. The Mind Map feature is the only reason I passed sociology. Seeing the concepts connected visually makes it stick in my brain way better.',
    },
    {
        initial: 'R',
        name: 'Ryan P.',
        role: 'Engineering Student',
        text: 'The flashcards generation is scarily accurate. I uploaded my textbook chapter, and it created 50 cards that covered every single formula I needed for the exam. Zero manual typing.',
    },
    {
        initial: 'J',
        name: 'Jessica M.',
        role: 'Psychology Major',
        text: "I have ADHD and struggle to focus on long articles. The 'Simplify' rewrite tool breaks down complex jargon into language I can actually understand. It makes studying feel less overwhelming.",
    },
    {
        initial: 'A',
        name: 'Alex H.',
        role: 'Working Student',
        text: 'I work part-time, so I study on the bus. Being able to listen to my notes or take a quick 5-minute quiz on my phone while commuting is a game changer.',
    },
    {
        initial: 'F',
        name: 'Farrah Z.',
        role: 'International Relations',
        text: 'I study materials in both English and Indonesian. Skoowl handles the language switching perfectly. If I ask it to explain a concept in Indonesian, it actually sounds natural, not like a robot.',
    },
    {
        initial: 'D',
        name: 'Daniel W.',
        role: 'Freshman • Business',
        text: "I tried Quizlet and ChatGPT, but having everything in one place—audio, notes, and quizzes—is just better. Plus, the free beta plan is insanely generous compared to other apps.",
    },
];

// Avatar gradient colors
const avatarGradients = [
    'from-(--brand-secondary) to-(--brand-accent)',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-destructive',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-blue-500',
    'from-amber-500 to-yellow-500',
    'from-fuchsia-500 to-pink-500',
];

function getAvatarGradient(index: number) {
    return avatarGradients[index % avatarGradients.length];
}

const ReviewCard = ({ testimonial, index }: { testimonial: typeof testimonials[0]; index: number }) => {
    return (
        <div className="shrink-0 w-[350px] md:w-[400px] p-6 mx-3 rounded-2xl bg-card/80 backdrop-blur-md border border-border hover:border-primary/30 transition-all duration-300">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                {/* Avatar with Initial */}
                <div className={`w-12 h-12 rounded-full bg-linear-to-br ${getAvatarGradient(index)} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                    {testimonial.initial}
                </div>
                <div>
                    <p className="text-foreground font-semibold">{testimonial.name}</p>
                    <p className="text-(--brand-secondary) text-sm">{testimonial.role}</p>
                </div>
            </div>
            {/* Quote */}
            <p className="text-muted-foreground text-sm leading-relaxed">&quot;{testimonial.text}&quot;</p>
        </div>
    );
};

export default function Testimonials() {
    const reduceMotion = useReducedMotion();
    const sectionRef = useRef<HTMLElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const firstRow = testimonials.slice(0, testimonials.length / 2);
    const secondRow = testimonials.slice(testimonials.length / 2);

    useEffect(() => {
        const node = sectionRef.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '200px' }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return (
        <section ref={sectionRef} className="relative py-16 overflow-hidden">
            {/* Section Header */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                viewport={{ once: true }}
                className="text-center mb-12 px-6"
            >
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                    Student{' '}
                    <AnimatedGradientText colorFrom="#8b5cf6" colorTo="#d946ef">
                        Stories
                    </AnimatedGradientText>
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                    Join us to study smarter, not harder.
                </p>
            </motion.div>

            <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
                {(reduceMotion || !isVisible) ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 px-6">
                        {testimonials.map((review, i) => (
                            <ReviewCard key={review.name} testimonial={review} index={i} />
                        ))}
                    </div>
                ) : (
                    <>
                        <Marquee pauseOnHover className="[--duration:80s]">
                            {firstRow.map((review, i) => (
                                <ReviewCard key={review.name} testimonial={review} index={i} />
                            ))}
                        </Marquee>
                        <Marquee reverse pauseOnHover className="[--duration:80s] mt-4">
                            {secondRow.map((review, i) => (
                                <ReviewCard key={review.name} testimonial={review} index={i + firstRow.length} />
                            ))}
                        </Marquee>
                    </>
                )}
                {/* Gradient Fade Left */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-linear-to-r from-black via-transparent to-transparent z-10" />
                {/* Gradient Fade Right */}
                <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-linear-to-l from-black via-transparent to-transparent z-10" />
            </div>
        </section>
    );
}
