Product Description

Creator Pool is a social prediction platform that allows fans to engage with their favorite YouTube creators by predicting how their upcoming videos will perform — such as reaching a specific view milestone or engagement level within a time frame.
Predictors join pools, make predictions, and earn rewards based on accurate outcomes, while creators can pledge part of their AdSense revenue to attract participation and buzz around their content.

The platform promotes fun, community-driven interaction, not betting — it’s about participation, engagement, and creator support.

Problem

Creators struggle to consistently engage audiences around new video releases.
Fans consume content passively, without deeper involvement or incentives.
Creator Pool transforms passive viewing into an interactive experience that builds hype and loyalty before a video even drops.

Project Overview
Summary

Creator Pool enables YouTube creators to launch “prediction pools” for upcoming videos. Fans predict measurable outcomes (e.g., “Will this video hit 50K views in 24 hours?”). Once the video is live, engagement metrics are tracked automatically.

Predictors earn rewards for accurate predictions, and creators benefit from increased anticipation and engagement around their videos.

Goals

Boost creator–fan interaction and anticipation for new content

Allow creators to pledge small AdSense revenue percentages as incentives

Reward predictors for participation and engagement accuracy

Position the app as a creator engagement hub, not a betting platform

Target Demographic

Creators: YouTubers with consistent uploads and fan communities

Predictors: YouTube fans, digital communities, and social entertainment enthusiasts

Features
Core MVP Features

Creator Pools: Creators launch pools tied to upcoming or unlisted videos

Predictions: Fans predict measurable outcomes using “Yes” or “No” logic

Dynamic Odds: Odds adjust dynamically based on pool participation to reflect sentiment

Pool States:

Open – Accepting predictions

Awaiting Release – Locked, waiting for the video to go public

Live Tracking – Monitoring real-time engagement once live

Closed – Tracking period ended; system evaluating results

Settled – Final results, winners rewarded

Payouts: Distributed automatically when pools settle

Creator Rewards: Creators can pledge a small portion of AdSense revenue (e.g., 5–15%) to attract participants

Performance Summaries: Visual insights for both creators and predictors

🔍 Auto Question Generation (New Update)
Purpose

To automatically generate prediction questions for upcoming creator pools using historical YouTube performance data — reducing manual setup and improving relevance.

Implementation

Data Source: Third-party APIs (e.g., Social Blade, Noxinfluencer)

Logic:

Fetch last 10–20 videos’ metrics: views after 24h, 48h, and 7 days.

Compute averages:

avg24hViews

avg48hViews

avg7dViews

Generate suggested pool questions:

“Will this video reach {avg24hViews} views in the first 24 hours?”

“Will this video outperform the creator’s 7-day average of {avg7dViews} views?”

“Will this video double its previous upload’s engagement rate?”

Present to creators during pool setup for quick selection.

Technical Overview

A background worker (AnalyticsWorker) fetches data periodically or on-demand.

Data stored as creatorStats for quick reuse.

Uses averages until YouTube authentication unlocks detailed Analytics API data.

Future Enhancements

Integrate YouTube Analytics API for real-time, authenticated data.

Allow ML-based suggestions using embedding similarity from previous high-performing videos.

Tax & Compliance

No betting or gambling terms used; platform framed as “interactive prediction.”

Rewards tied to participation and engagement, not financial speculation.

Small, capped monetary rewards or token-based incentives for fairness and compliance.

Design Goals

Clean, creator-centric aesthetic (Primary: Orange, Secondary: Cyan)

Mobile-first design using React Router 7 + shadcn/ui

Playful, energetic, and community-driven look

Smooth animations and micro-interactions to mimic social app fluidity

Logged-Out Home Page (LOHP)

Overview of trending pools

Showcase of top creators and popular predictions

“How It Works” explainer animation

CTA: “Join the Community” → leads to sign-up flow

User Authentication

Email & social login

Phone verification for rewards access

Onboarding flow introduces prediction concepts and community guidelines

Logged-In Home Page (LIHP)

Feed of active and upcoming pools

Quick filter by “Open,” “Awaiting Release,” or “Settled”

Personalized recommendations (based on past interactions or creators followed)

Feature Descriptions/Pages
For Predictors

View upcoming and active pools

Predict outcomes (Yes/No)

See dynamic odds and potential payouts (capped at poolTotal * 0.8)

Track live video stats

Earn rewards after settlements

For Creators

Launch new pools (manual or suggested questions)

View real-time participation and buzz metrics

Receive engagement insights post-settlement

Gain recognition badges (e.g., “Top Creator Pool”)

AnalyticsWorker

Fetches creator stats from Social Blade or similar APIs

Calculates performance averages (24h, 48h, 7d)

Generates JSON summaries for auto-suggested questions

Runs in background periodically

Future Enhancements

Verified creator integration (via YouTube OAuth)

AI-generated prediction question templates using embeddings

Multi-platform integration (Spotify, TikTok, Instagram)

Ranking system for top predictors and creators

Gamified rewards (badges, tokens, levels)


Note: Focus on MVP features for now
Check out items in the plan as we accomplish them as a todo list. If you have open questions that require my input, add those in the plan as well