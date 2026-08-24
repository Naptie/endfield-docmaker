<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Tabs from '$lib/components/ui/tabs';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import { Spinner } from '$lib/components/ui/spinner';
  import ArrowClockwiseIcon from 'phosphor-svelte/lib/ArrowClockwiseIcon';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import XIcon from '@lucide/svelte/icons/x';
  import FileIcon from '@lucide/svelte/icons/file';
  import GithubIcon from 'phosphor-svelte/lib/GithubLogoIcon';
  import BugIcon from 'phosphor-svelte/lib/BugIcon';
  import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
  import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
  import { DEFAULT_FONTS } from '$lib/typst.svelte';
  import {
    getAllFonts,
    putFont,
    removeFont,
    loadFontsWithCache,
    type CachedFont
  } from '$lib/stores/fonts';
  import { clearAllStores } from '$lib/stores/db';
  import { onMount } from 'svelte';

  let {
    open = $bindable(false)
  }: {
    open?: boolean;
  } = $props();

  const version = __APP_VERSION__;
  const commitHash = __COMMIT_HASH__;
  const fontsVersion: string = __FONTS_VERSION__;

  let activeTab = $state('fonts');
  let allFonts = $state<CachedFont[]>([]);
  let isRefreshing = $state(false);
  let isClearing = $state(false);
  let dataCleared = $state(false);

  async function loadFonts() {
    allFonts = await getAllFonts();
  }

  onMount(() => {
    if (open) loadFonts();
  });

  $effect(() => {
    if (open) loadFonts();
  });

  /** Refresh (re-fetch and re-cache) all default fonts. */
  async function refreshDefaultFonts() {
    isRefreshing = true;
    try {
      // Clear default fonts from cache
      for (const f of allFonts.filter((f) => !f.custom)) {
        await removeFont(f.name);
      }
      // Re-fetch and cache
      await loadFontsWithCache(DEFAULT_FONTS, fontsVersion);
      await loadFonts();
    } finally {
      isRefreshing = false;
    }
  }

  /** Refresh a single default font. */
  async function refreshSingleFont(name: string) {
    const def = DEFAULT_FONTS.find((f) => f.name === name);
    if (!def) return;
    isRefreshing = true;
    try {
      await removeFont(name);
      await loadFontsWithCache([def], fontsVersion);
      await loadFonts();
    } finally {
      isRefreshing = false;
    }
  }

  /** Add custom fonts from file picker. */
  function handleAddCustomFont() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ttf,.otf,.ttc,.otc,.woff,.woff2';
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files) return;
      for (const file of input.files) {
        const data = new Uint8Array(await file.arrayBuffer());
        await putFont({ name: file.name, data, version: 'custom', custom: true });
      }
      await loadFonts();
    };
    input.click();
  }

  /** Remove a custom font. */
  async function handleRemoveFont(name: string) {
    await removeFont(name);
    await loadFonts();
  }

  /** Clear all data (localStorage + IndexedDB). */
  async function clearAllData() {
    isClearing = true;
    try {
      await clearAllStores();
      localStorage.clear();
      dataCleared = true;
    } catch (e) {
      console.error('Error clearing data:', e);
    } finally {
      isClearing = false;
    }
  }

  /** Close the browser tab/window. */
  function closePage() {
    window.close();
  }

  /** Reload the current page. */
  function refreshPage() {
    window.location.reload();
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-xl">
    {#if dataCleared}
      <!-- Success view after clearing all data -->
      <div class="flex flex-col items-center gap-4 py-6">
        <CheckCircleIcon class="text-primary size-12" />
        <p class="text-sm">{m.settings_data_cleared()}</p>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" class="cursor-pointer text-xs" onclick={refreshPage}>
            <ArrowClockwiseIcon class="size-3.5" />
            {m.settings_refresh_page()}
          </Button>
          <Button variant="outline" size="sm" class="cursor-pointer text-xs" onclick={closePage}>
            <XIcon class="size-3.5" />
            {m.settings_close_page()}
          </Button>
        </div>
      </div>
    {:else}
      <Dialog.Header>
        <Dialog.Title>{m.settings()}</Dialog.Title>
      </Dialog.Header>

      <Tabs.Root bind:value={activeTab}>
        <Tabs.List variant="line">
          <Tabs.Trigger value="fonts" class="cursor-pointer">{m.settings_fonts()}</Tabs.Trigger>
          <Tabs.Trigger value="about" class="cursor-pointer">{m.settings_about()}</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {#if activeTab === 'fonts'}
        <div class="flex max-h-[min(32rem,50vh)] flex-col gap-3 overflow-y-auto">
          <!-- Global actions -->
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              class="cursor-pointer text-xs"
              onclick={refreshDefaultFonts}
              disabled={isRefreshing}
            >
              {#if isRefreshing}
                <Spinner class="size-3" />
              {:else}
                <ArrowClockwiseIcon class="size-3" />
              {/if}
              {m.settings_refresh_all()}
            </Button>
            <Button
              variant="outline"
              size="xs"
              class="cursor-pointer text-xs"
              onclick={handleAddCustomFont}
            >
              <PlusIcon class="size-3" />
              {m.settings_add_font()}
            </Button>
          </div>

          <Separator />

          <!-- Font list -->
          <div class="space-y-1">
            {#each allFonts as font (font.name)}
              <div
                class="bg-muted/40 hover:bg-muted/60 flex items-center gap-2 px-2 py-1.5 text-sm transition-colors"
              >
                <FileIcon class="text-muted-foreground size-4 shrink-0" />
                <span class="min-w-0 flex-1 truncate text-xs">{font.name}</span>
                <span class="text-muted-foreground shrink-0 text-[10px]">
                  {formatSize(font.data.byteLength)}
                </span>
                {#if font.custom}
                  <span
                    class="bg-primary/10 text-primary shrink-0 rounded px-1 py-0.5 text-[9px] font-medium"
                  >
                    {m.settings_custom()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-muted-foreground hover:text-destructive h-6 w-6 shrink-0 cursor-pointer p-0"
                    onclick={() => handleRemoveFont(font.name)}
                  >
                    <XIcon class="size-3.5" />
                  </Button>
                {:else}
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-muted-foreground h-6 w-6 shrink-0 cursor-pointer p-0"
                    onclick={() => refreshSingleFont(font.name)}
                    disabled={isRefreshing}
                  >
                    <ArrowClockwiseIcon class="size-3.5" />
                  </Button>
                {/if}
              </div>
            {:else}
              <p class="text-muted-foreground py-4 text-center text-xs">{m.settings_no_fonts()}</p>
            {/each}
          </div>
        </div>
      {:else if activeTab === 'about'}
        <div class="flex flex-col gap-4">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <Label class="text-muted-foreground w-20 shrink-0 text-xs">{m.settings_name()}</Label>
              <span class="text-xs">{m.app_name()}</span>
            </div>
            <div class="flex items-center gap-2">
              <Label class="text-muted-foreground w-20 shrink-0 text-xs"
                >{m.settings_version()}</Label
              >
              <span class="font-mono text-xs">v{version}</span>
            </div>
            <div class="flex items-center gap-2">
              <Label class="text-muted-foreground w-20 shrink-0 text-xs"
                >{m.settings_commit()}</Label
              >
              <a
                href="https://github.com/Naptie/endfield-docmaker/commit/{commitHash}"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-foreground font-mono text-xs underline"
              >
                {commitHash}
              </a>
            </div>
          </div>

          <Separator />

          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                class="cursor-pointer text-xs"
                href="https://github.com/Naptie/endfield-docmaker"
                target="_blank"
              >
                <GithubIcon class="size-4" />
                GitHub
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="cursor-pointer text-xs"
                href="https://github.com/Naptie/endfield-docmaker/issues/new"
                target="_blank"
              >
                <BugIcon class="size-4" />
                {m.settings_report_bug()}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="text-destructive hover:bg-destructive hover:text-destructive-foreground w-fit cursor-pointer text-xs"
              onclick={clearAllData}
              disabled={isClearing}
            >
              {#if isClearing}
                <Spinner class="size-4" />
              {:else}
                <TrashIcon class="size-4" />
              {/if}
              {m.settings_clear_data()}
            </Button>
          </div>
        </div>
      {/if}
    {/if}
  </Dialog.Content>
</Dialog.Root>
