<script>
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  import endfieldLogoEn from '$lib/assets/endfield-en.svg';
  import endfieldLogoZh from '$lib/assets/endfield-zh.svg';
</script>

<div class="bg-base-200">
  <h1 class="inline-flex items-center gap-2 text-2xl font-bold">
    <img
      src={getLocale() === 'zh' ? endfieldLogoZh : endfieldLogoEn}
      alt="Endfield Logo"
      class="h-16 w-16"
    />
    {m.app_name()}
  </h1>
</div>
