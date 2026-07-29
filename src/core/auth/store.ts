// Re-export of the canonical auth store. New code imports from this path;
// older imports of `@/lib/stores/authStore` keep working until migrated.
export { useAuthStore } from '@/lib/stores/authStore';
