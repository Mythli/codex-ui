type AutoSelectFirstChatInput = {
  activeChatId?: string;
  firstChatId?: string;
  firstChatProjectId?: string;
  isDraftChat?: boolean;
  isRunning: boolean;
};

export function shouldAutoSelectFirstChat(input: AutoSelectFirstChatInput): boolean {
  return !input.activeChatId &&
    !input.isDraftChat &&
    !input.isRunning &&
    Boolean(input.firstChatId) &&
    Boolean(input.firstChatProjectId);
}
