import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const [cookie, url] = await Promise.all([
        AsyncStorage.getItem('cookie'),
        AsyncStorage.getItem('instanceurl'),
      ]);
      setAuthed(Boolean(cookie && url));
      setReady(true);
    })();
  }, []);

  if (!ready) return null;
  return authed ? <Redirect href="/(app)/gate" /> : <Redirect href="/login" />;
}
