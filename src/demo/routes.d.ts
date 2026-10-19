// The route table scripts/build-demo.mjs generates from src/app/api/**/route.ts.
declare module "demo:routes" {
  export const routes: { pattern: RegExp; keys: string[]; mod: Record<string, unknown> }[];
}
