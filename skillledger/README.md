# SkillLedger - Dynamic & Verifiable Human Skill Graph System

A production-ready web platform for building real, verifiable skill graphs beyond degrees and resumes.

## Features

### For Students
- Create and manage skill profiles with proficiency levels
- Attempt micro skill challenges to verify skills
- Earn peer endorsements with weighted scoring
- View skill credibility scores
- Interactive skill graph visualization

### For Recruiters
- Search candidates by skill combinations
- Filter by credibility score
- View detailed candidate skill graphs
- Export structured skill reports

### For Admins
- Manage users and roles
- Create and manage skill challenges
- View platform analytics

## Tech Stack

- **Frontend**: React (Next.js), Tailwind CSS, D3.js/Recharts
- **Backend**: Node.js + Express
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT-based
- **Graph Visualization**: D3.js

## Project Structure

```
skillledger/
├── backend/
│   ├── config/          # Database configuration
│   ├── controllers/     # Route controllers
│   ├── middleware/     # Auth, error handling
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API routes
│   ├── utils/          # Utility functions (skill scoring)
│   ├── server.js       # Entry point
│   └── package.json
├── frontend/
│   ├── components/     # React components
│   ├── pages/         # Next.js pages
│   ├── context/        # React context
│   ├── styles/        # CSS styles
│   └── package.json
└── docs/               # Documentation
```

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB (local or Atlas)

### Backend Setup

```
bash
cd skillledger/backend
npm install
```

Create `.env` file in backend directory:
```
env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/skillledger
JWT_SECRET=your-secret-key
JWT_EXPIRE=30d
NODE_ENV=development
```

Start the server:
```
bash
npm run dev
```

### Frontend Setup

```
bash
cd skillledger/frontend
npm install
```

Create `.env.local` file in frontend directory:
```
env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Start the development server:
```
bash
npm run dev
```

### Default Users (Seed Data)

After running the backend, you can seed the database with test data:

```
bash
cd skillledger/backend
node utils/seed.js
```

Test accounts:
- **Student**: student@demo.com / password123
- **Recruiter**: recruiter@demo.com / password123
- **Admin**: admin@demo.com / password123

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/skills` - Add skill
- `PUT /api/users/skills/:skillId` - Update skill
- `DELETE /api/users/skills/:skillId` - Remove skill
- `GET /api/users/credibility` - Get credibility breakdown

### Challenges
- `GET /api/challenges` - List challenges
- `GET /api/challenges/:id` - Get challenge details
- `POST /api/challenges/:id/submit` - Submit challenge

### Recruiters
- `GET /api/recruiters/search` - Search candidates
- `GET /api/recruiters/users/:id` - View candidate
- `POST /api/recruiters/export` - Export candidates

### Endorsements
- `POST /api/endorsements` - Give endorsement
- `GET /api/endorsements/received` - Get received endorsements

## Skill Scoring Algorithm

The credibility score is calculated using a weighted formula:

```
Total Score = (Challenge Score × 0.4) + (Endorsement Score × 0.35) + (Proficiency Score × 0.25) × Decay Factor
```

- **Challenge Score (40%)**: Based on challenge completions, scores, difficulty, and recency
- **Endorsement Score (35%)**: Based on endorsement levels, endorser credibility, and count
- **Proficiency Score (25%)**: Based on self-reported proficiency and experience
- **Time Decay**: Skills decay over time if not updated (starts after 90 days)

## Deployment Instructions

### Frontend Deployment (Next.js)
The frontend is configured for static export and can be deployed to any static hosting platform.

1. **Build the frontend for static export:**

```
   cd skillledger/frontend
   npm run build
```

   This creates an `out` folder with static HTML, CSS, and JS files.

2. **Deploy to Vercel (recommended):**
   - Connect your GitHub repo to Vercel
   - Set the root directory to `skillledger/frontend`
   - Add environment variables in Vercel dashboard:
     
```
     NEXT_PUBLIC_API_URL=https://your-backend-url.com/api
     
```
   - Vercel will automatically detect Next.js and build it

3. **Deploy to Netlify:**
   - Set build command: `npm run build`
   - Publish directory: `out` (not `.next`)
   - Add environment variables in Netlify dashboard

4. **Deploy to any static hosting (GitHub Pages, Firebase, etc.):**
   - Upload the contents of the `out` folder to your hosting provider
   - Make sure to set the `NEXT_PUBLIC_API_URL` environment variable during build

### Backend Deployment
The backend is a Node.js/Express API that can be deployed to Heroku, Railway, Render, or any Node.js hosting.

1. **For Heroku:**
   - Create a Heroku app
   - Set environment variables in Heroku dashboard
   - Deploy from GitHub or using Heroku CLI

2. **For Railway:**
   - Connect GitHub repo
   - Set root directory to `skillledger/backend`
   - Add environment variables

3. **For Render:**
   - Create a Web Service
   - Connect GitHub repo
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Add environment variables

### Environment Variables
Make sure to set these environment variables in your deployment platform:

**Backend:**
- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - A secure random string
- `JWT_EXPIRE` - Token expiration (e.g., 30d)
- `NODE_ENV` - production

**Frontend:**
- `NEXT_PUBLIC_API_URL` - URL of your deployed backend API

## License

MIT
