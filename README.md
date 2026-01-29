# Error Explainer - Sentry Dashboard

A Next.js dashboard application for viewing Sentry errors with Google OAuth authentication.

## Features

- 🔐 Google OAuth authentication using NextAuth.js
- 📊 Dashboard displaying Sentry errors
- 🎨 Modern UI with Tailwind CSS
- 🔒 Protected routes with middleware

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Google Cloud project with OAuth credentials
- A Sentry account with API access

### Installation

1. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Create a `.env.local` file in the root directory with the following variables:

```env
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here-generate-with-openssl-rand-base64-32

# Google OAuth Credentials
# Get these from https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Sentry API Configuration
# Get your auth token from https://sentry.io/settings/account/api/auth-tokens/
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ORG=your-sentry-organization-slug
SENTRY_PROJECT=your-sentry-project-slug
```

### Setting up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set authorized redirect URIs to: `http://localhost:3000/api/auth/callback/google`
6. Copy the Client ID and Client Secret to your `.env.local` file

### Setting up Sentry API

1. Go to [Sentry Settings](https://sentry.io/settings/account/api/auth-tokens/)
2. Create a new auth token with `project:read` and `org:read` scopes
3. Copy the token to `SENTRY_AUTH_TOKEN` in your `.env.local` file
4. Find your organization slug (visible in your Sentry URL: `sentry.io/organizations/[org-slug]/`)
5. Find your project slug (visible in your Sentry URL: `sentry.io/organizations/[org-slug]/projects/[project-slug]/`)

### Generate NextAuth Secret

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output to `NEXTAUTH_SECRET` in your `.env.local` file.

### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

- `app/login/` - Login page with Google OAuth
- `app/dashboard/` - Main dashboard displaying Sentry errors
- `app/api/auth/[...nextauth]/` - NextAuth.js API route handler
- `app/api/sentry/errors/` - API route for fetching Sentry errors
- `middleware.ts` - Route protection middleware

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Sentry API Documentation](https://docs.sentry.io/api/)
