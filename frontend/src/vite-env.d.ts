/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // Set to "false" to disable third-party IP geolocation (ipapi.co) used to
  // pre-center maps. Defaults to enabled.
  readonly VITE_ENABLE_IP_GEOLOCATION?: string;
  // Shopify Storefront — leave empty to run the shop in demo mode.
  readonly VITE_SHOPIFY_DOMAIN?: string;
  readonly VITE_SHOPIFY_STOREFRONT_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
