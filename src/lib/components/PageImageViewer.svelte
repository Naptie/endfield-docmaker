<script lang="ts">
  /* eslint-disable svelte/no-at-html-tags */
  import { m } from '$lib/paraglide/messages';
  import Button from '$lib/components/ui/button/button.svelte';
  import MagnifyPlusIcon from 'phosphor-svelte/lib/MagnifyingGlassPlusIcon';
  import MagnifyMinusIcon from 'phosphor-svelte/lib/MagnifyingGlassMinusIcon';
  import FrameCornersIcon from 'phosphor-svelte/lib/FrameCornersIcon';

  let {
    /** Whole-document SVG string (all pages stacked vertically). */
    svg
  }: { svg?: string } = $props();

  const ZOOM_MAX = 4;
  /** 1 means "fit the viewer width"; >1 enables horizontal panning. */
  let zoom = $state(1);

  function setZoom(next: number) {
    zoom = Math.min(ZOOM_MAX, Math.max(1, next));
  }

  function toggleZoom() {
    setZoom(zoom > 1 ? 1 : 2);
  }
</script>

<div class="relative h-full min-h-150">
  <!-- Floating zoom controls -->
  <div
    class="bg-background/80 absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full border p-1 shadow-sm backdrop-blur"
  >
    <Button
      variant="ghost"
      size="icon-xs"
      class="cursor-pointer"
      onclick={() => setZoom(zoom / 1.5)}
      disabled={zoom <= 1}
      title={m.zoom_out()}
      aria-label={m.zoom_out()}
    >
      <MagnifyMinusIcon class="size-3.5" />
    </Button>
    <span class="w-10 text-center font-mono text-[10px] select-none">
      {Math.round(zoom * 100)}%
    </span>
    <Button
      variant="ghost"
      size="icon-xs"
      class="cursor-pointer"
      onclick={() => setZoom(zoom * 1.5)}
      disabled={zoom >= ZOOM_MAX}
      title={m.zoom_in()}
      aria-label={m.zoom_in()}
    >
      <MagnifyPlusIcon class="size-3.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon-xs"
      class="cursor-pointer"
      onclick={() => setZoom(1)}
      disabled={zoom === 1}
      title={m.zoom_reset()}
      aria-label={m.zoom_reset()}
    >
      <FrameCornersIcon class="size-3.5" />
    </Button>
  </div>

  <!-- Scrollable document; native pinch-zoom of the viewport also works -->
  <div
    class="bg-muted/40 h-full min-h-150 overflow-auto p-4 sm:p-6"
    role="document"
    ondblclick={toggleZoom}
  >
    <div class="mx-auto" style={`width:${100 * zoom}%`}>
      {#if svg}
        <!-- Vector document: the SVG spans all pages, stacked vertically.
             Scaled by the container, so it stays crisp at any zoom level.
             The document is always "white paper" (black text, red headers),
             so give the page a white background regardless of the app theme.
             Glyph colors come from Typst's own `fill` attributes – no
             override here, or we'd flatten the red title headers. -->
        <div
          class="[&>svg]:h-auto [&>svg]:w-full [&>svg]:bg-white [&>svg]:shadow-md [&>svg]:select-none"
        >
          {@html svg}
        </div>
      {/if}
    </div>
  </div>
</div>
