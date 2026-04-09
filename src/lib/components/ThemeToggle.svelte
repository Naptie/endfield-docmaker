<script lang="ts">
  import SunIcon from '@lucide/svelte/icons/sun';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import { toggleMode } from 'mode-watcher';
  import { m } from '$lib/paraglide/messages';
</script>

<button
  onclick={toggleMode}
  class="text-muted-foreground hover:bg-muted hover:text-foreground relative inline-flex h-7 w-7 cursor-pointer items-center justify-center transition-colors"
  aria-label={m.toggle_theme()}
>
  <SunIcon class="h-3.5 w-3.5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
  <MoonIcon
    class="absolute h-3.5 w-3.5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
  />
</button>
