import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { formatDuration } from '../../core/utils/format';

/**
 * Seekable progress bar.
 *
 * <p>While the user drags, the bar shows the dragged position rather than the audio
 * element's own time, so the handle does not fight the playhead. The seek is emitted
 * once on release.
 */
@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="progress">
      @if (showTimes()) {
        <span class="time">{{ elapsedLabel() }}</span>
      }

      <div
        class="track"
        role="slider"
        tabindex="0"
        aria-label="Seek"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="duration()"
        [attr.aria-valuenow]="displayTime()"
        [attr.aria-valuetext]="elapsedLabel() + ' of ' + durationLabel()"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
        (keydown)="onKeyDown($event)"
      >
        <div class="rail">
          <div class="fill" [style.width.%]="percent()"></div>
          <div class="handle" [style.left.%]="percent()"></div>
        </div>
      </div>

      @if (showTimes()) {
        <span class="time">{{ durationLabel() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .progress {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
      }

      .time {
        font-size: 0.75rem;
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
        min-width: 40px;
        text-align: center;
        flex-shrink: 0;
      }

      .track {
        flex: 1;
        min-width: 0;
        /* A tall, transparent hit area makes a 4px bar easy to grab. */
        padding: 8px 0;
        cursor: pointer;
        touch-action: none;
      }

      .rail {
        position: relative;
        height: 4px;
        background: var(--border-strong);
        border-radius: var(--radius-full);
        transition: height var(--transition-fast);
      }

      .track:hover .rail,
      .track:focus-visible .rail {
        height: 6px;
      }

      .fill {
        height: 100%;
        background: var(--gradient-aurora);
        border-radius: var(--radius-full);
      }

      .handle {
        position: absolute;
        top: 50%;
        width: 13px;
        height: 13px;
        margin-left: -6.5px;
        background: var(--text-primary);
        border-radius: 50%;
        box-shadow: var(--shadow-sm);
        transform: translateY(-50%) scale(0);
        transition: transform var(--transition-fast);
      }

      .track:hover .handle,
      .track:focus-visible .handle {
        transform: translateY(-50%) scale(1);
      }
    `,
  ],
})
export class ProgressBarComponent {
  readonly currentTime = input<number>(0);
  readonly duration = input<number>(0);
  readonly showTimes = input<boolean>(true);

  /** Emitted with an absolute position in seconds. */
  readonly seek = output<number>();

  /** Position being dragged, or null when not dragging. */
  private readonly dragTime = signal<number | null>(null);

  /** The time to display: the dragged position takes precedence over playback. */
  readonly displayTime = computed(() => this.dragTime() ?? this.currentTime());

  readonly percent = computed(() => {
    const duration = this.duration();
    return duration > 0 ? Math.min((this.displayTime() / duration) * 100, 100) : 0;
  });

  readonly elapsedLabel = computed(() => formatDuration(this.displayTime()));
  readonly durationLabel = computed(() => formatDuration(this.duration()));

  onPointerDown(event: PointerEvent): void {
    if (this.duration() <= 0) {
      return;
    }
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.dragTime.set(this.timeFromEvent(event));
  }

  onPointerMove(event: PointerEvent): void {
    if (this.dragTime() === null) {
      return;
    }
    this.dragTime.set(this.timeFromEvent(event));
  }

  onPointerUp(event: PointerEvent): void {
    const time = this.dragTime();
    if (time === null) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    this.dragTime.set(null);
    this.seek.emit(time);
  }

  /** Arrow keys nudge by five seconds; Home and End jump to the ends. */
  onKeyDown(event: KeyboardEvent): void {
    const duration = this.duration();
    if (duration <= 0) {
      return;
    }

    const step = 5;
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
        next = Math.min(this.currentTime() + step, duration);
        break;
      case 'ArrowLeft':
        next = Math.max(this.currentTime() - step, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = duration;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.seek.emit(next);
  }

  /** Maps a pointer position onto a time within the track. */
  private timeFromEvent(event: PointerEvent): number {
    const rail = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = rail.width > 0 ? (event.clientX - rail.left) / rail.width : 0;
    return Math.min(Math.max(ratio, 0), 1) * this.duration();
  }
}
