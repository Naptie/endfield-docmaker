<script lang="ts">
  import { cn } from '$lib/utils';

  export type DateParts = { year: string; month: string; day: string };

  let {
    value = $bindable({ year: '', month: '', day: '' }),
    disabled = false,
    class: className
  }: {
    value: DateParts;
    disabled?: boolean;
    class?: string;
  } = $props();

  let yearRef: HTMLInputElement | null = $state(null);
  let monthRef: HTMLInputElement | null = $state(null);
  let dayRef: HTMLInputElement | null = $state(null);

  function maxDaysInMonth(month: number, year: number): number {
    if (month < 1 || month > 12) return 31;
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month === 2) {
      const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      return leap ? 29 : 28;
    }
    return days[month - 1];
  }

  const parsedYear = $derived(parseInt(value.year, 10));
  const parsedMonth = $derived(parseInt(value.month, 10));
  const parsedDay = $derived(parseInt(value.day, 10));

  const yearValid = $derived(value.year === '' || (/^\d+$/.test(value.year) && parsedYear > 0));
  const monthValid = $derived(
    value.month === '' || (/^\d{1,2}$/.test(value.month) && parsedMonth >= 1 && parsedMonth <= 12)
  );
  const dayValid = $derived(() => {
    if (value.day === '') return true;
    if (!/^\d{1,2}$/.test(value.day)) return false;
    if (parsedDay < 1) return false;
    const y = yearValid && !isNaN(parsedYear) ? parsedYear : 1;
    const m = monthValid && !isNaN(parsedMonth) ? parsedMonth : 1;
    return parsedDay <= maxDaysInMonth(m, y);
  });

  export function getIsValid() {
    return (
      yearValid &&
      monthValid &&
      dayValid() &&
      value.year !== '' &&
      value.month !== '' &&
      value.day !== ''
    );
  }

  function onInput(field: keyof DateParts, e: Event) {
    const input = e.target as HTMLInputElement;
    value = { ...value, [field]: input.value };
  }

  function onKeydown(field: keyof DateParts, e: KeyboardEvent) {
    const input = e.target as HTMLInputElement;

    if (e.key === '/' || e.key === '-') {
      e.preventDefault();
      if (field === 'year') monthRef?.focus();
      else if (field === 'month') dayRef?.focus();
    }

    if (e.key === 'Backspace' && input.value === '' && input.selectionStart === 0) {
      e.preventDefault();
      if (field === 'day') monthRef?.focus();
      else if (field === 'month') yearRef?.focus();
    }

    if (e.key === 'ArrowRight' && input.selectionStart === input.value.length) {
      e.preventDefault();
      if (field === 'year') monthRef?.focus();
      else if (field === 'month') dayRef?.focus();
    }

    if (e.key === 'ArrowLeft' && input.selectionStart === 0) {
      e.preventDefault();
      if (field === 'day') monthRef?.focus();
      else if (field === 'month') yearRef?.focus();
    }
  }
</script>

<div
  data-disabled={disabled || undefined}
  class={cn(
    'dark:bg-input/30 border-input focus-within:border-ring focus-within:ring-ring/50 flex h-8 items-center rounded-none border bg-transparent text-xs transition-colors focus-within:ring-1',
    disabled &&
      'disabled:bg-input/50 dark:disabled:bg-input/80 pointer-events-none cursor-not-allowed opacity-50',
    className
  )}
>
  <input
    bind:this={yearRef}
    type="text"
    inputmode="numeric"
    {disabled}
    value={value.year}
    oninput={(e) => onInput('year', e)}
    onkeydown={(e) => onKeydown('year', e)}
    placeholder="196"
    class={cn(
      'placeholder:text-muted-foreground h-full w-12 bg-transparent px-2.5 text-center text-xs outline-none',
      !yearValid && 'text-destructive'
    )}
  />
  <span class="text-muted-foreground text-xs select-none">/</span>
  <input
    bind:this={monthRef}
    type="text"
    inputmode="numeric"
    maxlength={2}
    {disabled}
    value={value.month}
    oninput={(e) => onInput('month', e)}
    onkeydown={(e) => onKeydown('month', e)}
    placeholder="01"
    class={cn(
      'placeholder:text-muted-foreground h-full w-8 bg-transparent px-1 text-center text-xs outline-none',
      !monthValid && 'text-destructive'
    )}
  />
  <span class="text-muted-foreground text-xs select-none">/</span>
  <input
    bind:this={dayRef}
    type="text"
    inputmode="numeric"
    maxlength={2}
    {disabled}
    value={value.day}
    oninput={(e) => onInput('day', e)}
    onkeydown={(e) => onKeydown('day', e)}
    placeholder="29"
    class={cn(
      'placeholder:text-muted-foreground h-full w-8 bg-transparent px-1 text-center text-xs outline-none',
      !dayValid() && 'text-destructive'
    )}
  />
</div>
