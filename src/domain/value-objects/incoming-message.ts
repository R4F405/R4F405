/** A channel-agnostic inbound message (Telegram today, anything tomorrow). */
export interface IncomingMessage {
  /** Conversation the reply must be routed back to. */
  readonly chatId: string;
  /** Stable external identity of the sender (Telegram user id). */
  readonly telegramUserId: string;
  readonly displayName: string;
  readonly text: string;
  readonly receivedAt: Date;
}
