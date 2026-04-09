import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/**
 * Returns a singleton Anthropic client.
 * Reads ANTHROPIC_API_KEY from the environment at first call.
 */
export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local."
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
