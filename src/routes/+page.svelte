<script lang="ts">
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import endfieldLogoEn from '$lib/assets/endfield-en.svg';
  import endfieldLogoZh from '$lib/assets/endfield-zh.svg';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Label } from '$lib/components/ui/label';
  import DateInput from '$lib/components/DateInput.svelte';
  import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Spinner } from '$lib/components/ui/spinner';
  import { Separator } from '$lib/components/ui/separator';
  import { Badge } from '$lib/components/ui/badge';
  import { getTypstDocument, pick, triggerDownload } from '$lib';
  import { onMount } from 'svelte';
  import typst, { loadingState, waitForTypst } from '$lib/typst.svelte';
  import Button from '$lib/components/ui/button/button.svelte';

  const issuers = ['endfield_industries'] as const;
  const authorityPrefixes = ['终末地', '武陵区', '清波寨'] as const;

  let isReady = $state(false);

  let issuer = $state<(typeof issuers)[number]>(issuers[0]);
  let issuerName = $derived(m[`issuer_${issuer}`]());
  let authorityPrefix1 = $state<(typeof authorityPrefixes)[number]>(authorityPrefixes[0]);
  let authorityPrefix2 = $state<(typeof authorityPrefixes)[number]>(authorityPrefixes[0]);
  let authority1 = $state('纪律检查委员会');
  let authority2 = $state('人事管理局');
  let refNo = $state('1');
  let docTitle = $state('关于终末地相关人员人事管理\n违规问题的调查处理通报');
  let issueDate = $state({ year: '152', month: '1', day: '29' });
  let docContent = $state(`\
近期，终末地组织对内部人事管理及干员资格审查工作开展专项巡查，经查发现，在陈千语同志任职审核及后续管理工作中，佩丽卡监督存在履责不严、监管失察等问题，相关行为违反组织人事管理工作制度，对组织管理规范性和公信力造成不良影响。为严肃工作纪律，规范管理程序，现将有关调查情况及处理决定通报如下：

= 经查核实的主要问题

== 任职审核程序执行不严

陈千语同志多次跨地区任职期间，长期未按规定提交完整的学历成绩及学业认证材料。按照《终末地干员管理条例》相关要求，此类情况应立即启动材料复核程序并暂缓任职安排，但佩丽卡监督未及时履行监管职责，该问题未得到有效处置。虽后续补充提交相关材料，审核结果合规，但程序执行的严肃性未得到重视，违反人事审核工作基本要求。

== 存在非正当干预审核工作行为

在核查及问询过程中，经多方印证、综合查实，陈千语同志曾以非正式方式向人事工作人员施加压力，试图干预正常审核工作进程，该行为虽无书面记载，但经查证属实，已违反干员履职基本纪律要求。

本次事件并非单纯的材料提交疏漏问题，而是叠加监督缺位、程序执行不严、非正当干预审核等多重因素形成的人事管理违规问题，性质较为典型，需各单位引以为戒。

= 处理依据及决定

依据《终末地干员管理条例》第三章第4条、《终末地组织人事工作监督管理办法》相关规定，经终末地纪律检查委员会、人事管理局集体研究决定，对相关责任人作出如下处理：

== 陈千语干员

其行为违反干员任职审核相关规定，且存在干预正常工作进程的违规行为，情节属实。自本通报发布之日起，撤销其"六星高级精英干员"资格，调整至"五星精英干员"序列管理，按五星精英干员相关规定核定岗位待遇及工作权限。

== 佩丽卡监督

其在人事审核工作中未严格履行监管职责，履责不严、监管失察，是本次违规问题发生的重要原因，情节属实。对其作出诫勉谈话处理，在全组织范围内予以通报批评，责令其作出书面深刻检查，限期整改履职中存在的问题，并将整改情况报纪律检查委员会及人事管理局备案。

= 工作要求

各单位要以本次事件为警示，切实强化组织人事管理工作责任，严格执行干员资格审查、任职审核等各项工作程序，做到材料审核全流程留痕、监管责任全覆盖落实。要加强干员纪律教育，引导全体干员自觉遵守工作纪律，坚决杜绝干预正常工作进程、违反审核程序等行为。各监督岗位人员要切实履行监管职责，强化工作全过程监督，对发现的问题及时处置、闭环管理。

本通报自发布之日起执行，请各单位严格遵照落实。
`);

  const STORAGE_KEY = 'endfield-doc';
  const STORAGE_VERSION = 1;

  const saveToStorage = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: STORAGE_VERSION,
          issuer,
          authorityPrefix1,
          authorityPrefix2,
          authority1,
          authority2,
          refNo,
          docTitle,
          issueDate,
          docContent
        })
      );
    } catch (e) {
      console.error('Error saving to storage:', e);
    }
  };

  const loadFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.version !== STORAGE_VERSION) return;
      if (data.issuer) issuer = data.issuer;
      if (data.authorityPrefix1 !== undefined) authorityPrefix1 = data.authorityPrefix1;
      if (data.authorityPrefix2 !== undefined) authorityPrefix2 = data.authorityPrefix2;
      if (data.authority1 !== undefined) authority1 = data.authority1;
      if (data.authority2 !== undefined) authority2 = data.authority2;
      if (data.refNo !== undefined) refNo = data.refNo;
      if (data.docTitle !== undefined) docTitle = data.docTitle;
      if (data.issueDate?.year !== undefined) issueDate = data.issueDate;
      if (data.docContent !== undefined) docContent = data.docContent;
    } catch (e) {
      console.error('Error loading from storage:', e);
    } finally {
      isReady = true;
    }
  };

  let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
  let pdf: string | undefined = $state(undefined);
  let compileError: string | undefined = $state(undefined);

  let dateInput: { getIsValid: () => boolean } | undefined = $state(undefined);

  const parseDate = (date: { year: string; month: string; day: string }) => {
    const year = parseInt(date.year, 10);
    const month = parseInt(date.month, 10);
    const day = parseInt(date.day, 10);
    return {
      year: isNaN(year) || year <= 0 ? 150 : year,
      month: isNaN(month) || month < 1 || month > 12 ? 1 : month,
      day: isNaN(day) || day < 1 || day > 31 ? 1 : day
    };
  };

  $effect(() => {
    // Debounce input changes to avoid excessive PDF regeneration
    void issuer;
    void authorityPrefix1;
    void authorityPrefix2;
    void authority1;
    void authority2;
    void refNo;
    void docTitle;
    void issueDate.year;
    void issueDate.month;
    void issueDate.day;
    void docContent;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(async () => {
      await waitForTypst();
      await typst.addSource(
        '/main.typ',
        getTypstDocument({
          issuer,
          authority1: authorityPrefix1 + authority1,
          authority2: authority2 ? authorityPrefix2 + authority2 : '',
          refNo,
          docTitle,
          issueDate: parseDate(issueDate),
          docContent
        })
      );
      try {
        const data = await typst.pdf();
        if (!data) return;
        const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
        pdf = URL.createObjectURL(blob);
        compileError = undefined;
        saveToStorage();
      } catch (e) {
        compileError = e instanceof Error ? e.message : String(e);
        console.error('Error generating PDF:', e);
      }
    }, 500);
  });

  onMount(async () => {
    loadFromStorage();
    await waitForTypst();
  });
</script>

<!-- Hero Section -->
<section class="relative flex flex-col items-center justify-center px-6 pt-12 pb-10">
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-muted)_0%,transparent_70%)]"
  ></div>
  <div class="relative flex flex-col items-center gap-6">
    <div class="flex items-center gap-4">
      <img
        src={getLocale() === 'zh' ? endfieldLogoZh : endfieldLogoEn}
        alt="Endfield Logo"
        class="h-16 drop-shadow-md sm:h-20 dark:invert"
      />
      <div class="mt-2">
        <h1 class="font-sans text-3xl font-bold tracking-tight sm:text-5xl">
          {m.app_name()}
        </h1>
        <p class="text-muted-foreground mt-1 text-sm sm:text-base">
          {m[`subtitle_${pick([1, 2, 3, 4] as const)}`]()}
        </p>
      </div>
    </div>
  </div>
</section>

<Separator />

<!-- Document Maker Section -->
<section
  class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:flex md:min-h-[calc(100vh-15rem)] md:flex-col md:px-8"
>
  <div class="grid grid-cols-1 gap-6 md:flex-1 md:grid-cols-2 md:grid-rows-[1fr]">
    <!-- Left: Form -->
    <Card class="border-border/50 flex flex-col">
      <CardHeader>
        <CardTitle class="text-base font-semibold">{m.app_name()}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-1 flex-col space-y-5">
        <!-- Issuer -->
        <div class="space-y-2">
          <Label>{m.issuer()}</Label>
          <Select type="single" bind:value={issuer} disabled={!isReady}>
            <SelectTrigger class="w-full">
              {issuer ? issuerName : m.select_issuer()}
            </SelectTrigger>
            <SelectContent>
              {#each issuers as issuer (issuer)}
                <SelectItem value={issuer} label={issuerName} />
              {/each}
            </SelectContent>
          </Select>
        </div>

        <!-- Authorities -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>{m.authority_1()}</Label>
            <div class="flex">
              <Select type="single" bind:value={authorityPrefix1} disabled={!isReady}>
                <SelectTrigger class="w-auto shrink-0 rounded-r-none border-r-0">
                  {authorityPrefix1}
                </SelectTrigger>
                <SelectContent>
                  {#each authorityPrefixes as prefix (prefix)}
                    <SelectItem value={prefix} label={prefix} />
                  {/each}
                </SelectContent>
              </Select>
              <Input bind:value={authority1} disabled={!isReady} class="rounded-l-none" />
            </div>
          </div>
          <div class="space-y-2">
            <Label class="relative">
              {m.authority_2()}
              <Badge
                variant="outline"
                class="text-muted-foreground absolute -top-1 right-0 ml-1.5 text-[10px] font-normal"
              >
                {m.optional()}
              </Badge>
            </Label>
            <div class="flex">
              <Select type="single" bind:value={authorityPrefix2} disabled={!isReady}>
                <SelectTrigger class="w-auto shrink-0 rounded-r-none border-r-0">
                  {authorityPrefix2}
                </SelectTrigger>
                <SelectContent>
                  {#each authorityPrefixes as prefix (prefix)}
                    <SelectItem value={prefix} label={prefix} />
                  {/each}
                </SelectContent>
              </Select>
              <Input bind:value={authority2} disabled={!isReady} class="rounded-l-none" />
            </div>
          </div>
        </div>

        <!-- Title -->
        <div class="space-y-2">
          <Label>{m.doc_title()}</Label>
          <Textarea
            bind:value={docTitle}
            class="field-sizing-fixed min-h-10 flex-1 resize-none"
            disabled={!isReady}
          />
        </div>

        <!-- Issue Date & Ref No -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="space-y-2 sm:col-span-2">
            <Label>{m.issue_date()}</Label>
            <DateInput
              bind:this={dateInput}
              bind:value={issueDate}
              class="w-full"
              disabled={!isReady}
            />
            {#if dateInput && !dateInput.getIsValid() && issueDate.year !== '' && issueDate.month !== '' && issueDate.day !== ''}
              <p class="text-destructive text-[11px]">{m.invalid_date()}</p>
            {/if}
          </div>
          <div class="space-y-2">
            <Label>{m.ref_no()}</Label>
            <Input bind:value={refNo} disabled={!isReady} />
          </div>
        </div>

        <!-- Document Content -->
        <div class="flex flex-1 flex-col space-y-2">
          <Label>{m.doc_content()}</Label>
          <Textarea
            bind:value={docContent}
            placeholder={m.doc_content_placeholder()}
            class="field-sizing-fixed min-h-40 flex-1 resize-none"
            disabled={!isReady}
          />
        </div>
      </CardContent>
    </Card>

    <!-- Right: PDF Preview -->
    <Card class="border-border/50 flex flex-col">
      <CardHeader class="flex items-center justify-between">
        <CardTitle class="text-base font-semibold">{m.preview()}</CardTitle>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onclick={() => window.open(pdf, '_blank')}
            disabled={!pdf}
          >
            {m.open_in_new_tab()}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onclick={() =>
              triggerDownload(
                pdf!,
                `${issuerName}〔${issueDate.year}〕${refNo}号 ${docTitle.replaceAll('\n', '')}.pdf`
              )}
            disabled={!pdf}
          >
            {m.download()}
          </Button>
        </div>
      </CardHeader>
      <CardContent class="min-h-150 flex-1 p-0 pb-0">
        {#if compileError}
          <div class="flex flex-col gap-2 p-6">
            <p class="text-destructive text-sm font-medium">{m.compile_error()}</p>
            <p class="text-muted-foreground text-xs">{m.compile_error_desc()}</p>
            <pre
              class="bg-muted text-destructive/80 overflow-auto rounded-sm p-3 font-mono text-xs">{compileError}</pre>
          </div>
        {:else if pdf}
          <object
            data={pdf}
            type="application/pdf"
            class="h-full min-h-150 w-full"
            title={m.preview()}
          >
            <p class="text-muted-foreground p-6 text-sm">
              {m.pdf_not_available()}
              <a href={pdf} class="underline">{m.pdf_download()}</a>
            </p>
          </object>
        {:else}
          <div class="flex flex-col items-center justify-center gap-2 p-6">
            <Spinner class="size-10" />
            {#if loadingState.status}
              <p class="text-muted-foreground text-sm">{m[loadingState.status]()}</p>
            {/if}
          </div>
        {/if}
      </CardContent>
    </Card>
  </div>
</section>
