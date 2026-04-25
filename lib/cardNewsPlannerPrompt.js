export function buildCardNewsPlannerMessages(input = {}) {
  const roleTemplate = input.roleTemplate || {};
  const imageTemplate = input.imageTemplate || {};
  return [
    {
      role: "developer",
      content: [
        "You are a Card News planning assistant.",
        "Return JSON only. Do not call image tools. Do not generate images.",
        "Keep the selected card count and role order exactly.",
        "Keep Korean copy in Korean when the user brief is Korean.",
        "Keep headline and body as UI/manifest text.",
        "Make visualPrompt describe the image scene/layout only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        topic: input.topic || "",
        audience: input.audience || "",
        goal: input.goal || "",
        contentBrief: input.contentBrief || "",
        size: input.size || "2048x2048",
        imageTemplate: {
          id: imageTemplate.id,
          name: imageTemplate.name,
          stylePrompt: imageTemplate.stylePrompt,
          slots: imageTemplate.slots || [],
          palette: imageTemplate.palette || [],
        },
        roleTemplate: {
          id: roleTemplate.id,
          roles: (roleTemplate.roles || []).map((role) => ({
            role: role.role,
            promptHint: role.promptHint,
          })),
        },
      }),
    },
  ];
}
