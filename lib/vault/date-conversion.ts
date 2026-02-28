/** Convert Unix timestamp (seconds since epoch) to Date */
export function unixToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}
