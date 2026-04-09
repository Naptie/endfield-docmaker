import { m } from '$lib/paraglide/messages';

export const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const getAssetData = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};

export const getFontBlobUrl = async (url: string): Promise<string> => {
  const data = await getAssetData(url);
  const blob = new Blob([new Uint8Array(data)], { type: 'font/woff2' });
  return URL.createObjectURL(blob);
};

export const triggerDownload = (url: string, name: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
};

export const getTypstDocument = ({
  issuer,
  authority1,
  authority2,
  docTitle,
  refNo,
  issueDate: { year, month, day },
  docContent
}: {
  issuer: string;
  authority1: string;
  authority2: string;
  docTitle: string;
  refNo: string;
  issueDate: { year: number; month: number; day: number };
  docContent: string;
}): string => {
  switch (issuer) {
    case 'endfield_industries':
      return `
#import "official-doc.typ": *

#show: official-doc.with(
  ref-no: "${refNo}",
  conf-level: none,
  conf-period: none,
  urgen-level: none,
  ${authority2 ? `authorities: ("${authority1}", "${authority2}")` : `authority: ("${authority1}")`},
  stamp-icon: image("stamp-endfield-industries.png", width: 63%),
  stamp-shift: (5mm - ${Math.random() * 30}mm, 10mm - ${Math.random() * 40}mm),
  stamp-rotation: 25deg - ${Math.random() * 50}deg,
  issuer: "${m[`issuer_${issuer}`]()}",
  title: "${docTitle}",
  issue-date: datetime(year: ${year}, month: ${month}, day: ${day}),
)

${docContent}
`;
    default:
      throw new Error(`Unknown issuer: ${issuer}`);
  }
};
