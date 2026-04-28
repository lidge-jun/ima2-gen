const ROLE_TEMPLATES = [
  {
    id: "short-3",
    name: "Short 3",
    defaultCount: 3,
    roles: [
      { role: "hook", required: true, promptHint: "strong opening card", preferredSlots: ["title", "visual"] },
      { role: "core", required: true, promptHint: "main explanation card", preferredSlots: ["visual", "body"] },
      { role: "cta", required: true, promptHint: "clear call to action card", preferredSlots: ["cta"] },
    ],
  },
  {
    id: "mid-5",
    name: "Mid 5",
    defaultCount: 5,
    roles: [
      { role: "cover", required: true, promptHint: "cover card with strong headline", preferredSlots: ["title", "visual"] },
      { role: "problem", required: true, promptHint: "problem framing card", preferredSlots: ["title", "body"] },
      { role: "insight", required: true, promptHint: "insight or solution card", preferredSlots: ["visual", "body"] },
      { role: "example", required: true, promptHint: "example or proof card", preferredSlots: ["visual", "body"] },
      { role: "cta", required: true, promptHint: "closing call to action card", preferredSlots: ["cta"] },
    ],
  },
  {
    id: "long-8",
    name: "Long 8",
    defaultCount: 8,
    roles: [
      { role: "cover", required: true, promptHint: "cover card", preferredSlots: ["title"] },
      { role: "problem", required: true, promptHint: "problem card", preferredSlots: ["body"] },
      { role: "data", required: true, promptHint: "data card", preferredSlots: ["visual"] },
      { role: "tip1", required: true, promptHint: "first tip card", preferredSlots: ["body"] },
      { role: "tip2", required: true, promptHint: "second tip card", preferredSlots: ["body"] },
      { role: "example", required: true, promptHint: "example card", preferredSlots: ["visual"] },
      { role: "summary", required: true, promptHint: "summary card", preferredSlots: ["body"] },
      { role: "cta", required: true, promptHint: "call to action card", preferredSlots: ["cta"] },
    ],
  },
];

export function listRoleTemplates() {
  return ROLE_TEMPLATES;
}

export function getRoleTemplate(roleTemplateId = "mid-5") {
  return ROLE_TEMPLATES.find((t) => t.id === roleTemplateId) || ROLE_TEMPLATES[1];
}
