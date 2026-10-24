export function toLocalTaskTime(iso: string | null): string {
  if (!iso) return "";
  const value = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function taskDeadlinePatch(original: string | null, input: string): { deadline?: string | null } {
  // Unchanged minute input must not truncate server seconds/microseconds or defeat postponement.
  if (input === toLocalTaskTime(original)) return {};
  return { deadline: input ? new Date(input).toISOString() : null };
}
