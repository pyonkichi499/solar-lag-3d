// URL とストアの同期（docs/requirements.md §5）。担当: R1-2
/** 起動時に URL を読んでストアに反映し、以降の変更を URL に書き戻す。戻り値は購読の解除 */
export function installUrlSync(): () => void {
  return () => {};
}
