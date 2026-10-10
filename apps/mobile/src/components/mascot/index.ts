import type { ComponentType, RefAttributes } from 'react';
import { MascotSprite } from './MascotSprite';
import { riveAvailable } from './riveAvailable';
import type { MascotHandle, MascotProps } from './types';

/**
 * The coach mascot. Native builds with the Rive runtime get the Rive "Coach" rig
 * (assets/rive/mascot-coach.riv); Expo Go and Expo web get the layered-PNG sprite rig.
 * RiveMascot also falls back to the sprite by itself if the file fails to load.
 * RiveMascot is required lazily: its module needs the Rive native module at load time.
 */
export const Mascot: ComponentType<MascotProps & RefAttributes<MascotHandle>> = riveAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('./RiveMascot') as typeof import('./RiveMascot')).RiveMascot
  : MascotSprite;

export type { MascotHandle, MascotMood, MascotPose, MascotProps } from './types';
