/** A fulfillment error that retrying cannot fix (bad buyer input, unsafe URL). Logged and surfaced once. */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}
