import React, { useEffect } from 'react';

const KEYWORDS = ["Thinking", "Cooking", "Crunching", "Analyzing", "Processing"];

// Store in module scope so it survives React StrictMode remounts and conditional unmounting
let currentStaticWord = KEYWORDS[0];

export const rollNewProcessingWord = () => {
  currentStaticWord = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
};

export default function ProcessingIndicator() {
  // Ensure we have a smooth entrance
  return (
    <div className="processing-indicator">
      <div className="processing-shimmer">
        <span className="processing-keyword">{currentStaticWord}</span>
        <span className="bouncing-dots">
          <span>.</span><span>.</span><span>.</span>
        </span>
      </div>
    </div>
  );
}
