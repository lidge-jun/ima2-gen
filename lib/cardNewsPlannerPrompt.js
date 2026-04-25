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
        "Preserve the user's original language for headline, body, and textFields.",
        "Do not translate to English unless explicitly requested.",
        "If the user mixes languages, preserve the mix.",
        "If the user provides exact text, preserve it exactly.",
        "Role names such as cover/problem/cta are structural labels, not visible design text.",
        "Keep headline and body as UI/manifest text.",
        "Only textFields[].text with renderMode=\"in-image\" is intended to appear inside the image.",
        "Make visualPrompt describe scene, layout, style, spatial composition, and text-box placement only.",
        "Do not duplicate visible text in visualPrompt except to reference a text box position.",
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
