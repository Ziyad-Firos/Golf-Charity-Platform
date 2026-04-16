# EMERGENCY 2-MINUTE VERCEL FIX

## STEP 1: DELETE OLD PROJECT
1. Go to https://vercel.com/dashboard
2. Find "golf-charity-platform-client-h8bwqk0is"
3. Click "..." → "Delete Project"
4. Confirm deletion

## STEP 2: CREATE NEW PROJECT
1. Click "Add New" → "Project"
2. Import Git Repository
3. Select: Ziyad-Firos/Golf-Charity-Platform
4. Framework: "Other"
5. Build Command: "cd server && npm install && npm run build"
6. Output Directory: "server/dist"
7. Root Directory: "/"
8. Click "Deploy"

## STEP 3: SET ENVIRONMENT VARIABLES
1. Project Settings → Environment Variables
2. Add:
   - DATABASE_URL=postgresql://...
   - JWT_SECRET=your-secret
   - JWT_REFRESH_SECRET=your-refresh-secret
   - NODE_ENV=production

RESULT: Fresh deployment with latest code!
