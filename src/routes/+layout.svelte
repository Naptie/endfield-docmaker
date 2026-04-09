<script lang="ts">
  import './layout.css';
  import type { Pathname } from '$app/types';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { locales, localizeHref } from '$lib/paraglide/runtime';
  import favicon from '$lib/assets/favicon.svg';
  import { ModeWatcher } from 'mode-watcher';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher />

{@render children()}
<ThemeToggle />

<div style="display:none">
  {#each locales as locale (locale)}
    <a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}>{locale}</a>
  {/each}
</div>
