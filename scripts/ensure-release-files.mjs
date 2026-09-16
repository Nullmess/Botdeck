import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function ensureFile(relativePath, content) {
  const fullPath = join(root, relativePath);
  if (existsSync(fullPath)) {
    return;
  }
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
  console.log(`created missing release file ${relativePath}`);
}

ensureFile(".node-version", "24.17.0\n");
ensureFile(".nvmrc", "24.17.0\n");
ensureFile(
  ".env.example",
  `# Botdeck local environment example\n# Copy to .env.local for local overrides. Never commit real tokens.\n\nNODE_ENV=development\nBOTDECK_WS_HOST=127.0.0.1\nBOTDECK_WS_PORT=3001\n# BOTDECK_DATA_DIR=\n# BOTDECK_DATABASE_URL=\n# BOTDECK_RUNTIME_SECRET_PATH=\n# BOTDECK_WS_ALLOW_NON_LOCAL=0\n`,
);
ensureFile(
  ".gitignore",
  `node_modules/\napps/web/node_modules/\npackages/shared/node_modules/\n.next/\napps/web/.next/\napps/web/.turbo/\n.botdeck/\napps/web/.botdeck/\nrelease/\nBotdeck-*/\nbin/\n.cache/\ndebug.log\n.env\n.env.local\napps/web/prisma/dev.db\n*.tsbuildinfo\n`,
);
ensureFile(
  ".github/workflows/ci.yml",
  `name: Botdeck CI\n\non:\n  push:\n  pull_request:\n\njobs:\n  check:\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version-file: .node-version\n          cache: npm\n\n      - name: Install dependencies\n        run: npm ci\n\n      - name: Run quality gate\n        run: npm run check\n\n      - name: Run production audit\n        run: npm run audit:prod\n\n      - name: Build\n        run: npm run build\n`,
);
