export async function shutdownServerAndMcp(options: {
  closeServer: () => Promise<void>;
  shutdownMcp: () => Promise<void>;
  graceMs?: number;
}): Promise<void> {
  const serverClose = options.closeServer();
  const mcpClose = options.shutdownMcp();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      Promise.all([serverClose, mcpClose]),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, options.graceMs ?? 2_900); timer.unref?.(); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export function startMcpRestoreAfterListen(ctx: {
  serverActualPort?: number | undefined;
  mcpConnectionManager?: { restoreStoredConnections(): Promise<void> } | undefined;
}): Promise<void> {
  if (!ctx.serverActualPort || !ctx.mcpConnectionManager) return Promise.resolve();
  return ctx.mcpConnectionManager.restoreStoredConnections();
}
