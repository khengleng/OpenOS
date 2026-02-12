# Project Nexus: The Personal OS (PWA)
**Domain:** cambobia.com  
**Infrastructure:** Railway  
**Timeline:** 8 Weeks (Accelerated MVP)

## 1. Executive Summary
Nexus is a "Lean Super App" designed as a Personal OS. It consolidates four fragmented daily needs—Planning (Utility), Spending (FinTech), Community (Hyper-Local), and Wellness (Health)—into a single, high-performance Progressive Web App (PWA).

## 2. Technical Stack
* **Framework:** Next.js 14+ (App Router)
* **Styling:** Tailwind CSS + shadcn/ui
* **Database/Backend:** Supabase (PostgreSQL)
* **Hosting:** Railway
* **PWA Engine:** `next-pwa`

## 3. 8-Week Accelerated Roadmap
* **Weeks 1-2:** Core Build (Auth + Dashboard shell)
* **Week 3:** Module 1: The Daily Pulse (Habits & Weather)
* **Week 4:** Module 2: The Flow (FinTech/Expense Logger)
* **Week 5:** Module 3: Vitality Sync (Health/Steps)
* **Week 6:** Module 4: The Mesh (Hyper-Local Bulletin)
* **Weeks 7-8:** Refinement, Push Notifications, & Store Submission.

## 4. NEXT STEPS (Immediate Execution)

### 4.1 Database Initialization
Run the following SQL in the Supabase SQL Editor to establish the foundational tables for all 4 modules:

```sql
-- Profiles (Core)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  avatar_url text,
  updated_at timestamp with time zone
);

-- Daily Pulse (Utility)
create table habits (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  streak_count int default 0,
  last_completed date
);

-- The Flow (FinTech)
create table expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  amount decimal not null,
  category text,
  created_at timestamp with time zone default now()
);

-- The Mesh (Local)
create table local_posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  content text,
  location_lat float,
  location_long float,
  post_type text check (post_type in ('borrow', 'lend', 'alert'))
);