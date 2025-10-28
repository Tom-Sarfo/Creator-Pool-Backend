# 🎥 Creator Pool

**Creator Pool** is a social prediction platform that turns YouTube video launches into interactive experiences.  
Fans predict how well upcoming creator videos will perform (e.g., *“Will this video hit 50K views in 24 hours?”*),  
and earn rewards when their predictions are accurate — while creators benefit from increased buzz, engagement, and visibility.

---

## 🚀 Tech Stack

### **Frontend**
- React Router 7  
- TypeScript  
- Tailwind CSS + shadcn/ui  
- Recharts (Analytics Visuals)
- Playwright (UI & e2e Testing)

### **Backend**
- NestJS (API Layer)  
- TypeORM (Database ORM)  
- PostgreSQL (Primary Database)  
- BullMQ / Redis (Background Jobs & AnalyticsWorker)  
- YouTube Data API + Social Blade API (Video Metrics & Insights)
- Sentry (Error Monitoring)

---

## 🧠 Core Concept

Creator Pool allows creators and fans to collaborate around upcoming YouTube videos.

- **Creators** launch pools for unlisted or upcoming videos.  
- **Fans (Predictors)** join the pools and predict measurable outcomes using **Yes/No** options.  
- **Dynamic Odds** adjust in real time based on total predictions per side.  
- **Rewards** are distributed automatically when a pool settles.  

---

## 🏗️ Features (MVP)

### 🎬 Creator
- Connect YouTube Channel  
- View auto-suggested pool questions (generated from past performance)
- Launch new prediction pools for unlisted or upcoming videos  
- Pledge % of AdSense revenue to attract more participants  
- Earn a small royalty from every settled pool on their video  

### 📊 Predictor
- Browse and join open pools  
- Predict outcomes and view real-time odds  
- Track engagement when video goes public  
- Earn proportional rewards based on correct predictions  

### ⚙️ System
- **AnalyticsWorker** (Background Job)
  - Fetches creator stats from Social Blade / YouTube  
  - Calculates average 24h, 48h, and 7-day performance metrics  
  - Generates suggested pool questions automatically  

- **Pool Lifecycle**
  - `Open` → accepting predictions  
  - `Awaiting Release` → staking closed, waiting for video to go public  
  - `Live Tracking` → engagement monitored in real-time  
  - `Closed` → tracking ended, evaluating outcomes  
  - `Settled` → rewards distributed  

---

## 🎨 Design

- **Primary Color:** Orange  
- **Secondary Color:** Cyan (Sky Blue)  
- Clean, mobile-first design with subtle motion  
- Fun and community-driven — *predict, don’t bet.*

---

## 🧪 Testing

All automated testing is done with **Playwright**:

- Unit Tests  
- e2e Tests (user flows)  
- Visual regression for pool states

Run tests:
```bash
npm test:e2e


Check out items in the plan as we accomplish them as a todo list. If you have open questions that require my input, add those in the plan as well