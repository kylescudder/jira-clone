# Jira clone with filters

_Automatically synced with your [v0.dev](https://v0.dev) deployments_

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/kyle-scudders-projects/v0-jira-clone-with-filters)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/vGmBW28Xmul)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/kyle-scudders-projects/v0-jira-clone-with-filters](https://vercel.com/kyle-scudders-projects/v0-jira-clone-with-filters)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/vGmBW28Xmul](https://v0.dev/chat/projects/vGmBW28Xmul)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

# Jira clone with filters

_Automatically synced with your [v0.dev](https://v0.dev) deployments_

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/kyle-scudders-projects/v0-jira-clone-with-filters)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/vGmBW28Xmul)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/kyle-scudders-projects/v0-jira-clone-with-filters](https://vercel.com/kyle-scudders-projects/v0-jira-clone-with-filters)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/vGmBW28Xmul](https://v0.dev/chat/projects/vGmBW28Xmul)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

---

## Jira Authentication (User OAuth 2.0 3LO)

This app now supports per-user Jira authentication using Atlassian OAuth 2.0 (3LO). In production, each user must connect their Jira account so the app can fetch their current user and data. For local development, the previous Basic auth (JIRA_EMAIL and JIRA_API_TOKEN) can still be used as a fallback.

### Setup

Add the following environment variables:

- ATLASSIAN_CLIENT_ID=
- ATLASSIAN_CLIENT_SECRET=
- ATLASSIAN_REDIRECT_URI= (e.g., https://your-app.com/api/auth/jira/callback)
- ATLASSIAN_SCOPES=read:jira-user read:jira-work offline_access (optional; default provided)
- JIRA_BASE_URL= (optional; used as fallback for Basic auth)
- JIRA_EMAIL= (optional; fallback only)
- JIRA_API_TOKEN= (optional; fallback only)

Register your OAuth app in https://developer.atlassian.com/ and configure the redirect URL to the value of ATLASSIAN_REDIRECT_URI.

### What values should ATLASSIAN_CLIENT_ID and ATLASSIAN_REDIRECT_URI be?

- ATLASSIAN_CLIENT_ID: The Client ID from your Atlassian OAuth 2.0 (3LO) app in the Atlassian Developer Console. You can find it by:
  - Visiting https://developer.atlassian.com/ → "Developer Console" → select your app → Overview → copy the "Client ID".
- ATLASSIAN_REDIRECT_URI: The full callback URL that Atlassian redirects to after login. It must exactly match one of the redirect URLs configured in your Atlassian app. For this project, the route is:
  - http(s)://YOUR_DOMAIN/api/auth/jira/callback

Examples:

- Local development:
  - ATLASSIAN_CLIENT_ID=YOUR_DEV_CONSOLE_CLIENT_ID
  - ATLASSIAN_REDIRECT_URI=http://localhost:3000/api/auth/jira/callback
- Production (e.g., Vercel):
  - ATLASSIAN_CLIENT_ID=YOUR_DEV_CONSOLE_CLIENT_ID
  - ATLASSIAN_REDIRECT_URI=https://your-deployed-domain.com/api/auth/jira/callback

Notes:

- The redirect URI must be registered in the Atlassian app settings, or login will fail.
- Scopes typically include: read:jira-user read:jira-work offline_access (already defaulted if ATLASSIAN_SCOPES is not set).
- Keep ATLASSIAN_CLIENT_SECRET safe; do not commit it. Configure it in your hosting provider’s environment variables.

### User Flow

- Start login: GET /api/auth/jira/login (redirects to Atlassian)
- Callback: /api/auth/jira/callback (sets HTTP-only cookies with token and cloudId)
- Logout: POST /api/auth/jira/logout

When a user is authenticated, server-side Jira calls use:

- Base URL: https://api.atlassian.com/ex/jira/{JIRA_CLOUD_ID}
- Header: Authorization: Bearer {JIRA_ACCESS_TOKEN}

If not authenticated, the app falls back to Basic auth using env variables (useful for development).
