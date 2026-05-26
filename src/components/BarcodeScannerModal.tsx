import React, { useState } from 'react';
import { Modal, StyleSheet, View, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, useTheme, Snackbar } from 'react-native-paper';

interface BarcodeScannerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScannerModal({ visible, onDismiss, onScan }: BarcodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const theme = useTheme();
  const [scanned, setScanned] = useState(false);
  const [scannedCode, setScannedCode] = useState('');

  const handleClose = () => {
    setScanned(false);
    setScannedCode('');
    onDismiss();
  };

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.container}>
          <Text>カメラ権限を確認中...</Text>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.container}>
          <View style={styles.permissionBox}>
            <Text style={{ marginBottom: 16 }}>
              バーコードをスキャンするには、カメラへのアクセスを許可してください。
            </Text>
            <Button mode="contained" onPress={requestPermission}>
              カメラを許可する
            </Button>
            <Button style={{ marginTop: 8 }} onPress={handleClose}>
              キャンセル
            </Button>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code128'],
          }}
          onBarcodeScanned={scanned ? undefined : ({ data }) => {
            setScanned(true);
            setScannedCode(data);
            onScan(data);
            
            // 2秒間は再読み込みを制限
            setTimeout(() => {
              setScanned(false);
            }, 2000);
          }}
        />
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.headerText}>バーコードをスキャン</Text>
          </View>
          <View style={styles.scanArea} />
          <View style={styles.footer}>
            <Button mode="contained" onPress={handleClose} buttonColor={theme.colors.error}>
              閉じる
            </Button>
          </View>
        </View>

        <Snackbar
          visible={scanned}
          onDismiss={() => setScanned(false)}
          duration={2000}
          style={styles.snackbar}
        >
          <Text style={{ color: '#fff' }}>読み取り成功: {scannedCode}</Text>
        </Snackbar>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  permissionBox: {
    backgroundColor: '#fff',
    padding: 24,
    margin: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scanArea: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    margin: 40,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  footer: {
    padding: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
  },
  snackbar: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
  },
});
