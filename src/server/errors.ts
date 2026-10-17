/** Thrown for anything the client did wrong; route handlers turn it into a 4xx. */
export class ClientError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
