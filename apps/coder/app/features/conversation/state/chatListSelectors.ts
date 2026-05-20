import type { RootState } from "../../../store/configureStore";

export const selectUnreadThreadIds = (state: RootState) => state.chatListMeta.unreadThreadIds;
export const selectHydratingThreadIds = (state: RootState) => state.chatListMeta.hydratingThreadIds;
