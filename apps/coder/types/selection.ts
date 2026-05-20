export type CoderSelection =
  | { kind: "none" }
  | { kind: "thread"; threadId: string; projectId: string }
  | { kind: "draft"; draftId: string; projectId: string };

export type CoderSelectionState = {
  current: CoderSelection;
  nextDraftId: number;
};
