import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved datasource resolution for the CLI out of schema.prisma and
 * into this file: `migrate` and `db` commands read the connection from here,
 * not from `env("DATABASE_URL")` in the schema. The schema keeps its datasource
 * block for the generated client's types.
 *
 * Deliberately `process.env` and not prisma's `env()` helper: `env()` throws on
 * a missing variable, and this file is evaluated for *every* command including
 * `generate`, which runs in `postinstall`. With `env()` a plain `pnpm install`
 * fails on any machine without a database — CI's typecheck job, a contributor's
 * first clone. The migrate commands still refuse to run without it, which is
 * the only place the connection is actually required.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
