import { Tabs } from 'expo-router';
import { TabBar } from '@/components/nav/TabBar';
import { color } from '@/design/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.white } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="path" />
      <Tabs.Screen name="practice" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
