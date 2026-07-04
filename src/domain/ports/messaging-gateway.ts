/** Driven port for sending messages back to the user (Telegram today). */
export interface MessagingGatewayPort {
  sendMessage(chatId: string, text: string): Promise<void>;
}
