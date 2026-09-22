import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Fallback page for unmatched routes. */
@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="not-found">
      <span class="glyph" aria-hidden="true">♪</span>
      <h1>Page not found</h1>
      <p>That link does not lead anywhere. The music is still playing, though.</p>
      <a class="btn-accent" routerLink="/">Back to home</a>
    </div>
  `,
  styles: [
    `
      .not-found {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        min-height: 60vh;
        text-align: center;
      }

      .glyph {
        font-size: 4rem;
        line-height: 1;
        background: var(--gradient-aurora);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      p {
        color: var(--text-muted);
        max-width: 44ch;
      }

      a {
        margin-top: 10px;
      }
    `,
  ],
})
export class NotFoundComponent {}
