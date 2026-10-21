// Content backend for the site and the admin panel (/admin).
// Empty = the site reads data/*.json and the admin runs in demo mode.
// Filled = texts and photos come from Supabase and the admin saves there.
window.CMS_CONFIG = {
  supabaseUrl: "",     // e.g. "https://abcd1234.supabase.co"
  supabaseAnonKey: "", // the project's public "anon" key (safe to publish)
};
