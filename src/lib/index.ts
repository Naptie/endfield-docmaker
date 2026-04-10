import { m } from '$lib/paraglide/messages';
import type { ISSUERS } from './constants';

export type Authority = {
  faction: (typeof ISSUERS)[number]['key'];
  name: string;
};

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
  authorities,
  docTitle,
  refNo,
  issueDate: { year, month, day },
  docContent
}: {
  issuer: (typeof ISSUERS)[number]['key'];
  authorities: Authority[];
  docTitle: string;
  refNo: string;
  issueDate: { year: number; month: number; day: number };
  docContent: string;
}): string => {
  const authEntries = authorities
    .filter((a) => a.name.trim() !== '')
    .map(
      (a) =>
        `(name: "${m[`prefix_${a.faction}`]()}${a.name}", icon: image("stamp-${a.faction}.png"))`
    );
  return `
#import "official-doc.typ": *

#show: official-doc.with(
  ref-no: "${refNo}",
  conf-level: none,
  conf-period: none,
  urgen-level: none,
  authorities: (${authEntries.join(', ')},),
  watermark-icon: image("watermark-${issuer}.png"),
  issuer: "${m[`issuer_${issuer}`]()}",
  title: "${docTitle}",
  issue-date: datetime(year: ${year}, month: ${month}, day: ${day}),
  seed: ${Date.now()},
)

${docContent}
`;
};
