import sharp from 'sharp';
import type { components } from '../../../packages/api-client/src/schema.js';
type Agent = components['schemas']['Agent'];

export const creativeAgents: Agent[] = [
  { id: 'agent_alpha', name: 'Neon Frame', description: 'Cinematic key art and energetic scene writing.', style: 'Electric cyan and magenta, bold geometry, science-fiction posters.', capabilities: ['text', 'image'], status: 'available', internal: true, avatar_color: '#D946EF' },
  { id: 'agent_beta', name: 'Paper Sun', description: 'Warm illustrations and character-led scenes.', style: 'Terracotta and cream, editorial shapes, playful botanical details.', capabilities: ['text', 'image'], status: 'available', internal: true, avatar_color: '#D97745' },
  { id: 'agent_gamma', name: 'Lunar Ink', description: 'Restrained visual storytelling and atmospheric dialogue.', style: 'Black and ivory, film-noir contrast, line art and quiet typography.', capabilities: ['text', 'image'], status: 'available', internal: true, avatar_color: '#64748B' },
];

// Repository-native geometric fixtures. These are deterministic mock work, not AI outputs.
const scene = (agent: Agent) => {
  const stories: Record<string, string> = {
    agent_alpha: 'INT. MARS HABITAT — ALARM LIGHT\n\nASTRONAUT A: The oxygen spike is behind that door.\nASTRONAUT B: Then let us meet whatever is breathing.\n\nThe airlock opens on a garden on Mars. Neon work lights turn the leaves electric blue. Two astronauts stand among the vines as the alarms fall silent.\n\nASTRONAUT A: We thought the planet was empty.\nASTRONAUT B: It was waiting for us to listen.',
    agent_beta: 'INT. MARS GREENHOUSE — MORNING\n\nASTRONAUT A: I ordered spare filters, not tomatoes.\nASTRONAUT B: Taste one before you file the complaint.\n\nTwo astronauts discover a warm little garden on Mars. One removes a glove to touch a leaf; the other carefully counts the tomatoes. A handwritten watering schedule covers the airlock.\n\nASTRONAUT A: Who has been tending this?\nASTRONAUT B: We have. Every day we decided to stay.',
    agent_gamma: 'INT. ABANDONED MARS STATION — NIGHT\n\nASTRONAUT A: The log says nothing survived.\nASTRONAUT B: The log ends before spring.\n\nA narrow beam cuts through the dust. Beyond it, two astronauts discover a garden on Mars, growing in the dark under an old maintenance lamp. A flower leans toward the light. Neither astronaut moves.\n\nASTRONAUT A: Should we report it?\nASTRONAUT B: Give it one more quiet minute.',
  };
  return `${agent.name} — FIVE MINUTE SCENES\n\n${stories[agent.id]}\n\nDeterministic mock work. Style: ${agent.style}\n`;
};
function svg(agent: Agent) {
  const warm = agent.id === 'agent_beta'; const mono = agent.id === 'agent_gamma';
  const bg = warm ? '#f4e7cc' : mono ? '#101419' : '#111237';
  const accent = warm ? '#be552e' : mono ? '#ddd7c8' : '#f04db3';
  const green = warm ? '#3c735b' : mono ? '#88999a' : '#4be3db';
  const foreground = warm ? '#3a3028' : '#f5f2e7';
  const label = warm ? 'PAPER SUN' : mono ? 'LUNAR INK' : 'NEON FRAME';
  if (warm) return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640">
    <rect width="960" height="640" fill="#f4e7cc"/>
    <path d="M590 0H960V640H710Q480 420 590 0" fill="#e6b483"/>
    <circle cx="715" cy="260" r="185" fill="#bd5631"/>
    <path d="M540 500V300Q710 115 875 300V500Z" fill="#f4e7cc"/>
    ${[580,640,710,775,835].map((x,i)=>`<path d="M${x} 496V${350-i*12}" stroke="#3c735b" stroke-width="10"/><ellipse cx="${x-16}" cy="${420-i*12}" rx="35" ry="15" fill="#3c735b" transform="rotate(35 ${x-16} ${420-i*12})"/><ellipse cx="${x+17}" cy="${380-i*10}" rx="35" ry="15" fill="#66956b" transform="rotate(-35 ${x+17} ${380-i*10})"/>`).join('')}
    <path d="M490 500H960V640H610Z" fill="#3c735b"/>
    ${[580,710].map(x=>`<circle cx="${x}" cy="492" r="19" fill="#f4e7cc"/><rect x="${x-18}" y="515" width="36" height="45" rx="10" fill="#f4e7cc"/><path d="M${x-10} 556v30M${x+10} 556v30" stroke="#f4e7cc" stroke-width="10"/>`).join('')}
    <text x="55" y="65" font-family="sans-serif" font-size="19" letter-spacing="5" fill="#3c735b">PAPER SUN / 002</text>
    <text x="50" y="190" font-family="serif" font-size="88" fill="#3a3028">Five</text>
    <text x="50" y="282" font-family="serif" font-size="88" fill="#3a3028">Minute</text>
    <text x="50" y="374" font-family="serif" font-size="88" fill="#3a3028">Scenes</text>
    <rect x="55" y="425" width="70" height="6" fill="#bd5631"/>
    <text x="55" y="475" font-family="sans-serif" font-size="20" fill="#3a3028">A LITTLE GARDEN.</text>
    <text x="55" y="508" font-family="sans-serif" font-size="20" fill="#3a3028">A VERY LONG WAY HOME.</text>
    <text x="55" y="600" font-family="sans-serif" font-size="15" letter-spacing="3" fill="#3c735b">TWO ASTRONAUTS ON MARS</text>
  </svg>`;
  if (mono) return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640">
    <rect width="960" height="640" fill="#101419"/>
    <rect x="35" y="35" width="890" height="570" fill="none" stroke="#ddd7c8" stroke-width="2"/>
    <text x="480" y="85" text-anchor="middle" font-family="sans-serif" font-size="17" letter-spacing="7" fill="#88999a">LUNAR INK / 003</text>
    <path d="M610 130L310 420H850Z" fill="#ddd7c8" opacity=".1"/>
    <circle cx="610" cy="130" r="12" fill="#ddd7c8"/>
    <path d="M70 420L250 340L360 410L500 370L690 430L890 365" fill="none" stroke="#647480" stroke-width="3"/>
    <path d="M500 425V300Q610 160 720 300V425Z" fill="#101419" stroke="#ddd7c8" stroke-width="3"/>
    <path d="M610 230V425M500 330H720" stroke="#647480" stroke-width="2"/>
    ${[540,590,640,685].map((x,i)=>`<path d="M${x} 420v-${60+i*16}m0 25l-20 -18m20 5l20 -18" fill="none" stroke="#ddd7c8" stroke-width="3"/>`).join('')}
    ${[240,300].map(x=>`<circle cx="${x}" cy="370" r="11" fill="#ddd7c8"/><path d="M${x} 386v35m0 -20l-13 15m13 -15l13 15m-13 5l-10 20m10 -20l10 20" stroke="#ddd7c8" stroke-width="6"/>`).join('')}
    <text x="480" y="510" text-anchor="middle" font-family="serif" font-size="48" letter-spacing="4" fill="#ddd7c8">FIVE MINUTE SCENES</text>
    <text x="480" y="558" text-anchor="middle" font-family="sans-serif" font-size="14" letter-spacing="4" fill="#88999a">ON MARS, SOMETHING IS STILL GROWING.</text>
  </svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
    <rect width="960" height="640" fill="${bg}"/>
    ${mono ? '<path d="M0 310L960 120M0 370L960 180M0 430L960 240" stroke="#26323c" stroke-width="12"/>' : ''}
    <circle cx="750" cy="235" r="125" fill="${accent}"/>
    <path d="M0 470 Q200 335 450 470 T960 440 V640 H0Z" fill="${accent}" opacity=".35"/>
    <path d="M0 520 Q350 440 650 530 T960 500 V640 H0Z" fill="${accent}"/>
    <path d="M300 520V350 Q480 150 660 350V520Z" fill="${bg}" stroke="${green}" stroke-width="7"/>
    <path d="M480 260V520M300 400H660" stroke="${green}" stroke-width="3" opacity=".6"/>
    ${[360,420,500,560,610].map((x,i)=>`<path d="M${x} 515v-${65+i*13}" stroke="${green}" stroke-width="6"/><ellipse cx="${x-13}" cy="${460-i*9}" rx="22" ry="9" transform="rotate(30 ${x-13} ${460-i*9})" fill="${green}"/><ellipse cx="${x+13}" cy="${440-i*9}" rx="22" ry="9" transform="rotate(-30 ${x+13} ${440-i*9})" fill="${green}"/>`).join('')}
    ${[235,710].map(x=>`<circle cx="${x}" cy="430" r="23" fill="${foreground}"/><rect x="${x-21}" y="457" width="42" height="58" rx="12" fill="${foreground}"/><path d="M${x-12} 510v45M${x+12} 510v45" stroke="${foreground}" stroke-width="13"/>`).join('')}
    <text x="52" y="58" font-family="sans-serif" font-size="19" letter-spacing="6" fill="${green}">${label} / 001</text>
    <text x="48" y="132" font-family="sans-serif" font-size="62" font-weight="bold" fill="${foreground}">FIVE MINUTE</text>
    <text x="48" y="196" font-family="sans-serif" font-size="62" font-weight="bold" fill="${foreground}">SCENES</text>
    <text x="52" y="599" font-family="sans-serif" font-size="19" letter-spacing="3" fill="${foreground}">TWO ASTRONAUTS. ONE IMPOSSIBLE GARDEN.</text>
  </svg>`;
}
const cache = new Map<string, Promise<Buffer>>();
export async function creativeFixture(agent: Agent) {
  if (!cache.has(agent.id)) cache.set(agent.id, sharp(Buffer.from(svg(agent))).png().toBuffer());
  return { image: await cache.get(agent.id)!, text: scene(agent) };
}
