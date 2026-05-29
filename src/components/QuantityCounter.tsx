import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

interface Props {
  value: number;
  onChange: (newValue: number) => void;
  min?: number;
  isAlert?: boolean;
  targetValue?: number;
}

export function QuantityCounter({ value, onChange, min = 0, isAlert = false, targetValue }: Props) {
  const theme = useTheme();

  const handleMinus = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handlePlus = () => {
    onChange(value + 1);
  };

  return (
    <View style={styles.container}>
      <IconButton
        icon="minus"
        mode="outlined"
        size={20}
        onPress={handleMinus}
        disabled={value <= min}
        style={styles.button}
      />
      <Text style={styles.text} variant="titleMedium">
        <Text style={isAlert ? { color: theme.colors.error } : undefined}>{value}</Text>
        {targetValue !== undefined ? ` / ${targetValue}` : ''}
      </Text>
      <IconButton
        icon="plus"
        mode="outlined"
        size={20}
        onPress={handlePlus}
        style={styles.button}
        iconColor={theme.colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    margin: 0,
  },
  text: {
    marginHorizontal: 16,
    minWidth: 30,
    textAlign: 'center',
  },
});
