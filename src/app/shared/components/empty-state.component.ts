import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Shown when a view has loaded successfully but has nothing to display. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <div class="icon" aria-hidden="true">{{ icon() }}</div>
      <h3>{{ title() }}</h3>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      @if (actionLabel()) {
        <button type="button" class="btn-ghost" (click)="action.emit()">{{ actionLabel() }}</button>
      }
    </div>
  `,
  styles: [
    `
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 64px 24px;
        text-align: center;
      }

      .icon {
        font-size: 3rem;
        line-height: 1;
        opacity: 0.55;
        margin-bottom: 4px;
      }

      h3 {
        color: var(--text-primary);
      }

      p {
        color: var(--text-muted);
        max-width: 42ch;
        font-size: 0.9375rem;
      }

      button {
        margin-top: 10px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input<string>('🎵');
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly actionLabel = input<string>('');
  readonly action = output<void>();
}
