# Setup Guide - Getting Your Credentials

## 1. NEXTAUTH_SECRET

This is a secret key used to encrypt session tokens. You can generate it using:

### Option 1: Using OpenSSL (Recommended)
```bash
openssl rand -base64 32
```

Copy the output and use it as your `NEXTAUTH_SECRET`.

### Option 2: Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Option 3: Online Generator
Visit: https://generate-secret.vercel.app/32
- Click "Generate" and copy the secret

---

## 2. GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

These are Google OAuth credentials. Follow these steps:

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account

### Step 2: Create a New Project (or select existing)
1. Click the project dropdown at the top
2. Click "New Project"
3. Enter a project name (e.g., "Error Explainer")
4. Click "Create"

### Step 3: Enable Google+ API
1. Go to "APIs & Services" → "Library"
2. Search for "Google+ API" or "Google Identity"
3. Click on it and press "Enable"

### Step 4: Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" (unless you have a Google Workspace)
   - Fill in:
     - App name: "Error Explainer"
     - User support email: Your email
     - Developer contact: Your email
   - Click "Save and Continue"
   - Add scopes: `email`, `profile`, `openid`
   - Click "Save and Continue"
   - Add test users (your email) if needed
   - Click "Save and Continue"

### Step 5: Create OAuth 2.0 Client ID
1. Application type: Select "Web application"
2. Name: "Error Explainer Web Client"
3. Authorized JavaScript origins:
   - Add: `http://localhost:3000`
   - Add: `http://localhost:3000/api/auth/callback/google` (if needed)
4. Authorized redirect URIs:
   - Add: `http://localhost:3000/api/auth/callback/google`
   - For production, add: `https://yourdomain.com/api/auth/callback/google`
5. Click "Create"

### Step 6: Copy Your Credentials
- **Client ID**: Copy this to `GOOGLE_CLIENT_ID`
- **Client secret**: Copy this to `GOOGLE_CLIENT_SECRET`

⚠️ **Important**: Keep your Client Secret secure and never commit it to version control!

---

## 3. SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT

### Step 1: Get Sentry Auth Token
1. Visit: https://sentry.io/settings/account/api/auth-tokens/
2. Click "Create New Token"
3. Fill in:
   - Name: "Error Explainer Dashboard"
   - Scopes: Select:
     - `org:read` - Read organization data
     - `project:read` - Read project data
     - `event:read` - Read event data (optional, for more details)
4. Click "Create Token"
5. **Copy the token immediately** - you won't be able to see it again!
6. Paste it as `SENTRY_AUTH_TOKEN`

### Step 2: Find Your Organization Slug
1. Go to your Sentry dashboard: https://sentry.io/
2. Look at the URL: `https://sentry.io/organizations/[YOUR-ORG-SLUG]/`
3. Copy `[YOUR-ORG-SLUG]` and use it as `SENTRY_ORG`

### Step 3: Find Your Project Slug
1. Go to your project in Sentry
2. Look at the URL: `https://sentry.io/organizations/[ORG]/projects/[PROJECT-SLUG]/`
3. Copy `[PROJECT-SLUG]` and use it as `SENTRY_PROJECT`

---

## Complete .env.local Example

Create a file named `.env.local` in the root of your project:

```env
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=paste-your-generated-secret-here

# Google OAuth Credentials
GOOGLE_CLIENT_ID=paste-your-google-client-id-here
GOOGLE_CLIENT_SECRET=paste-your-google-client-secret-here

# Sentry API Configuration
SENTRY_AUTH_TOKEN=paste-your-sentry-auth-token-here
SENTRY_ORG=paste-your-sentry-org-slug-here
# For multiple projects (Frontend + Backend):
SENTRY_FRONTEND_PROJECT=paste-your-frontend-project-slug-here
SENTRY_BACKEND_PROJECT=paste-your-backend-project-slug-here
# Or use single project (legacy):
# SENTRY_PROJECT=paste-your-sentry-project-slug-here

# OpenAI API Configuration (for AI Error Explanations)
OPENAI_API_KEY=paste-your-openai-api-key-here
```

---

## 4. OPENAI_API_KEY

This is used to generate AI-powered, human-friendly explanations of errors.

### Step 1: Get OpenAI API Key
1. Visit: https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Give it a name (e.g., "Error Explainer")
5. Copy the key immediately - you won't be able to see it again!
6. Paste it as `OPENAI_API_KEY` in your `.env.local` file

### Step 2: Add Credits (if needed)
- OpenAI requires credits to use their API
- Go to: https://platform.openai.com/account/billing
- Add payment method and credits if needed
- The app uses `gpt-4o-mini` which is cost-effective

---

## Quick Links Summary

- **Generate NEXTAUTH_SECRET**: Run `openssl rand -base64 32`
- **Google Cloud Console**: https://console.cloud.google.com/
- **Sentry Auth Tokens**: https://sentry.io/settings/account/api/auth-tokens/
- **Sentry Dashboard**: https://sentry.io/
- **OpenAI API Keys**: https://platform.openai.com/api-keys

---

## Troubleshooting

### Google OAuth Issues
- Make sure redirect URI matches exactly: `http://localhost:3000/api/auth/callback/google`
- Ensure Google+ API is enabled
- Check that OAuth consent screen is configured

### Sentry API Issues
- Verify your auth token has the correct scopes
- Check that org and project slugs are correct (case-sensitive)
- Ensure your Sentry account has access to the organization/project

### Linear API Issues
- Get your API key from https://linear.app/settings/api
- Ensure the Linear issue ID is stored in Sentry tags (typically as a tag with key containing "linear")
- The system will automatically extract Linear issue identifiers (e.g., "ABC-123") from Sentry tags
