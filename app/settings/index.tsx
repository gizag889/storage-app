import React from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Divider } from 'react-native-paper';
import { router } from 'expo-router';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <List.Section>
        <List.Subheader>マスター管理</List.Subheader>
        <List.Item
          title="場所管理"
          description="アイテムの保管場所を追加・編集します"
          left={(props) => <List.Icon {...props} icon="map-marker" />}
          onPress={() => router.push('/settings/locations')}
        />
        <Divider />
        <List.Item
          title="カテゴリー管理"
          description="アイテムの分類を追加・編集します"
          left={(props) => <List.Icon {...props} icon="shape" />}
          onPress={() => router.push('/settings/categories')}
        />
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
