import React from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';
import { formatDate } from '../../src/utils/date';
import { useLogs } from '../../src/hooks/useLogs';

export default function LogScreen() {
  const theme = useTheme();

  const { data, isPending, isError } = useLogs();

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'red' }}>データの読み込みに失敗しました</Text>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.center}>
        <Text>記録されたログはありません。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.message}
            titleNumberOfLines={3}
            description={formatDate(item.created_at)}
            left={props => (
              <List.Icon 
                {...props} 
                icon={item.log_type === 'low_stock' ? 'alert-circle' : 'bell-ring'} 
                color={item.log_type === 'low_stock' ? theme.colors.error : theme.colors.primary} 
              />
            )}
            style={styles.listItem}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listItem: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
});
