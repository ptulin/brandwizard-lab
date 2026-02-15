import type { PrototypePrompt } from "@/types";

const EMPTY = "(Not specified)";

export function buildPrototypePrompt(idea: string): PrototypePrompt {
  const text = idea.trim() || EMPTY;
  return {
    problem: text,
    targetUser: EMPTY,
    scope: EMPTY,
    constraints: EMPTY,
    inputsOutputs: EMPTY,
    successMetric: EMPTY,
    dataModel: EMPTY,
    screens: EMPTY,
    acceptanceCriteria: EMPTY,
    implementationPlan: EMPTY,
  };
}

export function buildPrototypeFromForm(f: Partial<PrototypePrompt>): PrototypePrompt {
  return {
    problem: f.problem?.trim() || EMPTY,
    targetUser: f.targetUser?.trim() || EMPTY,
    scope: f.scope?.trim() || EMPTY,
    constraints: f.constraints?.trim() || EMPTY,
    inputsOutputs: f.inputsOutputs?.trim() || EMPTY,
    successMetric: f.successMetric?.trim() || EMPTY,
    dataModel: f.dataModel?.trim() || EMPTY,
    screens: f.screens?.trim() || EMPTY,
    acceptanceCriteria: f.acceptanceCriteria?.trim() || EMPTY,
    implementationPlan: f.implementationPlan?.trim() || EMPTY,
  };
}

export function formatPromptForCopy(p: PrototypePrompt): string {
  return `# Prototype brief (build-ready, tool-agnostic)

## Target user
${p.targetUser}

## Core problem
${p.problem}

## MVP scope
${p.scope}

## Constraints
${p.constraints}

## Inputs / Outputs
${p.inputsOutputs}

## Success metric
${p.successMetric}

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
