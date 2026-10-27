"use client";

import { useEffect, useState } from "react";

const PROMPT = "Write a short story about a robot that discovers emotions";
const MODEL = "openai/gpt-oss-120b";

type PuterChatPart = { text?: string };
type PuterGlobal = {
  ai: {
    chat: (
      prompt: string,
      options: { model: string; stream: true }
    ) => Promise<AsyncIterable<PuterChatPart>>;
  };
};

function readPuter(): PuterGlobal | null {
  const candidate = (window as Window & { puter?: PuterGlobal }).puter;
  if (!candidate?.ai?.chat) return null;
  return candidate;
}

export default function PuterChat() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Waiting for Puter…");

  useEffect(() => {
    let cancelled = false;

    async function streamResponse() {
      let puter = readPuter();
      for (let attempt = 0; !puter && attempt < 50; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        puter = readPuter();
      }
      if (!puter) {
        if (!cancelled) setStatus("Puter did not load.");
        return;
      }
      if (cancelled) return;
      setStatus(`Streaming ${MODEL}`);
      try {
        const response = await puter.ai.chat(PROMPT, { model: MODEL, stream: true });
        for await (const part of response) {
          if (cancelled) return;
          if (part?.text) setText((current) => current + part.text);
        }
        if (!cancelled) setStatus("Done");
      } catch (err) {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Puter request failed");
      }
    }

    void streamResponse();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-8">
      <p className="text-sm text-zinc-400">{status}</p>
      <p className="mt-2 text-sm text-zinc-500">{PROMPT}</p>
      <div className="mt-4 min-h-40 whitespace-pre-wrap rounded-2xl border border-white/10 p-5 text-base leading-relaxed text-zinc-100">
        {text}
      </div>
    </section>
  );
}
