/**
 * 日付（DateオブジェクトまたはISO日時文字列）を YYYY/MM/DD HH:mm 形式にフォーマットします。
 * @param dateOrIsoString フォーマット対象のDateオブジェクトまたはISO文字列
 * @returns フォーマットされた日時文字列、もしくは空文字
 */
export const formatDate = (dateOrIsoString: Date | string | null | undefined): string => {
  if (!dateOrIsoString) return '';
  try {
    const date = typeof dateOrIsoString === 'string' ? new Date(dateOrIsoString) : dateOrIsoString;
    if (isNaN(date.getTime())) return String(dateOrIsoString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hr = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${d} ${hr}:${min}`;
  } catch {
    return String(dateOrIsoString);
  }
};
