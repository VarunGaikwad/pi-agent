import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const OptionSchema = Type.Object({
  label: Type.String({ description: "Short option label" }),
  description: Type.String({ description: "What this option means" }),
});

const QuestionSchema = Type.Object({
  question: Type.String({ description: "The complete question to ask" }),
  header: Type.String({ description: "Short label for the question" }),
  options: Type.Array(OptionSchema, {
    description: "Choices to present",
    minItems: 2,
    maxItems: 4,
  }),
  multiSelect: Type.Boolean({ description: "Allow more than one choice" }),
});

export default function askUserQuestion(pi: ExtensionAPI) {
  pi.registerTool({
    name: "AskUserQuestion",
    label: "Ask User Question",
    description:
      "Ask the user up to four clarifying questions with selectable options. Users can always provide a custom answer.",
    promptSnippet: "Ask the user focused clarifying questions with selectable options",
    promptGuidelines: [
      "Use AskUserQuestion when missing requirements or user preferences materially affect the implementation; do not guess.",
    ],
    parameters: Type.Object({
      questions: Type.Array(QuestionSchema, { minItems: 1, maxItems: 4 }),
    }),
    executionMode: "sequential",

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!ctx.hasUI) throw new Error("AskUserQuestion requires interactive or RPC mode");

      const answers: Array<{ header: string; question: string; answer: string }> = [];

      for (const question of params.questions) {
        const labels = question.options.map(
          (option, index) => `${index + 1}. ${option.label} — ${option.description}`,
        );
        let answer: string;

        if (question.multiSelect) {
          const selected = new Set<number>();
          while (true) {
            const choices = labels.map((label, index) => `${selected.has(index) ? "✓" : "○"} ${label}`);
            choices.push("Done", "Other (type an answer)");
            const choice = await ctx.ui.select(`${question.header}: ${question.question}`, choices, { signal });
            if (choice === undefined) return cancelled(answers);
            if (choice === "Done") {
              if (selected.size === 0) continue;
              answer = [...selected].map((index) => question.options[index].label).join(", ");
              break;
            }
            if (choice === "Other (type an answer)") {
              const custom = await ctx.ui.input(question.question, "Type your answer", { signal });
              if (custom === undefined) return cancelled(answers);
              if (custom.trim()) {
                answer = custom.trim();
                break;
              }
              continue;
            }
            const index = choices.indexOf(choice);
            if (index >= 0 && index < labels.length) {
              if (selected.has(index)) selected.delete(index);
              else selected.add(index);
            }
          }
        } else {
          const other = "Other (type an answer)";
          const choice = await ctx.ui.select(`${question.header}: ${question.question}`, [...labels, other], { signal });
          if (choice === undefined) return cancelled(answers);
          if (choice === other) {
            const custom = await ctx.ui.input(question.question, "Type your answer", { signal });
            if (custom === undefined) return cancelled(answers);
            answer = custom.trim() || "(no answer)";
          } else {
            answer = question.options[labels.indexOf(choice)]?.label ?? choice;
          }
        }

        answers.push({ header: question.header, question: question.question, answer });
      }

      return result(answers, false);
    },
  });
}

function cancelled(answers: Array<{ header: string; question: string; answer: string }>) {
  return result(answers, true);
}

function result(answers: Array<{ header: string; question: string; answer: string }>, cancelled: boolean) {
  const text = cancelled
    ? "User cancelled the questions."
    : `User answers:\n${answers.map(({ header, answer }) => `${header}: ${answer}`).join("\n")}`;
  return { content: [{ type: "text" as const, text }], details: { answers, cancelled } };
}
