/** Pure agent authorization boundary: no network, dynamic code or filesystem access. */
export type AgentPolicy = {
  readonly allowedTools: readonly string[];
  readonly maxTokens: number;
  readonly requireApprovalFor: readonly string[];
};
export type AgentInvocation = {
  readonly tool: string;
  readonly estimatedTokens: number;
  readonly approved: boolean;
};
export function authorizeAgentTool(policy: AgentPolicy, invocation: AgentInvocation): void {
  if (!Number.isSafeInteger(policy.maxTokens) || policy.maxTokens < 0) throw new Error("Invalid budget");
  if (!Number.isSafeInteger(invocation.estimatedTokens) || invocation.estimatedTokens < 0 ||
      invocation.estimatedTokens > policy.maxTokens) throw new Error("Token budget exceeded");
  if (!policy.allowedTools.includes(invocation.tool)) throw new Error("Tool not authorized");
  if (policy.requireApprovalFor.includes(invocation.tool) && !invocation.approved) {
    throw new Error("Human approval required");
  }
}
export function rejectUntrustedInstruction(text: string): boolean {
  return /ignore (all |previous |prior )?instructions|reveal (the )?(system prompt|secrets)|exfiltrat/i.test(text);
}
