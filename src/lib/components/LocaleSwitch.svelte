<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
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
   * (`./en/`, `./`). Only needed on deployments without a base path (e.g.
   * Bilibili Toy under `/toy/<slug>/`), where a leading slash would resolve to
   * the site root and 404. When a base path is configured (GitHub Pages sets
   * `BASE_PATH`), `localizeHref` already returns correct root-relative URLs
   * that include the base – prepending `.` there would double it.
   */
  function pageRelativeHref(href: string): string {
    if (base) return href;
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

  <!-- Hidden links for SEO / prerendering (page-relative on Toy, base-aware elsewhere) -->
  <div style="display:none">
    {#each locales as locale (locale)}
      <a href={pageRelativeHref(localizeHref(page.url.pathname, { locale }))}>{locale}</a>
    {/each}
  </div>
{/if}
