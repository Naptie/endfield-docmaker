<script lang="ts">
  import type { Pathname } from '$app/types';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { getLocale, locales, localizeHref } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages';
  import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
  import GlobeIcon from 'phosphor-svelte/lib/GlobeIcon';

  const localeLabels: Record<string, () => string> = {
    en: () => m.locale_en(),
    zh: () => m.locale_zh()
  };

  let currentLocale = $state(getLocale());

  function onLocaleChange(value: string | undefined) {
    if (!value || value === getLocale()) return;
    const locale = value as (typeof locales)[number];
    const href = resolve(localizeHref(page.url.pathname, { locale }) as Pathname);
    window.location.href = href;
  }
</script>

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

<!-- Hidden links for SEO / prerendering -->
<div style="display:none">
  {#each locales as locale (locale)}
    <a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}>{locale}</a>
  {/each}
</div>
