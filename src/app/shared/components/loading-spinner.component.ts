import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Indeterminate loading indicator with an optional caption. */
@Component({
  selector: 'app-loading-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" [class.inline]="inline()" role="status" aria-live="polite">
      <div class="spinner" [style.--size.px]="size()"></div>
      @if (message()) {
        <p class="message">{{ message() }}</p>
      }
      <span class="visually-hidden">Loading</span>
    </div>
  `,
  styles: [
    `
      .wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 48px 16px;
      }

      .wrap.inline {
        padding: 16px;
        flex-direction: row;
      }

      .spinner {
        --size: 36px;
        width: var(--size);
        height: var(--size);
        border: 3px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 720ms linear infinite;
      }

      .message {
        color: var(--text-muted);
        font-size: 0.875rem;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class LoadingSpinnerComponent {
  readonly message = input<string>('');
  readonly size = input<number>(36);
  readonly inline = input<boolean>(false);
}
