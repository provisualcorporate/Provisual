import { useEffect, useRef, useState } from "react";

const PUNCTUATION_COLOR = "#c958a8";
const PUNCTUATION_PATTERN = /[,.;:!?…—–\-'"“”«»()[\]{}]/;

type TypewriterTitleProps = {
  text: string;
  className?: string;
  speedMs?: number;
  deleteSpeedMs?: number;
};

function renderTypewriterText(value: string) {
  return value.split("").map((char, index) =>
    PUNCTUATION_PATTERN.test(char) ? (
      <span key={`${index}-${char}`} style={{ color: PUNCTUATION_COLOR }}>
        {char}
      </span>
    ) : (
      <span key={`${index}-${char}`}>{char}</span>
    ),
  );
}

export default function TypewriterTitle({
  text,
  className,
  speedMs = 90,
  deleteSpeedMs = 14,
}: TypewriterTitleProps) {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [cursorLit, setCursorLit] = useState(true);
  const [typingComplete, setTypingComplete] = useState(false);
  const displayedRef = useRef("");

  const updateDisplayed = (value: string) => {
    displayedRef.current = value;
    setDisplayed(value);
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const clearAll = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };

    const deleteChars = () =>
      new Promise<void>((resolve) => {
        if (displayedRef.current.length === 0) {
          resolve();
          return;
        }

        timer = setInterval(() => {
          if (cancelled) return;
          const next = displayedRef.current.slice(0, -1);
          updateDisplayed(next);
          if (next.length === 0) {
            clearAll();
            resolve();
          }
        }, deleteSpeedMs);
      });

    const typeChars = () =>
      new Promise<void>((resolve) => {
        let index = 0;
        updateDisplayed("");
        timer = setInterval(() => {
          if (cancelled) return;
          index += 1;
          updateDisplayed(text.slice(0, index));
          if (index >= text.length) {
            clearAll();
            resolve();
          }
        }, speedMs);
      });

    const run = async () => {
      clearAll();
      setShowCursor(true);
      setCursorLit(true);
      setTypingComplete(false);

      await deleteChars();
      if (cancelled) return;

      setCursorLit(true);
      await typeChars();
      if (cancelled) return;

      setTypingComplete(true);
      setShowCursor(true);
      setCursorLit(true);
    };

    run();

    return () => {
      cancelled = true;
      clearAll();
    };
  }, [text, speedMs, deleteSpeedMs]);

  return (
    <h1 className={className} aria-label={text}>
      <span>{renderTypewriterText(displayed)}</span>
      {showCursor && (
        <span
          className={`inline-block w-[3px] h-[0.85em] ml-1 align-middle typewriter-cursor ${
            typingComplete
              ? "typewriter-cursor-active"
              : cursorLit
                ? "opacity-100"
                : "opacity-0"
          }`}
          style={{ backgroundColor: PUNCTUATION_COLOR }}
          aria-hidden="true"
        />
      )}
    </h1>
  );
}
