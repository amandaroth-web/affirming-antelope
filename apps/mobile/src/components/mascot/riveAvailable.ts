import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, TurboModuleRegistry } from 'react-native';

/**
 * True when the Rive native runtime is linked into this binary (the dev client / release build).
 * Expo Go and Expo web don't have it; there the sprite rig is used instead.
 *
 * This is a capability check, not a try-and-see: importing @rive-app/react-native without the
 * native module throws at module load, so callers must only `require` it when this is true.
 */
export const riveAvailable: boolean = (() => {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false; // Expo Go
  // Nitro's TurboModule must exist before asking it about hybrid objects.
  if (TurboModuleRegistry.get('NitroModules') == null) return false;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NitroModules } = require('react-native-nitro-modules') as typeof import('react-native-nitro-modules');
  return NitroModules.hasHybridObject('RiveRuntime') && NitroModules.hasHybridObject('RiveFileFactory');
})();
