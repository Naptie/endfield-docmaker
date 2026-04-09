<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { ModeWatcher } from 'mode-watcher';
  import Footer from '$lib/components/Footer.svelte';
  import { m } from '$lib/paraglide/messages';

  let { children } = $props();
</script>

<svelte:head>
  <title>{m.app_name()}</title>
  <link rel="icon" href={favicon} />
</svelte:head>
<ModeWatcher />

<div class="flex min-h-screen flex-col">
  <main class="flex-1">
    {@render children()}
  </main>

  <Footer />
</div>
