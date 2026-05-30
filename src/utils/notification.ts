import * as Notifications from 'expo-notifications';

/**
 * アラーム（ローカル通知）をスケジュール登録します。
 * @param alarmAt アラーム予定日時
 * @param alarmMessage アラームメッセージ
 * @param itemName アイテム名
 * @returns 登録された通知ID
 */
export async function scheduleAlarm(
  alarmAt: Date,
  alarmMessage: string,
  itemName: string
): Promise<string> {
  if (alarmAt.getTime() <= Date.now()) {
    throw new Error('アラーム日時は未来の時間を指定してください');
  }

  try {
    const messageBody = alarmMessage.trim() || `${itemName} のアラーム時間です`;
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'リマインダー',
        body: messageBody,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alarmAt },
    });
    return notificationId;
  } catch (e) {
    console.error('Failed to schedule notification', e);
    throw new Error('通知の設定に失敗しました');
  }
}

/**
 * スケジュールされたアラーム（通知）をキャンセルします。
 * @param notificationId 通知ID
 */
export async function cancelAlarm(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {
    console.error('Failed to cancel notification:', e);
  }
}
