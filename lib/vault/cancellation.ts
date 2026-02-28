/**
 * A token for cooperative cancellation of async operations.
 *
 * Create one per cancellable operation. Pass it to async code which
 * checks `isCancelled` between steps. Call `cancel()` to signal stop.
 */
export class CancellationToken {
  private _cancelled = false;

  /** Signal cancellation. Idempotent. */
  cancel(): void {
    this._cancelled = true;
  }

  /** Whether cancellation has been requested. */
  get isCancelled(): boolean {
    return this._cancelled;
  }
}
