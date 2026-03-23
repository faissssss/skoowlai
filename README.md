# 🦉 skoowl ai

> **Your Personal AI Study Buddy.**  
> Instantly transform documents, videos, and recordings into interactive notes, flashcards, quizzes, and mind maps.
Grab your skoowl ai here! www.skoowlai.com
![Skoowl AI Banner](/public/skoowl-logo.png)

## 🚀 Overview

**skoowl ai** is a modern, AI-powered study platform designed to supercharge learning. It eliminates the tedious work of manual summarization by using advanced LLMs to process raw educational content—PDFs, YouTube lectures, or audio recordings—into structured, study-ready materials.

### ✨ Key Features

-   **📝 Smart Notes**: Auto-generate comprehensive, formatted study notes from any file.
-   **⚡ Flashcards**: Create spaced-repetition flashcards to master key terms and concepts.
-   **❓ Adaptive Quizzes**: Generate multiple-choice, true/false, or fill-in-the-blank quizzes with AI-powered hints.
-   **🧠 Mind Maps**: Visualize complex topics with interactive, customizable mind maps (Radial, Tree, Fishbone layouts).
-   **🎙️ Live Transcription**: Record lectures in real-time or upload audio files for instant transcription and processing.
-   **📺 YouTube Learning**: Paste a video URL to instantly extract knowledge from educational videos.
-   **🗣️ Chat Assistant**: Ask questions and get clarifications directly from your study notes.

---

## 🛠️ Tech Stack

This project is built with the latest modern web technologies, focusing on performance, user experience, and scalability.

### **Frontend**
-   **Framework**: [Next.js 15 (App Router)](https://nextjs.org/) - The React Framework for the Web.
-   **Language**: [TypeScript](https://www.typescriptlang.org/) - For type-safe, robust code.
-   **UI Library**: [React 19](https://react.dev/) - The library for web and native user interfaces.
-   **Styling**: 
    -   [Tailwind CSS v4](https://tailwindcss.com/) - Utility-first CSS framework.
    -   [Framer Motion](https://www.framer.com/motion/) - For complex, fluid animations.
    -   [Radix UI](https://www.radix-ui.com/) - Headless, accessible UI primitives.
    -   [Lucide React](https://lucide.dev/) - Beautiful, consistent icons.

### **Backend & Database**
-   **Database**: [PostgreSQL](https://www.postgresql.org/) (via [Neon](https://neon.tech/) Serverless) & [Local SQLite](https://sqlite.org/) (for dev).
-   **ORM**: [Prisma v5.22.0](https://www.prisma.io/) - Next-generation Node.js and TypeScript ORM.
-   **Caching & Rate Limiting**: [Upstash Redis](https://upstash.com/) for caching and API rate limiting.
-   **Authentication**: [Clerk](https://clerk.com/) - Complete user management and authentication.
-   **Payments & Subscriptions**: [Dodo Payments](https://www.dodopayments.com/) - Payment gateway and subscription handling.
-   **Webhooks**: [Svix](https://www.svix.com/) - Robust webhook signature verification.

### **Artificial Intelligence (AI)**
-   **Text Generation**: [Google Gemini / OpenAI](https://deepmind.google/technologies/gemini/) (via Vercel AI SDK) - Fast, efficient reasoning for notes and quizzes.
-   **Transcription**: 
    -   [Deepgram](https://deepgram.com/) - High-quality real-time audio and speech transcription.
-   **AI SDK**: [Vercel AI SDK](https://sdk.vercel.ai/docs) - The TypeScript toolkit for streaming AI applications.

### **Rich Interfaces & UI Enhancements**
-   **Rich Text Editor**: [Tiptap](https://tiptap.dev/) - Headless editor for notes and interactive content.
-   **Markdown & Math**: `react-markdown` with `remark`/`rehype` and `KaTeX` plugins for rendering AI outputs and formulas.
-   **Diagrams**: [React Flow](https://reactflow.dev/) - For building interactive interactive mind maps.
-   **3D UI / Advanced Graphics**: `three.js`, `@react-three/fiber`, `@shadergradient/react`, and `gsap` for powerful interactive visual layers and animations.

### **File Processing & Media Extraction**
-   **Documents**: `pdf-parse` (PDF), `mammoth` (Word), and `officeparser` (PowerPoint/Office).
-   **YouTube**: `youtube-transcript`, `@distube/ytdl-core`, and `yt-dlp-exec` for extracting knowledge from educational videos.

---

## 🏁 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
-   Node.js 18+ installed
-   npm or pnpm or yarn

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/yourusername/skoowl-ai.git
cd skoowl-ai
\`\`\`

### 2. Install dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Environment Setup
Create a `.env` file in the root directory. You can use `.env.example` as a reference.

\`\`\`bash
cp .env.example .env
\`\`\`

Fill in the required keys:
\`\`\`env
# Database
DATABASE_URL="postgresql://..."

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# AI Keys
GOOGLE_GENERATIVE_AI_API_KEY="AIzaSy..."
GROQ_API_KEY="gsk_..."
DEEPGRAM_API_KEY="..." (Optional for live features)
\`\`\`

### 4. Database Setup
Push the Prisma schema to your database:
\`\`\`bash
npx prisma db push
npx prisma generate
\`\`\`

### 5. Run the development server
\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🚀 Deployment

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

1.  Push your code to GitHub.
2.  Import the project into Vercel.
3.  Add your **Environment Variables** (Production keys).
4.  Deploy!

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.

---

**Built with 💜 by Fais Wibowo**
