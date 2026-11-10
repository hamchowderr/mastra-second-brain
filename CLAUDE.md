# CLAUDE.md

Read [AGENTS.md](./AGENTS.md): it holds the boot order, env rules, Knowledge conventions and the things never to do. Setup and usage are in the [README](./README.md).

```bash
npm install
cp .env.example .env      # APP_SECRET + one provider key
npm run knowledge:sync
npm run dev               # long-running; don't wait for it to exit
npm run typecheck && npm run build
npm run eval              # USE_AIMOCK=true with AIMock running = free
```
