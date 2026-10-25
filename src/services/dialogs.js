import { Alert, Platform } from 'react-native';
import { translate } from '../i18n';

// Alert.alert does nothing on react-native-web, so fall back to the browser dialogs there

export const showMessage = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

export const askConfirm = (title, message, confirmText = translate('common.yes')) => {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: translate('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, onPress: () => resolve(true) }
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
};
