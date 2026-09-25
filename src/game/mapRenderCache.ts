export function runMapCacheOperation(
  operation: () => void,
  fallback: () => void,
): boolean {
  try {
    operation();
    return true;
  } catch {
    fallback();
    return false;
  }
}
