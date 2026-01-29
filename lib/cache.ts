import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const AI_CACHE_FILE = path.join(CACHE_DIR, 'ai-explanations.json');

// Ensure cache directory exists
function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

// Read cache file
function readCache(): Record<string, any> {
    try {
        ensureCacheDir();
        if (fs.existsSync(AI_CACHE_FILE)) {
            const data = fs.readFileSync(AI_CACHE_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading cache:', error);
    }
    return {};
}

// Write to cache file
function writeCache(cache: Record<string, any>) {
    try {
        ensureCacheDir();
        fs.writeFileSync(AI_CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (error) {
        console.error('Error writing cache:', error);
    }
}

// Generate cache key from error details
export function generateCacheKey(errorDetails: {
    title: string;
    culprit: string;
    metadata: any;
}): string {
    // Create a unique key based on error characteristics
    // Use more specific data to ensure cache hits for same errors
    const keyData = {
        title: errorDetails.title?.trim() || '',
        culprit: errorDetails.culprit?.trim() || '',
        // Include metadata to ensure uniqueness
        type: errorDetails.metadata?.type || '',
        value: String(errorDetails.metadata?.value || '').substring(0, 100), // Limit length
    };

    // Create a more stable hash-like key
    const keyString = JSON.stringify(keyData);
    return Buffer.from(keyString).toString('base64').substring(0, 64);
}

// Get cached AI explanation
export function getCachedExplanation(errorDetails: {
    title: string;
    culprit: string;
    metadata: any;
}): any | null {
    try {
        const cache = readCache();
        const key = generateCacheKey(errorDetails);

        console.log('🔍 Checking cache for key:', key.substring(0, 20) + '...');
        console.log('📋 Cache keys available:', Object.keys(cache).length);

        if (cache[key]) {
            const cachedItem = cache[key];
            // Check if cache is still valid (e.g., 7 days)
            const cacheAge = Date.now() - cachedItem.timestamp;
            const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

            if (cacheAge < MAX_AGE) {
                console.log('✅ Using cached AI explanation for key:', key.substring(0, 20) + '...');
                console.log('⏰ Cache age:', Math.round(cacheAge / 1000 / 60), 'minutes');
                return cachedItem.explanation;
            } else {
                console.log('⏰ Cache expired for key:', key.substring(0, 20) + '...');
                console.log('⏰ Cache age:', Math.round(cacheAge / 1000 / 60 / 60), 'hours');
            }
        } else {
            console.log('❌ No cache found for key:', key.substring(0, 20) + '...');
        }
    } catch (error) {
        console.error('❌ Error getting cached explanation:', error);
    }

    return null;
}

// Save AI explanation to cache
export function saveCachedExplanation(
    errorDetails: {
        title: string;
        culprit: string;
        metadata: any;
    },
    explanation: any
): void {
    try {
        const cache = readCache();
        const key = generateCacheKey(errorDetails);

        cache[key] = {
            explanation,
            timestamp: Date.now(),
            errorTitle: errorDetails.title,
        };

        writeCache(cache);
        console.log('💾 Saved AI explanation to cache for key:', key.substring(0, 20) + '...');
        console.log('📊 Total cached explanations:', Object.keys(cache).length);
    } catch (error) {
        console.error('❌ Error saving cached explanation:', error);
    }
}

// Clear old cache entries (optional cleanup)
export function cleanupCache(): void {
    try {
        const cache = readCache();
        const now = Date.now();
        const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

        let cleaned = false;
        Object.keys(cache).forEach(key => {
            const cacheAge = now - cache[key].timestamp;
            if (cacheAge >= MAX_AGE) {
                delete cache[key];
                cleaned = true;
            }
        });

        if (cleaned) {
            writeCache(cache);
            console.log('Cleaned up old cache entries');
        }
    } catch (error) {
        console.error('Error cleaning cache:', error);
    }
}
