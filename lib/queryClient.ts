import { QueryClient } from '@tanstack/react-query';

/**
 * The app's one React Query cache. Its own module so the auth store can wipe
 * it on login/logout - cached data (farms, assets, summaries...) belongs to
 * the site and user it was fetched for, never the next login.
 */
export const queryClient = new QueryClient();
