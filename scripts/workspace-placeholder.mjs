const scriptName = process.argv[2] ?? 'workspace';

const messages = {
  dev: 'Dev entrypoints are not implemented yet. Add workspace packages under apps/*, services/*, or packages/*.',
  build: 'Build targets are not implemented yet. Add package build scripts before enabling this command.',
  typecheck: 'Typecheck targets are not implemented yet. Workspace scaffolding is valid.',
  test: 'Test targets are not implemented yet. Add package tests before enabling this command.',
  lint: 'Lint targets are not implemented yet. Add lint configuration before enabling this command.',
  format: 'Format targets are not implemented yet. Add formatter configuration before enabling this command.',
  seed: 'Seed targets are not implemented yet. Add seed data scripts before enabling this command.'
};

console.log(`[agent-safety-gateway] ${messages[scriptName] ?? `${scriptName} is not implemented yet.`}`);
