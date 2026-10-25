export function initChinaTourBuilder(
  root: HTMLElement,
  callbacks: { onRequest: (comment: string) => void; onChange: (comment: string) => void },
): () => void;
