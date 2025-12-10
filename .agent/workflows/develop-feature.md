---
description: How to develop and test new features before deploying
---

# Feature Development Workflow

## 1. Create a Feature Branch (optional)
```bash
git checkout -b feature/your-feature-name
```

## 2. Start the Dev Server
// turbo
```bash
npm run dev
```
Opens at `http://localhost:3000` with hot reload.

## 3. Develop Your Feature
- Edit files in `src/` - changes auto-refresh
- Check terminal for errors
- Test in browser as you go

## 4. Test Locally
- Open `http://localhost:3000`
- Test all flows related to your feature
- Check browser console for JS errors
- Check terminal for server errors

## 5. Run TypeScript Check
// turbo
```bash
npx tsc --noEmit
```

## 6. Build Test (ensures it works on Vercel)
// turbo
```bash
npm run build
```

## 7. Commit & Push
```bash
git add -A
git commit -m "feat: description of your feature"
git push
```

## 8. Deploy
- Vercel auto-deploys on push (if connected)
- Or trigger manually from Vercel dashboard

---

## Quick Commands

| Action | Command |
|--------|---------|
| Start dev server | `npm run dev` |
| Type check | `npx tsc --noEmit` |
| Production build | `npm run build` |
| Commit & push | `git add -A; git commit -m "message"; git push` |
