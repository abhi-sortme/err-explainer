/**
 * Calculate similarity score between two strings using Jaccard similarity and substring matching
 * @param str1 First string to compare
 * @param str2 Second string to compare
 * @returns Similarity score from 0-100
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 100;

  // Tokenize into words (filter out short words like "in", "is", "a")
  const words1 = s1.split(/\s+/).filter(w => w.length > 2);
  const words2 = s2.split(/\s+/).filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  // Calculate Jaccard similarity (intersection over union)
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  const jaccardScore = (intersection.size / union.size) * 100;

  // Check for substring matches (one contains significant portion of the other)
  const longerLength = Math.max(s1.length, s2.length);
  const shorterLength = Math.min(s1.length, s2.length);
  let substringScore = 0;
  
  if (s1.includes(s2) || s2.includes(s1)) {
    substringScore = (shorterLength / longerLength) * 100;
  }

  // Take the maximum of Jaccard and substring scores
  return Math.max(jaccardScore, substringScore);
}
