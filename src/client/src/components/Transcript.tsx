import { useEffect, useMemo, useRef } from "react";
import type { CodexTranscript } from "../types";
import { MessageBubble } from "./MessageBubble";
import { WorkBlock } from "./WorkBlock";

export function Transcript({
  transcript,
  onToggleWork
}: {
  transcript: CodexTranscript;
  onToggleWork: (workId: string, open: boolean) => void;
}) {
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const contentSignature = useMemo(() => transcriptContentSignature(transcript), [transcript]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
  }, [contentSignature]);

  return (
    <div className="messages" ref={messagesRef}>
      {transcript.length === 0 ? (
        <div className="empty">Start a new chat to see messages here.</div>
      ) : (
        transcript.map((entry) => {
          if (entry.type === "message") {
            return <MessageBubble key={entry.id} node={entry.message} />;
          }

          return (
            <div className="turn" key={entry.id}>
              <MessageBubble node={entry.userMessage} />
              {entry.workBlock && (
                <WorkBlock node={entry.workBlock} onToggle={(open) => onToggleWork(entry.workBlock!.id, open)} />
              )}
              {entry.assistantFinal && <MessageBubble node={entry.assistantFinal} />}
            </div>
          );
        })
      )}
    </div>
  );
}

function transcriptContentSignature(transcript: CodexTranscript) {
  return transcript
    .map((entry) => {
      if (entry.type === "message") {
        return ["message", entry.message.id, entry.message.role, entry.message.text.length].join(":");
      }

      const node = entry.workBlock;
      return [
        "turn",
        entry.id,
        entry.userMessage.text.length,
        entry.assistantFinal?.text.length ?? 0,
        node
          ? [
              "work",
              node.id,
              node.state,
              node.items
                .map((item) => {
                  if (item.type === "assistantNote") {
                    return ["note", item.id, item.text.length].join(":");
                  }
                  return [
                    "tool",
                    item.id,
                    item.activity.kind,
                    item.activity.title,
                    item.activity.detail ?? "",
                    item.activity.status ?? "",
                    item.activity.output?.length ?? 0,
                    item.activity.files?.length ?? 0
                  ].join(":");
                })
                .join("|")
            ].join(":")
          : ""
      ].join(":");
    })
    .join("\n");
}
