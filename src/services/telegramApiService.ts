/**
 * Telegram Bot API direct connection helper
 * Allows user to test their live Bot Token and Worker Chat ID directly from the UI
 */

export interface TelegramTestResult {
  success: boolean;
  message: string;
  botDetails?: {
    id: number;
    username: string;
    first_name: string;
  };
}

export async function testTelegramBotToken(botToken: string): Promise<TelegramTestResult> {
  if (!botToken || !botToken.trim()) {
    return { success: false, message: 'Bot Token is required.' };
  }

  try {
    const cleanToken = botToken.trim();
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const data = await res.json();

    if (data.ok && data.result) {
      return {
        success: true,
        message: `Successfully connected to bot @${data.result.username} (${data.result.first_name})`,
        botDetails: {
          id: data.result.id,
          username: data.result.username,
          first_name: data.result.first_name,
        },
      };
    } else {
      return {
        success: false,
        message: data.description || 'Invalid Telegram Bot Token.',
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Network error connecting to Telegram: ${errorMsg}`,
    };
  }
}

export async function sendLiveTelegramWorkerAlert(
  botToken: string,
  chatId: string,
  htmlText: string
): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Bot Token or Chat ID not configured.' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: htmlText,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json();
    if (data.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.description || 'Telegram API returned error.' };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
