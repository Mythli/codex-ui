export type AutoSelectFirstChatInput = {
  activeChatId?: string;
  firstChatId?: string;
  firstChatProjectId?: string;
  isDraftChat?: boolean;
  isRunning: boolean;
};

export type HydrateActiveChatInput = {
  activeChatId?: string;
  isDraftChat?: boolean;
  isHydratingThread?: boolean;
  isRunning: boolean;
  shouldLoadThread: boolean;
};

export function shouldAutoSelectFirstChat(input: AutoSelectFirstChatInput): boolean {
  return !input.activeChatId &&
    !input.isDraftChat &&
    !input.isRunning &&
    Boolean(input.firstChatId) &&
    Boolean(input.firstChatProjectId);
}

export function shouldHydrateActiveChat(input: HydrateActiveChatInput): boolean {
  if (!input.activeChatId || input.isDraftChat || input.isRunning) {
    return false;
  }
  if (input.isHydratingThread) {
    return false;
  }
  return input.shouldLoadThread;
}
