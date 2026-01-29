# AI Error Explainer - Architecture

## 📁 Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── ai/explain/         # AI error explanation endpoint
│   │   ├── auth/[...nextauth]/ # NextAuth.js authentication
│   │   ├── linear/             # Linear integration
│   │   │   ├── forward/        # Forward AI explanations to Linear
│   │   │   └── issues/         # Fetch Linear issues
│   │   └── sentry/             # Sentry integration
│   │       └── errors/         # Fetch Sentry errors
│   ├── dashboard/              # Dashboard pages
│   │   └── errors/[id]/        # Error details page
│   ├── login/                  # Login page
│   └── providers.tsx           # Session provider wrapper
│
├── lib/
│   ├── hooks/                  # Reusable React hooks
│   │   ├── useSentryErrors.ts  # Hook for fetching Sentry errors
│   │   └── useLinearIssues.ts  # Hook for fetching Linear issues
│   │
│   ├── utils/                  # Utility functions
│   │   ├── fuzzy-match.ts      # Fuzzy string matching algorithm
│   │   ├── linear-matcher.ts   # Linear-Sentry matching logic
│   │   └── error-stats.ts      # Error statistics calculations
│   │
│   ├── cache.ts                # File-based cache for AI explanations
│   └── openai.ts               # OpenAI service for error explanations
│
├── types/
│   └── next-auth.d.ts          # NextAuth.js type definitions
│
├── auth.ts                     # NextAuth.js configuration
└── middleware.ts               # Route protection middleware
```

## 🔧 Core Components

### Custom Hooks

#### `useSentryErrors(isAuthenticated)`
- **Location**: `lib/hooks/useSentryErrors.ts`
- **Purpose**: Fetch Sentry errors with automatic caching and revalidation
- **Features**:
  - Auto-refresh every 60 seconds
  - SWR-based caching
  - Deduplication of requests

#### `useLinearIssues(isAuthenticated)`
- **Location**: `lib/hooks/useLinearIssues.ts`
- **Purpose**: Fetch Linear issues with automatic caching
- **Features**:
  - Auto-refresh every 2 minutes
  - SWR-based caching
  - Fetches from "Sortme" team's "Triage" state

### Utility Functions

#### Fuzzy Matching (`fuzzy-match.ts`)
- **`calculateSimilarity(str1, str2)`**: Returns similarity score (0-100) between two strings
- **Algorithm**:
  - Jaccard similarity (word intersection/union)
  - Substring matching
  - Returns maximum of both scores

#### Linear Matcher (`linear-matcher.ts`)
- **`matchLinearIssue(sentryError, linearIssues)`**: Matches Sentry error with Linear issues
- **Matching Strategy**:
  1. **Priority 1**: Sentry ID in Linear description/title (100% match)
  2. **Priority 2**: Sentry ID in Linear URL (100% match)
  3. **Priority 3**: Fuzzy title matching (≥70% threshold)
- **Returns**: Linear issue details or undefined

#### Error Stats (`error-stats.ts`)
- **`calculateErrorStats(errors)`**: Calculates dashboard statistics
  - Total errors (sum of all occurrences)
  - Error-level issues count
  - Warning-level issues count
  - Affected users count
  - Frontend/Backend error counts
- **`getLevelColor(level)`**: Returns Tailwind CSS classes for error level badges

### Services

#### OpenAI Service (`openai.ts`)
- **`explainError(errorDetails)`**: Generates human-friendly error explanations
- **Features**:
  - File-based caching (7-day TTL)
  - Structured JSON response
  - Fallback error handling
  - Comprehensive error analysis:
    - Overview
    - Detailed breakdown (what, where, why, when)
    - Severity and impact analysis
    - Error components
    - Possible causes with code references
    - Concrete solutions with priority/difficulty
    - Prevention tips

#### Cache Service (`cache.ts`)
- **Purpose**: Persistent file-based cache for AI explanations
- **Location**: `.cache/ai-explanations.json`
- **TTL**: 7 days
- **Functions**:
  - `getCachedExplanation(errorDetails)`
  - `saveCachedExplanation(errorDetails, explanation)`
  - `cleanupExpiredCache()`

## 🔄 Data Flow

### Dashboard Page Flow

```
User loads dashboard
    ↓
useSentryErrors hook → /api/sentry/errors → Sentry API
    ↓
useLinearIssues hook → /api/linear/issues → Linear GraphQL API
    ↓
matchLinearIssue() → Fuzzy matching algorithm
    ↓
calculateErrorStats() → Statistics calculation
    ↓
Render dashboard with matched data
```

### Error Details Flow

```
User clicks "View Details"
    ↓
/dashboard/errors/[id] page loads
    ↓
/api/sentry/errors/[id] → Sentry API (with fallback endpoints)
    ↓
matchLinearIssue() → Find corresponding Linear issue
    ↓
/api/ai/explain → Check cache → OpenAI API (if not cached)
    ↓
Render error details with AI explanation
```

### Forward to Linear Flow

```
User clicks "Forward to Linear"
    ↓
Clean AI explanation (remove React internals)
    ↓
/api/linear/forward → Linear GraphQL API
    ↓
Update Linear issue description and assignee
    ↓
Show success message
```

## 🎨 UI Architecture

### Design System
- **Theme**: Dark AI-powered theme
- **Colors**: Purple/Pink/Cyan gradient palette
- **Effects**:
  - Animated background orbs
  - Neural network pattern overlay
  - Glassmorphism with backdrop blur
  - Glowing shadows (box-shadow with color/opacity)
  - Gradient text with `bg-clip-text`

### Key UI Patterns
- **Loading States**: Spinning gradientbordered circle
- **Empty States**: Icon + message
- **Error States**: Red-tinted glass card with icon
- **Success States**: Green-tinted badges
- **Cards**: Dark glass with border and backdrop blur
- **Buttons**: Gradient background with hover effects
- **Badges**: Level-based colors with borders

## 📦 Key Dependencies

- **Next.js 16**: Framework
- **NextAuth.js v5**: Authentication
- **SWR**: Data fetching and caching
- **OpenAI SDK**: AI error explanations
- **Sentry API**: Error monitoring integration
- **Linear API**: Project management integration
- **Tailwind CSS**: Styling

## 🔐 Environment Variables

```env
# Authentication
NEXTAUTH_SECRET=your-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Sentry
SENTRY_AUTH_TOKEN=your-sentry-token
SENTRY_ORG=your-org-slug
SENTRY_FRONTEND_PROJECT=your-frontend-project-slug
SENTRY_BACKEND_PROJECT=your-backend-project-slug

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Linear
LINEAR_API_KEY=your-linear-api-key
```

## 🚀 Performance Optimizations

1. **Caching Strategy**:
   - Server-side: Next.js `revalidate` (60-120s)
   - Client-side: SWR with deduplication
   - AI explanations: File-based cache (7 days)

2. **Request Deduplication**:
   - SWR automatically dedupes parallel requests
   - 60s deduplication interval for Sentry
   - 120s deduplication interval for Linear

3. **Pagination**:
   - Dashboard shows 10 errors per page
   - Reduces initial render time

4. **Lazy Loading**:
   - AI explanations loaded after error details
   - Linear issues fetched in background

## 🧪 Testing Considerations

- **Fuzzy Matching**: Test with various title formats
- **Cache**: Verify 7-day expiration
- **API Fallbacks**: Test Sentry API endpoint fallbacks
- **Linear Matching**: Test with different Sentry-Linear correlations
- **Circular Reference**: Test AI explanation serialization

## 📝 Future Improvements

- [ ] Add unit tests for utility functions
- [ ] Implement error grouping/filtering
- [ ] Add real-time updates via WebSocket
- [ ] Support more Linear teams/states
- [ ] Add bulk operations (forward multiple errors)
- [ ] Implement user preferences/settings
- [ ] Add analytics dashboard
- [ ] Support additional error sources (Rollbar, Bugsnag, etc.)
