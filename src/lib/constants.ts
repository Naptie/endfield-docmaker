import logoEndfieldInds from '$lib/assets/logos/endfield-industries.png';
import logoRhodesIsle from '$lib/assets/logos/rhodes-island.png';
import logoUWST from '$lib/assets/logos/uwst.png';
import logoHAS from '$lib/assets/logos/has.png';

export const ISSUERS = [
  { key: 'endfield_industries', url: logoEndfieldInds },
  { key: 'uwst', url: logoUWST },
  { key: 'has', url: logoHAS },
  { key: 'rhodes_island', url: logoRhodesIsle }
] as const;
