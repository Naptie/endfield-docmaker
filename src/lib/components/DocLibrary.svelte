<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import * as Dialog from '$lib/components/ui/dialog';
  import Button from '$lib/components/ui/button/button.svelte';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from 'phosphor-svelte/lib/TrashIcon';
  import CloudCheckIcon from 'phosphor-svelte/lib/CloudCheckIcon';
  import ArticleIcon from 'phosphor-svelte/lib/ArticleIcon';
  import ExamIcon from 'phosphor-svelte/lib/ExamIcon';
  import type { Component } from 'svelte';
  import type { LibraryDoc } from '$lib/stores/docs';
  import { getTemplate } from '$lib/templates';
  import { toyEnv } from '$lib/toy.svelte';

  let {
    open = $bindable(false),
    docs,
    onselect,
    ondelete,
    onnew
  }: {
    open?: boolean;
    docs: LibraryDoc[];
    onselect: (doc: LibraryDoc) => void;
    ondelete: (id: string) => void;
    onnew: () => void;
  } = $props();

  const TEMPLATE_ICONS: Record<string, Component> = {
    'official-doc': ArticleIcon,
    testpaper: ExamIcon
  };

  /** Cache object URLs for thumbnail blobs (one URL per distinct blob). */

  const blobUrls = new WeakMap<Blob, string>();
  function thumbUrl(doc: LibraryDoc): string | undefined {
    if (!doc.thumbnail) return undefined;
    let url = blobUrls.get(doc.thumbnail);
    if (!url) {
      url = URL.createObjectURL(doc.thumbnail);
      blobUrls.set(doc.thumbnail, url);
    }
    return url;
  }

  const dateFormatter = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' });

  function templateName(id: string): string {
    return getTemplate(id).name();
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <div class="flex flex-wrap items-center justify-between gap-2 pr-8">
        <Dialog.Title>{m.library()}</Dialog.Title>
        <Button variant="outline" size="xs" class="cursor-pointer text-xs" onclick={onnew}>
          <PlusIcon class="size-3" />
          {m.library_new_doc()}
        </Button>
      </div>
      <Dialog.Description>{m.library_desc()}</Dialog.Description>
    </Dialog.Header>

    {#if docs.length === 0}
      <p class="text-muted-foreground py-10 text-center text-sm">{m.library_empty()}</p>
    {:else}
      <div class="grid max-h-[min(36rem,60vh)] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
        {#each docs as doc (doc.id)}
          <div
            role="button"
            tabindex="0"
            class="border-border/60 bg-card hover:border-border group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-colors focus-visible:ring-2 focus-visible:outline-none"
            onclick={() => onselect(doc)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onselect(doc);
              }
            }}
          >
            <div
              class="bg-muted/30 flex aspect-[210/297] items-start justify-center overflow-hidden"
            >
              {#if thumbUrl(doc)}
                <img
                  src={thumbUrl(doc)}
                  alt={doc.title}
                  loading="lazy"
                  class="h-full w-full object-cover object-top"
                />
              {:else}
                <div class="text-muted-foreground/40 flex h-full items-center justify-center">
                  {#if TEMPLATE_ICONS[doc.templateId]}
                    {@const Icon = TEMPLATE_ICONS[doc.templateId]}
                    <Icon class="size-10" />
                  {/if}
                </div>
              {/if}
            </div>
            <div class="flex flex-col gap-1 p-2">
              <span class="line-clamp-2 min-h-8 text-xs leading-4 font-medium">{doc.title}</span>
              <div class="text-muted-foreground flex items-center justify-between gap-1">
                <span class="flex min-w-0 items-center gap-1">
                  {#if TEMPLATE_ICONS[doc.templateId]}
                    {@const Icon = TEMPLATE_ICONS[doc.templateId]}
                    <Icon class="size-3 shrink-0" />
                  {/if}
                  <span class="truncate text-[10px]">{templateName(doc.templateId)}</span>
                </span>
                <span class="shrink-0 text-[10px]">{dateFormatter.format(doc.updatedAt)}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              class="text-muted-foreground hover:text-destructive absolute top-1 right-1 h-6 w-6 cursor-pointer bg-white/80 p-0 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100 dark:bg-black/60"
              onclick={(e) => {
                e.stopPropagation();
                ondelete(doc.id);
              }}
            >
              <TrashIcon class="size-3.5" />
            </Button>
          </div>
        {/each}
      </div>
    {/if}

    {#if toyEnv.available}
      <div class="text-muted-foreground flex items-center gap-1.5 text-xs">
        <CloudCheckIcon class="size-3.5 shrink-0" />
        {m.library_sync_hint()}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
