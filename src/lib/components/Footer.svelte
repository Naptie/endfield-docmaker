<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import { Button } from '$lib/components/ui/button';
  import GithubIcon from 'phosphor-svelte/lib/GithubLogoIcon';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import LocaleSwitch from '$lib/components/LocaleSwitch.svelte';

  const version = __APP_VERSION__;
  const commitHash = __COMMIT_HASH__;
</script>

<footer class="border-border/40 bg-muted/30 border-t">
  <div
    class="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8"
  >
    <div class="text-muted-foreground flex items-center gap-3 text-xs">
      <span class="font-mono">v{version}</span>
      <span class="text-border">|</span>
      <a
        href="https://github.com/Naptie/endfield-docmaker/commit/{commitHash}"
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-foreground font-mono transition-colors"
      >
        {commitHash}
      </a>
    </div>

    <div class="flex items-center gap-1">
      <LocaleSwitch />
      <ThemeToggle />
      <Button
        variant="ghost"
        size="sm"
        href="https://github.com/Naptie/endfield-docmaker"
        target="_blank"
        rel="noopener noreferrer"
        class="text-muted-foreground hover:text-foreground"
      >
        <GithubIcon class="mr-1.5 h-3.5 w-3.5" />
        {m.view_on_github()}
      </Button>
    </div>
  </div>
</footer>
