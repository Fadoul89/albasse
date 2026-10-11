import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'albasse_device_id';

function generateDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// N'insere qu'une fois par appareil : tant qu'aucun id n'est stocke localement,
// c'est une premiere installation reelle (pas juste un clic sur le lien).
export async function trackAppInstall() {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return;
    const deviceId = generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    const { error } = await supabase.from('app_installs').insert({ device_id: deviceId });
    if (error) console.error('Erreur suivi installation:', error.message);
  } catch {
    // silencieux : le suivi ne doit jamais bloquer le demarrage de l'app
  }
}
