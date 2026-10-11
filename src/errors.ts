export class CosmosError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}, public exitCode = 2) { super(message); }
}
export function failure(error: unknown) {
  const e = error instanceof CosmosError ? error : new CosmosError('INTERNAL_ERROR', error instanceof Error ? error.message : String(error), {}, 4);
  return { ok: false, error: { code: e.code, message: e.message, details: e.details, recovery: { kind: e.code === 'RESULT_UNCERTAIN' ? 'verify' : 'correct', safeToRetry: e.exitCode < 4 } }, exitCode: e.exitCode };
}
