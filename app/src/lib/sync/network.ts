import { useNetworkState } from 'expo-network';

/** Whether the device looks online. Unknown counts as online; failed requests are handled by the outbox anyway. */
export function useOnline(): boolean {
  const state = useNetworkState();
  return state.isConnected !== false && state.isInternetReachable !== false;
}
