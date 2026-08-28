<script lang="ts">
  import { page } from '$app/state';
  import { getLocale, locales, localizeHref } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages';
  import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
  import GlobeIcon from 'phosphor-svelte/lib/GlobeIcon';
  import { toyEnv } from '$lib/toy.svelte';

  const localeLabels: Record<string, () => string> = {
    en: () => m.locale_en(),
    zh: () => m.locale_zh()
  };

  let currentLocale = $state(getLocale());

  function onLocaleChange(value: string | undefined) {
    if (!value || value === getLocale()) return;
    const locale = value as (typeof locales)[number];
    window.location.href = localizeHref(page.url.pathname, { locale });
  }

  /**
   * Convert a root-relative URL (`/en/`, `/`) into a page-relative one
   * (`./en/`, `./`). Toy-hosted pages live under `/toy/<slug>/`, where a
   * leading slash would resolve to the site root and 404. The page itself
   * uses relative asset URLs, so relative locale links stay correct there.
   */
  function relativeHref(href: string): string {
    if (href.startsWith('/')) return `.${href}`;
    return href;
  }
</script>

<!-- Localized routes don't exist under the Bilibili Toy mount point; hide the switch there. -->
{#if !toyEnv.available}
  <Select type="single" bind:value={currentLocale} onValueChange={onLocaleChange}>
    <SelectTrigger
      size="sm"
      class="text-muted-foreground hover:text-foreground h-7 cursor-pointer gap-1.5 border-none px-2 text-xs not-hover:bg-transparent!"
    >
      <GlobeIcon class="h-3.5 w-3.5" />
      {localeLabels[currentLocale]?.() ?? currentLocale}
    </SelectTrigger>
    <SelectContent>
      {#each locales as locale (locale)}
        <SelectItem value={locale} label={localeLabels[locale]?.() ?? locale} />
      {/each}
    </SelectContent>
  </Select>

  <!-- Hidden links for SEO / prerendering (page-relative – safe under any mount path) -->
  <div style="display:none">
    {#each locales as locale (locale)}
      <a href={relativeHref(localizeHref(page.url.pathname, { locale }))}>{locale}</a>
    {/each}
  </div>
{/if}
