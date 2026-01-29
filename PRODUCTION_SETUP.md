# Production Setup Guide

## Fixing Google OAuth Redirect URI Mismatch Error

If you're seeing the error: **"Error 400: redirect_uri_mismatch"** in production, follow these steps:

### Step 1: Find Your Production Domain

Determine your production URL. Examples:
- Vercel: `https://your-app-name.vercel.app`
- Custom domain: `https://yourdomain.com`
- Other hosting: Check your deployment platform

### Step 2: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID (the one you're using)
5. Under **Authorized redirect URIs**, add:
   ```
   https://your-production-domain.com/api/auth/callback/google
   ```
   Replace `your-production-domain.com` with your actual domain.

6. Under **Authorized JavaScript origins**, add:
   ```
   https://your-production-domain.com
   ```
   (No trailing slash, no `/api/auth/callback/google`)

7. Click **Save**

### Step 3: Verify Environment Variables

Make sure your production environment has these variables set:

```env
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

**Important**: 
- `NEXTAUTH_URL` must match your production domain exactly (with `https://`)
- The redirect URI in Google Console must match: `{NEXTAUTH_URL}/api/auth/callback/google`

### Step 4: Wait for Changes to Propagate

Google OAuth changes can take a few minutes to propagate. Wait 2-5 minutes after saving before testing.

### Step 5: Test Again

1. Clear your browser cache or use incognito mode
2. Try logging in again
3. The redirect URI should now match

## Common Mistakes to Avoid

1. ❌ **Wrong protocol**: Using `http://` instead of `https://` in production
2. ❌ **Trailing slash**: Adding `/` at the end of the redirect URI
3. ❌ **Wrong path**: Using `/api/auth/callback` instead of `/api/auth/callback/google`
4. ❌ **Missing NEXTAUTH_URL**: Not setting `NEXTAUTH_URL` in production environment
5. ❌ **Case sensitivity**: Domain must match exactly (case-sensitive)

## Example Configuration

### For Vercel Deployment:
```
Authorized redirect URIs:
- http://localhost:3000/api/auth/callback/google
- https://your-app.vercel.app/api/auth/callback/google

Authorized JavaScript origins:
- http://localhost:3000
- https://your-app.vercel.app

Environment Variables:
NEXTAUTH_URL=https://your-app.vercel.app
```

### For Custom Domain:
```
Authorized redirect URIs:
- http://localhost:3000/api/auth/callback/google
- https://yourdomain.com/api/auth/callback/google

Authorized JavaScript origins:
- http://localhost:3000
- https://yourdomain.com

Environment Variables:
NEXTAUTH_URL=https://yourdomain.com
```

## Still Having Issues?

1. **Check the exact error**: Look at the error details in the Google OAuth error page
2. **Verify the redirect URI**: The error message will show what redirect URI was attempted
3. **Check environment variables**: Ensure `NEXTAUTH_URL` is set correctly in your hosting platform
4. **Check NextAuth version**: Make sure you're using NextAuth.js v5 (beta) which uses `/api/auth/callback/[provider]` format

## Quick Checklist

- [ ] Added production redirect URI to Google Cloud Console
- [ ] Added production JavaScript origin to Google Cloud Console
- [ ] Set `NEXTAUTH_URL` environment variable in production
- [ ] Set `NEXTAUTH_SECRET` environment variable in production
- [ ] Set `GOOGLE_CLIENT_ID` environment variable in production
- [ ] Set `GOOGLE_CLIENT_SECRET` environment variable in production
- [ ] Waited 2-5 minutes for changes to propagate
- [ ] Tested in incognito mode
