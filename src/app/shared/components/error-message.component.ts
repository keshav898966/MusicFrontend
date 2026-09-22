import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Shown when a request fails, with an optional retry. */
@Component({
  selector: 'app-error-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="error" role="alert">
      <div class="icon" aria-hidden="true">⚠️</div>
      <div class="body">
        <h3>{{ title() }}</h3>
        <p>{{ message() }}</p>
      </div>
      @if (showRetry()) {
        <button type="button" class="btn-ghost" (click)="retry.emit()">Try again</button>
      }
    </div>
  `,
  styles: [
    `
      .error {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 22px;
        margin: 16px 0;
        background: rgba(248, 113, 113, 0.08);
        border: 1px solid rgba(248, 113, 113, 0.28);
        border-radius: var(--radius-md);
      }

      .icon {
        font-size: 1.5rem;
        line-height: 1;
      }

      .body {
        flex: 1;
        min-width: 0;
      }

      h3 {
        font-size: 1rem;
        color: var(--danger);
        margin-bottom: 2px;
      }

      p {
        color: var(--text-secondary);
        font-size: 0.875rem;
      }

      @media (max-width: 560px) {
        .error {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class ErrorMessageComponent {
  readonly title = input<string>('Something went wrong');
  readonly message = input.required<string>();
  readonly showRetry = input<boolean>(true);
  readonly retry = output<void>();
}
