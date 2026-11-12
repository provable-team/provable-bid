export const designExamples = [
  {
    id: "night-shift",
    title: "Night Shift",
    creator: "Codex",
    category: "Posters",
    kind: "Jazz night poster",
    description: "After-hours energy, oversized type, and a rhythm you can see.",
    file: "night-shift-poster",
    color: "#242523",
    briefTitle: "A bold poster for Night Shift jazz night",
    brief: "Create a finished A3 poster for a fictional jazz night called Night Shift. Artists: The Mara Vale Quartet and DJ Ida Loop. Event: Friday 19 March 2027, doors 20:00, music 21:00, at The Hour Room, a fictional venue in East London. Information: example.com/nightshift. Use ink black, warm cream and vermilion; bold editorial typography and original geometric artwork. Deliver one self-contained HTML page with an inline SVG poster, a working SVG download, and a print layout. Keep event details readable, with a responsive screen preview. These are sample facts; replace them with my real event details before publishing.",
    requirements: [
      "The poster shows Night Shift, Friday 19 March 2027, doors 20:00 and music 21:00.",
      "Shows The Mara Vale Quartet, DJ Ida Loop, The Hour Room, East London and example.com/nightshift.",
      "Includes original geometric artwork, a working SVG download and a print layout.",
      "The preview works on a 375px phone without horizontal scrolling.",
    ],
  },
  {
    id: "fieldwork",
    title: "Fieldwork",
    creator: "Codex",
    category: "Business cards",
    kind: "Landscape studio identity",
    description: "A quiet identity with organic lines and room to breathe.",
    file: "fieldwork-cards",
    color: "#e3e5d7",
    briefTitle: "Front and back business cards for Fieldwork",
    brief: "Design both sides of a business card for Fieldwork, a fictional landscape design studio. Include Good places grow slowly, Landscape · Gardens · Public space and Project enquiries. Contact: studio@example.com and example.com/fieldwork. Use olive, warm cream, thoughtful serif typography and original botanical artwork. Each card is 3.5 × 2 inches. Deliver a self-contained HTML preview containing inline SVG artwork, working SVG downloads for both sides, and a print layout. Keep contact details readable and inside a clear safety margin. Do not invent phone numbers, credentials or a scannable QR code. These are sample contact details; replace them with my own before printing.",
    requirements: [
      "Shows front and back designs for Fieldwork with Good places grow slowly and Landscape · Gardens · Public space.",
      "Contact details are studio@example.com and example.com/fieldwork.",
      "Both card faces use a 3.5 × 2 inch ratio, with readable type and a clear safety margin.",
      "Includes working SVG downloads, a print layout and a phone preview without horizontal scrolling.",
    ],
  },
  {
    id: "common-ground",
    title: "Common Ground",
    creator: "Codex",
    category: "Posters",
    kind: "Neighborhood food festival",
    description: "Local food, big color. A fresh invitation to come together.",
    file: "common-ground-poster",
    color: "#e5e9ef",
    briefTitle: "A colorful poster for Common Ground food festival",
    brief: "Create a finished A3 poster for Common Ground, a fictional neighborhood food festival. Event: Saturday 22 May 2027, 10:00–17:00, at Riverside Green, a fictional venue in Bristol. Include Growers · Street food · One very long lunch and example.com/commonground. Use cobalt blue, cream, orange and citrus yellow with original graphic produce illustrations and a clear typographic hierarchy. Deliver one self-contained HTML page containing an inline SVG poster, a working SVG download and print layout. It should feel like a designed poster, with a responsive screen preview. Replace these sample facts with my real festival details before publishing.",
    requirements: [
      "Shows Common Ground, Saturday 22 May 2027, 10:00–17:00 and Riverside Green, Bristol.",
      "Includes Growers · Street food · One very long lunch and example.com/commonground.",
      "Uses original produce artwork and provides a working SVG download and print layout.",
      "The poster preview fits a 375px phone without horizontal scrolling.",
    ],
  },
  {
    id: "forma",
    title: "Forma",
    creator: "Codex",
    category: "Business cards",
    kind: "Architecture studio identity",
    description: "Precision, a confident blue, and a small architectural gesture.",
    file: "forma-cards",
    color: "#dce1ed",
    briefTitle: "A precise business-card identity for Forma",
    brief: "Design front and back business cards for Forma, a fictional architecture studio. Include Build what matters and New commissions. Contact: studio@example.com and example.com/forma. Use ultramarine and ivory, disciplined typography and an original architectural line or geometric mark. Each card is 3.5 × 2 inches, with readable contact details and a clear safety margin. Deliver a self-contained HTML preview with inline SVG artwork, working SVG downloads for each side and a print layout. Do not invent professional credentials, phone numbers or a QR code. These are sample contact details; replace them with my own before printing.",
    requirements: [
      "Shows front and back cards for Forma with Build what matters and New commissions.",
      "Contact details are studio@example.com and example.com/forma.",
      "Both faces use a 3.5 × 2 inch ratio, readable typography and a clear safety margin.",
      "Includes working SVG downloads, a print layout and a responsive phone preview.",
    ],
  },
] as const;

/**
 * Pages made by provable.bid's own house agents (claudeHouseAgent + claude-judge-v2), copied byte for byte from
 * samples/<slug>/ into public/examples/house/. Every figure below is read from that sample's provenance.json; the
 * gallery test checks them against it, so update both together. These are not brief presets.
 */
export type HouseAgentProvenance = {
  sample: string;
  model: string;
  evaluator: string;
  judgeStatus: "qualified";
  checksPassed: number;
  checksTotal: number;
  sha256: string;
  generatedAt: string;
  note: string;
};

export type HouseAgentSample = {
  id: string;
  title: string;
  creator: "House agent";
  agent: "Atelier" | "Meadow" | "Voltage";
  category: (typeof designExamples)[number]["category"];
  kind: string;
  description: string;
  file: string;
  color: string;
  /** Describes the card; used for both the desktop and the phone screenshot. */
  alt: string;
  provenance: HouseAgentProvenance;
};

const houseSampleNote = "Generated outside any buyer competition. No purchase or payout. Fictional brief.";

export const houseAgentSamples: readonly HouseAgentSample[] = [
  {
    id: "maya-okafor-voltage",
    title: "Maya Okafor",
    creator: "House agent",
    agent: "Voltage",
    category: "Business cards",
    kind: "Product designer business card",
    description: "A black front with a bold uppercase name and an orange stripe; a white back with email and website.",
    file: "house/maya-okafor-card-voltage",
    color: "#e8e6e1",
    alt: "Two-sided business card for Maya Okafor, Product Designer: a black front with her name in large white capitals, the title in orange and an orange stripe, beside a white back listing maya@example.com and example.com/maya.",
    provenance: {
      sample: "samples/maya-okafor-business-card/voltage.html",
      model: "claude-haiku-5-5",
      evaluator: "claude-judge-v2",
      judgeStatus: "qualified",
      checksPassed: 4,
      checksTotal: 4,
      sha256: "a91beb5e22badf05b7bd0011ed079f361259da851460b6e305d5a400fe16e219",
      generatedAt: "2026-11-12T16:32:30.192Z",
      note: houseSampleNote,
    },
  },
  {
    id: "crumb-and-co-atelier",
    title: "Crumb & Co.",
    creator: "House agent",
    agent: "Atelier",
    category: "Business cards",
    kind: "Bakery business card",
    description: "A cream serif wordmark with a wheat mark; the back sets the hours and preorder line in a calm hierarchy.",
    file: "house/crumb-and-co-card-atelier",
    color: "#e6dece",
    alt: "Two-sided business card for Crumb & Co. Bakery on cream stock: the front shows a small wheat mark above the serif wordmark Crumb & Co. and the word Bakery; the back lists the hours, Tuesday to Sunday 7am to 3pm, and Preorders at crumbandco.example.",
    provenance: {
      sample: "samples/crumb-and-co-business-card/atelier.html",
      model: "claude-haiku-5-5",
      evaluator: "claude-judge-v2",
      judgeStatus: "qualified",
      checksPassed: 4,
      checksTotal: 4,
      sha256: "fd5eaa430dedd8a91428382e716987ee88c17390a772a14c9b719bd6928df477",
      generatedAt: "2026-11-12T16:32:39.041Z",
      note: houseSampleNote,
    },
  },
];

export function findDesignExample(id: string | null) {
  return designExamples.find((example) => example.id === id);
}
