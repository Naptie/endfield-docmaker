import logoEndfieldInds from '$lib/assets/logos/endfield-industries.png';
import logoRhodesIsl from '$lib/assets/logos/rhodes-island.svg?raw';
import logoUWST from '$lib/assets/logos/uwst.svg?raw';
import logoTGCC from '$lib/assets/logos/tgcc.svg?raw';
import logoHAS from '$lib/assets/logos/has.svg?raw';

export type IssuerEntry<K extends string = string> =
  | { key: K; type: 'png'; url: string }
  | { key: K; type: 'svg'; raw: string };

export const ISSUERS = [
  { key: 'endfield_industries', type: 'png', url: logoEndfieldInds },
  { key: 'has', type: 'svg', raw: logoHAS },
  { key: 'rhodes_island', type: 'svg', raw: logoRhodesIsl },
  { key: 'tgcc', type: 'svg', raw: logoTGCC },
  { key: 'uwst', type: 'svg', raw: logoUWST }
] as const satisfies readonly IssuerEntry[];
