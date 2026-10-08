import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Keyboard height for content inside a Modal (bottom sheets), where
 * KeyboardAvoidingView doesn't reach. Uses the "will" events on iOS so the
 * spacer moves with the keyboard; 0 on web.
 */
export function useKeyboardHeight(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}
