# Agent installation

1. Install: `npx -y github:HiAPIAI/hiapi-game-asset-studio-skill -y` (or `--codex`, `--claude`, `--target=/path/to/skills`).
2. Set `HIAPI_API_KEY` in the environment that starts the agent (https://www.hiapi.ai/en/dashboard/api-keys).
3. Needs Node 18+ and, for slicing sheets, uv (Python).
4. Read `SKILL.md` and `references/plan.md`, write the plan, run `scripts/run-plan.mjs plan.json --dry-run`, and tell the
   user the estimated cost before the paid run.
5. Look at every generated image before handing over; redo what is off-model. Never publish anything.
