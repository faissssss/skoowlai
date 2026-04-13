# How to Fix OneDrive Space Issues for this Project

Your `node_modules` folder contains thousands of small files that can fill up your OneDrive storage and slow down syncing. The best solution is to move your development projects to a folder that OneDrive does not sync.

## Step 1: Stop all running servers
1. Go to your terminal in VS Code.
2. Press `Ctrl + C` ensuring the dev server ("npm run dev") is stopped.
3. Close VS Code.

## Step 2: Move the project
1. Open File Explorer.
2. Navigate to `C:\Users\User\OneDrive\2024\antigravity\studybuddy`.
3. Cut the `studybuddy` folder (`Ctrl + X`).
4. Navigate to a local drive location, for example `C:\`.
5. Create a new folder named `Projects` if it doesn't exist (so you have `C:\Projects`).
6. Paste the `studybuddy` folder inside `C:\Projects` (`Ctrl + V`).

**New Path:** `C:\Projects\studybuddy`

## Step 3: Re-open in VS Code
1. Open VS Code.
2. Go to **File > Open Folder...**
3. Select `C:\Projects\studybuddy`.

## Step 4: Verify
1. Open a new terminal in VS Code.
2. Run `npm run dev`.
3. OneDrive should no longer try to sync these files of this project.

## (Optional) Quick Fix for existing OneDrive trash
If you have already deleted files but OneDrive is still full, check your OneDrive Recycle Bin online to permanently delete items.
