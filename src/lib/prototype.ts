import type { PrototypePrompt } from "@/types";

export function buildPrototypePrompt(idea: string): PrototypePrompt {
  const lines = idea.trim().split(/\n/).filter(Boolean);
  const text = lines.join("\n");
  return {
    problem: text || "(Describe the problem or idea)",
    targetUser: "(Who is the primary user?)",
    scope: "(In scope for MVP / Out of scope)",
    constraints: "(Tech, time, compliance)",
    dataModel: "(Key entities and relations)",
    screens: "(List main screens/flows)",
    acceptanceCriteria: "(User-visible criteria)",
    implementationPlan: "(Phased steps)",
  };
}

export function formatPromptForCopy(p: PrototypePrompt): string {
  return `# Prototype brief

## Problem
${p.problem}

## Target user
${p.targetUser}

## Scope
${p.scope}

## Constraints
${p.constraints}

## Data model
${p.dataModel}

## Screens
${p.screens}

## Acceptance criteria
${p.acceptanceCriteria}

## Implementation plan
${p.implementationPlan}
`;
}
