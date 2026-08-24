import type { ISSUERS } from './constants';

export type IssuerEntry<K extends string = string> =
  { key: K; type: 'png'; url: string } | { key: K; type: 'svg'; raw: string };

export type IssuerKey = (typeof ISSUERS)[number]['key'];

export type Authority = {
  faction: IssuerKey;
  name: string;
};
