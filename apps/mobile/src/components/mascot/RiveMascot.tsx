// Web (and any platform without a .native build): no Rive runtime, so the sprite rig stands in.
// The Rive implementation is RiveMascot.native.tsx; Metro picks it on iOS and Android.
export { MascotSprite as RiveMascot } from './MascotSprite';
