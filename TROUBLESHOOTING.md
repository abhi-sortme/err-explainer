# Troubleshooting Sentry API 403 Forbidden Error

## Common Causes of 403 Forbidden

### 1. **Missing or Incorrect Token Scopes**

Your Sentry auth token must have the following scopes:
- ✅ `org:read` - Read organization data
- ✅ `project:read` - Read project data
- ✅ `event:read` - Read event/issue data (recommended)

**How to fix:**
1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. Delete your old token (if it exists)
3. Click "Create New Token"
4. Name it: "Error Explainer Dashboard"
5. **Check ALL these scopes:**
   - `org:read`
   - `project:read`
   - `event:read`
6. Click "Create Token"
7. Copy the token immediately
8. Update `SENTRY_AUTH_TOKEN` in your `.env.local`
9. Restart your dev server: `npm run dev`

### 2. **Incorrect Organization Slug**

The organization slug is case-sensitive and must match exactly.

**How to find it:**
1. Go to your Sentry dashboard: https://sentry.io/
2. Look at the URL: `https://sentry.io/organizations/[YOUR-ORG-SLUG]/`
3. Copy the slug exactly as it appears (case-sensitive)
4. Update `SENTRY_ORG` in your `.env.local`

**Example:**
- URL: `https://sentry.io/organizations/my-company/`
- Slug: `my-company` ✅
- NOT: `My-Company` ❌ or `MY-COMPANY` ❌

### 3. **Incorrect Project Slug**

The project slug is also case-sensitive.

**How to find it:**
1. Go to your project in Sentry
2. Look at the URL: `https://sentry.io/organizations/[ORG]/projects/[PROJECT-SLUG]/`
3. Copy the project slug exactly as it appears
4. Update `SENTRY_PROJECT` in your `.env.local`

**Example:**
- URL: `https://sentry.io/organizations/my-company/projects/my-app/`
- Project: `my-app` ✅
- NOT: `My-App` ❌

### 4. **Token Format Issues**

Make sure your token doesn't have extra spaces or quotes.

**Correct format in .env.local:**
```env
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Wrong formats:**
```env
SENTRY_AUTH_TOKEN="sntrys_xxx"  ❌ (no quotes)
SENTRY_AUTH_TOKEN= sntrys_xxx   ❌ (no leading space)
SENTRY_AUTH_TOKEN=sntrys_xxx    ❌ (trailing space)
```

### 5. **Account Access Issues**

Your Sentry account must have access to the organization and project.

**How to verify:**
1. Log into Sentry: https://sentry.io/
2. Check if you can see the organization
3. Check if you can see the project
4. If not, ask your organization admin to grant you access

### 6. **Token Expired or Revoked**

If you've regenerated or deleted the token, you need to update it.

**How to check:**
1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. See if your token is still listed
3. If not, create a new one and update `.env.local`

## Step-by-Step Debugging

### Step 1: Verify Your .env.local File

Make sure your `.env.local` file looks like this (no quotes, no spaces):

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

### Step 2: Test Your Token Manually

You can test your token using curl:

```bash
curl -H "Authorization: Bearer YOUR_SENTRY_AUTH_TOKEN" \
  https://sentry.io/api/0/organizations/YOUR_ORG_SLUG/
```

If this returns 403, your token or org slug is wrong.
If this returns 200, your token works, but the project slug might be wrong.

### Step 3: Check Server Logs

Look at your terminal where `npm run dev` is running. You should see detailed error messages that will help identify the issue.

### Step 4: Verify in Browser Console

1. Open your dashboard: http://localhost:3000/dashboard
2. Open browser DevTools (F12)
3. Go to "Network" tab
4. Click "Refresh" on the dashboard
5. Look for the `/api/sentry/errors` request
6. Check the response for detailed error messages

## Quick Checklist

Before asking for help, verify:

- [ ] Token has `org:read` scope
- [ ] Token has `project:read` scope
- [ ] Token has `event:read` scope (recommended)
- [ ] Organization slug matches exactly (case-sensitive)
- [ ] Project slug matches exactly (case-sensitive)
- [ ] No quotes around values in `.env.local`
- [ ] No extra spaces in `.env.local`
- [ ] Restarted dev server after changing `.env.local`
- [ ] Account has access to the organization
- [ ] Account has access to the project

## Still Having Issues?

If you've checked everything above and still get 403:

1. **Create a fresh token** with all required scopes
2. **Double-check your slugs** by copying them directly from Sentry URLs
3. **Test the token** using the curl command above
4. **Check the error message** in the dashboard - it now shows detailed information

The improved error messages will tell you exactly what's wrong!
