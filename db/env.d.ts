declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    TURN_URL?: string;
    TURN_USERNAME?: string;
    TURN_PASSWORD?: string;
  }
}
