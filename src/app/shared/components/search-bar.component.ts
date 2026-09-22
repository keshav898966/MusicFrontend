import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Search input with submit-on-Enter and a clear button. */
@Component({
  selector: 'app-search-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <form class="search" role="search" (ngSubmit)="onSubmit()">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" stroke-linecap="round" />
        </svg>
      </span>

      <input
        #input
        type="search"
        name="query"
        autocomplete="off"
        [placeholder]="placeholder()"
        [attr.aria-label]="placeholder()"
        [(ngModel)]="value"
        (input)="queryChange.emit(value)"
      />

      @if (value) {
        <button type="button" class="clear" aria-label="Clear search" (click)="onClear()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
          </svg>
        </button>
      }

      @if (showButton()) {
        <button type="submit" class="submit">Search</button>
      }
    </form>
  `,
  styles: [
    `
      .search {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 0 6px 0 14px;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        transition: border-color var(--transition-fast), background var(--transition-fast);
      }

      .search:focus-within {
        border-color: var(--accent);
        background: var(--bg-hover);
      }

      .icon {
        display: grid;
        place-items: center;
        color: var(--text-muted);
        flex-shrink: 0;
      }

      .icon svg {
        width: 18px;
        height: 18px;
      }

      input {
        flex: 1;
        min-width: 0;
        padding: 11px 0;
        background: none;
        border: none;
        color: var(--text-primary);
        outline: none;
      }

      input::placeholder {
        color: var(--text-muted);
      }

      /* Hide the native clear affordance in favour of the styled one. */
      input::-webkit-search-cancel-button {
        display: none;
      }

      .clear {
        display: grid;
        place-items: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        color: var(--text-muted);
        flex-shrink: 0;
      }

      .clear:hover {
        color: var(--text-primary);
        background: var(--bg-active);
      }

      .clear svg {
        width: 15px;
        height: 15px;
      }

      .submit {
        padding: 8px 18px;
        background: var(--gradient-aurora);
        color: var(--text-on-accent);
        font-weight: 600;
        font-size: 0.875rem;
        border-radius: var(--radius-full);
        flex-shrink: 0;
        transition: transform var(--transition-fast);
      }

      .submit:hover {
        transform: scale(1.04);
      }

      @media (max-width: 560px) {
        .submit {
          display: none; /* Enter submits; the button is redundant on mobile */
        }
      }
    `,
  ],
})
export class SearchBarComponent {
  readonly placeholder = input<string>('Search tracks and artists');
  readonly showButton = input<boolean>(false);
  readonly initialValue = input<string>('');

  /** Emitted on submit (Enter or the button). */
  readonly searchSubmit = output<string>();
  /** Emitted on every keystroke, for debounced live search. */
  readonly queryChange = output<string>();

  value = '';

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('input');

  constructor() {
    // Adopt the initial value once, e.g. when arriving with ?q= in the URL.
    queueMicrotask(() => {
      if (this.initialValue() && !this.value) {
        this.value = this.initialValue();
      }
    });
  }

  onSubmit(): void {
    const trimmed = this.value.trim();
    if (trimmed) {
      this.searchSubmit.emit(trimmed);
    }
  }

  onClear(): void {
    this.value = '';
    this.queryChange.emit('');
    this.inputRef()?.nativeElement.focus();
  }

  /** Lets a parent page focus the field, e.g. on a keyboard shortcut. */
  focus(): void {
    this.inputRef()?.nativeElement.focus();
  }
}
