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
-   **Database**: [PostgreSQL](https://www.postgresql.org/) (via [Neon](https://neon.tech/) Serverless).
-   **ORM**: [Prisma](https://www.prisma.io/) - Next-generation Node.js and TypeScript ORM.
-   **Authentication**: [Clerk](https://clerk.com/) - Complete user management and authentication.

### **Artificial Intelligence (AI)**
-   **Text Generation**: [Google Gemini 2.5 Flash](https://deepmind.google/technologies/gemini/) (via Vercel AI SDK) - Fast, efficient reasoning for notes and quizzes.
-   **Transcription**: 
    -   [Groq](https://groq.com/) (Whisper Large v3) - Lightning-fast audio transcription.
    -   [Deepgram](https://deepgram.com/) - Real-time streaming transcription capabilities.
-   **AI SDK**: [Vercel AI SDK](https://sdk.vercel.ai/docs) - The TypeScript toolkit for building AI applications.

### **File Processing**
-   **PDFs**: `pdf-parse`
-   **Word**: `mammoth`
-   **PowerPoint**: `officeparser`
-   **YouTube**: `youtube-transcript` & `@distube/ytdl-core`

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
