<script lang="ts">
  /* eslint-disable svelte/no-at-html-tags */
  import { m } from '$lib/paraglide/messages';
  import * as Dialog from '$lib/components/ui/dialog';
  import Button from '$lib/components/ui/button/button.svelte';
  import Spinner from '$lib/components/ui/spinner/spinner.svelte';
  import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
  import CopyIcon from 'phosphor-svelte/lib/CopySimpleIcon';
  import ShareNetworkIcon from 'phosphor-svelte/lib/ShareNetworkIcon';
  import QrCodeIcon from 'phosphor-svelte/lib/QrCodeIcon';
  import qrcode from 'qrcode-generator';
  import { untrack } from 'svelte';
  import { supportsToy } from '$lib/toy.svelte';
  import { uploadDocState } from '$lib/utils/paste';
  import { buildShareUrl, buildToyPath, resolveToyPath, type DocState } from '$lib/utils/link';

  let {
    open = $bindable(false),
    docState
  }: {
    open?: boolean;
    docState: DocState;
  } = $props();

  let busy = $state(false);
  let copied = $state(false);
  /** Toy-generated QR image (PNG data URL). */
  let toyQrSrc = $state<string | null>(null);
  /** Locally generated QR image (SVG markup). */
  let localQrSvg = $state<string | null>(null);
  /**
   * Fully-resolved link for copy / the URL a scanner lands on.
   * On Toy this is the platform-generated URL; on Web it is resolved locally.
   */
  let shareUrl = $state<string | null>(null);
  /** Toy-root-relative path used for `toy.share` / `toy.getQrCode`. */
  let toyPath = $state<string | null>(null);

  $effect(() => {
    // Snapshot once per open – avoid re-encoding (and re-uploading QR requests)
    // on every keystroke happening behind the dialog.
    if (open) untrack(() => void regenerate());
  });

  async function regenerate() {
    busy = true;
    copied = false;
    toyQrSrc = null;
    localQrSvg = null;
    try {
      // Prefer external storage: upload the doc to a paste provider and carry
      // only a tiny `?p=<key>` in the Toy-relative path (no base64 bloat).
      // Fall back to the inline `?d=` payload when every provider fails.
      let path: string | null = null;
      const stored = await uploadDocState(docState);
      if (stored) path = buildToyPath(docState, stored.token);
      path ??= buildToyPath(docState);
      toyPath = path;

      // Prefer the platform QR (works in-app and on web) when available. It
      // only accepts a Toy-relative path; the platform generates the full URL.
      if (await supportsToy('getQrCode')) {
        try {
          const resp = await window.toy.getQrCode(path ? { path } : undefined);
          toyQrSrc = resp.base64;
          shareUrl = resp.url;
          return;
        } catch (e) {
          console.error('Toy getQrCode failed, falling back to local QR:', e);
        }
      }

      // Web fallback: resolve the relative path (or inline payload) to an
      // absolute URL, then encode it locally.
      const url = path ? resolveToyPath(path) : buildShareUrl(docState);
      shareUrl = url;
      if (!url) return;
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      localQrSvg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } finally {
      busy = false;
    }
  }

  async function handleCopy() {
    if (!shareUrl || copied) return;
    await navigator.clipboard.writeText(shareUrl);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  async function handleShare() {
    if (!toyPath) return;
    try {
      if (await supportsToy('share')) {
        await window.toy.share({ path: toyPath });
      }
    } catch (e) {
      console.error('Error sharing:', e);
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-sm">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <QrCodeIcon class="size-4" />
        {m.qr_code()}
      </Dialog.Title>
      <Dialog.Description>{m.qr_desc()}</Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col items-center gap-4">
      {#if busy && !toyQrSrc && !localQrSvg}
        <div class="flex h-56 w-56 items-center justify-center">
          <Spinner class="text-muted-foreground size-8" />
        </div>
      {:else if toyQrSrc || localQrSvg}
        <!-- White plate keeps the code readable in dark mode -->
        <div class="bg-white p-3 shadow-sm">
          {#if toyQrSrc}
            <img src={toyQrSrc} alt={m.qr_code()} class="size-50" />
          {:else if localQrSvg}
            <div class="size-50 [&>svg]:h-full [&>svg]:w-full">{@html localQrSvg}</div>
          {/if}
        </div>
      {:else}
        <p class="text-muted-foreground text-sm">{m.qr_too_large()}</p>
      {/if}

      <div class="flex w-full flex-wrap items-center justify-center gap-2">
        {#if shareUrl}
          <Button variant="outline" size="sm" class="cursor-pointer text-xs" onclick={handleCopy}>
            {#if copied}
              <CheckIcon class="size-3.5" />
              {m.copied()}
            {:else}
              <CopyIcon class="size-3.5" />
              {m.copy_link()}
            {/if}
          </Button>
        {/if}
        {#if toyPath}
          <Button variant="outline" size="sm" class="cursor-pointer text-xs" onclick={handleShare}>
            <ShareNetworkIcon class="size-3.5" />
            {m.share()}
          </Button>
        {/if}
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
