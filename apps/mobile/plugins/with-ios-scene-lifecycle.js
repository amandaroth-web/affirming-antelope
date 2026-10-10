// iOS 27 asserts at launch unless the app adopts the UIScene life cycle
// ("UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption"). The SDK 57
// prebuild template predates that; SDK 58's template adopts it via expo's
// ExpoAppSceneDelegate. This plugin applies the same changes to the generated
// ios/ project so we do not hand-edit it. Remove it once on SDK 58+.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

function patchAppDelegate(src) {
  if (src.includes('ExpoReactNativeFactoryProvider')) return src;

  let out = src.replace(
    /class AppDelegate: ExpoAppDelegate \{/,
    'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
  );

  // The scene delegate now creates the window and starts React Native.
  out = out.replace(
    /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\n#endif\n/,
    '\n    // The window is created and React Native is started by `SceneDelegate` under the\n    // scene-based life cycle (required by iOS 27).\n',
  );

  if (!out.includes('ExpoReactNativeFactoryProvider {') || out.includes('startReactNative')) {
    throw new Error('with-ios-scene-lifecycle: AppDelegate.swift layout changed; update the plugin.');
  }

  return `${out.trimEnd()}\n\n@objc(SceneDelegate)\nclass SceneDelegate: ExpoAppSceneDelegate {\n  // Extension point for config plugins.\n}\n`;
}

module.exports = function withIosSceneLifecycle(config) {
  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('with-ios-scene-lifecycle: expected a Swift AppDelegate.');
    }
    c.modResults.contents = patchAppDelegate(c.modResults.contents);
    return c;
  });

  return withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return c;
  });
};
