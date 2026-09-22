import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Track } from '../../core/models/music.models';
import { MusicCardComponent } from './music-card.component';

/**
 * Responsive grid of track cards.
 *
 * <p>Uses auto-fill with a minimum column width, so the layout adapts from a phone to a
 * wide desktop without any breakpoint-specific column counts.
 */
@Component({
  selector: 'app-music-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MusicCardComponent],
  template: `
    <div class="grid" [style.--min-col.px]="minColumnWidth()">
      @for (track of tracks(); track track.id) {
        <app-music-card [track]="track" [queue]="tracks()" />
      }
    </div>
  `,
  styles: [
    `
      .grid {
        --min-col: 180px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(var(--min-col), 1fr));
        gap: 18px;
      }

      @media (max-width: 640px) {
        .grid {
          /* Two columns stay readable down to a 320px viewport. */
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }
      }
    `,
  ],
})
export class MusicGridComponent {
  readonly tracks = input.required<Track[]>();
  readonly minColumnWidth = input<number>(180);
}
